import { requestWithRetry, parseBody } from './lib/http.js';
import logger from '../utils/logger.js';

const BASE_URL = process.env.OBSIDIAN_API_BASE_URL || 'https://127.0.0.1:27124';
const TOKEN = process.env.OBSIDIAN_API_TOKEN;
const VAULT = process.env.OBSIDIAN_VAULT_NAME;
const ALLOW_SELF_SIGNED = String(process.env.OBSIDIAN_ALLOW_SELF_SIGNED_CERT || 'true') === 'true';

const name = 'obsidian';

function isConfigured() {
	return Boolean(TOKEN);
}

function headers() {
	return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

async function listNotes() {
	if (!isConfigured()) throw new Error('[obsidian] OBSIDIAN_API_TOKEN is not set in apps/api/.env');
	if (ALLOW_SELF_SIGNED) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	const res = await requestWithRetry(`${BASE_URL.replace(/\/$/, '')}/vault/`, {
		method: 'GET', integration: name, timeoutMs: 15000, headers: headers(),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[obsidian] listNotes failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[obsidian] listNotes ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Obsidian API', configured: false, reachable: false, status: 'not_configured', detail: 'OBSIDIAN_API_TOKEN missing (Local REST API plugin required)' };
	}
	try {
		if (ALLOW_SELF_SIGNED) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		const res = await requestWithRetry(BASE_URL, { method: 'GET', integration: name, timeoutMs: 10000, headers: headers() });
		return { name, label: 'Obsidian API', configured: true, reachable: res.ok, status: res.ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, vault: VAULT || null };
	} catch (err) {
		return { name, label: 'Obsidian API', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, listNotes };
