import Pocketbase from 'pocketbase';
import logger from '../utils/logger.js';

const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

/**
 * Require a valid PocketBase user session.
 *
 * The frontend sends the user's PocketBase JWT in `Authorization: Bearer <token>`.
 * We verify it against PocketBase (authRefresh) and attach `req.user`. Only
 * authenticated users can consume credit-bearing routes (AI, scrape, composio).
 */
export async function requireAuth(req, res, next) {
	const header = req.headers.authorization || '';
	const token = header.replace(/^Bearer\s+/i, '').trim();
	if (!token) {
		return res.status(401).json({ error: 'Authentication required. Please sign in.' });
	}

	const pb = new Pocketbase(PB_URL);
	pb.autoCancellation(false);
	pb.authStore.save(token, null);

	try {
		await pb.collection('users').authRefresh();
	} catch (_) {
		return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
	}

	if (!pb.authStore.isValid || !pb.authStore.record) {
		return res.status(401).json({ error: 'Invalid session.' });
	}

	req.user = pb.authStore.record;
	req.userId = pb.authStore.record.id;
	req.pbToken = token;
	logger.info(`[api] ${req.method} ${req.path} user=${req.userId} at ${new Date().toISOString()}`);
	next();
}

/**
 * Simple in-memory per-user sliding-window rate limiter. Keyed on the
 * authenticated user id (falls back to IP for unauthenticated probes).
 * Note: in-memory only — resets on process restart, which is acceptable for
 * this single-instance sandbox deployment.
 */
export function perUserRateLimit({ windowMs = 60_000, max = 30 } = {}) {
	const hits = new Map();
	return (req, res, next) => {
		const key = req.userId || req.ip || 'anon';
		const now = Date.now();
		const rec = hits.get(key) || { count: 0, reset: now + windowMs };
		if (now > rec.reset) {
			rec.count = 0;
			rec.reset = now + windowMs;
		}
		rec.count += 1;
		hits.set(key, rec);
		if (rec.count > max) {
			const retryAfter = Math.ceil((rec.reset - now) / 1000);
			res.set('Retry-After', String(retryAfter));
			return res.status(429).json({ error: 'Rate limit exceeded. Slow down.', retryAfter });
		}
		next();
	};
}

export default requireAuth;
