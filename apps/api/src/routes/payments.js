import { TIERS, getTier } from '../config/tiers.js';
import logger from '../utils/logger.js';
import pocketbaseClient from '../utils/pocketbaseClient.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const CRYPTO_IDS = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', USDC: 'usd-coin' };

/** Compute the price (in USD) for a tier + cycle. */
function priceFor(tierId, cycle) {
	const tier = getTier(tierId);
	if (!tier || tier.price == null) return null;
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