import openrouter from '../integrations/openrouter.js';
import firecrawl from '../integrations/firecrawl.js';
import logger from '../utils/logger.js';
import { assertSafeUrl } from '../utils/url-safety.js';

const VALID_TYPES = ['url', 'video', 'product', 'transcript', 'business'];

const TYPE_HINT = {
	url: 'a website URL — analyze the page content, on-page SEO, metadata and conversion elements.',
	video: 'a video topic — analyze YouTube/search opportunity for this topic.',
	product: 'a product description — analyze commercial and informational search opportunity.',
	transcript: 'a transcript — analyze repurposing and search opportunity from this content.',
	business: 'a business name/location — analyze local SEO opportunity.',
};

/** Reuse the tolerant JSON extraction approach. */
function extractJson(raw) {
	if (!raw || typeof raw !== 'string') return null;
	const candidates = [];
	const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
	let m;
	while ((m = fenceRe.exec(raw)) !== null) candidates.push(m[1].trim());
	candidates.push(raw.trim());
	const first = raw.indexOf('{');
	const last = raw.lastIndexOf('}');
	if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));
	for (const c of candidates) {
		if (!c) continue;
		try {
			const p = JSON.parse(c);
			if (p && typeof p === 'object') return p;
		} catch {
			try {
				const p = JSON.parse(c.replace(/,\s*([}\]])/g, '$1'));
				if (p && typeof p === 'object') return p;
			} catch { /* next */ }
		}
	}
	return null;
}

const AUDIT_SCHEMA = `Return ONLY valid JSON (no markdown fences, no prose) with EXACTLY this shape:
{
  "summary": string (2-3 sentence executive summary),
  "score": number (0-100 overall opportunity score),
  "scoreBreakdown": [ { "label": string, "value": number } ] (4-5 sub-scores 0-100: e.g. Keywords, Conversion, Content, Technical, Authority),
  "keywords": {
    "missedThemes": [ { "cluster": string, "intent": string, "volume": string, "detail": string } ] (4-6),
  },
  "conversion": [ { "issue": string, "impact": "high"|"medium"|"low", "fix": string } ] (3-5),
  "content": [ { "gap": string, "detail": string } ] (3-5),
  "technical": [ { "item": string, "status": "ok"|"warn"|"fail", "detail": string } ] (4-6),
  "priorities": [ { "action": string, "impact": "high"|"medium"|"low", "effort": "low"|"medium"|"high", "detail": string } ] (4-6, ranked by impact)
}`;

async function generate({ type, input, pageContent, attempt = 1 }) {
	const strict = attempt > 1 ? ' Your previous reply was not valid JSON. Respond with ONLY the raw JSON object.' : '';
	const messages = [
		{
			role: 'system',
			content:
				'You are ForgeSEO, an evidence-based SEO and conversion audit engine. The user provides ' +
				TYPE_HINT[type] + ' Produce a concrete, specific audit — no generic filler, estimate realistic numbers. ' +
				AUDIT_SCHEMA + strict,
		},
		{
			role: 'user',
			content:
				`Input type: ${type}\nInput: ${input}\n` +
				(pageContent ? `\nFetched page content (truncated):\n${pageContent.slice(0, 6000)}\n` : '') +
				'\nProduce the audit JSON now.',
		},
	];
	const result = await openrouter.chat({ messages, maxTokens: 2200, temperature: attempt > 1 ? 0.3 : 0.55 });
	const raw = result?.choices?.[0]?.message?.content || '';
	const parsed = extractJson(raw);
	if (parsed && typeof parsed.score !== 'undefined') return parsed;
	if (attempt < 3) return generate({ type, input, pageContent, attempt: attempt + 1 });
	throw new Error('The AI returned an unparseable audit response after 3 attempts. Please try again.');
}

/**
 * POST /ai/audit — real ForgeSEO opportunity audit via OpenRouter, with an
 * optional Firecrawl fetch when the input is a URL.
 * body: { type, input }
 */
export const runAudit = async (req, res) => {
	const { type = 'url', input } = req.body || {};
	if (!VALID_TYPES.includes(type)) {
		return res.status(422).json({ error: `Unknown input type "${type}"`, types: VALID_TYPES });
	}
	if (!input || typeof input !== 'string' || input.trim().length < 3) {
		return res.status(422).json({ error: 'Please provide something to scan (at least a few characters).' });
	}
	if (input.length > 8000) {
		return res.status(422).json({ error: 'Input is too long (max 8000 characters).' });
	}
	if (!openrouter.isConfigured()) {
		return res.status(503).json({ error: 'Audit generation is not configured. Set OPENROUTER_API_KEY in apps/api/.env.' });
	}

	let pageContent = '';
	let fetched = false;
	if (type === 'url') {
		let normalized = input.trim();
		if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
		try {
			assertSafeUrl(normalized);
			if (firecrawl.isConfigured()) {
				const scraped = await firecrawl.scrape({ url: normalized, formats: ['markdown'] });
				pageContent = scraped?.data?.markdown || scraped?.markdown || '';
				fetched = Boolean(pageContent);
			}
		} catch (err) {
			logger.warn(`[audit] page fetch skipped: ${err.message}`);
		}
	}

	const audit = await generate({ type, input: input.trim(), pageContent });
	logger.info(`[audit] type=${type} generated for user=${req.userId} (fetched=${fetched})`);
	res.json({ type, input: input.trim(), fetched, audit, model: openrouter.defaultModel });
};

export default runAudit;
