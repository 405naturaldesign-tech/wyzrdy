import {
	getUserPlan, isModelAllowed, getUsage, TOKEN_LIMITS,
} from '../utils/aiUsage.js';

/**
 * requireAIEntitlement — server-side gate for all credit-bearing AI routes.
 *
 * Enforces (from server-verified state only):
 *  1. The user holds an active entitlement (founding or active subscription).
 *  2. The requested model is allowed for the user's plan.
 *  3. Monthly and daily token limits have not been exceeded (persistent,
 *     queried from the ai_usage ledger — never reset on restart).
 *
 * Must run AFTER requireAuth so req.user / req.userId are populated.
 */
export async function requireAIEntitlement(req, res, next) {
	const plan = await getUserPlan(req.user, req.userId);
	if (plan === 'none') {
		return res.status(403).json({
			error: 'An active plan is required to use AI features.',
			code: 'no_entitlement',
		});
	}

	const model = req.body?.model;
	if (!isModelAllowed(plan, model)) {
		return res.status(403).json({
			error: `Model "${model}" is not available on the ${plan} plan.`,
			code: 'model_not_allowed',
		});
	}

	const limits = TOKEN_LIMITS[plan] || {};
	if (limits.monthly != null || limits.daily != null) {
		const usage = await getUsage(req.userId);
		if (limits.monthly != null && usage.monthly >= limits.monthly) {
			return res.status(429).json({
				error: 'Monthly AI token limit reached for your plan.',
				code: 'monthly_limit',
				usage,
				limits,
			});
		}
		if (limits.daily != null && usage.daily >= limits.daily) {
			return res.status(429).json({
				error: 'Daily AI token limit reached for your plan.',
				code: 'daily_limit',
				usage,
				limits,
			});
		}
	}

	req.userPlan = plan;
	next();
}
