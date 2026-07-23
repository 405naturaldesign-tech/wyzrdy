import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.COMPOSIO_API_KEY;
const BASE_URL = process.env.COMPOSIO_API_BASE_URL || 'https://backend.composio.dev/api/v3';
const ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || 'all';
const ENABLED_TOOLKITS = process.env.COMPOSIO_ENABLED_TOOLKITS || 'all';
const QUOTA = process.env.QUOTA_COMPOSIO_DAILY_REQUESTS;

const name = 'composio';

function isConfigured() {
	return Boolean(API_KEY);
}

function headers() {
	return { 'x-api-key': API_KEY, 'Content-Type': 'application/json' };
}

async function listToolkits({ limit = 50 } = {}) {
	if (!isConfigured()) throw new Error('[composio] COMPOSIO_API_KEY is not set in apps/api/.env');
	enforceQuota(name, QUOTA);
	const res = await requestWithRetry(`${BASE_URL}/toolkits?limit=${limit}`, {
		method: 'GET', integration: name, timeoutMs: 30000, headers: headers(),
	});
	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[composio] listToolkits failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	}
	logger.info('[composio] listToolkits ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Composio', configured: false, reachable: false, status: 'not_configured', detail: 'COMPOSIO_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/toolkits?limit=1`, {
			method: 'GET', integration: name, timeoutMs: 20000, headers: headers(),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return {
			name, label: 'Composio', configured: true, reachable: ok, status: ok ? 'ok' : 'error',
			detail: `${res.status} ${res.statusText}`, entityId: ENTITY_ID, toolkits: ENABLED_TOOLKITS,
		};
	} catch (err) {
		return { name, label: 'Composio', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, listToolkits, entityId: ENTITY_ID };
