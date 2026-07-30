/**
 * Hostinger API Integration
 *
 * Integrates Hostinger website provisioning with wyzrdy's Composio OAuth flow.
 * When a customer pays for a plan, this creates their hosting account + domain + site.
 *
 * API Base: https://api.hostinger.com/v1
 * Docs: https://developers.hostinger.com/docs
 */

import { requestWithRetry, parseBody } from './lib/http.js';
import { enforceQuota } from './lib/quota.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.HOSTINGER_API_KEY;
const BASE_URL = process.env.HOSTINGER_API_BASE_URL || 'https://api.hostinger.com/v1';
const QUOTA = process.env.QUOTA_HOSTINGER_DAILY_REQUESTS || '1000';

const name = 'hostinger';

function isConfigured() {
	return Boolean(API_KEY);
}

function headers() {
	return {
		'Authorization': `Bearer ${API_KEY}`,
		'Content-Type': 'application/json',
	};
}

/**
 * Create a new website on Hostinger account
 *
 * POST /sites
 *
 * @param {Object} opts
 * @param {string} opts.domain - domain name (e.g., "customer-business.com")
 * @param {string} opts.siteName - display name for the site
 * @param {string} opts.cms - CMS type: 'wordpress', 'wix', 'custom', etc.
 * @param {string} opts.plan - hosting plan: 'starter', 'professional', 'business'
 * @returns {Promise<Object>} site creation response: { siteId, domain, status, url }
 */
async function createWebsite({ domain, siteName, cms = 'wordpress', plan = 'professional' } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!domain) throw new Error('[hostinger] createWebsite: domain is required');

	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/sites`, {
		method: 'POST',
		headers: headers(),
		integration: name,
		timeoutMs: 30000,
		body: JSON.stringify({
			domain,
			siteName: siteName || domain.split('.')[0],
			cms,
			plan,
		}),
	});

	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] createWebsite failed: ${res.status} ${res.statusText} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	logger.info(`[hostinger] created website for domain ${domain}, siteId ${body.siteId}`);
	return body;
}

/**
 * Get website details
 *
 * GET /sites/:siteId
 *
 * @param {string} siteId - site ID from createWebsite response
 * @returns {Promise<Object>} site details: { siteId, domain, status, url, plan, cms }
 */
async function getWebsite(siteId) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId) throw new Error('[hostinger] getWebsite: siteId is required');

	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}`, {
		method: 'GET',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
	});

	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] getWebsite failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	return body;
}

/**
 * List all websites
 *
 * GET /sites
 *
 * @param {Object} opts
 * @param {number} opts.limit - max results (default 50)
 * @param {string} opts.status - filter by status: 'active', 'suspended', 'pending'
 * @returns {Promise<Array>} array of sites
 */
async function listWebsites({ limit = 50, status } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');

	enforceQuota(name, QUOTA);

	let url = `${BASE_URL}/sites?limit=${limit}`;
	if (status) url += `&status=${status}`;

	const res = await requestWithRetry(url, {
		method: 'GET',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
	});

	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] listWebsites failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	return body.sites || [];
}

/**
 * Create a DNS record
 *
 * POST /sites/:siteId/dns-records
 *
 * @param {Object} opts
 * @param {string} opts.siteId - site ID
 * @param {string} opts.name - subdomain (e.g., "www", "@", "mail")
 * @param {string} opts.type - DNS record type: "A", "AAAA", "CNAME", "MX", "TXT", "NS"
 * @param {string} opts.value - record value (IP, hostname, text)
 * @param {number} opts.ttl - time to live (default 3600)
 * @param {number} opts.priority - priority (for MX records)
 * @returns {Promise<Object>} created DNS record
 */
async function createDNSRecord({ siteId, name, type, value, ttl = 3600, priority } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId || !name || !type || !value) {
		throw new Error('[hostinger] createDNSRecord: siteId, name, type, value are required');
	}

	enforceQuota(name, QUOTA);

	const body = {
		name,
		type,
		value,
		ttl,
	};
	if (priority !== undefined) body.priority = priority;

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}/dns-records`, {
		method: 'POST',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
		body: JSON.stringify(body),
	});

	const responseBody = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] createDNSRecord failed: ${res.status} — ${JSON.stringify(responseBody).slice(0, 300)}`);
	}

	logger.info(`[hostinger] created DNS record ${type} ${name} for site ${siteId}`);
	return responseBody;
}

