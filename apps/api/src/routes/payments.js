import { TIERS, getTier } from '../config/tiers.js';
import logger from '../utils/logger.js';
import pocketbaseClient from '../utils/pocketbaseClient.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com';
const COINBASE_COMMERCE_KEY = process.env.COINBASE_COMMERCE_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const CRYPTO_IDS = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', USDC: 'usd-coin' };

/** Compute the price (in the smallest tier currency = USD dollars) for a tier + cycle. */
function priceFor(tierId, cycle) {
	const tier = getTier(tierId);
	if (!tier || tier.price == null) return null;
	// Annual = 12 months with 2 free (i.e. ~17% off).
	return cycle === 'annual' ? tier.price * 10 : tier.price;
}

async function savePayment(record) {
	try {
		return await pocketbaseClient.collection('payments').create(record);
	} catch (err) {
		logger.error('[payments] failed to persist payment record', err.message);
		return null;
	}
}

async function createInvoice(owner, { tier, amount, currency, provider, status }) {
	try {
		const number = `WZ-${Date.now().toString(36).toUpperCase()}`;
		return await pocketbaseClient.collection('invoices').create({
			owner, number, tier, amount, currency, provider, status,
			line_items: [{ description: `Wyzrdy ${tier} plan`, amount, currency }],
		});
	} catch (err) {
		logger.error('[payments] failed to create invoice', err.message);
		return null;
	}
}

/* ---------------- provider checkout builders ---------------- */

async function stripeCheckout({ userId, email, tier, cycle, amount, currency }) {
	if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_NOT_CONFIGURED');
	const params = new URLSearchParams();
	params.append('mode', 'subscription');
	params.append('success_url', `${APP_BASE_URL}/dashboard?checkout=success`);
	params.append('cancel_url', `${APP_BASE_URL}/checkout?canceled=1`);
	params.append('customer_email', email || '');
	params.append('client_reference_id', userId);
	params.append('line_items[0][quantity]', '1');
	params.append('line_items[0][price_data][currency]', currency.toLowerCase());
	params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
	params.append('line_items[0][price_data][recurring][interval]', cycle === 'annual' ? 'year' : 'month');
	params.append('line_items[0][price_data][product_data][name]', `Wyzrdy ${tier} (${cycle})`);
	const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params,
	});
	if (!res.ok) throw new Error(`stripe checkout failed: ${res.status} ${res.statusText}`);
	const data = await res.json();
	return { external_id: data.id, checkout_url: data.url };
}

async function paypalCheckout({ tier, cycle, amount, currency }) {
	if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) throw new Error('PAYPAL_NOT_CONFIGURED');
	const authRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: 'grant_type=client_credentials',
	});
	if (!authRes.ok) throw new Error(`paypal auth failed: ${authRes.status} ${authRes.statusText}`);
	const { access_token } = await authRes.json();
	const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			intent: 'CAPTURE',
			purchase_units: [{ amount: { currency_code: currency, value: amount.toFixed(2) }, description: `Wyzrdy ${tier} (${cycle})` }],
			application_context: { return_url: `${APP_BASE_URL}/dashboard?checkout=success`, cancel_url: `${APP_BASE_URL}/checkout?canceled=1` },
		}),
	});
	if (!orderRes.ok) throw new Error(`paypal order failed: ${orderRes.status} ${orderRes.statusText}`);
	const data = await orderRes.json();
	const approve = (data.links || []).find((l) => l.rel === 'approve');
	return { external_id: data.id, checkout_url: approve?.href || '' };
}

async function coinbaseCheckout({ tier, cycle, amount, currency }) {
	if (!COINBASE_COMMERCE_KEY) throw new Error('COINBASE_NOT_CONFIGURED');
	const res = await fetch('https://api.commerce.coinbase.com/charges', {
		method: 'POST',
		headers: { 'X-CC-Api-Key': COINBASE_COMMERCE_KEY, 'X-CC-Version': '2018-03-22', 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: `Wyzrdy ${tier} plan`,
			description: `Wyzrdy ${tier} subscription (${cycle})`,
			pricing_type: 'fixed_price',
			local_price: { amount: amount.toFixed(2), currency },
			redirect_url: `${APP_BASE_URL}/dashboard?checkout=success`,
		}),
	});
	if (!res.ok) throw new Error(`coinbase charge failed: ${res.status} ${res.statusText}`);
	const { data } = await res.json();
	return { external_id: data.id, checkout_url: data.hosted_url };
}

