import logger from '../../utils/logger.js';

const MAX_ATTEMPTS = Number(process.env.INTEGRATION_RETRY_MAX_ATTEMPTS || 3);
const BASE_DELAY_MS = Number(process.env.INTEGRATION_RETRY_BASE_DELAY_MS || 500);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch wrapper with timeout, exponential backoff retry, and logging.
 * Retries on network errors and 429 / 5xx responses. Returns the Response.
 * Callers must still check response.ok and throw for non-retryable failures.
 */
export async function requestWithRetry(url, options = {}, meta = {}) {
	const {
		timeoutMs = 30000,
		maxAttempts = MAX_ATTEMPTS,
		integration = meta.integration || 'integration',
		...fetchOptions
	} = options;

	let lastError;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
			clearTimeout(timer);

			if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
				const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
				logger.warn(`[${integration}] ${response.status} ${response.statusText} — retry ${attempt}/${maxAttempts} in ${delay}ms`);
				await sleep(delay);
				continue;
			}
			return response;
		} catch (err) {
			clearTimeout(timer);
			lastError = err;
			if (attempt < maxAttempts) {
				const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
				logger.warn(`[${integration}] request error "${err.message}" — retry ${attempt}/${maxAttempts} in ${delay}ms`);
				await sleep(delay);
				continue;
			}
		}
	}
	throw new Error(`[${integration}] request failed after ${maxAttempts} attempts: ${lastError?.message || 'unknown error'}`);
}

/** Parse JSON safely; return text if not JSON. */
export async function parseBody(response) {
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
