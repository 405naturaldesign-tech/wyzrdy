import { getStripe, isStripeConfigured } from '../utils/stripeClient.js';
import {
	pb, getActiveCampaign, getOrCreateState, getPricingTier,
	expireStalePromos,
	THRESHOLD_2FOR1, THRESHOLD_FREE_YEAR, THRESHOLD_2_YEARS,
} from '../utils/viral.js';
import logger from '../utils/logger.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://wyzrdy.com';
const VIRAL_ENTRY_PRICE_ID = process.env.STRIPE_VIRAL_ENTRY_PRICE_ID;

function randCode() {
	const a = Math.random().toString(36).slice(2, 10);
	const b = Math.random().toString(36).slice(2, 8);
	return `ref_${a}${b}`;
}

/** POST /referral/generate-link — mint a unique referral code for the caller. */
export async function generateLink(req, res) {
	// Reuse an existing pending code so a user doesn't accumulate dead links.
	try {
		const existing = await pb
			.collection('viral_referrals')
			.getFirstListItem(`referrer_id = '${req.userId}' && status = 'pending'`, { sort: '-created_at' });
		if (existing) {
			return res.json({ referral_code: existing.referral_code, referral_url: `${APP_BASE_URL}/signup?ref=${existing.referral_code}` });
		}
	} catch (_) { /* none yet */ }

	let code = randCode();
	let created = null;
	for (let i = 0; i < 5 && !created; i++) {
		try {
			created = await pb.collection('viral_referrals').create(
				{ referrer_id: req.userId, referral_code: code, status: 'pending' },
				{ requestKey: `gen-${req.userId}-${i}` },
			);
		} catch (err) {
			if (String(err.message).includes('unique') || err.status === 400) { code = randCode(); continue; }
			throw err;
		}
	}
	if (!created) throw new Error('Failed to generate a unique referral code');
	res.json({ referral_code: code, referral_url: `${APP_BASE_URL}/signup?ref=${code}` });
}

/** POST /checkout/viral-entry — $7.77/mo Viral Entry Tier checkout. */
export async function checkoutViralEntry(req, res) {
	if (!isStripeConfigured()) {
		return res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY (test) to apps/api/.env.' });
	}
	const campaign = await getActiveCampaign();
	if (!campaign || !campaign.viral_entry_tier_enabled) {
		return res.status(400).json({ error: 'Campaign has ended. Viral Entry Tier is no longer available.' });
	}

	const referralCode = (req.query.referral_code || req.body?.referral_code || '').toString().trim();
	if (!referralCode) return res.status(422).json({ error: 'referral_code is required.' });

	let referral;
	try {
		referral = await pb.collection('viral_referrals').getFirstListItem(`referral_code = '${referralCode.replace(/'/g, '')}'`);
	} catch (_) {
		return res.status(400).json({ error: 'Invalid referral code.' });
	}
	if (referral.status !== 'pending') {
		return res.status(400).json({ error: 'This referral link has already been used.' });
	}

	if (!VIRAL_ENTRY_PRICE_ID) throw new Error('STRIPE_VIRAL_ENTRY_PRICE_ID is not set in apps/api/.env');
	const stripe = getStripe();

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		line_items: [{ price: VIRAL_ENTRY_PRICE_ID, quantity: 1 }],
		client_reference_id: req.userId,
		metadata: {
			user_id: req.userId,
			referral_code: referralCode,
			tier: 'viral_entry',
			referrer_id: referral.referrer_id,
		},
		success_url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${APP_BASE_URL}/checkout/cancel`,
	});

	// Attach the checkout user to the referral so the webhook can self-referral check.
	try {
		await pb.collection('viral_referrals').update(referral.id, { referred_user_id: req.userId, status: 'signup_complete' });
	} catch (err) { logger.warn(`[viral] referral pre-update failed: ${err.message}`); }

	res.json({ checkout_url: session.url, session_id: session.id });
}

/** GET /referral/status — server-computed progress (zero client trust). */
export async function referralStatus(req, res) {
	await expireStalePromos();
	const state = await getOrCreateState(req.userId);

	// Surface the caller's active referral link (generate lazily if absent).
	let link = '';
	try {
		const r = await pb.collection('viral_referrals').getFirstListItem(`referrer_id = '${req.userId}' && status = 'pending'`, { sort: '-created_at' });
		link = `${APP_BASE_URL}/signup?ref=${r.referral_code}`;
	} catch (_) { /* none */ }

	const count = state.referral_count || 0;
	const friends_to_2for1 = Math.max(0, THRESHOLD_2FOR1 - count);
	const friends_to_free_year = Math.max(0, THRESHOLD_FREE_YEAR - count);
	const friends_to_2_years = Math.max(0, THRESHOLD_2_YEARS - count);

	const message = friends_to_2for1 > 0
		? `You are ${friends_to_2for1} verified friend${friends_to_2for1 === 1 ? '' : 's'} away from unlocking Plato for $2.22/mo, or ${friends_to_free_year} friends away from a full year free.`
		: friends_to_free_year > 0
			? `You've unlocked $2.22/mo. You're ${friends_to_free_year} friends away from a full year free.`
			: `You've unlocked a full year free. Keep referring toward the 5-year cap.`;

	res.json({
		referral_count: count,
		promo_state: state.promo_state || 'inactive',
		friends_to_2for1,
		friends_to_free_year,
		friends_to_2_years,
		promo_expires_at: state.promo_state === 'active_2for1' ? (state.promo_end_date || null) : null,
		free_months_remaining: ['free_year_1', 'free_year_2', 'free_year_5'].includes(state.promo_state) ? (state.free_months_accrued || 0) : 0,
		max_free_months: state.max_free_months || 60,
		referral_link: link,
		message,
	});
}