/* ---------------- route handlers ---------------- */

/** GET /payments/crypto-quote?amount=99&currency=USD — real-time crypto conversion. */
export const cryptoQuote = async (req, res) => {
	const amount = Number(req.query.amount);
	if (!amount || amount <= 0) return res.status(422).json({ error: 'amount query param is required' });
	const ids = Object.values(CRYPTO_IDS).join(',');
	const upstream = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
	if (!upstream.ok) throw new Error(`coingecko quote failed: ${upstream.status} ${upstream.statusText}`);
	const prices = await upstream.json();
	const quotes = Object.entries(CRYPTO_IDS).map(([sym, id]) => {
		const usd = prices[id]?.usd || 0;
		return { asset: sym, priceUsd: usd, amount: usd ? Number((amount / usd).toFixed(sym === 'USDC' ? 2 : 6)) : 0 };
	});
	res.json({ fiatAmount: amount, currency: 'USD', quotes, asOf: new Date().toISOString() });
};

/** POST /payments/checkout — initiate a payment for a tier via any provider. */
export const checkout = async (req, res) => {
	const { provider, tier, cycle = 'monthly', currency = 'USD', crypto_asset = '', method = '' } = req.body || {};
	if (!TIERS[tier]) return res.status(422).json({ error: 'A valid plan (tier) is required.' });
	if (!['stripe', 'paypal', 'cashapp', 'whatsapp', 'crypto'].includes(provider)) {
		return res.status(422).json({ error: 'A valid payment provider is required.' });
	}

	// Founding members already hold active access for their first year — no charge required.
	if (req.user?.pilot_member || req.user?.lifetime_free_status) {
		return res.json({ pilot: true, message: 'You already have active founding access — no payment required.', tier });
	}

	if (tier === 'enterprise') {
		return res.json({ contactSales: true, message: 'Enterprise is billed via a tailored agreement. Our team will reach out.' });
	}

	const amount = priceFor(tier, cycle);
	if (amount == null) return res.status(422).json({ error: 'This plan cannot be purchased online.' });

	const base = {
		owner: req.userId, provider, method: method || provider, tier, billing_cycle: cycle,
		amount, currency, crypto_asset, status: 'pending',
	};

	try {
		let result = {};
		if (provider === 'stripe') result = await stripeCheckout({ userId: req.userId, email: req.user?.email, tier, cycle, amount, currency });
		else if (provider === 'paypal') result = await paypalCheckout({ tier, cycle, amount, currency });
		else if (provider === 'crypto') result = await coinbaseCheckout({ tier, cycle, amount, currency });
		else if (provider === 'cashapp' || provider === 'whatsapp') {
			throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);
		}

		const rec = await savePayment({ ...base, status: 'processing', external_id: result.external_id || '', checkout_url: result.checkout_url || '', meta: { cycle } });
		return res.json({ id: rec?.id || null, provider, tier, amount, currency, checkout_url: result.checkout_url, external_id: result.external_id });
	} catch (err) {
		if (String(err.message).endsWith('NOT_CONFIGURED')) {
			await savePayment({ ...base, status: 'failed', meta: { reason: 'provider_not_configured' } });
			return res.status(503).json({
				error: `The ${provider} payment provider is not configured yet. Add its API credentials to apps/api/.env to enable live checkout.`,
				provider,
				needsKeys: true,
			});
		}
		throw err;
	}
};

/** GET /payments/status/:id */
export const status = async (req, res) => {
	try {
		const rec = await pocketbaseClient.collection('payments').getOne(req.params.id);
		if (rec.owner !== req.userId) return res.status(403).json({ error: 'forbidden' });
		return res.json({ id: rec.id, status: rec.status, provider: rec.provider, amount: rec.amount, currency: rec.currency });
	} catch (_) {
		return res.status(404).json({ error: 'Payment not found' });
	}
};

