import { snapshot } from '../utils/metrics.js';
import { TIERS, TIER_ORDER } from '../config/tiers.js';

/**
 * GET /perf/ping
 * Ultra-light public endpoint used as the target of the browser-driven load
 * test. Does minimal work so the measured latency reflects the request path,
 * not a synthetic payload. Optional `?work=N` spins a small CPU loop to
 * simulate heavier endpoints.
 */
export async function ping(req, res) {
	const work = Math.min(2_000_000, parseInt(req.query.work, 10) || 0);
	let acc = 0;
	for (let i = 0; i < work; i++) acc += Math.sqrt(i);
	res.json({ ok: true, ts: Date.now(), work, acc: work ? acc : undefined });
}

/**
 * GET /perf/metrics
 * Real in-process performance metrics for the monitoring dashboard.
 * Public so the dashboard can render without a credit-bearing call.
 */
export async function metrics(req, res) {
	// This is an internal monitoring endpoint (exempt from the global rate
	// limiter — see middleware/global-rate-limit.js). Cache for a full
	// minute so bursts of polling/refresh clicks don't force recomputation.
	res.set('Cache-Control', 'public, max-age=60');
	res.json(snapshot());
}

/**
 * GET /perf/tiers
 * Public tier catalogue (limits, features, pricing) so the frontend can render
 * the pricing/comparison page from the same source of truth the backend uses.
 */
export async function tiers(req, res) {
	res.json({ order: TIER_ORDER, tiers: TIERS });
}

export default { ping, metrics, tiers };
