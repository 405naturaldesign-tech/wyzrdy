import { integrations } from '../integrations/index.js';
import logger from '../utils/logger.js';

// GET /monitor/health — scheduled-agent health check across all 12 integrations.
// Measures per-integration response time, reachability, and error state, and
// aggregates an overall status/error-rate summary the monitoring dashboard renders.
//
// NOTE ON SCHEDULING: this sandbox has no always-on process (the API hibernates
// when idle), so true server-side cron is not available here. The monitoring
// dashboard drives this endpoint on a 5-minute interval while open, and in a
// real production deployment this same endpoint is the target of an external
// scheduler (Render/Vercel/GitHub-Actions cron, Uptime bot, etc.).
export const health = async (req, res) => {
	const entries = Object.values(integrations);

	const checks = await Promise.all(
		entries.map(async (i) => {
			const start = Date.now();
			try {
				const r = await i.verify();
				const responseMs = Date.now() - start;
				return {
					name: i.name,
					label: r.label || i.name,
					configured: Boolean(r.configured),
					reachable: Boolean(r.reachable),
					status: r.status,
					detail: r.detail || '',
					responseMs,
					healthy: r.status === 'ok',
				};
			} catch (err) {
				logger.warn(`[monitor] ${i.name} verify threw: ${err.message}`);
				return {
					name: i.name,
					label: i.name,
					configured: false,
					reachable: false,
					status: 'error',
					detail: err.message,
					responseMs: Date.now() - start,
					healthy: false,
				};
			}
		}),
	);

	const total = checks.length;
	const healthy = checks.filter((c) => c.healthy).length;
	const configured = checks.filter((c) => c.configured).length;
	const degraded = checks.filter((c) => c.configured && !c.healthy).length;
	const notConfigured = total - configured;
	const avgResponseMs = total
		? Math.round(checks.reduce((s, c) => s + c.responseMs, 0) / total)
		: 0;
	const errorRate = total ? Number((((total - healthy) / total) * 100).toFixed(1)) : 0;

	let overall = 'operational';
	if (healthy === 0) overall = 'outage';
	else if (degraded > 0) overall = 'degraded';

	const summary = {
		total,
		healthy,
		configured,
		notConfigured,
		degraded,
		avgResponseMs,
		errorRate,
		overall,
	};

	logger.info(
		`[monitor] health check — overall=${overall} healthy=${healthy}/${total} avg=${avgResponseMs}ms errRate=${errorRate}%`,
	);

	res.json({ checkedAt: new Date().toISOString(), summary, checks });
};

export default health;
