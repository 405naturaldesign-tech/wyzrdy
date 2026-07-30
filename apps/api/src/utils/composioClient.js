/**
 * Composio Client for wyzrdy
 *
 * Manages Composio session creation and tool access for:
 * - Stripe (payments + checkout sessions via MCP connected account)
 * - Hostinger (website provisioning)
 * - Other integrations (GitHub, Twitter, YouTube, etc.)
 *
 * All Stripe operations SHOULD route through Composio MCP tools, not the
 * raw Stripe SDK. The connected account (ca_2nmiXdU8RIs1) is configured
 * in the Composio dashboard and authorises the app's own Stripe account.
 */

import { Composio } from '@composio/core';
import logger from './logger.js';

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

if (!COMPOSIO_API_KEY) {
	throw new Error('COMPOSIO_API_KEY is required in .env');
}

const composio = new Composio({ apiKey: COMPOSIO_API_KEY });

/**
 * Create a Composio session for a user
 *
 * @param {string} userId - wyzrdy user ID
 * @param {Object} opts - options
 * @param {Array<string>} opts.toolkits - toolkits to enable (default: all)
 * @returns {Promise<Object>} Composio session with tools available
 */
export async function createSession(userId, opts = {}) {
	try {
		const {
			toolkits = [
				'stripe',
				'hostinger',
				'gmail',
				'googledocs',
				'googledrive',
				'googlesheets',
				'twitter',
				'github',
				'perplexityai',
				'firecrawl',
				'codeinterpreter',
				'openrouter',
				'deepseek',
			],
		} = opts;

		const session = await composio.create(userId, {
			toolkits,
			authConfigs: {
				hostinger: process.env.COMPOSIO_AUTH_CONFIG_HOSTINGER || 'ac_Kzk3Vu6Khamy',
				stripe: process.env.COMPOSIO_AUTH_CONFIG_STRIPE || 'ac__kRDZqgAG-Ur',
			},
			connectedAccounts: {
				hostinger: process.env.COMPOSIO_CONNECTED_ACCOUNT_HOSTINGER || 'ca_imd1K1wn6MxS',
				stripe: process.env.COMPOSIO_CONNECTED_ACCOUNT_STRIPE || 'ca_2nmiXdU8RIs1',
			},
			manageConnections: {
				waitForConnections: true,
			},
		});

		logger.info(`[composio] created session for user ${userId}`);
		return session;
	} catch (err) {
		logger.error(`[composio] createSession error: ${err.message}`);
		throw err;
	}
}

/**
 * Get tools from a Composio session
 *
 * @param {Object} session - Composio session
 * @param {Array<string>} toolNames - specific tools to get (optional)
 * @returns {Promise<Array>} array of tool definitions
 */
export async function getTools(session, toolNames = []) {
	try {
		const tools = await session.tools(toolNames.length > 0 ? toolNames : undefined);
		logger.info(`[composio] loaded ${tools.length} tools`);
		return tools;
	} catch (err) {
		logger.error(`[composio] getTools error: ${err.message}`);
		throw err;
	}
}

/**
 * Execute a Composio tool
 *
 * @param {Object} session - Composio session
 * @param {string} toolName - tool identifier (e.g., "STRIPE_CREATE_CUSTOMER")
 * @param {Object} input - tool input parameters
 * @returns {Promise<Object>} tool execution result
 */
export async function executeTool(session, toolName, input = {}) {
	try {
		logger.info(`[composio] executing tool ${toolName}`);

		const result = await session.tools.execute(toolName, input);

		logger.info(`[composio] tool ${toolName} executed successfully`);
		return result;
	} catch (err) {
		logger.error(`[composio] executeTool error (${toolName}): ${err.message}`);
		throw err;
	}
}

/**
 * Hostinger-specific: provision a website
 *
 * @param {string} userId - wyzrdy user ID
 * @param {Object} opts
 * @param {string} opts.domain - customer domain (e.g., "customer-business.com")
 * @param {string} opts.siteName - site display name
 * @param {string} opts.cms - CMS type ("wordpress", "wix", etc.)
 * @param {string} opts.plan - hosting plan ("starter", "professional", "business")
 * @returns {Promise<Object>} provisioning result
 */
export async function provisionHostingerSite(userId, { domain, siteName, cms = 'wordpress', plan = 'professional' } = {}) {
	try {
		if (!domain) throw new Error('domain is required');

		const session = await createSession(userId, { toolkits: ['hostinger'] });

		const result = await executeTool(session, 'HOSTINGER_CREATE_WEBSITE', {
			domain,
			siteName: siteName || domain.split('.')[0],
			cms,
			plan,
		});

		logger.info(`[composio-hostinger] provisioned site ${domain} for user ${userId}`);
		return result;
	} catch (err) {
		logger.error(`[composio-hostinger] provisionHostingerSite error: ${err.message}`);
		throw err;
	}
}

