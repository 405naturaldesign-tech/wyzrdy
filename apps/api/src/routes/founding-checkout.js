import { createStripeCheckoutSession, isStripeConfiguredViaComposio } from '../utils/composioClient.js';
import {
	pb, getAvailability, findUserPurchase, RESERVATION_TTL_MS, FOUNDING_CAP,
	countCompletedFounding,
} from '../utils/founding.js';
import logger from '../utils/logger.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://wyzrdy.com';
const FOUNDING_PRICE_ID = process.env.STRIPE_FOUNDING_PRICE_ID;
const FOUNDING_MEMBER_PRICE_ID = process.env.STRIPE_FOUNDING_MEMBER_PRICE_ID;
const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID;
const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID;

function ensureStripeViaComposio(res) {
	if (!isStripeConfiguredViaComposio()) {
		res.status(503).json({
			error: 'Stripe (via Composio) is not configured. Add COMPOSIO_API_KEY to apps/api/.env.',
		});
		return null;
	}
	return true;
}

// NOTE: The founding Stripe Price/Product (STRIPE_FOUNDING_PRICE_ID) is
// configured in the Stripe Dashboard, not in code. Update it there to:
//   Product name: "Wyzrdy Individual — Founding Offer"
//   Description: "One-time founding access for your first year. After 12
//   months, standard subscription pricing applies."

/** POST /checkout/founding — create a $11.69 one-time founding Checkout Session via Composio MCP. */
export async function checkoutFounding(req, res) {
	if (!ensureStripeViaComposio(res)) return;
	if (!FOUNDING_PRICE_ID) throw new Error('STRIPE_FOUNDING_PRICE_ID is not set in apps/api/.env');

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
				.getFirstListItem('code = {:code}', { code: refCode });
			if (rc && rc.owner && rc.owner !== req.userId) referrerId = rc.owner;
		} catch (_) { /* unknown code — ignore */ }
	}

	const metadata = { user_id: req.userId, purchase_type: 'founding_lifetime' };
	if (referrerId) metadata.referrer_id = referrerId;

	const session = await createStripeCheckoutSession(req.userId, {
		mode: 'payment',
		lineItems: [{ price: FOUNDING_PRICE_ID, quantity: 1 }],
		successUrl: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancelUrl: `${APP_BASE_URL}/checkout/cancel`,
		customerEmail: req.user.email,
		metadata,
		extra: { payment_intent_data: { metadata } },
	});

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
		stripe_price_id: FOUNDING_PRICE_ID,
		purchase_type: 'founding_lifetime',
		amount_cents: 1169,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	});

	logger.info(`[founding] checkout session ${session.id} for user ${req.userId}`);
	res.json({ url: session.url, session_id: session.id });
}

