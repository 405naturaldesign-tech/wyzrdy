import pb from './pocketbaseClient.js';
import logger from './logger.js';
import { getStripe } from './stripeClient.js';

export const CAMPAIGN_NAME = 'viral_pipeline_2026';
export const MAX_FREE_MONTHS = 60; // 5 years hard cap

// Referral thresholds -> promo state.
export const THRESHOLD_2FOR1 = 2;
export const THRESHOLD_FREE_YEAR = 10;
export const THRESHOLD_2_YEARS = 20;

const nowIso = () => new Date().toISOString().replace('T', ' ');
const esc = (s) => String(s || '').replace(/'/g, '');

/** Add N months to a date, returning an ISO (space) timestamp. */
function addMonths(date, months) {
	const d = new Date(date);
	d.setMonth(d.getMonth() + months);
	return d.toISOString().replace('T', ' ');
}

/** Fetch the active campaign, or null. Enforces active flag + date window. */
export async function getActiveCampaign() {
	try {
		const c = await pb
			.collection('campaigns')
			.getFirstListItem(`campaign_name = '${CAMPAIGN_NAME}'`);
		if (!c.active) return null;
		const now = new Date();
		if (c.end_date && new Date(c.end_date) < now) return null;
		if (c.start_date && new Date(c.start_date) > now) return null;
		return c;
	} catch (_) {
		return null;
	}
}

/** Idempotent get-or-create of a user's referral_state row. */
export async function getOrCreateState(userId) {
	try {
		return await pb
			.collection('referral_state')
			.getFirstListItem(`user_id = '${esc(userId)}'`);
	} catch (_) {
		return pb.collection('referral_state').create({
			user_id: userId,
			referral_count: 0,
			promo_state: 'inactive',
			free_months_accrued: 0,
			max_free_months: MAX_FREE_MONTHS,
		});
	}
}

/** Look up a pricing tier row by name. */
export async function getPricingTier(tierName) {
	try {
		return await pb
			.collection('pricing_tiers')
			.getFirstListItem(`tier_name = '${esc(tierName)}'`);
	} catch (_) {
		return null;
	}
}

/** Record a device fingerprint for a user (dedup-tolerant). */
export async function captureFingerprint(userId, { ip, deviceId, pmFingerprint }) {
	if (!userId) return;
	try {
		await pb.collection('device_fingerprints').create(
			{
				user_id: userId,
				ip_address: ip || '',
				device_id: deviceId || '',
				payment_method_fingerprint: pmFingerprint || '',
			},
			{ requestKey: `fp-${userId}-${Date.now()}` },
		);
	} catch (err) {
		logger.warn(`[viral] fingerprint capture failed: ${err.message}`);
	}
}

/**
 * Detect a self-referral by comparing device fingerprints (IP, device id,
 * payment-method fingerprint) between referrer and referred user.
 */
export async function checkSelfReferral(referrerId, referredUserId) {
	if (!referrerId || !referredUserId) return false;
	if (referrerId === referredUserId) return true;
	try {
		const [a, b] = await Promise.all([
			pb.collection('device_fingerprints').getFullList({ filter: `user_id = '${esc(referrerId)}'` }),
			pb.collection('device_fingerprints').getFullList({ filter: `user_id = '${esc(referredUserId)}'` }),
		]);
		const ipsA = new Set(a.map((r) => r.ip_address).filter(Boolean));
		const devA = new Set(a.map((r) => r.device_id).filter(Boolean));
		const pmA = new Set(a.map((r) => r.payment_method_fingerprint).filter(Boolean));
		for (const r of b) {
			if (r.ip_address && ipsA.has(r.ip_address)) return true;
			if (r.device_id && devA.has(r.device_id)) return true;
			if (r.payment_method_fingerprint && pmA.has(r.payment_method_fingerprint)) return true;
		}
	} catch (err) {
		logger.warn(`[viral] self-referral check failed: ${err.message}`);
	}
	return false;
}

/** Best-effort email via PocketBase (goja handles delivery on its side). */
async function notify(userId, subject, body) {
	try {
		const user = await pb.collection('users').getOne(userId);
		if (!user?.email) return;
		// Store a lightweight log; PB hooks/mailer handle actual delivery in prod.
		logger.info(`[viral] email -> ${user.email}: ${subject} | ${body}`);
	} catch (_) {
		/* non-fatal */
	}
}

/**
 * Apply the reward tier for a referrer given their (already updated) count.
 * Applies a Stripe coupon/price switch when Stripe + a subscription exist,
 * and always updates referral_state. Enforces the 60-month cap.
 */
async function applyRewardForCount(state, campaign) {
	const count = state.referral_count;
	const patch = {};

	if (count >= THRESHOLD_2_YEARS) {
		patch.promo_state = 'free_year_2';
		patch.free_months_accrued = Math.min(24, MAX_FREE_MONTHS);
		if (count >= 30) {
			patch.free_months_accrued = MAX_FREE_MONTHS; // 5-year cap
			patch.promo_state = 'free_year_5';
		}
	} else if (count >= THRESHOLD_FREE_YEAR) {
		patch.promo_state = 'free_year_1';
		patch.free_months_accrued = Math.min(12, MAX_FREE_MONTHS);
	} else if (count >= THRESHOLD_2FOR1) {
		patch.promo_state = 'active_2for1';
		patch.promo_start_date = nowIso();
		patch.promo_end_date = addMonths(new Date(), 12); // 1-year cap on $2.22
		patch.free_months_accrued = state.free_months_accrued || 0;
	} else {
		return state; // below any threshold
	}

	// Enforce absolute cap.
	if ((patch.free_months_accrued || 0) > MAX_FREE_MONTHS) {
		patch.free_months_accrued = MAX_FREE_MONTHS;
	}

	if (!campaign) {
		logger.info('[viral] campaign ended; promo not applied');
		await notify(state.user_id, 'Referral campaign ended', 'Promo rewards are no longer available.');
		return state;
	}

	await maybeApplyStripeCoupon(state.user_id, patch.promo_state);

	const updated = await pb.collection('referral_state').update(state.id, patch);
	await notify(state.user_id, 'Referral reward unlocked', `New promo state: ${patch.promo_state}`);
	return updated;
}

/** Apply a Stripe coupon / price switch to the referrer's subscription. */
async function maybeApplyStripeCoupon(userId, promoState) {
	const stripe = getStripe();
	if (!stripe) return;
	try {
		// Locate an active subscription for the user via their founding_purchases
		// ledger (holds stripe_customer_id / stripe_subscription_id).
		let purchase = null;
		try {
			purchase = await pb
				.collection('founding_purchases')
				.getFirstListItem(`user_id = '${esc(userId)}' && stripe_subscription_id != ''`, { sort: '-created' });
		} catch (_) { /* none */ }
		if (!purchase?.stripe_subscription_id) return;

		let months = 1;
		if (promoState === 'active_2for1') months = 12;
		else if (promoState === 'free_year_1') months = 12;
		else if (promoState === 'free_year_2') months = 24;
		else if (promoState === 'free_year_5') months = 60;

		const percentOff = promoState === 'active_2for1' ? 90 : 100; // $22.22->$2.22 ~= 90% off
		const coupon = await stripe.coupons.create({ percent_off: percentOff, duration: 'repeating', duration_in_months: months });
		await stripe.subscriptions.update(purchase.stripe_subscription_id, { coupon: coupon.id });
		logger.info(`[viral] applied coupon ${coupon.id} (${percentOff}% x${months}mo) to ${userId}`);
	} catch (err) {
		logger.error(`[viral] stripe coupon apply failed: ${err.message}`);
	}
}

/** Revert a referrer to standard billing (remove coupon / discount). */
async function revertStripe(userId) {
	const stripe = getStripe();
	if (!stripe) return;
	try {
		const purchase = await pb
			.collection('founding_purchases')
			.getFirstListItem(`user_id = '${esc(userId)}' && stripe_subscription_id != ''`, { sort: '-created' });
		if (purchase?.stripe_subscription_id) {
			await stripe.subscriptions.deleteDiscount(purchase.stripe_subscription_id);
			logger.info(`[viral] removed discount for ${userId}`);
		}
	} catch (err) {
		logger.warn(`[viral] revert stripe failed: ${err.message}`);
	}
}

/**
 * Process a verified viral-entry checkout. Called from the Stripe webhook after
 * signature verification & event-id idempotency. `eventId` is the Stripe event
 * id (stored on the referral for replay protection).
 */
export async function processViralConversion({ referralCode, referredUserId, referredEmail, paymentIntentId, eventId }) {
	if (!referralCode) return;
	let referral;
	try {
		referral = await pb
			.collection('viral_referrals')
			.getFirstListItem(`referral_code = '${esc(referralCode)}'`);
	} catch (_) {
		logger.warn(`[viral] no referral for code ${referralCode}`);
		return;
	}
	if (referral.status === 'payment_verified') return; // already counted

	const referrerId = referral.referrer_id;
	const effectiveReferred = referredUserId || referral.referred_user_id;

	// Self-referral guard.
	if (effectiveReferred && (await checkSelfReferral(referrerId, effectiveReferred))) {
		await pb.collection('viral_referrals').update(referral.id, {
			status: 'self_referral_blocked',
			referred_user_id: effectiveReferred || referral.referred_user_id,
			stripe_event_id: eventId || '',
		});
		logger.warn(`[viral] SECURITY self-referral blocked code=${referralCode} referrer=${referrerId}`);
		await notify(referrerId, 'Referral blocked', 'Your referral was blocked due to duplicate account detection.');
		return;
	}

	await pb.collection('viral_referrals').update(referral.id, {
		status: 'payment_verified',
		referred_user_id: effectiveReferred || referral.referred_user_id,
		referred_email: referredEmail || referral.referred_email,
		payment_intent_id: paymentIntentId || '',
		stripe_event_id: eventId || '',
		verified_at: nowIso(),
	});

	// Increment the referrer's verified count and re-evaluate rewards.
	const state = await getOrCreateState(referrerId);
	const updated = await pb.collection('referral_state').update(state.id, {
		referral_count: (state.referral_count || 0) + 1,
		last_webhook_processed: eventId || '',
	});
	const campaign = await getActiveCampaign();
	await applyRewardForCount(updated, campaign);
	logger.info(`[viral] conversion recorded referrer=${referrerId} count=${updated.referral_count}`);
}

/** Revoke a referral on refund/dispute and downgrade promo if a threshold drops. */
export async function processReferralReversal({ paymentIntentId, dispute }) {
	if (!paymentIntentId) return;
	let referral;
	try {
		referral = await pb
			.collection('viral_referrals')
			.getFirstListItem(`payment_intent_id = '${esc(paymentIntentId)}'`);
	} catch (_) {
		return;
	}
	if (['refunded', 'disputed'].includes(referral.status)) return;

	await pb.collection('viral_referrals').update(referral.id, {
		status: dispute ? 'disputed' : 'refunded',
		refunded_at: nowIso(),
	});

	const referrerId = referral.referrer_id;
	const state = await getOrCreateState(referrerId);
	const newCount = Math.max(0, (state.referral_count || 0) - 1);
	const patch = { referral_count: newCount };

	// Downgrade promo if it falls below the threshold that granted it.
	const s = state.promo_state;
	if ((s === 'free_year_2' && newCount < THRESHOLD_2_YEARS) ||
		(s === 'free_year_1' && newCount < THRESHOLD_FREE_YEAR)) {
		// Re-evaluate to the next-lower tier the count still supports.
		if (newCount >= THRESHOLD_FREE_YEAR) { patch.promo_state = 'free_year_1'; patch.free_months_accrued = 12; }
		else if (newCount >= THRESHOLD_2FOR1) { patch.promo_state = 'active_2for1'; patch.free_months_accrued = 0; }
		else { patch.promo_state = 'inactive'; patch.free_months_accrued = 0; await revertStripe(referrerId); }
	} else if (s === 'active_2for1' && newCount < THRESHOLD_2FOR1) {
		patch.promo_state = 'inactive';
		patch.free_months_accrued = 0;
		await revertStripe(referrerId);
	}

	await pb.collection('referral_state').update(state.id, patch);
	await notify(referrerId, 'Referral reversed', `A referred customer's payment was ${dispute ? 'disputed' : 'refunded'}. Your promo may be revoked.`);
	logger.info(`[viral] reversal referrer=${referrerId} newCount=${newCount}`);
}

/**
 * Lazily expire the $2.22/mo promo when its 12-month window has passed. No cron
 * exists in this environment, so this runs on-demand (status reads & webhooks).
 */
export async function expireStalePromos() {
	const now = nowIso();
	try {
		const stale = await pb.collection('referral_state').getFullList({
			filter: `promo_state = 'active_2for1' && promo_end_date != '' && promo_end_date <= '${now}'`,
		});
		for (const s of stale) {
			await pb.collection('referral_state').update(s.id, { promo_state: 'expired_2for1' }, { requestKey: `exp-${s.id}` });
			await revertStripe(s.user_id);
			await notify(s.user_id, 'Promo expired', 'Your $2.22/mo promo has expired. Reverting to $22.22/mo.');
		}
		if (stale.length) logger.info(`[viral] expired ${stale.length} 2for1 promos`);
	} catch (err) {
		logger.warn(`[viral] expireStalePromos failed: ${err.message}`);
	}
}

export { pb };
