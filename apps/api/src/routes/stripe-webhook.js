import { isStripeConfiguredViaComposio, executeTool, createSession } from '../utils/composioClient.js';
import { pb, countCompletedFounding, FOUNDING_CAP } from '../utils/founding.js';
import { processViralConversion, processReferralReversal } from '../utils/viral.js';
import { provisionHostingerSite } from '../utils/composioClient.js';
import logger from '../utils/logger.js';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const nowIso = () => new Date().toISOString().replace('T', ' ');

/** Update the founding_purchases row matched by any provided key. */
async function findPurchase({ sessionId, paymentIntentId, subscriptionId }) {
	const clauses = [];
	if (sessionId) clauses.push(`stripe_checkout_session_id = '${sessionId}'`);
	if (paymentIntentId) clauses.push(`stripe_payment_intent_id = '${paymentIntentId}'`);
	if (subscriptionId) clauses.push(`stripe_subscription_id = '${subscriptionId}'`);
	if (!clauses.length) return null;
	try {
		return await pb
			.collection('founding_purchases')
			.getFirstListItem(clauses.join(' || '), { sort: '-created' });
	} catch (_) {
		return null;
	}
}

async function updateReservationBySession(sessionId, status) {
	if (!sessionId) return;
	try {
		const r = await pb
			.collection('founding_reservations')
			.getFirstListItem(`stripe_checkout_session_id = '${sessionId}'`);
		await pb.collection('founding_reservations').update(r.id, { status });
	} catch (_) {
		/* no reservation (subscription flow) */
	}
}

async function handleViralCheckout(session, eventId) {
	const md = session.metadata || {};
	if (md.tier !== 'viral_entry' || !md.referral_code) return false;
	await processViralConversion({
		referralCode: md.referral_code,
		referredUserId: md.user_id || session.client_reference_id,
		referredEmail: session.customer_details?.email || '',
		paymentIntentId: session.payment_intent || session.subscription || '',
		eventId,
	});
	return true;
}

async function handleCheckoutCompleted(session) {
	const purchase = await findPurchase({ sessionId: session.id });
	if (!purchase) {
		logger.warn(`[webhook] no purchase for session ${session.id}`);
		return;
	}
	const patch = {
		payment_status: 'succeeded',
		entitlement_status: 'active',
		completed_at: nowIso(),
		stripe_customer_id: session.customer || purchase.stripe_customer_id || '',
		stripe_payment_intent_id: session.payment_intent || purchase.stripe_payment_intent_id || '',
		stripe_subscription_id: session.subscription || purchase.stripe_subscription_id || '',
	};

	if (purchase.purchase_type === 'founding_lifetime') {
		// Re-check the cap at grant time to prevent overselling.
		const completed = await countCompletedFounding();
		if (completed >= FOUNDING_CAP) {
			// Attempt refund via Composio MCP
			if (session.payment_intent) {
				try {
					const s = await createSession(purchase.user_id, { toolkits: ['stripe'] });
					await executeTool(s, 'STRIPE_CREATE_REFUND', { payment_intent: session.payment_intent });
				} catch (e) {
					logger.error('[webhook] sold-out refund failed', e.message);
				}
			}
			await pb.collection('founding_purchases').update(purchase.id, {
				payment_status: 'failed',
				entitlement_status: 'revoked',
				notes: 'Refunded automatically: founding cap reached.',
			});
			await updateReservationBySession(session.id, 'released');
			return;
		}
	}

	await pb.collection('founding_purchases').update(purchase.id, patch);
	await updateReservationBySession(session.id, 'completed');
	logger.info(`[webhook] granted access for purchase ${purchase.id}`);

	// Auto-provision Hostinger site if domain is provided in metadata
	if (session.metadata?.domain && purchase.user_id) {
		try {
			const hostingerResult = await provisionHostingerSite(purchase.user_id, {
				domain: session.metadata.domain,
				siteName: session.metadata.site_name || session.metadata.domain.split('.')[0],
				cms: session.metadata.cms || 'wordpress',
				plan: session.metadata.hosting_plan || 'professional',
			});
			logger.info(`[webhook] provisioned Hostinger site for ${session.metadata.domain}, siteId: ${hostingerResult.siteId}`);
			await pb.collection('hostinger_provisioning').create({
				customer_id: session.customer || purchase.user_id,
				domain: session.metadata.domain,
				site_id: hostingerResult.siteId,
				status: 'provisioned',
				cms: session.metadata.cms || 'wordpress',
				plan: session.metadata.hosting_plan || 'professional',
				created_at: new Date().toISOString(),
				metadata: JSON.stringify(hostingerResult),
			});
		} catch (err) {
			logger.error(`[webhook] Hostinger provisioning failed for ${session.metadata.domain}: ${err.message}`);
		}
	}

	// Record a referral conversion — only from this verified paid event.
	const referrerId = session.metadata?.referrer_id;
	const referredUser = session.metadata?.user_id || purchase.user_id;
	if (referrerId && referredUser && referrerId !== referredUser) {
		try {
			await pb.collection('referral_conversions').create({
				referrer: referrerId,
				referred_user: referredUser,
				referred_purchase_id: purchase.id,
				conversion_type: 'founding_purchase',
			});
		} catch (err) {
			logger.info(`[webhook] referral conversion skipped: ${err.message}`);
		}
	}
}

