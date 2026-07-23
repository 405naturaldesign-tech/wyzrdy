import { integrations } from '../integrations/index.js';
import { recordAiUsage } from '../utils/aiUsage.js';

// Rough token estimate when the provider does not report usage (~4 chars/token).
function estimateTokens(text) {
	return Math.ceil((text || '').length / 4);
}

const CHAT_PROVIDERS = {
	zai: integrations.zai,
	openrouter: integrations.openrouter,
	claude: integrations.claude,
};

/**
 * POST /ai/chat — unified chat entry point for Wyzrdy / Easy Breezy / ForgeSEO.
 * body: { provider?: 'zai'|'openrouter'|'claude', messages: [...], model?, maxTokens?, temperature? }
 */
export const chat = async (req, res) => {
	const { provider = 'zai', messages, model, maxTokens, temperature } = req.body || {};
	const integration = CHAT_PROVIDERS[provider];
	if (!integration) {
		return res.status(422).json({ error: `Unknown chat provider "${provider}"`, available: Object.keys(CHAT_PROVIDERS) });
	}
	if (!Array.isArray(messages) || messages.length === 0) {
		return res.status(422).json({ error: 'messages array is required' });
	}
	const result = await integration.chat({ messages, model, maxTokens, temperature });

	// Persist usage to the ledger for server-side quota enforcement.
	const usage = result?.usage || {};
	const inputTokens = usage.prompt_tokens ?? estimateTokens(messages.map((m) => m.content).join(' '));
	const outputTokens = usage.completion_tokens ?? estimateTokens(
		typeof result?.text === 'string' ? result.text : JSON.stringify(result || ''),
	);
	await recordAiUsage({ userId: req.userId, provider, model, inputTokens, outputTokens });

	res.json({ provider, result });
};
