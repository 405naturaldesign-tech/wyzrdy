import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = process.env.GEMINI_VLM_MODEL || 'gemini-1.5-pro';
const MAX_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 2048);
const QUOTA = process.env.QUOTA_GEMINI_DAILY_REQUESTS;

const name = 'gemini';

function isConfigured() {
	return Boolean(API_KEY);
}

async function generate({ prompt, model } = {}) {
	if (!isConfigured()) throw new Error('[gemini] GEMINI_API_KEY is not set in apps/api/.env');
	if (!prompt) throw new Error('[gemini] prompt is required');
	enforceQuota(name, QUOTA);
	const m = model || MODEL;
	const res = await requestWithRetry(`${BASE_URL}/models/${m}:generateContent?key=${API_KEY}`, {
		method: 'POST', integration: name, timeoutMs: 40000,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: MAX_TOKENS } }),
	});
	const body = await parseBody(res);
	if (!res.ok) throw new Error(`[gemini] generate failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	logger.info('[gemini] generateContent ok');
	return body;
}

async function verify() {
	if (!isConfigured()) {
		return { name, label: 'Gemini VLM', configured: false, reachable: false, status: 'not_configured', detail: 'GEMINI_API_KEY missing' };
	}
	try {
		const res = await requestWithRetry(`${BASE_URL}/models?key=${API_KEY}`, { method: 'GET', integration: name, timeoutMs: 15000 });
		const ok = res.ok;
		if (!ok) await parseBody(res);
		return { name, label: 'Gemini VLM', configured: true, reachable: ok, status: ok ? 'ok' : 'error', detail: `${res.status} ${res.statusText}`, model: MODEL };
	} catch (err) {
		return { name, label: 'Gemini VLM', configured: true, reachable: false, status: 'error', detail: err.message };
	}
}

export default { name, isConfigured, verify, generate, defaultModel: MODEL };
