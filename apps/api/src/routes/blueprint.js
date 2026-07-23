import openrouter from '../integrations/openrouter.js';
import logger from '../utils/logger.js';

const SECTION_SCHEMA = `Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "offer": { "headline": string, "summary": string, "pricing": string, "differentiators": string[] },
  "audience": { "segment": string, "painPoints": string[], "channels": string[], "budget": string },
  "market": { "position": string, "competitors": string[], "advantage": string },
  "model": { "type": string, "revenueStreams": string[], "keyMetrics": string[] },
  "brand": { "voice": string, "values": string[], "palette": string },
  "landingCopy": { "hero": string, "subhead": string, "cta": string, "bullets": string[] },
  "outreach": { "channel": string, "message": string, "sequence": string[] },
  "taskPlan": { "phases": [ { "name": string, "timeline": string, "tasks": string[] } ] },
  "financials": { "startupCost": string, "monthlyBurn": string, "breakEven": string, "assumptions": string[] },
  "nextAction": { "recommendation": string, "why": string }
}`;

/**
 * POST /ai/blueprint — generate a full, personalized Business Launch Blueprint
 * using OpenRouter (deepseek-v4-flash). Returns structured JSON for all 10
 * Easy Breezy sections. Requires authentication (mounted behind requireAuth).
 * body: { intent: string, idea: string }
 */
export const generateBlueprint = async (req, res) => {
	const { intent = 'start', idea } = req.body || {};
	if (!idea || typeof idea !== 'string' || idea.trim().length < 4) {
		return res.status(422).json({ error: 'Please describe what you want to build (at least a few words).' });
	}
	if (idea.length > 2000) {
		return res.status(422).json({ error: 'Description is too long (max 2000 characters).' });
	}

	if (!openrouter.isConfigured()) {
		return res.status(503).json({
			error: 'AI blueprint generation is not configured. Set OPENROUTER_API_KEY in apps/api/.env.',
		});
	}

	const messages = [
		{
			role: 'system',
			content:
				'You are Easy Breezy, an expert startup strategist. Given a founder intent and idea, produce a concrete, ' +
				'personalized Business Launch Blueprint. Be specific and actionable — no generic filler. ' +
				SECTION_SCHEMA,
		},
		{
			role: 'user',
			content: `Intent: ${intent}\nIdea / situation: ${idea.trim()}\n\nGenerate the blueprint now as JSON only.`,
		},
	];

	const result = await openrouter.chat({ messages, maxTokens: 2200, temperature: 0.6 });
	const raw = result?.choices?.[0]?.message?.content || '';

	let blueprint;
	try {
		const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
		const start = cleaned.indexOf('{');
		const end = cleaned.lastIndexOf('}');
		blueprint = JSON.parse(cleaned.slice(start, end + 1));
	} catch (err) {
		logger.warn(`[blueprint] failed to parse model JSON: ${err.message}`);
		throw new Error('The AI returned an unparseable response. Please try again.');
	}

	logger.info(`[blueprint] generated for user=${req.userId} intent=${intent}`);
	res.json({ intent, idea: idea.trim(), blueprint, model: openrouter.defaultModel });
};

export default generateBlueprint;
