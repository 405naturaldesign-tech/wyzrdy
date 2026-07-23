/**
 * Frontend mirror of the backend tier catalogue
 * (apps/api/src/config/tiers.js). Used for the pricing page, dashboard usage
 * meters, feature-lock indicators, and upgrade prompts.
 *
 * `null` for a numeric limit means "unlimited".
 */
export const TIERS = {
  individual: {
    id: 'individual',
    name: 'Individual',
    price: 22.22,
    priceLabel: '$22.22',
    cadence: '/month',
    annualPrice: 133.32,
    annualPriceLabel: '$133.32',
    blurb: 'For solo founders validating a first offer.',
    highlight: false,
    limits: { reqPerMin: 100, reqPerDay: 1000, workflowsPerMonth: 1, auditsPerMonth: 5, storageGB: 1, teamMembers: 1 },
    exports: ['JSON', 'Markdown'],
    integrations: ['Google Drive', 'Obsidian'],
    features: {
      advancedBlueprints: false, whiteLabel: false, apiAccess: false,
      advancedAnalytics: false, customBranding: false, prioritySupport: false,
    },
    support: 'Email support',
    perks: [
      '1 workflow / month',
      '5 audits / month',
      'Basic blueprints',
      'Google Drive & Obsidian',
      'JSON & Markdown export',
      '1 GB storage',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 77.77,
    priceLabel: '$77.77',
    cadence: '/month',
    annualPrice: 466.62,
    annualPriceLabel: '$466.62',
    blurb: 'For growing teams shipping revenue systems.',
    highlight: true,
    limits: { reqPerMin: 500, reqPerDay: 10000, workflowsPerMonth: 20, auditsPerMonth: 50, storageGB: 50, teamMembers: 3 },
    exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs'],
    integrations: ['Google Drive', 'Obsidian', 'Slack', 'GitHub'],
    features: {
      advancedBlueprints: true, whiteLabel: false, apiAccess: false,
      advancedAnalytics: true, customBranding: true, prioritySupport: true,
    },
    support: 'Priority email support',
    perks: [
      '20 workflows / month',
      '50 audits / month',
      'Advanced blueprints',
      'All standard integrations',
      'PDF, Word & Google Docs export',
      'Up to 3 team members',
      'Custom branding (logo, colors)',
      '50 GB storage',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 333.33,
    priceLabel: '$333.33',
    cadence: '/month',
    annualPrice: 1999.98,
    annualPriceLabel: '$1,999.98',
    blurb: 'For agencies running client work at scale.',
    highlight: false,
    limits: { reqPerMin: 2000, reqPerDay: 50000, workflowsPerMonth: null, auditsPerMonth: null, storageGB: 500, teamMembers: null },
    exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs', 'Custom'],
    integrations: ['Google Drive', 'Obsidian', 'Slack', 'GitHub', 'Custom workflows'],
    features: {
      advancedBlueprints: true, whiteLabel: true, apiAccess: true,
      advancedAnalytics: true, customBranding: true, prioritySupport: true,
    },
    support: 'Dedicated support',
    perks: [
      'Unlimited workflows & audits',
      'White-label blueprints',
      'Full API access + webhooks',
      'Unlimited team members',
      'Advanced analytics & reporting',
      'Full white-label branding',
      '500 GB storage',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    priceLabel: 'Custom',
    cadence: '',
    blurb: 'For organizations needing SLAs and control.',
    highlight: false,
    limits: { reqPerMin: null, reqPerDay: null, workflowsPerMonth: null, auditsPerMonth: null, storageGB: null, teamMembers: null },
    exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs', 'Custom', 'Custom integrations'],
    integrations: ['All integrations', 'Custom integrations', 'On-premise option'],
    features: {
      advancedBlueprints: true, whiteLabel: true, apiAccess: true,
      advancedAnalytics: true, customBranding: true, prioritySupport: true,
    },
    support: '24/7 phone & email, dedicated account manager',
    perks: [
      'Everything in Agency',
      'Custom features & integrations',
      'Unlimited everything',
      'On-premise option',
      'Custom dashboards & reports',
      '99.9% uptime SLA',
      '24/7 phone & email support',
      'Dedicated account manager',
    ],
  },
};

export const TIER_ORDER = ['individual', 'business', 'agency', 'enterprise'];

export function getTier(tierId) {
  return TIERS[tierId] || TIERS.individual;
}

export function fmtLimit(v) {
  return v == null ? 'Unlimited' : v.toLocaleString();
}

/** Feature comparison matrix rows for the pricing table. */
export const FEATURE_ROWS = [
  { key: 'workflowsPerMonth', label: 'Workflows / month', kind: 'limit' },
  { key: 'auditsPerMonth', label: 'Audits / month', kind: 'limit' },
  { key: 'reqPerMin', label: 'API requests / min', kind: 'limit' },
  { key: 'reqPerDay', label: 'API requests / day', kind: 'limit' },
  { key: 'storageGB', label: 'Storage (GB)', kind: 'limit' },
  { key: 'teamMembers', label: 'Team members', kind: 'limit' },
  { key: 'advancedBlueprints', label: 'Advanced blueprints', kind: 'bool' },
  { key: 'advancedAnalytics', label: 'Advanced analytics', kind: 'bool' },
  { key: 'customBranding', label: 'Custom branding', kind: 'bool' },
  { key: 'whiteLabel', label: 'White-label', kind: 'bool' },
  { key: 'apiAccess', label: 'API access + webhooks', kind: 'bool' },
  { key: 'prioritySupport', label: 'Priority support', kind: 'bool' },
];

export default TIERS;