import logger from '../utils/logger.js';

/**
 * Startup environment validation.
 *
 * REQUIRED vars cause a fail-fast exit if missing (infrastructure the server
 * cannot run without). RECOMMENDED vars only log a warning — the server still
 * boots, but the related feature (AI, tools, alerts) is disabled until the key
 * is provided. Keep the split honest: only put a var in REQUIRED if the process
 * genuinely cannot serve requests without it.
 */
const REQUIRED = [
	// Stripe is required for any payment functionality.
	// Without STRIPE_SECRET_KEY, all checkout routes return 503.
];

const RECOMMENDED = [
	'OPENROUTER_API_KEY',       // primary LLM router (deepseek-v4-flash)
	'COMPOSIO_API_KEY',         // tool orchestration
	'STRIPE_SECRET_KEY',        // payment processing (test or live)
	'STRIPE_WEBHOOK_SECRET',    // webhook signature verification
];

const OPTIONAL_ALERTS = ['SENDGRID_API_KEY', 'SLACK_WEBHOOK_URL'];

function firstDefined(...names) {
	for (const n of names) {
		if (process.env[n]) return process.env[n];
	}
	return undefined;
}

export function validateEnv() {
	const missingRequired = REQUIRED.filter((k) => !process.env[k]);
	if (missingRequired.length) {
		logger.error(
			`FATAL: missing required env vars: ${missingRequired.join(', ')}. Set them in apps/api/.env and restart.`,
		);
		process.exit(1);
	}

	const missingRecommended = RECOMMENDED.filter((k) => !process.env[k]);
	if (missingRecommended.length) {
		logger.warn(
			`Missing recommended env vars: ${missingRecommended.join(', ')}. ` +
				'Related features are disabled until set.',
		);
	}

	const pbSuper = firstDefined('PB_SUPERUSER_EMAIL', 'POCKETBASE_ADMIN_EMAIL');
	if (!pbSuper) {
		logger.warn(
			'PB_SUPERUSER_EMAIL not set — server-side PocketBase writes (monitor history) are unavailable.',
		);
	}

	const missingAlerts = OPTIONAL_ALERTS.filter((k) => !process.env[k]);
	if (missingAlerts.length === OPTIONAL_ALERTS.length) {
		logger.info('No alert channel configured (SENDGRID_API_KEY / SLACK_WEBHOOK_URL) — monitor alerts will be log-only.');
	}

	logger.info('Environment validation passed.');
}

export default validateEnv;