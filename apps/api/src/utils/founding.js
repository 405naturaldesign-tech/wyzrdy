import pb from './pocketbaseClient.js';
import logger from './logger.js';

export const FOUNDING_CAP = 20000;
export const RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Count completed, non-revoked, non-refunded founding purchases. */
export async function countCompletedFounding() {
	const res = await pb.collection('founding_purchases').getList(1, 1, {
		filter:
			"purchase_type = 'founding_lifetime' && payment_status = 'succeeded' && entitlement_status = 'active' && refunded_at = null",
		skipTotal: false,
	});
	return res.totalItems;
}

/** Count currently active (non-expired) reservations. */
export async function countActiveReservations() {
	const nowIso = new Date().toISOString().replace('T', ' ');
	const res = await pb.collection('founding_reservations').getList(1, 1, {
		filter: `status = 'active' && expires_at > '${nowIso}'`,
		skipTotal: false,
	});
	return res.totalItems;
}

/**
 * Lazily expire stale reservations so the counter reflects reality. Runs
 * on-demand (no cron in this environment) whenever availability is checked.
 */
export async function releaseExpiredReservations() {
	const nowIso = new Date().toISOString().replace('T', ' ');
	try {
		const stale = await pb.collection('founding_reservations').getFullList({
			filter: `status = 'active' && expires_at <= '${nowIso}'`,
		});
		for (const r of stale) {
			await pb
				.collection('founding_reservations')
				.update(r.id, { status: 'expired' }, { requestKey: `exp-${r.id}` });
		}
		if (stale.length) logger.info(`[founding] expired ${stale.length} reservations`);
	} catch (err) {
		logger.error('[founding] releaseExpiredReservations failed', err.message);
	}
}

/** Availability snapshot after clearing expired reservations. */
export async function getAvailability() {
	await releaseExpiredReservations();
	const [completed, reserved] = await Promise.all([
		countCompletedFounding(),
		countActiveReservations(),
	]);
	const allocated = completed + reserved;
	return {
		completed_purchases: completed,
		active_reservations: reserved,
		total_cap: FOUNDING_CAP,
		remaining: Math.max(0, FOUNDING_CAP - allocated),
		sold_out: allocated >= FOUNDING_CAP,
	};
}

/** Find the newest purchase record for a user (any type). */
export async function findUserPurchase(userId, purchaseType) {
	const typeFilter = purchaseType ? ` && purchase_type = '${purchaseType}'` : '';
	try {
		return await pb
			.collection('founding_purchases')
			.getFirstListItem(`user_id = '${userId}'${typeFilter}`, { sort: '-created' });
	} catch (_) {
		return null;
	}
}

export { pb };