async function handleEvent(event) {
	const obj = event.data.object;
	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded': {
			const viral = await handleViralCheckout(obj, event.id);
			if (!viral) await handleCheckoutCompleted(obj);
			break;
		}
		case 'checkout.session.async_payment_failed': {
			const p = await findPurchase({ sessionId: obj.id });
			if (p) await pb.collection('founding_purchases').update(p.id, { payment_status: 'failed' });
			await updateReservationBySession(obj.id, 'released');
			break;
		}
		case 'invoice.paid': {
			const p = await findPurchase({ subscriptionId: obj.subscription });
			if (p) {
				await pb.collection('founding_purchases').update(p.id, {
					entitlement_status: 'active',
					payment_status: 'succeeded',
					subscription_period_end: obj.period_end
						? new Date(obj.period_end * 1000).toISOString().replace('T', ' ')
						: p.subscription_period_end,
				});
			}
			break;
		}
		case 'invoice.payment_failed': {
			const p = await findPurchase({ subscriptionId: obj.subscription });
			if (p) await pb.collection('founding_purchases').update(p.id, { entitlement_status: 'suspended' });
			break;
		}
		case 'customer.subscription.updated': {
			const p = await findPurchase({ subscriptionId: obj.id });
			if (p) {
				await pb.collection('founding_purchases').update(p.id, {
					subscription_period_end: obj.current_period_end
						? new Date(obj.current_period_end * 1000).toISOString().replace('T', ' ')
						: p.subscription_period_end,
				});
			}
			break;
		}
		case 'customer.subscription.deleted': {
			const p = await findPurchase({ subscriptionId: obj.id });
			if (p) await pb.collection('founding_purchases').update(p.id, { entitlement_status: 'revoked' });
			break;
		}
		case 'customer.subscription.created': {
			const p = await findPurchase({ subscriptionId: obj.id });
			if (p) {
				await pb.collection('founding_purchases').update(p.id, {
					subscription_period_end: obj.current_period_end
						? new Date(obj.current_period_end * 1000).toISOString().replace('T', ' ')
						: p.subscription_period_end,
				});
			}
			break;
		}
		case 'charge.refunded': {
			await processReferralReversal({ paymentIntentId: obj.payment_intent, dispute: false });
			const p = await findPurchase({ paymentIntentId: obj.payment_intent });
			if (p) {
				await pb.collection('founding_purchases').update(p.id, {
					refunded_at: nowIso(),
					entitlement_status: 'revoked',
				});
				await updateReservationBySession(p.stripe_checkout_session_id, 'released');
			}
			break;
		}
		case 'charge.dispute.created': {
			await processReferralReversal({ paymentIntentId: obj.payment_intent, dispute: true });
			const p = await findPurchase({ paymentIntentId: obj.payment_intent });
			if (p) await pb.collection('founding_purchases').update(p.id, { entitlement_status: 'suspended' });
			break;
		}
		case 'charge.dispute.closed': {
			const p = await findPurchase({ paymentIntentId: obj.payment_intent });
			if (p) {
				if (obj.status === 'won') {
					await pb.collection('founding_purchases').update(p.id, { entitlement_status: 'active' });
				} else if (obj.status === 'lost') {
					await pb.collection('founding_purchases').update(p.id, { entitlement_status: 'revoked' });
				}
			}
			break;
		}
		default:
			logger.info(`[webhook] unhandled event ${event.type}`);
	}
}

/**
 * POST /webhooks/stripe — registered with express.raw BEFORE json parsing.
 * Verifies the Stripe signature against the raw body, dedupes by event id,
 * then processes. Always returns 200 quickly once verified.
 *
 * NOTE: Signature verification uses the local STRIPE_WEBHOOK_SECRET (crypto,
 * not an API call — Composio cannot replace this). All other Stripe ops
 * (refunds, etc.) route through Composio MCP.
 */
export default async function stripeWebhook(req, res) {
	if (!WEBHOOK_SECRET) {
		return res.status(503).json({ error: 'Stripe webhook not configured (STRIPE_WEBHOOK_SECRET missing).' });
	}

	// Grab the Stripe signing secret from the env — we verify locally.
	// We use the raw Stripe module (not the SDK client) for the constructEvent
	// crypto verification only.
	const sig = req.headers['stripe-signature'];
	let event;
	try {
		const { default: Stripe } = await import('stripe');
		const localStripe = new Stripe('sk_local_only_for_verify', { apiVersion: '2026-06-24' });
		event = localStripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
	} catch (err) {
		logger.error('[webhook] signature verification failed', err.message);
		return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
	}

	// Test mode check: only process live events
	if (!event.livemode) {
		return res.status(200).json({ received: true, testmode: true });
	}

	// Idempotency: bail if we've already recorded this event id.
	try {
		await pb.collection('webhook_events').getFirstListItem(`stripe_event_id = '${event.id}'`);
		return res.status(200).json({ received: true, duplicate: true });
	} catch (_) {
		/* not processed yet */
	}

	let status = 'success';
	try {
		await handleEvent(event);
	} catch (err) {
		status = 'failed';
		logger.error(`[webhook] handler error for ${event.type}: ${err.message}`);
	}

	try {
		await pb.collection('webhook_events').create({
			stripe_event_id: event.id,
			event_type: event.type,
			processed_at: nowIso(),
			status,
		});
	} catch (err) {
		logger.error('[webhook] failed to record event ledger', err.message);
	}

	res.status(200).json({ received: true });
}