import { captureFingerprint } from '../utils/viral.js';

/**
 * captureDeviceFingerprint — records the authenticated caller's IP, device id
 * (from the X-Device-Id header the frontend sends), and any Stripe payment
 * method fingerprint header. Non-blocking: failures never break the request.
 * MUST run after requireAuth so req.userId is populated.
 */
export function captureDeviceFingerprint(req, _res, next) {
	try {
		if (req.userId) {
			const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.ip || '';
			const deviceId = (req.headers['x-device-id'] || '').toString().slice(0, 200);
			const pmFingerprint = (req.headers['x-pm-fingerprint'] || '').toString().slice(0, 200);
			// Fire and forget.
			captureFingerprint(req.userId, { ip, deviceId, pmFingerprint });
		}
	} catch (_) {
		/* never block */
	}
	next();
}

export default captureDeviceFingerprint;
