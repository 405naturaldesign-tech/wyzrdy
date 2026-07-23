/**
 * Lightweight in-process request metrics for the performance dashboard.
 * Tracks total requests, error counts, and a rolling window of latencies to
 * compute throughput and p95/p99. In-memory only (single-instance sandbox).
 */
const MAX_SAMPLES = 2000;
const startedAt = Date.now();

const state = {
	total: 0,
	errors: 0,
	byStatus: {},
	byRoute: {},
	latencies: [], // rolling window of ms
	recent: [], // {t, ms} for throughput windows
};

export function recordRequest({ route, status, ms }) {
	state.total += 1;
	if (status >= 400) state.errors += 1;
	state.byStatus[status] = (state.byStatus[status] || 0) + 1;
	state.byRoute[route] = (state.byRoute[route] || 0) + 1;

	state.latencies.push(ms);
	if (state.latencies.length > MAX_SAMPLES) state.latencies.shift();

	const now = Date.now();
	state.recent.push({ t: now, ms });
	// keep only last 60s of samples for throughput
	const cutoff = now - 60_000;
	while (state.recent.length && state.recent[0].t < cutoff) state.recent.shift();
}

function percentile(sorted, p) {
	if (!sorted.length) return 0;
	const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
	return Math.round(sorted[idx] * 100) / 100;
}

export function snapshot() {
	const sorted = [...state.latencies].sort((a, b) => a - b);
	const now = Date.now();
	const last1s = state.recent.filter((r) => r.t >= now - 1000).length;
	const last60s = state.recent.length;
	const mem = process.memoryUsage();
	const cpu = process.cpuUsage();

	return {
		uptimeSec: Math.round((now - startedAt) / 1000),
		total: state.total,
		errors: state.errors,
		errorRate: state.total ? Math.round((state.errors / state.total) * 10000) / 100 : 0,
		throughputPerSec: last1s,
		throughputPerMin: last60s,
		latency: {
			count: sorted.length,
			avg: sorted.length ? Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100 : 0,
			min: sorted.length ? Math.round(sorted[0] * 100) / 100 : 0,
			max: sorted.length ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0,
			p50: percentile(sorted, 50),
			p95: percentile(sorted, 95),
			p99: percentile(sorted, 99),
		},
		byStatus: state.byStatus,
		byRoute: state.byRoute,
		memory: {
			rssMB: Math.round((mem.rss / 1048576) * 100) / 100,
			heapUsedMB: Math.round((mem.heapUsed / 1048576) * 100) / 100,
			heapTotalMB: Math.round((mem.heapTotal / 1048576) * 100) / 100,
		},
		cpu: {
			userMs: Math.round(cpu.user / 1000),
			systemMs: Math.round(cpu.system / 1000),
		},
	};
}

export function metricsMiddleware(req, res, next) {
	const start = process.hrtime.bigint();
	res.on('finish', () => {
		const ms = Number(process.hrtime.bigint() - start) / 1e6;
		recordRequest({
			route: `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`,
			status: res.statusCode,
			ms,
		});
	});
	next();
}

export default { recordRequest, snapshot, metricsMiddleware };
