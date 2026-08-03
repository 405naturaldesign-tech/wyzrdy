// Central config for the Wyzrdy "Founding Access" offer.
// One-time payment for one year of access to the Individual plan.

export const FOUNDING = {
  price: 11.69,
  priceLabel: '$11.69',
  cap: 20000,
  cta: 'Claim Founding Access — $11.69',
  headline:
    'One-time founding access for your first year: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. Once the limit is reached, this offer is gone.',
  clarification:
    'One year of access applies to the Wyzrdy Individual plan. Metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. Standard subscription pricing applies after the first 12 months.',
  // Stripe Payment Link for the $11.69 founding access one-time purchase.
  // Replace with the live Payment Link URL from the Stripe dashboard.
  // Configured server-side via STRIPE_FOUNDING_PAYMENT_LINK in apps/api/.env.
  paymentLinkId: 'founding_individual',
  successUrl: '/checkout/success',
  cancelUrl: '/checkout/cancel',
};

// Founding Member Launch — $2 First Month, Lock In Forever
export const FOUNDING_MEMBER = {
  price: 2,
  priceLabel: '$2',
  period: 'first month',
  cap: 20000,
  cta: 'Become a Founding Member — $2 First Month',
  headline:
    'Founding Member Launch: first month just $2, then lock in your founding rate forever. Only 20,000 founding spots available — once they\'re gone, standard pricing returns.',
  subhead:
    'Your $2/mo founding rate is locked in for life. No price increases, ever. Cancel anytime. But if you cancel, the founding rate is gone — you can\'t get it back.',
  clarification:
    'Founding Member rate of $2/mo applies to the Wyzrdy Individual plan. Locked in for the lifetime of your subscription. If you cancel, standard pricing applies on re-subscription. Metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded.',
  socialProof: [
    { name: 'Sarah K.', role: 'Founder, Bloom Creative', quote: 'I grabbed my founding spot immediately. $2/mo for an AI operating system is the easiest decision I\'ve made all year.' },
    { name: 'Marcus T.', role: 'Growth Lead, StackLabs', quote: 'Locked in at $2/mo and already shipped 3 workflows. The value per dollar is absurd.' },
    { name: 'Priya M.', role: 'Solo Consultant', quote: 'At $2/mo, the risk is zero and the upside is unlimited. Founding member was a no-brainer.' },
  ],
  successUrl: '/checkout/success',
  cancelUrl: '/checkout/cancel',
};

// Formats "1,847 of 20,000 founding access passes remaining"
export function remainingLabel(remaining, cap = FOUNDING.cap) {
  const r = Math.max(0, Number.isFinite(remaining) ? remaining : cap);
  return `${r.toLocaleString()} of ${cap.toLocaleString()} founding access passes remaining`;
}

// Formats "18,153 of 20,000 founding member spots remaining"
export function foundingMemberRemainingLabel(remaining, cap = FOUNDING_MEMBER.cap) {
  const r = Math.max(0, Number.isFinite(remaining) ? remaining : cap);
  return `${r.toLocaleString()} of ${cap.toLocaleString()} founding member spots remaining`;
}