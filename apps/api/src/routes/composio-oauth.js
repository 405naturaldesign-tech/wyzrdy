/**
 * Composio OAuth Callback & Integration Management
 *
 * Routes:
 * - POST   /integrations/oauth/init/:toolkitId         — initiate OAuth flow (return Composio auth URL)
 * - GET    /integrations/oauth/callback                — Composio OAuth redirect (auth code → token)
 * - GET    /integrations/connections                   — list user's active connections
 * - DELETE /integrations/connections/:connectionId     — revoke OAuth connection
 * - POST   /integrations/execute/:connectionId/:action — execute action with stored credentials
 */

import logger from '../utils/logger.js';
import { integrations } from '../integrations/index.js';
import pb from '../utils/pocketbaseClient.js';

const COMPOSIO_API_BASE = process.env.COMPOSIO_API_BASE_URL || 'https://backend.composio.dev/api/v3';
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL || 'http://localhost:3001';

/**
 * POST /integrations/oauth/init/:toolkitId
 *
 * Initiates OAuth flow by:
 * 1. Creating an OAuth entity in Composio
 * 2. Returning the auth URL for frontend redirect
 *
 * Body (optional): { redirect_uri }
 * Response: { authUrl, entityId, state }
 */
export const initOAuthFlow = async (req, res) => {
	try {
		const { toolkitId } = req.params;
		const { userId } = req.user;
		const redirectUri = req.body?.redirect_uri || `${CALLBACK_BASE_URL}/api/integrations/oauth/callback`;
		const state = Buffer.from(JSON.stringify({ userId, toolkitId, ts: Date.now() })).toString('base64');

		if (!COMPOSIO_API_KEY) {
			return res.status(503).json({ error: 'Composio not configured', detail: 'COMPOSIO_API_KEY missing' });
		}

		// Create OAuth entity in Composio for this user (or reuse if exists)
		const entityRes = await fetch(`${COMPOSIO_API_BASE}/connected-accounts`, {
			method: 'POST',
			headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				appName: toolkitId,
				userUuid: userId,
				redirectUrl: redirectUri,
			}),
		});

		if (!entityRes.ok) {
			const err = await entityRes.text();
			logger.warn(`[composio-oauth] init failed for toolkit ${toolkitId}: ${entityRes.status} ${err}`);
			return res.status(entityRes.status || 500).json({ error: 'OAuth entity creation failed', detail: err });
		}

		const entityData = await entityRes.json();
		const { redirectUrl } = entityData;

		// Persist pending OAuth state in PocketBase
		const conn = await pb.collection('integrations').create({
			user_id: userId,
			provider: toolkitId,
			status: 'pending',
			state: state,
			created_at: new Date().toISOString(),
		});

		logger.info(`[composio-oauth] initiated OAuth for user ${userId}, toolkit ${toolkitId}, connId ${conn.id}`);

		res.json({
			authUrl: redirectUrl,
			state,
			connectionId: conn.id,
			expires: Date.now() + 600000, // 10 minutes
		});
	} catch (err) {
		logger.error(`[composio-oauth] initOAuthFlow error: ${err.message}`);
		res.status(500).json({ error: 'OAuth init failed', detail: err.message });
	}
};

/**
 * GET /integrations/oauth/callback
 *
 * Composio redirects here after user authorizes the OAuth consent screen.
 *
 * Query params: { code, state }
 * Retrieves credentials and persists them to PocketBase.
 */
export const handleOAuthCallback = async (req, res) => {
	try {
		const { code, state } = req.query;

		if (!code || !state) {
			logger.warn('[composio-oauth] callback missing code or state');
			return res.status(422).json({ error: 'OAuth callback: missing code or state' });
		}

		let stateData;
		try {
			stateData = JSON.parse(Buffer.from(state, 'base64').toString());
		} catch (err) {
			logger.warn('[composio-oauth] callback invalid state');
			return res.status(422).json({ error: 'OAuth callback: invalid state' });
		}

		const { userId, toolkitId } = stateData;

		// Exchange code for credentials via Composio API
		const tokenRes = await fetch(`${COMPOSIO_API_BASE}/connected-accounts/init-token`, {
			method: 'POST',
			headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				appName: toolkitId,
				code,
				clientId: process.env.COMPOSIO_CLIENT_ID,
				clientSecret: process.env.COMPOSIO_CLIENT_SECRET,
			}),
		});

		if (!tokenRes.ok) {
			const err = await tokenRes.text();
			logger.warn(`[composio-oauth] token exchange failed: ${tokenRes.status} ${err}`);
			return res.status(tokenRes.status || 500).json({ error: 'Token exchange failed', detail: err });
		}

		const tokenData = await tokenRes.json();
		const { accessToken, refreshToken, expiresAt } = tokenData;

		// Find and update the pending connection record
		const records = await pb.collection('integrations').getFullList({
			filter: `user_id = "${userId}" && provider = "${toolkitId}" && status = "pending"`,
		});

		if (records.length === 0) {
			logger.warn(`[composio-oauth] no pending connection found for user ${userId}, provider ${toolkitId}`);
			return res.status(404).json({ error: 'No pending OAuth session found' });
		}

		const conn = records[0];
		await pb.collection('integrations').update(conn.id, {
			status: 'connected',
			access_token: accessToken,
			refresh_token: refreshToken || '',
			expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
			connected_at: new Date().toISOString(),
		});

		logger.info(`[composio-oauth] successfully connected user ${userId} to ${toolkitId}, connId ${conn.id}`);

		// Redirect to success page (frontend will handle)
		const successUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings`);
		successUrl.searchParams.set('integration', toolkitId);
		successUrl.searchParams.set('status', 'success');
		res.redirect(successUrl.toString());
	} catch (err) {
		logger.error(`[composio-oauth] handleOAuthCallback error: ${err.message}`);
		const errorUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings`);
		errorUrl.searchParams.set('error', 'oauth_failed');
		errorUrl.searchParams.set('detail', err.message);
		res.redirect(errorUrl.toString());
	}
};

