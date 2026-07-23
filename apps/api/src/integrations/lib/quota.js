import logger from '../../utils/logger.js';

// In-memory per-integration daily quota counter. Resets on UTC day change or
// process restart (the instance hibernates when idle, so this is best-effort).
const counters = new Map();

function today() {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Enforce a daily request quota for an integration. limit of 0 = unlimited.
 * Throws when the quota is exceeded so errorMiddleware handles the response.
 */
export function enforceQuota(integration, limit) {
	const max = Number(limit || 0);
	if (!max) return;

	const key = `${integration}:${today()}`;
	const used = counters.get(key) || 0;
	if (used >= max) {
		throw new Error(`[${integration}] daily quota of ${max} requests exceeded`);
	}
	counters.set(key, used + 1);
	if ((used + 1) % Math.max(1, Math.floor(max / 4)) === 0) {
		logger.info(`[${integration}] quota usage ${used + 1}/${max}`);
	}
}
