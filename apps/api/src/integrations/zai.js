import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.ZAI_API_KEY;
const BASE_URL = process.env.ZAI_API_BASE_URL || 'https://api.z.ai/api/paas/v4';
const DEFAULT_MODEL = process.env.ZAI_DEFAULT_MODEL || 'GLM-4.7-Flash';
const TIMEOUT_MS = Number(process.env.ZAI_TIMEOUT_MS || 30000);
const QUOTA = process.env.QUOTA_ZAI_DAILY_REQUESTS;

const name = 'zai';

function isConfigured() {
	return Boolean(API_KEY);
}

async function chat({ messages, model, maxTokens = 512, temperature = 0.7 } = {}) {
	if (!isConfigured()) throw new Error('[zai] ZAI_API_KEY is not set in apps/api/.env');
	if (!Array.isArray(messages) || messages.length === 0) {
		throw new Error('[zai] messages array is required');
	}
	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/chat/completions`, {
		method: 'POST',
		integration: name,
		timeoutMs: TIMEOUT_MS,
		headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ model: model || DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
	});
	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[zai] chat failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	}
	logger.info('[zai] chat completion ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Z.ai (GLM)', configured: false, reachable: false, status: 'not_configured', detail: 'ZAI_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/chat/completions`, {
			method: 'POST',
			integration: name,
			timeoutMs: TIMEOUT_MS,
			headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
		});
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'Z.ai (GLM)', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, model: DEFAULT_MODEL };
	} catch (err) {
		return { name, label: 'Z.ai (GLM)', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, chat, defaultModel: DEFAULT_MODEL };
