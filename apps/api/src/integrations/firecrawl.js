import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.FIRECRAWL_API_KEY;
const BASE_URL = process.env.FIRECRAWL_API_BASE_URL || 'https://api.firecrawl.dev/v1';
const TIMEOUT_MS = Number(process.env.FIRECRAWL_TIMEOUT_MS || 60000);
const QUOTA = process.env.QUOTA_FIRECRAWL_DAILY_REQUESTS;

const name = 'firecrawl';

function isConfigured() {
	return Boolean(API_KEY);
}

function headers() {
	return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

async function scrape({ url, formats = ['markdown'] } = {}) {
	if (!isConfigured()) throw new Error('[firecrawl] FIRECRAWL_API_KEY is not set in apps/api/.env');
	if (!url) throw new Error('[firecrawl] url is required');
	enforceQuota(name, QUOTA);
	const res = await requestWithRetry(`${BASE_URL}/scrape`, {
		method: 'POST', integration: name, timeoutMs: TIMEOUT_MS, headers: headers(),
		body: JSON.stringify({ url, formats }),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[firecrawl] scrape failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[firecrawl] scrape ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Firecrawl', configured: false, reachable: false, status: 'not_configured', detail: 'FIRECRAWL_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/scrape`, {
			method: 'POST', integration: name, timeoutMs: 20000, headers: headers(),
			body: JSON.stringify({ url: 'https://example.com' }),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'Firecrawl', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}` };
	} catch (err) {
		return { name, label: 'Firecrawl', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, scrape };
