import { requestWithRetry, parseBody } from './lib/http.js';
import logger from '../utils/logger.js';

const SERVICE_URL = process.env.BS4_SERVICE_URL;
const API_KEY = process.env.BS4_SERVICE_API_KEY;
const PARSER = process.env.BS4_DEFAULT_PARSER || 'html.parser';

const name = 'bs4';

// BeautifulSoup4 is Python; this Express service talks to an optional sidecar.
function isConfigured() {
	return Boolean(SERVICE_URL);
}

function headers() {
	const h = { 'Content-Type': 'application/json' };
	if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
	return h;
}

async function parse({ html, selector, parser } = {}) {
	if (!isConfigured()) throw new Error('[bs4] BS4_SERVICE_URL is not set in apps/api/.env (requires a Python BS4 sidecar)');
	if (!html) throw new Error('[bs4] html is required');
	const res = await requestWithRetry(`${SERVICE_URL.replace(/\/$/, '')}/parse`, {
		method: 'POST', integration: name, timeoutMs: 20000, headers: headers(),
		body: JSON.stringify({ html, selector, parser: parser || PARSER }),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[bs4] parse failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[bs4] parse ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Beautiful Soup 4', configured: false, reachable: false, status: 'not_configured', detail: 'BS4_SERVICE_URL missing (Python sidecar not provisioned)' };
	}
	try {
		const res = await requestWithRetry(SERVICE_URL, { method: 'GET', integration: name, timeoutMs: 15000, headers: headers() });
		return { name, label: 'Beautiful Soup 4', configured: true, reachable: res.ok, status: res.ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, parser: PARSER };
	} catch (err) {
		return { name, label: 'Beautiful Soup 4', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, parse };
