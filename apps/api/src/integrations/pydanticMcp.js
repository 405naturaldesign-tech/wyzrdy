import { requestWithRetry, parseBody } from './lib/http.js';
import logger from '../utils/logger.js';

const SERVER_URL = process.env.PYDANTIC_MCP_SERVER_URL;
const API_KEY = process.env.PYDANTIC_MCP_API_KEY;
const NAMESPACE = process.env.PYDANTIC_MCP_NAMESPACE || 'default';
const TIMEOUT_MS = Number(process.env.PYDANTIC_MCP_TIMEOUT_MS || 20000);

const name = 'pydanticMcp';

function isConfigured() {
	return Boolean(SERVER_URL && API_KEY);
}

function headers() {
	return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

async function extract({ schema, content } = {}) {
	if (!isConfigured()) throw new Error('[pydanticMcp] PYDANTIC_MCP_SERVER_URL / PYDANTIC_MCP_API_KEY not set in apps/api/.env');
	if (!schema || !content) throw new Error('[pydanticMcp] schema and content are required');
	const res = await requestWithRetry(`${SERVER_URL.replace(/\/$/, '')}/extract`, {
		method: 'POST', integration: name, timeoutMs: TIMEOUT_MS, headers: headers(),
		body: JSON.stringify({ namespace: NAMESPACE, schema, content }),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[pydanticMcp] extract failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[pydanticMcp] extract ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Pydantic MCP', configured: false, reachable: false, status: 'not_configured', detail: 'PYDANTIC_MCP_SERVER_URL / PYDANTIC_MCP_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(SERVER_URL, { method: 'GET', integration: name, timeoutMs: 15000, headers: headers() });
		return { name, label: 'Pydantic MCP', configured: true, reachable: res.ok, status: res.ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, namespace: NAMESPACE };
	} catch (err) {
		return { name, label: 'Pydantic MCP', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, extract };
