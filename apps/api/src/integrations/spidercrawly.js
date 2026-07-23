import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.SPIDERCRAWLY_API_KEY;
const BASE_URL = process.env.SPIDERCRAWLY_API_BASE_URL || 'https://api.spidercrawly.com/v1';
const QUOTA = process.env.QUOTA_SPIDERCRAWLY_DAILY_REQUESTS;

const name = 'spidercrawly';

function isConfigured() {
	return Boolean(API_KEY);
}

function headers() {
	return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

async function crawl({ url, limit = 10 } = {}) {
	if (!isConfigured()) throw new Error('[spidercrawly] SPIDERCRAWLY_API_KEY is not set in apps/api/.env');
	if (!url) throw new Error('[spidercrawly] url is required');
	enforceQuota(name, QUOTA);
	const res = await requestWithRetry(`${BASE_URL}/crawl`, {
		method: 'POST', integration: name, timeoutMs: 60000, headers: headers(),
		body: JSON.stringify({ url, limit }),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[spidercrawly] crawl failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[spidercrawly] crawl ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'SpiderCrawly', configured: false, reachable: false, status: 'not_configured', detail: 'SPIDERCRAWLY_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/crawl`, {
			method: 'POST', integration: name, timeoutMs: 20000, headers: headers(),
			body: JSON.stringify({ url: 'https://example.com', limit: 1 }),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'SpiderCrawly', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}` };
	} catch (err) {
		return { name, label: 'SpiderCrawly', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, crawl };
