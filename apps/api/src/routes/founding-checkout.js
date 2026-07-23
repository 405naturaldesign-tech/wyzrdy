import { getStripe, isStripeConfigured } from '../utils/stripeClient.js';
import { PLANS, getStripePriceId, isStripePriceConfigured, isValidPlanCycle } from '../config/pricing.js';
import {
	pb, getAvailability, findUserPurchase, RESERVATION_TTL_MS, FOUNDING_CAP,
	countCompletedFounding,
} from '../utils/founding.js';
import logger from '../utils/logger.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://wyzrdy.com';

function ensureStripe(res) {
	if (!isStripeConfigured()) {
		res.status(503).json({
			error: 'Stripe is not configured. Add STRIPE_SECRET_KEY (test) to apps/api/.env.',
		});
		return null;
	}
	return getStripe();
}

/**
 * POST /checkout/founding — $11.69 one-time Founding Access Checkout Session.
 * Uses mode: payment (never creates a subscription).
 * Creates a reservation + purchase ledger record before redirecting to Stripe.
 */
export async function checkoutFounding(req, res) {
	const stripe = ensureStripe(res);
	if (!stripe) return;

	// Verify the founding price ID is configured
	const priceId = getStripePriceId('founding');
	if (!priceId) {
		return res.status(503).json({
			error: 'Founding Access checkout is not configured. Set STRIPE_FOUNDING_PRICE_ID in apps/api/.env.',
		});
	}

	// Prevent duplicate founding entitlements.
	const existing = await findUserPurchase(req.userId, 'founding_lifetime');
	if (existing && ['active', 'pending'].includes(existing.entitlement_status) && existing.payment_status !== 'failed') {
		return res.status(400).json({ error: 'You already have founding access.' });
	}

	// Availability gate (completed + active reservations).
	const avail = await getAvailability();
	if (avail.sold_out || avail.remaining <= 0) {
		return res.status(429).json({ error: 'Founding offer sold out.', ...avail });
	}

	// Resolve referral attribution server-side.
	let referrerId = '';
	const refCode = (req.body?.ref || '').toString().trim();
	if (refCode) {
		try {
			const rc = await pb
				.collection('referral_codes')
				.getFirstListItem(`code = '${refCode.replace(/'/g, '')}'`);
			if (rc && rc.owner && rc.owner !== req.userId) referrerId = rc.owner;
		} catch (_) {
			/* unknown code — ignore */
		}
	}

	const idempotencyKey = `founding-checkout-${req.userId}-${Date.now()}`;
	const metadata = { user_id: req.userId, purchase_type: 'founding_lifetime' };
	if (referrerId) metadata.referrer_id = referrerId;

	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		payment_method_types: ['card'],
		line_items: [{ price: priceId, quantity: 1 }],
		customer_email: req.user.email,
		success_url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${APP_BASE_URL}/checkout/cancel`,
		metadata,
		payment_intent_data: { metadata },
	}, { idempotencyKey });

	const now = new Date();
	const expires = new Date(now.getTime() + RESERVATION_TTL_MS);

	await pb.collection('founding_reservations').create({
		user_id: req.userId,
		stripe_checkout_session_id: session.id,
		reserved_at: now.toISOString().replace('T', ' '),
		expires_at: expires.toISOString().replace('T', ' '),
		status: 'active',
	});

	await pb.collection('founding_purchases').create({
		user_id: req.userId,
		stripe_checkout_session_id: session.id,
		stripe_price_id: priceId,
		purchase_type: 'founding_lifetime',
		amount_cents: PLANS.founding.amountCents,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	});

	logger.info(`[founding] checkout session ${session.id} for user ${req.userId}`);
	res.json({ url: session.url, session_id: session.id });
}

/**
 * POST /checkout/subscription — standard recurring subscription checkout.
 * body: { plan: 'individual'|'business'|'agency', cycle: 'monthly'|'annual' }
 * Uses mode: subscription (creates recurring billing).
 */
export async function checkoutSubscription(req, res) {
	const stripe = ensureStripe(res);
	if (!stripe) return;

	const plan = (req.body?.plan || 'individual').toString().toLowerCase();
	const cycle = (req.body?.cycle || 'monthly').toString().toLowerCase();

	if (!isValidPlanCycle(plan, cycle)) {
		return res.status(422).json({ error: `Invalid plan "${plan}" or cycle "${cycle}".` });
	}

	const priceId = getStripePriceId(plan, cycle);
	if (!priceId) {
		return res.status(503).json({
			error: `Checkout for ${plan} (${cycle}) is not configured. Set the corresponding STRIPE_*_PRICE_ID in apps/api/.env.`,
		});
	}

	const idempotencyKey = `sub-checkout-${req.userId}-${plan}-${cycle}-${Date.now()}`;

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		payment_method_types: ['card'],
		line_items: [{ price: priceId, quantity: 1 }],
		customer_email: req.user.email,
		success_url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${APP_BASE_URL}/checkout/cancel`,
		metadata: { user_id: req.userId, purchase_type: `${plan}_${cycle}` },
	}, { idempotencyKey });

	await pb.collection('founding_purchases').create({
		user_id: req.userId,
		stripe_checkout_session_id: session.id,
		stripe_price_id: priceId,
		purchase_type: `${plan}_${cycle}`,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	});

	res.json({ url: session.url, session_id: session.id });
}

/**
 * POST /checkout/portal — Stripe Customer Portal for existing customers.
 */
export async function checkoutPortal(req, res) {
	const stripe = ensureStripe(res);
	if (!stripe) return;

	const purchase = await findUserPurchase(req.userId);
	if (!purchase || !purchase.stripe_customer_id) {
		return res.status(400).json({ error: 'No Stripe customer found for this account.' });
	}

	const portal = await stripe.billingPortal.sessions.create({
		customer: purchase.stripe_customer_id,
		return_url: `${APP_BASE_URL}/dashboard?tab=profile`,
	});
	res.json({ url: portal.url });
}

/**
 * GET /entitlement — the logged-in user's current entitlement.
 */
export async function getEntitlement(req, res) {
	const purchase = await findUserPurchase(req.userId);
	if (!purchase) {
		return res.json({
			user_id: req.userId,
			entitlement_type: 'none',
			entitlement_status: 'none',
			purchase_type: null,
		});
	}
	res.json({
		user_id: req.userId,
		entitlement_type: purchase.entitlement_status === 'active' ? purchase.purchase_type : 'none',
		entitlement_status: purchase.entitlement_status,
		purchase_type: purchase.purchase_type,
		payment_status: purchase.payment_status,
		completed_at: purchase.completed_at || null,
		subscription_period_end: purchase.subscription_period_end || null,
		stripe_customer_id: purchase.stripe_customer_id || null,
		stripe_subscription_id: purchase.stripe_subscription_id || null,
	});
}

/**
 * GET /payments/config-status — public, tells the client whether Stripe is live.
 */
export async function paymentsConfigStatus(req, res) {
	res.json({ stripe_configured: isStripeConfigured() });
}

/**
 * GET /founding/count — public completed founding purchase counter.
 */
export async function foundingCount(req, res) {
	const completed = await countCompletedFounding();
	res.json({
		completed_purchases: completed,
		total_cap: FOUNDING_CAP,
		remaining: Math.max(0, FOUNDING_CAP - completed),
		sold_out: completed >= FOUNDING_CAP,
	});
}