/**
 * Stripe-specific: create a customer
 *
 * @param {string} userId - wyzrdy user ID
 * @param {Object} opts
 * @param {string} opts.email - customer email
 * @param {string} opts.name - customer name (optional)
 * @param {Object} opts.metadata - custom metadata (optional)
 * @returns {Promise<Object>} Stripe customer object
 */
export async function createStripeCustomer(userId, { email, name, metadata = {} } = {}) {
	try {
		if (!email) throw new Error('email is required');

		const session = await createSession(userId, { toolkits: ['stripe'] });

		const result = await executeTool(session, 'STRIPE_CREATE_CUSTOMER', {
			email,
			name: name || undefined,
			metadata,
		});

		logger.info(`[composio-stripe] created customer ${email} for user ${userId}`);
		return result;
	} catch (err) {
		logger.error(`[composio-stripe] createStripeCustomer error: ${err.message}`);
		throw err;
	}
}

/**
 * Stripe-specific: create a payment intent
 *
 * @param {string} userId - wyzrdy user ID
 * @param {Object} opts
 * @param {number} opts.amount - amount in cents
 * @param {string} opts.currency - currency code (default "usd")
 * @param {string} opts.customerId - Stripe customer ID (optional)
 * @param {string} opts.description - payment description
 * @param {Object} opts.metadata - custom metadata
 * @returns {Promise<Object>} Stripe PaymentIntent object
 */
export async function createStripePaymentIntent(userId, { amount, currency = 'usd', customerId, description, metadata = {} } = {}) {
	try {
		if (!amount) throw new Error('amount is required');

		const session = await createSession(userId, { toolkits: ['stripe'] });

		const result = await executeTool(session, 'STRIPE_CREATE_PAYMENT_INTENT', {
			amount,
			currency,
			customer: customerId || undefined,
			description: description || undefined,
			metadata,
		});

		logger.info(`[composio-stripe] created payment intent for ${amount / 100} ${currency.toUpperCase()}`);
		return result;
	} catch (err) {
		logger.error(`[composio-stripe] createStripePaymentIntent error: ${err.message}`);
		throw err;
	}
}

/**
 * Stripe-specific: create a checkout session
 *
 * Routes ALL Stripe checkout operations through Composio MCP so the
 * app does not need STRIPE_SECRET_KEY locally — the connected account
 * in Composio authorises the Stripe API calls.
 *
 * @param {string} userId - wyzrdy user ID (or 'system' for app-level)
 * @param {Object} opts
 * @param {string} opts.mode - 'payment' or 'subscription'
 * @param {Array} opts.lineItems - Stripe line items
 * @param {string} opts.successUrl - redirect on success
 * @param {string} opts.cancelUrl - redirect on cancel
 * @param {string} opts.customerEmail - optional customer email
 * @param {Object} opts.metadata - custom metadata
 * @param {Object} opts.extra - any extra params passed to Stripe
 * @returns {Promise<Object>} { id, url, customer, ...stripe session fields }
 */
export async function createStripeCheckoutSession(userId, {
	mode = 'subscription',
	lineItems = [],
	successUrl = '',
	cancelUrl = '',
	customerEmail = '',
	metadata = {},
	extra = {},
} = {}) {
	if (!lineItems.length || !successUrl || !cancelUrl) {
		throw new Error('lineItems, successUrl, and cancelUrl are required');
	}

	const session = await createSession(userId || 'system', { toolkits: ['stripe'] });
	const result = await executeTool(session, 'STRIPE_CREATE_CHECKOUT_SESSION', {
		mode,
		line_items: lineItems,
		success_url: successUrl,
		cancel_url: cancelUrl,
		customer_email: customerEmail || undefined,
		metadata,
		...extra,
	});

	logger.info(`[composio-stripe] created checkout session ${result?.id} (${mode})`);
	return result;
}

/**
 * Expose whether Stripe is available via Composio connected account.
 * Does not require STRIPE_SECRET_KEY in .env — just COMPOSIO_API_KEY.
 */
export function isStripeConfiguredViaComposio() {
	return Boolean(COMPOSIO_API_KEY) && Boolean(process.env.COMPOSIO_CONNECTED_ACCOUNT_STRIPE || 'ca_2nmiXdU8RIs1');
}
	export default {
	composio,
	createSession,
	getTools,
	executeTool,
	provisionHostingerSite,
	createStripeCustomer,
	createStripePaymentIntent,
	createStripeCheckoutSession,
	isStripeConfiguredViaComposio,
};
