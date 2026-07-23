/**
 * Canonical subscription tier definitions — the single source of truth for
 * backend rate limiting, quota enforcement, and feature gating.
 *
 * The frontend keeps a mirror of this data in apps/web/src/lib/tiers.js for
 * UI rendering. Keep the two in sync when limits change.
 *
 * `null` for a numeric limit means "unlimited".
 */
export const TIERS = {
	individual: {
		id: 'individual',
		name: 'Individual',
		price: 22.22,
		priceLabel: '$22.22',
		blurb: 'For solo founders validating a first offer.',
		limits: {
			reqPerMin: 100,
			reqPerDay: 1000,
			workflowsPerMonth: 1,
			auditsPerMonth: 5,
			storageGB: 1,
			teamMembers: 1,
		},
		exports: ['JSON', 'Markdown'],
		integrations: ['Google Drive', 'Obsidian'],
		features: {
			advancedBlueprints: false,
			whiteLabel: false,
			apiAccess: false,
			advancedAnalytics: false,
			customBranding: false,
			prioritySupport: false,
		},
		support: 'Email support',
	},
	business: {
		id: 'business',
		name: 'Business',
		price: 77.77,
		priceLabel: '$77.77',
		blurb: 'For growing teams shipping revenue systems.',
		limits: {
			reqPerMin: 500,
			reqPerDay: 10000,
			workflowsPerMonth: 20,
			auditsPerMonth: 50,
			storageGB: 50,
			teamMembers: 3,
		},
		exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs'],
		integrations: ['Google Drive', 'Obsidian', 'Slack', 'GitHub'],
		features: {
			advancedBlueprints: true,
			whiteLabel: false,
			apiAccess: false,
			advancedAnalytics: true,
			customBranding: true,
			prioritySupport: true,
		},
		support: 'Priority email support',
	},
	agency: {
		id: 'agency',
		name: 'Agency',
		price: 333.33,
		priceLabel: '$333.33',
		blurb: 'For agencies running client work at scale.',
		limits: {
			reqPerMin: 2000,
			reqPerDay: 50000,
			workflowsPerMonth: null,
			auditsPerMonth: null,
			storageGB: 500,
			teamMembers: null,
		},
		exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs', 'Custom'],
		integrations: ['Google Drive', 'Obsidian', 'Slack', 'GitHub', 'Custom workflows'],
		features: {
			advancedBlueprints: true,
			whiteLabel: true,
			apiAccess: true,
			advancedAnalytics: true,
			customBranding: true,
			prioritySupport: true,
		},
		support: 'Dedicated support',
	},
	enterprise: {
		id: 'enterprise',
		name: 'Enterprise',
		price: null,
		priceLabel: 'Custom',
		blurb: 'For organizations needing SLAs and control.',
		limits: {
			reqPerMin: null,
			reqPerDay: null,
			workflowsPerMonth: null,
			auditsPerMonth: null,
			storageGB: null,
			teamMembers: null,
		},
		exports: ['JSON', 'Markdown', 'PDF', 'Word', 'Google Docs', 'Custom', 'Custom integrations'],
		integrations: ['All integrations', 'Custom integrations', 'On-premise option'],
		features: {
			advancedBlueprints: true,
			whiteLabel: true,
			apiAccess: true,
			advancedAnalytics: true,
			customBranding: true,
			prioritySupport: true,
		},
		support: '24/7 phone & email, dedicated account manager',
	},
};

export const TIER_ORDER = ['individual', 'business', 'agency', 'enterprise'];

export function getTier(tierId) {
	return TIERS[tierId] || TIERS.individual;
}

export default TIERS;