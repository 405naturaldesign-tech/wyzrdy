import { randomUUID } from 'node:crypto';
import { getTier } from '../config/tiers.js';
import logger from '../utils/logger.js';

/**
 * Attach a correlation id to every request for tracing. Echoed back in the
 * `X-Correlation-Id` response header so clients and logs can be joined.
 */
export function correlationId(req, res, next) {
	const id = req.headers['x-correlation-id'] || randomUUID();
	req.correlationId = id;
	res.set('X-Correlation-Id', id);
	next();
}

/**
 * Per-tier rate limiting. Enforces BOTH a per-minute and a per-day sliding
 * window derived from the authenticated user's subscription tier. Requires
 * `requireAuth` to have populated `req.user` first. Enterprise (null limits)
 * bypasses enforcement.
 *
 * In-memory only (single-instance sandbox). Counters reset on restart.
 */
const minuteHits = new Map();
const dayHits = new Map();

function bump(store, key, windowMs, now) {
	const rec = store.get(key) || { count: 0, reset: now + windowMs };
	if (now > rec.reset) {
		rec.count = 0;
		rec.reset = now + windowMs;
	}
	rec.count += 1;
	store.set(key, rec);
	return rec;
}

export function tierRateLimit(req, res, next) {
	const tier = getTier(req.user?.subscription_tier);
	const { reqPerMin, reqPerDay } = tier.limits;
	const key = req.userId || req.ip || 'anon';
	const now = Date.now();

	res.set('X-Tier', tier.id);

	const perMin = bump(minuteHits, `${key}:min`, 60_000, now);
	const perDay = bump(dayHits, `${key}:day`, 86_400_000, now);

	if (reqPerMin != null) {
		res.set('X-RateLimit-Limit-Minute', String(reqPerMin));
		res.set('X-RateLimit-Remaining-Minute', String(Math.max(0, reqPerMin - perMin.count)));
	}
	if (reqPerDay != null) {
		res.set('X-RateLimit-Limit-Day', String(reqPerDay));
		res.set('X-RateLimit-Remaining-Day', String(Math.max(0, reqPerDay - perDay.count)));
	}

	if (reqPerMin != null && perMin.count > reqPerMin) {
		const retryAfter = Math.ceil((perMin.reset - now) / 1000);
		res.set('Retry-After', String(retryAfter));
		logger.warn(`[tier] ${tier.id} minute limit hit user=${key} cid=${req.correlationId}`);
		return res.status(429).json({
			error: `You've reached the ${tier.name} per-minute limit (${reqPerMin}/min). Upgrade your plan for higher throughput.`,
			tier: tier.id,
			limit: reqPerMin,
			window: 'minute',
			retryAfter,
		});
	}
	if (reqPerDay != null && perDay.count > reqPerDay) {
		const retryAfter = Math.ceil((perDay.reset - now) / 1000);
		res.set('Retry-After', String(retryAfter));
		logger.warn(`[tier] ${tier.id} daily limit hit user=${key} cid=${req.correlationId}`);
		return res.status(429).json({
			error: `You've reached the ${tier.name} daily limit (${reqPerDay}/day). Upgrade your plan to continue.`,
			tier: tier.id,
			limit: reqPerDay,
			window: 'day',
			retryAfter,
		});
	}

	next();
}

/**
 * Gate a route behind a boolean tier feature flag (e.g. `apiAccess`).
 */
export function requireFeature(feature) {
	return (req, res, next) => {
		const tier = getTier(req.user?.subscription_tier);
		if (!tier.features[feature]) {
			return res.status(403).json({
				error: `The "${feature}" capability is not available on the ${tier.name} plan. Upgrade to unlock it.`,
				tier: tier.id,
				feature,
			});
		}
		next();
	};
}

export default tierRateLimit;