/**
 * GET /integrations/connections
 *
 * List all active OAuth connections for the authenticated user.
 * Response: { connections: [{ id, provider, status, connected_at, expiresAt }] }
 */
export const listConnections = async (req, res) => {
	try {
		const { userId } = req.user;

		const connections = await pb.collection('integrations').getFullList({
			filter: `user_id = "${userId}" && status = "connected"`,
		});

		const sanitized = connections.map((c) => ({
			id: c.id,
			provider: c.provider,
			status: c.status,
			connected_at: c.connected_at,
			expires_at: c.expires_at,
		}));

		res.json({ connections: sanitized });
	} catch (err) {
		logger.error(`[composio-oauth] listConnections error: ${err.message}`);
		res.status(500).json({ error: 'Failed to list connections', detail: err.message });
	}
};

/**
 * DELETE /integrations/connections/:connectionId
 *
 * Revoke an OAuth connection (remove token).
 */
export const revokeConnection = async (req, res) => {
	try {
		const { connectionId } = req.params;
		const { userId } = req.user;

		const conn = await pb.collection('integrations').getOne(connectionId);

		if (conn.user_id !== userId) {
			return res.status(403).json({ error: 'Unauthorized' });
		}

		await pb.collection('integrations').update(connectionId, {
			status: 'revoked',
			access_token: '',
			refresh_token: '',
		});

		logger.info(`[composio-oauth] revoked connection ${connectionId} for user ${userId}`);
		res.json({ success: true, message: 'Connection revoked' });
	} catch (err) {
		logger.error(`[composio-oauth] revokeConnection error: ${err.message}`);
		res.status(500).json({ error: 'Failed to revoke connection', detail: err.message });
	}
};

/**
 * POST /integrations/execute/:connectionId/:action
 *
 * Execute a Composio action using stored OAuth credentials.
 *
 * Body: { input: {...}, params?: {...} }
 * Response: { result, executedAt }
 */
export const executeAction = async (req, res) => {
	try {
		const { connectionId, action } = req.params;
		const { userId } = req.user;
		const { input, params } = req.body || {};

		const conn = await pb.collection('integrations').getOne(connectionId);

		if (conn.user_id !== userId) {
			return res.status(403).json({ error: 'Unauthorized' });
		}

		if (conn.status !== 'connected' || !conn.access_token) {
			return res.status(403).json({ error: 'Connection not active', detail: 'No stored credentials' });
		}

		// Check if token expired and refresh if needed
		if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
			if (!conn.refresh_token) {
				return res.status(403).json({ error: 'Token expired and no refresh token available' });
			}
			// TODO: implement refresh token flow
		}

		// Execute action via Composio
		const actionRes = await fetch(`${COMPOSIO_API_BASE}/actions/execute`, {
			method: 'POST',
			headers: {
				'x-api-key': COMPOSIO_API_KEY,
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${conn.access_token}`,
			},
			body: JSON.stringify({
				appName: conn.provider,
				actionId: action,
				input: input || {},
				...params,
			}),
		});

		if (!actionRes.ok) {
			const err = await actionRes.text();
			logger.warn(`[composio-oauth] action execution failed: ${actionRes.status} ${err}`);
			return res.status(actionRes.status || 500).json({ error: 'Action execution failed', detail: err });
		}

		const result = await actionRes.json();
		logger.info(`[composio-oauth] executed action ${action} for user ${userId}`);

		res.json({ result, executedAt: new Date().toISOString() });
	} catch (err) {
		logger.error(`[composio-oauth] executeAction error: ${err.message}`);
		res.status(500).json({ error: 'Action execution failed', detail: err.message });
	}
};

/**
 * GET /integrations/mcp-server-info
 *
 * Returns MCP server configuration for this OAuth bridge.
 * Used by the frontend to initialize MCP server communication.
 *
 * Response: { mcpServer, transports, capabilities }
 */
export const getMcpServerInfo = async (req, res) => {
	try {
		const { userId } = req.user;

		const connections = await pb.collection('integrations').getFullList({
			filter: `user_id = "${userId}" && status = "connected"`,
		});

		const resources = connections.map((c) => ({
			uri: `composio://${c.provider}/${c.id}`,
			name: c.provider,
			mimeType: 'application/vnd.composio.connection',
		}));

		res.json({
			mcpServer: {
				name: 'wyzrdy-composio-mcp-bridge',
				version: '1.0.0',
			},
			transports: ['stdio', 'sse', 'ws'],
			capabilities: {
				resources: {
					listChanged: true,
					subscribe: true,
				},
				tools: true,
				logging: true,
				roots: false,
			},
			resources,
			toolkits: connections.map((c) => c.provider),
		});
	} catch (err) {
		logger.error(`[composio-oauth] getMcpServerInfo error: ${err.message}`);
		res.status(500).json({ error: 'Failed to get MCP server info', detail: err.message });
	}
};