/**
 * Get all DNS records for a site
 *
 * GET /sites/:siteId/dns-records
 *
 * @param {string} siteId - site ID
 * @param {Object} opts
 * @param {number} opts.limit - max results (default 50)
 * @returns {Promise<Array>} array of DNS records
 */
async function listDNSRecords(siteId, { limit = 50 } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId) throw new Error('[hostinger] listDNSRecords: siteId is required');

	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}/dns-records?limit=${limit}`, {
		method: 'GET',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
	});

	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] listDNSRecords failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	return body.records || [];
}

/**
 * Update a DNS record
 *
 * PATCH /sites/:siteId/dns-records/:recordId
 *
 * @param {Object} opts
 * @param {string} opts.siteId - site ID
 * @param {string} opts.recordId - DNS record ID
 * @param {string} opts.value - new value
 * @param {number} opts.ttl - new TTL
 * @returns {Promise<Object>} updated DNS record
 */
async function updateDNSRecord({ siteId, recordId, value, ttl } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId || !recordId) throw new Error('[hostinger] updateDNSRecord: siteId, recordId required');

	enforceQuota(name, QUOTA);

	const body = {};
	if (value) body.value = value;
	if (ttl) body.ttl = ttl;

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}/dns-records/${recordId}`, {
		method: 'PATCH',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
		body: JSON.stringify(body),
	});

	const responseBody = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] updateDNSRecord failed: ${res.status} — ${JSON.stringify(responseBody).slice(0, 300)}`);
	}

	logger.info(`[hostinger] updated DNS record ${recordId} for site ${siteId}`);
	return responseBody;
}

/**
 * Delete a DNS record
 *
 * DELETE /sites/:siteId/dns-records/:recordId
 *
 * @param {string} siteId - site ID
 * @param {string} recordId - DNS record ID
 * @returns {Promise<Object>} success response
 */
async function deleteDNSRecord(siteId, recordId) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId || !recordId) throw new Error('[hostinger] deleteDNSRecord: siteId, recordId required');

	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}/dns-records/${recordId}`, {
		method: 'DELETE',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
	});

	if (!res.ok) {
		const body = await parseBody(res);
		throw new Error(`[hostinger] deleteDNSRecord failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	logger.info(`[hostinger] deleted DNS record ${recordId} for site ${siteId}`);
	return { success: true };
}

/**
 * Get website analytics
 *
 * GET /sites/:siteId/analytics
 *
 * @param {string} siteId - site ID
 * @param {Object} opts
 * @param {string} opts.period - 'day', 'week', 'month', 'year'
 * @returns {Promise<Object>} analytics data: { visits, pageViews, uniqueVisitors, etc. }
 */
async function getAnalytics(siteId, { period = 'month' } = {}) {
	if (!isConfigured()) throw new Error('[hostinger] HOSTINGER_API_KEY not configured');
	if (!siteId) throw new Error('[hostinger] getAnalytics: siteId is required');

	enforceQuota(name, QUOTA);

	const res = await requestWithRetry(`${BASE_URL}/sites/${siteId}/analytics?period=${period}`, {
		method: 'GET',
		headers: headers(),
		integration: name,
		timeoutMs: 20000,
	});

	const body = await parseBody(res);
	if (!res.ok) {
		throw new Error(`[hostinger] getAnalytics failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
	}

	return body;
}

/**
 * Verify API connectivity and credentials
 *
 * @returns {Promise<Object>} { name, label, configured, reachable, status, detail }
 */
async function verify() {
	if (!isConfigured()) {
		return {
			name,
			label: 'Hostinger',
			configured: false,
			reachable: false,
			status: 'not_configured',
			detail: 'HOSTINGER_API_KEY missing',
		};
	}

	try {
		const res = await requestWithRetry(`${BASE_URL}/sites?limit=1`, {
			method: 'GET',
			headers: headers(),
			integration: name,
			timeoutMs: 20000,
		});

		const ok = res.ok;
		if (!ok) await parseBody(res);

		return {
			name,
			label: 'Hostinger',
			configured: true,
			reachable: ok,
			status: ok ? 'ok' : 'error',
			detail: `${res.status} ${res.statusText}`,
		};
	} catch (err) {
		return {
			name,
			label: 'Hostinger',
			configured: true,
			reachable: false,
			status: 'error',
			detail: err.message,
		};
	}
}

export default {
	name,
	isConfigured,
	verify,
	createWebsite,
	getWebsite,
	listWebsites,
	createDNSRecord,
	listDNSRecords,
	updateDNSRecord,
	deleteDNSRecord,
	getAnalytics,
};
