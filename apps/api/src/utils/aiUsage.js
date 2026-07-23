import pb from './pocketbaseClient.js';
import { findUserPurchase } from './founding.js';
import logger from './logger.js';

// Server-side model allowlist per plan. "*" means any model.
export const MODEL_ALLOWLIST = {
	individual: ['deepseek-v3', 'gpt-4o-mini'],
	business: ['deepseek-v3', 'gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet'],
	agency: ['deepseek-v3', 'gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'o1'],
	enterprise: ['*'],
};

// Persistent token limits per plan (null = unlimited).
export const TOKEN_LIMITS = {
	individual: { monthly: 100000, daily: 10000 },
	business: { monthly: 1000000, daily: 100000 },
	agency: { monthly: 10000000, daily: 1000000 },
	enterprise: { monthly: null, daily: null },
};

const PLAN_RANK = { none: 0, individual: 1, business: 2, agency: 3, enterprise: 4 };

/**
 * Determine the user's effective plan from SERVER-VERIFIED state only.
 * - An active recurring subscription (users.subscription_status = 'active')
 *   grants the users.subscription_tier plan.
 * - An active founding_lifetime purchase grants permanent Individual access.
 * The higher of the two wins (founding member can also hold a higher tier).
 */
export async function getUserPlan(userRecord, userId) {
	let plan = 'none';

	// Recurring subscription (subscription_tier is a server-protected field).
	const subStatus = userRecord?.subscription_status;
	const subTier = userRecord?.subscription_tier;
	if (subStatus === 'active' && PLAN_RANK[subTier]) {
		plan = subTier;
	}

	// Founding lifetime -> Individual, verified via the entitlement ledger.
	try {
		const founding = await findUserPurchase(userId, 'founding_lifetime');
		if (
			founding &&
			founding.payment_status === 'succeeded' &&
			founding.entitlement_status === 'active' &&
			!founding.refunded_at
		) {
			if (PLAN_RANK['individual'] > PLAN_RANK[plan]) plan = 'individual';
		}
	} catch (err) {
		logger.error('[ai-usage] plan lookup failed', err.message);
	}

	return plan;
}

export function isModelAllowed(plan, model) {
	const allowed = MODEL_ALLOWLIST[plan] || [];
	if (allowed.includes('*')) return true;
	if (!model) return true; // provider default; individual token limits still apply
	return allowed.some((m) => model.toLowerCase().includes(m.toLowerCase()));
}

function monthKey(d = new Date()) {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Sum tokens used this month and today from the persistent ledger. */
export async function getUsage(userId) {
	const month = monthKey();
	const startOfDay = new Date();
	startOfDay.setUTCHours(0, 0, 0, 0);
	const dayIso = startOfDay.toISOString().replace('T', ' ');

	let monthly = 0;
	let daily = 0;
	try {
		const rows = await pb.collection('ai_usage').getFullList({
			filter: `owner = '${userId}' && month = '${month}'`,
		});
		for (const r of rows) {
			const t = (r.input_tokens || 0) + (r.output_tokens || 0);
			monthly += t;
			if (r.created && String(r.created).replace('T', ' ') >= dayIso) daily += t;
		}
	} catch (err) {
		logger.error('[ai-usage] getUsage failed', err.message);
	}
	return { monthly, daily, month };
}

/** Persist one usage record. Never throws to the caller. */
export async function recordAiUsage({ userId, provider, model, inputTokens = 0, outputTokens = 0, costCents = 0 }) {
	try {
		await pb.collection('ai_usage').create({
			owner: userId,
			provider: provider || 'openrouter',
			model: model || '',
			input_tokens: Math.max(0, Math.round(inputTokens)),
			output_tokens: Math.max(0, Math.round(outputTokens)),
			estimated_cost_cents: Math.max(0, costCents),
			month: monthKey(),
		});
	} catch (err) {
		logger.error('[ai-usage] recordAiUsage failed', err.message);
	}
}
