import { requestWithRetry, parseBody } from './lib/http.js';
import logger from '../utils/logger.js';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const ROOT_FOLDER = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

const name = 'googleDrive';

// Configured for API calls once we can mint an access token (needs a refresh token).
function isConfigured() {
	return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function getAccessToken() {
	if (!isConfigured()) throw new Error('[googleDrive] CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN not set in apps/api/.env');
	const res = await requestWithRetry('https://oauth2.googleapis.com/token', {
		method: 'POST', integration: name, timeoutMs: 15000,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
			refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
		}).toString(),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[googleDrive] token refresh failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	return body.access_token;
}

async function listFiles({ pageSize = 20 } = {}) {
	const token = await getAccessToken();
	const q = ROOT_FOLDER ? `&q='${ROOT_FOLDER}'+in+parents` : '';
	const res = await requestWithRetry(`https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}${q}`, {
		method: 'GET', integration: name, timeoutMs: 20000, headers: { Authorization: `Bearer ${token}` },
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[googleDrive] listFiles failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[googleDrive] listFiles ok');
	return body;
}

async function verify() {
	if (!CLIENT_ID || !CLIENT_SECRET) {
		return { name, label: 'Google Drive', configured: false, reachable: false, status: 'not_configured', detail: 'GOOGLE_DRIVE_CLIENT_ID / CLIENT_SECRET missing' };
	}
	if (!REFRESH_TOKEN) {
		return { name, label: 'Google Drive', configured: false, reachable: false, status: 'needs_oauth', detail: 'OAuth client set, but no refresh token — complete the OAuth flow to enable server-side access' };
	}
	try {
		await getAccessToken();
		return { name, label: 'Google Drive', configured: true, reachable: true, status: 'ok', detail: 'refresh token exchanged for access token' };
	} catch (err) {
		return { name, label: 'Google Drive', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, getAccessToken, listFiles };