/** POST /payments/refund — request a refund for one of the user's payments. */
export const refund = async (req, res) => {
	const { paymentId } = req.body || {};
	if (!paymentId) return res.status(422).json({ error: 'paymentId is required' });
	let rec;
	try { rec = await pocketbaseClient.collection('payments').getOne(paymentId); }
	catch (_) { return res.status(404).json({ error: 'Payment not found' }); }
	if (rec.owner !== req.userId) return res.status(403).json({ error: 'forbidden' });

	if (rec.provider === 'stripe' && STRIPE_SECRET_KEY && rec.external_id) {
		const r = await fetch('https://api.stripe.com/v1/refunds', {
			method: 'POST',
			headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ payment_intent: rec.external_id }),
		});
		if (!r.ok) throw new Error(`stripe refund failed: ${r.status} ${r.statusText}`);
	}
	await pocketbaseClient.collection('payments').update(paymentId, { status: 'refunded' });
	res.json({ id: paymentId, status: 'refunded' });
};

/* ---------------- webhooks (provider → server) ---------------- */

async function markPaidByExternalId(externalId, provider) {
	if (!externalId) return;
	try {
		const rec = await pocketbaseClient.collection('payments').getFirstListItem(`external_id = "${externalId}"`);
		await pocketbaseClient.collection('payments').update(rec.id, { status: 'paid' });
		await createInvoice(rec.owner, { tier: rec.tier, amount: rec.amount, currency: rec.currency, provider, status: 'paid' });
		// Activate subscription on the user.
		await pocketbaseClient.collection('users').update(rec.owner, {
			subscription_tier: rec.tier,
			subscription_status: 'active',
			billing_cycle: rec.billing_cycle,
			subscription_start: new Date().toISOString(),
		}).catch(() => {});
	} catch (err) {
		logger.error(`[payments] webhook (${provider}) could not match external_id`, externalId, err.message);
	}
}

export const webhookStripe = async (req, res) => {
	const event = req.body || {};
	logger.info('[payments] stripe webhook', event.type || 'unknown');
	if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
		const obj = event.data?.object || {};
		await markPaidByExternalId(obj.id, 'stripe');
	}
	res.json({ received: true });
};

export const webhookPaypal = async (req, res) => {
	const event = req.body || {};
	logger.info('[payments] paypal webhook', event.event_type || 'unknown');
	if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
		await markPaidByExternalId(event.resource?.id, 'paypal');
	}
	res.json({ received: true });
};

export const webhookCoinbase = async (req, res) => {
	const event = req.body?.event || {};
	logger.info('[payments] coinbase webhook', event.type || 'unknown');
	if (event.type === 'charge:confirmed' || event.type === 'charge:resolved') {
		await markPaidByExternalId(event.data?.id, 'crypto');
	}
	res.json({ received: true });
};

/* ---------------- invoices + subscription changes ---------------- */

export const listInvoices = async (req, res) => {
	const items = await pocketbaseClient.collection('invoices').getFullList({ filter: `owner = "${req.userId}"`, sort: '-created' }).catch(() => []);
	res.json({ items });
};

export const invoiceById = async (req, res) => {
	try {
		const rec = await pocketbaseClient.collection('invoices').getOne(req.params.id);
		if (rec.owner !== req.userId) return res.status(403).json({ error: 'forbidden' });
		return res.json(rec);
	} catch (_) {
		return res.status(404).json({ error: 'Invoice not found' });
	}
};

async function changeTier(req, res, direction) {
	const { tier } = req.body || {};
	if (!TIERS[tier]) return res.status(422).json({ error: 'A valid target tier is required.' });
	await pocketbaseClient.collection('users').update(req.userId, { subscription_tier: tier }).catch(() => {});
	res.json({ tier, direction, message: `Subscription ${direction}d to ${tier}.` });
}

export const subscriptionUpgrade = (req, res) => changeTier(req, res, 'upgrade');
export const subscriptionDowngrade = (req, res) => changeTier(req, res, 'downgrade');

export const subscriptionCancel = async (req, res) => {
	await pocketbaseClient.collection('users').update(req.userId, { subscription_status: 'canceled' }).catch(() => {});
	res.json({ status: 'canceled', message: 'Your subscription has been canceled.' });
};
