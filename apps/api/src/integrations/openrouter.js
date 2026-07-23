import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'deepseek/deepseek-v4-flash';
const APP_NAME = process.env.OPENROUTER_APP_NAME || 'Wyzrdy';
const APP_URL = process.env.OPENROUTER_APP_URL || 'http://localhost:3000';
const QUOTA = process.env.QUOTA_OPENROUTER_DAILY_REQUESTS;

const name = 'openrouter';

function isConfigured() {
	return Boolean(API_KEY);
}

function headers() {
	return {
		Authorization: `Bearer ${API_KEY}`,
		'Content-Type': 'application/json',
		'HTTP-Referer': APP_URL,
		'X-Title': APP_NAME,
	};
}

async function chat({ messages, model, maxTokens = 512, temperature = 0.7 } = {}) {
	if (!isConfigured()) throw new Error('[openrouter] OPENROUTER_API_KEY is not set in apps/api/.env');
	if (!Array.isArray(messages) || messages.length === 0) {
		throw new Error('[openrouter] messages array is required');
	}
	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/chat/completions`, {
		method: 'POST',
		integration: name,
		timeoutMs: 40000,
		headers: headers(),
		body: JSON.stringify({ model: model || DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
	});
	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[openrouter] chat failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	}
	logger.info('[openrouter] chat completion ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'OpenRouter', configured: false, reachable: false, status: 'not_configured', detail: 'OPENROUTER_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/key`, {
			method: 'GET', integration: name, timeoutMs: 15000, headers: headers(),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'OpenRouter', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, model: DEFAULT_MODEL };
	} catch (err) {
		return { name, label: 'OpenRouter', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, chat, defaultModel: DEFAULT_MODEL };
