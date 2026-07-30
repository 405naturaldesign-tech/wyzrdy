import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let stripe = null;

/**
 * Lazily construct the Stripe client. Returns null when no secret key is
 * configured so callers can surface a clear "not configured" error instead
 * of crashing at import time. Stripe TEST keys only for this sprint.
 */
export function getStripe() {
	if (stripe) return stripe;
	if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) return null;
	stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-06-24' });
	return stripe;
}

export const isStripeConfigured = () =>
	!!(STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_'));
