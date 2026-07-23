import openrouter from '../integrations/openrouter.js';
import logger from '../utils/logger.js';

const STAGE_META = {
	interpret: 'Interpret the objective — break down the goal, surface assumptions, list clarifying questions.',
	forge: 'Forge the system — design the workflow, map the tasks, identify dependencies.',
	optimize: 'Optimize funnels — analyze conversion points, propose improvements, estimate metrics.',
	launch: 'Launch — produce a launch checklist, timeline, and resource requirements.',
	grow: 'Grow — create a growth strategy, a scaling plan, and the metrics to track.',
};

const VALID = Object.keys(STAGE_META);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempt to pull a JSON object out of an arbitrary model response.
 * Handles: plain JSON, ```json fenced blocks, text before/after JSON,
 * multiple JSON objects (takes the first valid one), and truncated/partial
 * JSON (best-effort brace-balancing repair).
 * Returns the parsed object or null if nothing usable was found.
 */
function extractJson(raw) {
	if (!raw || typeof raw !== 'string') return null;

	const candidates = [];

	// 1) Fenced code blocks (```json ... ``` or ``` ... ```)
	const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
	let fenceMatch;
	while ((fenceMatch = fenceRe.exec(raw)) !== null) {
		candidates.push(fenceMatch[1].trim());
	}

	// 2) The raw string itself (in case it's already clean JSON)
	candidates.push(raw.trim());

	// 3) Scan for balanced {...} substrings, starting from every '{' found,
	// preferring the longest valid match.
	const braceCandidates = [];
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] !== '{') continue;
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let j = i; j < raw.length; j++) {
			const ch = raw[j];
			if (inString) {
				if (escape) {
					escape = false;
				} else if (ch === '\\') {
					escape = true;
				} else if (ch === '"') {
					inString = false;
				}
				continue;
			}
			if (ch === '"') inString = true;
			else if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) {
					braceCandidates.push(raw.slice(i, j + 1));
					break;
				}
			}
		}
	}
	// Longest balanced candidate first (most likely to be the full object).
	braceCandidates.sort((a, b) => b.length - a.length);
	candidates.push(...braceCandidates);

	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			const parsed = JSON.parse(candidate);
			if (parsed && typeof parsed === 'object') return parsed;
		} catch {
			// try a light repair: trim trailing commas / truncated tail
			const repaired = candidate
				.replace(/,\s*([}\]])/g, '$1')
				.trim();
			try {
				const parsed = JSON.parse(repaired);
				if (parsed && typeof parsed === 'object') return parsed;
			} catch {
				// give up on this candidate
			}
		}
	}

	return null;
}

/** Normalize a parsed payload into the { reasoning, title, items } shape the UI expects. */
function normalizeOutput(parsed, stage) {
	if (!parsed || typeof parsed !== 'object') return null;

	const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
	const title = typeof parsed.title === 'string' && parsed.title.trim()
		? parsed.title
		: stage.charAt(0).toUpperCase() + stage.slice(1);

	let items = Array.isArray(parsed.items) ? parsed.items : [];
	items = items
		.filter((it) => it && (it.label || it.detail))
		.map((it) => ({
			label: typeof it.label === 'string' ? it.label : 'Result',
			detail: typeof it.detail === 'string' ? it.detail : JSON.stringify(it).slice(0, 500),
		}));

	if (items.length === 0) return null;

	return { reasoning, title, items };
}

async function generateStageOutput({ objective, stage, context, attempt = 1, maxAttempts = 3 }) {
	const schema = `Return ONLY valid JSON (no markdown fences, no commentary before or after) with exactly this shape:
{
  "reasoning": string (2-4 sentences of your thinking process for this stage),
  "title": string (short title for the stage output),
  "items": [ { "label": string, "detail": string } ] (4-6 concrete, specific results)
}`;

	const strictness = attempt > 1
		? ' IMPORTANT: your previous response could not be parsed as JSON. Respond with ONLY the raw JSON object — no markdown code fences, no explanation, no leading or trailing text.'
		: '';

	const messages = [
		{
			role: 'system',
			content:
				'You are Wyzrdy, an AI business operating system that turns objectives into working revenue systems. ' +
				`For the current stage, ${STAGE_META[stage]} Be concrete and specific — no generic filler. ` +
				schema + strictness,
		},
		{
			role: 'user',
			content:
				`Objective: ${objective.trim()}\n` +
				(context ? `Prior stages: ${JSON.stringify(context).slice(0, 2000)}\n` : '') +
				`\nProduce the "${stage}" stage now as JSON only.`,
		},
	];

	const result = await openrouter.chat({ messages, maxTokens: 1100, temperature: attempt > 1 ? 0.3 : 0.6 });
	const raw = result?.choices?.[0]?.message?.content || '';

	logger.debug(`[workflow] stage=${stage} attempt=${attempt} raw response (first 500 chars): ${raw.slice(0, 500)}`);

	const parsed = extractJson(raw);
	const output = normalizeOutput(parsed, stage);

	if (output) return { output, raw };

	if (attempt < maxAttempts) {
		const delay = 400 * 2 ** (attempt - 1);
		logger.warn(`[workflow] stage=${stage} attempt=${attempt} produced unparseable/empty JSON — retrying in ${delay}ms`);
		await sleep(delay);
		return generateStageOutput({ objective, stage, context, attempt: attempt + 1, maxAttempts });
	}

	logger.error(`[workflow] stage=${stage} exhausted ${maxAttempts} attempts. Last raw response: ${raw.slice(0, 1000)}`);
	const preview = raw ? raw.slice(0, 300) : '(empty response)';
	throw new Error(
		`The AI returned an unparseable response for the "${stage}" stage after ${maxAttempts} attempts. Received: "${preview}${raw.length > 300 ? '…' : ''}". Please try regenerating this stage.`,
	);
}

/**
 * POST /ai/workflow — generate ONE stage of the Wyzrdy build workflow via
 * OpenRouter (deepseek-v4-flash). The frontend calls this once per stage so
 * each stage streams/reveals independently with its own reasoning.
 * body: { objective: string, stage: 'interpret'|'forge'|'optimize'|'launch'|'grow', context?: object }
 */
export const runStage = async (req, res) => {
	const { objective, stage = 'interpret', context } = req.body || {};
	if (!objective || typeof objective !== 'string' || objective.trim().length < 4) {
		return res.status(422).json({ error: 'Please describe your objective (at least a few words).' });
	}
	if (objective.length > 2000) {
		return res.status(422).json({ error: 'Objective is too long (max 2000 characters).' });
	}
	if (!VALID.includes(stage)) {
		return res.status(422).json({ error: `Unknown stage "${stage}"`, stages: VALID });
	}

	if (!openrouter.isConfigured()) {
		return res.status(503).json({ error: 'AI workflow generation is not configured. Set OPENROUTER_API_KEY in apps/api/.env.' });
	}

	const { output } = await generateStageOutput({ objective, stage, context });

	logger.info(`[workflow] stage=${stage} generated for user=${req.userId}`);
	res.json({ stage, output, model: openrouter.defaultModel });
};

export default runStage;
