import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.CLAUDE_API_KEY;
const MCP_URL = process.env.CLAUDE_MCP_SERVER_URL;
const DEFAULT_MODEL = process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022';
const API_VERSION = process.env.CLAUDE_API_VERSION || '2023-06-01';
const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 4096);
const QUOTA = process.env.QUOTA_CLAUDE_DAILY_REQUESTS;

const name = 'claude';

function isConfigured() {
	return Boolean(API_KEY || MCP_URL);
}

async function chat({ messages, model, maxTokens } = {}) {
	if (!API_KEY) throw new Error('[claude] CLAUDE_API_KEY is not set in apps/api/.env');
	if (!Array.isArray(messages) || messages.length === 0) {
		throw new Error('[claude] messages array is required');
	}
	enforceQuota(name, QUOTA);
	const res = await requestWithRetry('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		integration: name,
		timeoutMs: 40000,
		headers: { 'x-api-key': API_KEY, 'anthropic-version': API_VERSION, 'Content-Type': 'application/json' },
		body: JSON.stringify({ model: model || DEFAULT_MODEL, max_tokens: maxTokens || MAX_TOKENS, messages }),
	});
	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[claude] chat failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	}
	logger.info('[claude] message completion ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Claude MCP', configured: false, reachable: false, status: 'not_configured', detail: 'CLAUDE_API_KEY and CLAUDE_MCP_SERVER_URL both missing' };
	}
	// Prefer verifying the MCP endpoint if configured, else the Anthropic API key.
	try {
		if (MCP_URL) {
			const res = await requestWithRetry(MCP_URL, { method: 'GET', integration: name, timeoutMs: 15000 });
			return { name, label: 'Claude MCP', configured: true, reachable: res.ok, status: res.ok ? 'ok' : 'error', detail: `MCP ${res.status} ${res.statusText}` };
		}
		const res = await requestWithRetry('https://api.anthropic.com/v1/messages', {
			method: 'POST', integration: name, timeoutMs: 20000,
			headers: { 'x-api-key': API_KEY, 'anthropic-version': API_VERSION, 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'Claude MCP', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, model: DEFAULT_MODEL };
	} catch (err) {
		return { name, label: 'Claude MCP', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, chat, defaultModel: DEFAULT_MODEL };
