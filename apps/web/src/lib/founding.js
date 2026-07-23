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

// Formats "1,847 of 20,000 founding access passes remaining"
export function remainingLabel(remaining, cap = FOUNDING.cap) {
  const r = Math.max(0, Number.isFinite(remaining) ? remaining : cap);
  return `${r.toLocaleString()} of ${cap.toLocaleString()} founding access passes remaining`;
}
