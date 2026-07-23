import { integrations } from '../integrations/index.js';
import { assertSafeUrl } from '../utils/url-safety.js';

/**
 * POST /scrape — unified web-scraping entry point for ForgeSEO opportunity scans.
 * body: { url, provider?: 'firecrawl'|'spidercrawly'|'playwright', formats?, limit? }
 */
export const scrape = async (req, res) => {
	const { url, provider = 'firecrawl', formats, limit } = req.body || {};
	if (!url) {
		return res.status(422).json({ error: 'url is required' });
	}
	try {
		assertSafeUrl(url);
	} catch (err) {
		return res.status(err.statusCode || 422).json({ error: err.message });
	}
	let result;
	switch (provider) {
		case 'firecrawl':
			result = await integrations.firecrawl.scrape({ url, formats });
			break;
		case 'spidercrawly':
			result = await integrations.spidercrawly.crawl({ url, limit });
			break;
		case 'playwright':
			result = await integrations.playwright.fetchRendered({ url });
			break;
		default:
			return res.status(422).json({ error: `Unknown scrape provider "${provider}"`, available: ['firecrawl', 'spidercrawly', 'playwright'] });
	}
	res.json({ provider, result });
};

// GET /composio/toolkits — list available Composio toolkits for the entity.
export const composioToolkits = async (req, res) => {
	const result = await integrations.composio.listToolkits({ limit: Number(req.query.limit) || 50 });
	res.json(result);
};
