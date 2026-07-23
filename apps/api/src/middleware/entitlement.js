import { findUserPurchase } from '../utils/founding.js';

/**
 * Require an active founding entitlement OR an active, unexpired subscription.
 * Attaches `req.entitlement`. Assumes requireAuth ran first.
 */
export async function requireFoundingAccess(req, res, next) {
	const purchase = await findUserPurchase(req.userId);
	if (!purchase || purchase.entitlement_status !== 'active') {
		return res.status(403).json({ error: 'This feature requires an active Wyzrdy plan.' });
	}
	const isFounding = purchase.purchase_type === 'founding_lifetime';
	const subActive =
		['monthly', 'annual'].includes(purchase.purchase_type) &&
		purchase.subscription_period_end &&
		new Date(purchase.subscription_period_end) > new Date();
	if (!isFounding && !subActive) {
		return res.status(403).json({ error: 'Your subscription is inactive or expired.' });
	}
	req.entitlement = purchase;
	next();
}

/** Require an active, unexpired subscription (excludes founding lifetime). */
export async function requireSubscription(req, res, next) {
	const purchase = await findUserPurchase(req.userId);
	if (
		!purchase ||
		purchase.entitlement_status !== 'active' ||
		!purchase.subscription_period_end ||
		new Date(purchase.subscription_period_end) <= new Date()
	) {
		return res.status(403).json({ error: 'This feature requires an active subscription.' });
	}
	req.entitlement = purchase;
	next();
}
