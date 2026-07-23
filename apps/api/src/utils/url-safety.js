/**
 * SSRF protection for user-supplied URLs (scrape routes).
 * Only http/https public URLs are allowed. Private, loopback, link-local and
 * metadata-endpoint hosts are rejected. Optionally an allow-list of domains
 * can be enforced via SCRAPE_ALLOWED_DOMAINS (comma-separated).
 */
const BLOCKED_HOST_PATTERNS = [
	/^localhost$/i,
	/^127\./,
	/^0\./,
	/^10\./,
	/^192\.168\./,
	/^169\.254\./, // link-local / cloud metadata
	/^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0–172.31.255.255
	/^\[?::1\]?$/,
	/^\[?fc00:/i,
	/^\[?fe80:/i,
	/\.internal$/i,
	/\.local$/i,
	/^metadata\./i,
];

export function assertSafeUrl(raw) {
	let parsed;
	try {
		parsed = new URL(raw);
	} catch (_) {
		const err = new Error('Invalid URL');
		err.statusCode = 422;
		throw err;
	}

	if (!['http:', 'https:'].includes(parsed.protocol)) {
		const err = new Error('Only http and https URLs are allowed');
		err.statusCode = 422;
		throw err;
	}

	const host = parsed.hostname.toLowerCase();
	if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
		const err = new Error('URL host is not permitted (private/loopback address blocked)');
		err.statusCode = 422;
		throw err;
	}

	const allowList = (process.env.SCRAPE_ALLOWED_DOMAINS || '')
		.split(',')
		.map((d) => d.trim().toLowerCase())
		.filter(Boolean);
	if (allowList.length) {
		const ok = allowList.some((d) => host === d || host.endsWith(`.${d}`));
		if (!ok) {
			const err = new Error(`Domain not in allow-list. Permitted: ${allowList.join(', ')}`);
			err.statusCode = 422;
			throw err;
		}
	}

	return parsed;
}

export default assertSafeUrl;
