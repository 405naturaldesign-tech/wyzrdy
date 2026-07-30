import rateLimit from 'express-rate-limit';

export const globalRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	validate: { trustProxy: false },
	// Internal monitoring/load-test endpoints are self-throttled on the
	// client and the load test intentionally fires hundreds/thousands of
	// requests — they must not share the global per-IP budget, or the
	// metrics dashboard gets starved out by its own load test / polling.
	skip: (req) => req.path.startsWith('/perf/'),
});
