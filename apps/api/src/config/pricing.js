/**
 * Canonical server-owned price catalogue.
 *
 * SINGLE SOURCE OF TRUTH for all commercial pricing in the Wyzrdy platform.
 * The server resolves browser-supplied plan/cycle identifiers to trusted
 * Stripe Price IDs. The browser may NEVER submit a price, amount, or
 * Price ID — only approved plan + billing-cycle keys.
 *
 * Founding Access: $11.69 one-time, Individual plan for 12 months.
 *   - No automatic renewal.
 *   - First 20,000 verified successful purchasers.
 *   - Excludes metered third-party usage, premium add-ons,
 *     implementation services, and enterprise services.
 *
 * Standard subscriptions use Stripe Price IDs exclusively.
 * Enterprise is contract / contact-sales only.
 */
export const PLANS = {
  founding: {
    id: 'founding',
    name: 'Founding Access',
    type: 'one_time',
    amount: 11.69,
    amountCents: 1169,
    currency: 'usd',
    stripePriceIdEnv: 'STRIPE_FOUNDING_PRICE_ID',
    entitlement: 'individual',
    durationMonths: 12,
    cap: 20000,
    description: 'Founding Access is a one-time $11.69 payment for 12 months of the Individual plan. It does not renew automatically. Continued access after 12 months requires separately selecting a standard subscription.',
  },
  individual: {
    id: 'individual',
    name: 'Individual',
    monthly: {
      amount: 22.22,
      amountCents: 2222,
      stripePriceIdEnv: 'STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID',
    },
    annual: {
      amount: 133.32,
      amountCents: 13332,
      stripePriceIdEnv: 'STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID',
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    monthly: {
      amount: 77.77,
      amountCents: 7777,
      stripePriceIdEnv: 'STRIPE_BUSINESS_MONTHLY_PRICE_ID',
    },
    annual: {
      amount: 466.62,
      amountCents: 46662,
      stripePriceIdEnv: 'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
    },
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    monthly: {
      amount: 333.33,
      amountCents: 33333,
      stripePriceIdEnv: 'STRIPE_AGENCY_MONTHLY_PRICE_ID',
    },
    annual: {
      amount: 1999.98,
      amountCents: 199998,
      stripePriceIdEnv: 'STRIPE_AGENCY_ANNUAL_PRICE_ID',
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    type: 'contact_sales',
    description: 'Enterprise is billed via a tailored agreement. Contact sales for pricing.',
  },
};

/** Resolve a Stripe Price ID from the canonical plan + cycle, or null if not configured. */
export function getStripePriceId(planId, cycle) {
  const plan = PLANS[planId];
  if (!plan) return null;
  if (planId === 'founding') return process.env[plan.stripePriceIdEnv] || null;
  if (planId === 'enterprise') return null;
  const pricing = plan[cycle];
  if (!pricing) return null;
  return process.env[pricing.stripePriceIdEnv] || null;
}

/** Check if a plan+cycle has a configured Stripe Price ID. */
export function isStripePriceConfigured(planId, cycle) {
  const id = getStripePriceId(planId, cycle);
  return Boolean(id && id.startsWith('price_'));
}

/** Validate that a browser-supplied plan + cycle is a known combination. */
export function isValidPlanCycle(planId, cycle) {
  if (planId === 'founding') return true;
  if (planId === 'enterprise') return true;
  const plan = PLANS[planId];
  if (!plan) return false;
  return Boolean(plan[cycle]);
}

/** Get the display amount for a plan+cycle (for checkout disclosure). */
export function getDisplayAmount(planId, cycle) {
  if (planId === 'founding') return PLANS.founding.amount;
  if (planId === 'enterprise') return null;
  return PLANS[planId]?.[cycle]?.amount || null;
}

export default { PLANS, getStripePriceId, isStripePriceConfigured, isValidPlanCycle, getDisplayAmount };