// Viral Pipeline pricing — single source of truth for the Pricing page.
// Prices mirror the backend `pricing_tiers` collection and Stripe price IDs.

export const PRICING_TIERS = {
  plato: { name: 'Plato', price: 22.22, billing: 'monthly' },
  viral_entry: { name: 'Viral Entry', price: 7.77, billing: 'monthly' },
  promo_reward: { name: 'Promo Reward', price: 2.22, billing: 'monthly' },
  enterprise: { name: 'Enterprise', price: 333.33, billing: 'monthly' },
  sprint_pipeline: { name: 'Sprint/Pipeline', price: 2.22, billing: 'per_7_sprints' },
};

const cadence = { monthly: '/mo', per_7_sprints: '/ 7 sprints' };

// Ordered, presentation-ready tier catalogue for the pricing grid.
export const VIRAL_TIERS = [
  {
    id: 'plato',
    name: 'Plato',
    priceLabel: '$22.22',
    cadence: cadence.monthly,
    blurb: 'Standard Base. Unlock $2.22/mo with 2 referrals.',
    highlight: true,
    cta: 'Choose Plato ($22.22/mo)',
    checkoutTier: 'plato',
    perks: [
      'Full Wyzrdy revenue command center',
      'Easy Breezy + ForgeSEO included',
      'Standard base entitlement',
      'Unlock $2.22/mo with 2 verified referrals',
    ],
    support: 'Email support',
  },
  {
    id: 'viral_entry',
    name: 'Viral Entry',
    priceLabel: '$7.77',
    cadence: cadence.monthly,
    blurb: 'Referred friends entry tier. Unlock $2.22/mo with 2 referrals.',
    highlight: false,
    cta: 'Join Viral Entry ($7.77/mo)',
    checkoutTier: 'viral_entry',
    requiresReferral: true,
    perks: [
      'Entry tier for referred friends',
      'Full platform access',
      'Unlock $2.22/mo with 2 verified referrals',
      'Requires a valid referral link',
    ],
    support: 'Email support',
  },
  {
    id: 'promo_reward',
    name: 'Promo Reward',
    priceLabel: '$2.22',
    cadence: cadence.monthly,
    blurb: 'Unlocked conditionally for referrers with 2+ verified referrals. Hard-capped at 12 months.',
    highlight: false,
    cta: 'Unlock Promo ($2.22/mo)',
    checkoutTier: 'promo_reward',
    minReferrals: 2,
    perks: [
      'Reward rate for active referrers',
      'Requires 2+ verified referrals',
      'Hard-capped at 12 months',
      'Full platform access',
    ],
    support: 'Priority email support',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: '$333.33',
    cadence: cadence.monthly,
    blurb: 'High-tier enterprise access.',
    highlight: false,
    cta: 'Choose Enterprise ($333.33/mo)',
    checkoutTier: 'enterprise',
    perks: [
      'High-tier enterprise access',
      'Unlimited workflows & audits',
      'Dedicated account manager',
      'Priority SLA & support',
    ],
    support: '24/7 priority support',
  },
];

// Metered / one-off consumable, shown as a supplementary offer.
export const SPRINT_PIPELINE = {
  id: 'sprint_pipeline',
  name: 'Sprint / Pipeline Access',
  priceLabel: '$2.22',
  cadence: '/ 7 sprints',
  blurb: 'Metered access per sprint block.',
  cta: 'Buy 7 Sprints ($2.22)',
  checkoutTier: 'sprint_pipeline',
};