/** POST /checkout/founding-member — create a $2/mo Founding Member subscription Checkout Session via Composio MCP. */
export async function checkoutFoundingMember(req, res) {
	if (!ensureStripeViaComposio(res)) return;
	if (!FOUNDING_MEMBER_PRICE_ID) throw new Error('STRIPE_FOUNDING_MEMBER_PRICE_ID is not set in apps/api/.env');

	// Prevent duplicate founding member subscriptions.
	const existing = await findUserPurchase(req.userId, 'founding_member');
	if (existing && ['active', 'pending'].includes(existing.entitlement_status) && existing.payment_status !== 'failed') {
		return res.status(400).json({ error: 'You are already a Founding Member.' });
	}

	// Availability gate — reuse the existing founding cap counter.
	const avail = await getAvailability();
	if (avail.sold_out || avail.remaining <= 0) {
		return res.status(429).json({ error: 'Founding Member spots are sold out.', ...avail });
	}

	const metadata = { user_id: req.userId, purchase_type: 'founding_member', grandfathered_rate: '200' };

	const session = await createStripeCheckoutSession(req.userId, {
		mode: 'subscription',
		lineItems: [{ price: FOUNDING_MEMBER_PRICE_ID, quantity: 1 }],
		successUrl: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=founding_member`,
		cancelUrl: `${APP_BASE_URL}/checkout/founding-member`,
		customerEmail: req.user.email,
		metadata,
		extra: { subscription_data: { metadata } },
	});

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
		stripe_price_id: FOUNDING_MEMBER_PRICE_ID,
		purchase_type: 'founding_member',
		amount_cents: 200,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	});

	logger.info(`[founding-member] checkout session ${session.id} for user ${req.userId}`);
	res.json({ url: session.url, session_id: session.id });
}

/** POST /checkout/subscription?cycle=monthly|annual */
export async function checkoutSubscription(req, res) {
	if (!ensureStripeViaComposio(res)) return;

	const cycle = (req.query.cycle || req.body?.cycle || 'monthly').toLowerCase();
	const priceId = cycle === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
	if (!priceId) {
		throw new Error(`Stripe price id for ${cycle} is not set in apps/api/.env`);
	}

	const session = await createStripeCheckoutSession(req.userId, {
		mode: 'subscription',
		lineItems: [{ price: priceId, quantity: 1 }],
		successUrl: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancelUrl: `${APP_BASE_URL}/checkout/cancel`,
		customerEmail: req.user.email,
		metadata: { user_id: req.userId, purchase_type: cycle },
	});

	await pb.collection('founding_purchases').create({
		user_id: req.userId,
		stripe_checkout_session_id: session.id,
		stripe_price_id: priceId,
		purchase_type: cycle,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	});

	res.json({ url: session.url, session_id: session.id });
}

// Viral pipeline tier → Stripe price id + checkout mode.
const TIER_CHECKOUT = {
	plato: { price: process.env.STRIPE_PLATO_PRICE_ID, mode: 'subscription' },
	viral_entry: { price: process.env.STRIPE_VIRAL_ENTRY_PRICE_ID, mode: 'subscription' },
	promo_reward: { price: process.env.STRIPE_PROMO_REWARD_PRICE_ID, mode: 'subscription' },
	enterprise: { price: process.env.STRIPE_ENTERPRISE_PRICE_ID, mode: 'subscription' },
	sprint_pipeline: { price: process.env.STRIPE_SPRINT_PRICE_ID, mode: 'payment' },
};

/** POST /checkout/tier?tier=plato|viral_entry|promo_reward|enterprise|sprint_pipeline */
export async function checkoutTier(req, res) {
	if (!ensureStripeViaComposio(res)) return;

	const tier = (req.query.tier || req.body?.tier || '').toString().toLowerCase();
	const cfg = TIER_CHECKOUT[tier];
	if (!cfg) return res.status(422).json({ error: 'Unknown tier.' });
	if (!cfg.price) throw new Error(`Stripe price id for ${tier} is not set in apps/api/.env`);

	const session = await createStripeCheckoutSession(req.userId, {
		mode: cfg.mode,
		lineItems: [{ price: cfg.price, quantity: 1 }],
		successUrl: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancelUrl: `${APP_BASE_URL}/checkout/cancel`,
		customerEmail: req.user.email,
		metadata: { user_id: req.userId, purchase_type: tier },
	});

	await pb.collection('founding_purchases').create({
		user_id: req.userId,
		stripe_checkout_session_id: session.id,
		stripe_price_id: cfg.price,
		purchase_type: tier,
		currency: 'usd',
		payment_status: 'pending',
		entitlement_status: 'pending',
	}).catch((err) => logger.warn(`[checkout] ledger create failed: ${err.message}`));

	res.json({ url: session.url, session_id: session.id });
}

/** POST /checkout/portal — Stripe Customer Portal for the user's subscription. */
export async function checkoutPortal(req, res) {
	if (!ensureStripeViaComposio(res)) return;

	const purchase = await findUserPurchase(req.userId);
	if (!purchase || !purchase.stripe_customer_id) {
		return res.status(400).json({ error: 'No Stripe customer found for this account.' });
	}

	// Portal sessions are created via Composio MCP
	const session = await createStripeCheckoutSession(req.userId, {
		mode: 'subscription',
		lineItems: [],
		successUrl: `${APP_BASE_URL}/dashboard?tab=profile`,
		cancelUrl: `${APP_BASE_URL}/dashboard?tab=profile`,
		customerEmail: req.user.email,
		metadata: { user_id: req.userId, action: 'portal' },
		extra: { customer: purchase.stripe_customer_id, return_url: `${APP_BASE_URL}/dashboard?tab=profile` },
	});

	res.json({ url: session.url });
}

/** GET /entitlement — the logged-in user's entitlement. */
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

/** GET /payments/config-status — public, tells the client whether Stripe is live via Composio. */
export async function paymentsConfigStatus(req, res) {
	res.json({ stripe_configured: isStripeConfiguredViaComposio() });
}

/** GET /founding/count — public completed founding purchase counter. */
export async function foundingCount(req, res) {
	const completed = await countCompletedFounding();
	res.json({
		completed_purchases: completed,
		total_cap: FOUNDING_CAP,
		remaining: Math.max(0, FOUNDING_CAP - completed),
		sold_out: completed >= FOUNDING_CAP,
	});
}