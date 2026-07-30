import zai from './zai.js';
import claude from './claude.js';
import composio from './composio.js';
import openrouter from './openrouter.js';
import gemini from './gemini.js';
import playwright from './playwright.js';
import firecrawl from './firecrawl.js';
import spidercrawly from './spidercrawly.js';
import pydanticMcp from './pydanticMcp.js';
import bs4 from './bs4.js';
import obsidian from './obsidian.js';
import googleDrive from './googleDrive.js';
import hostinger from './hostinger.js';
import logger from '../utils/logger.js';

export const integrations = {
	zai, claude, composio, openrouter, gemini, playwright,
	firecrawl, spidercrawly, pydanticMcp, bs4, obsidian, googleDrive, hostinger,
};

/** Run verify() on every integration in parallel and summarize the results. */
export async function verifyAll() {
	const entries = Object.values(integrations);
	const results = await Promise.all(entries.map(async (i) => {
		try {
			return await i.verify();
		} catch (err) {
			logger.error(`[${i.name}] verify threw: ${err.message}`);
			return { name: i.name, configured: false, reachable: false, status: 'error', detail: err.message };
		}
	}));

	const summary = {
		total: results.length,
		ok: results.filter((r) => r.status === 'ok').length,
		configured: results.filter((r) => r.configured).length,
		not_configured: results.filter((r) => !r.configured).length,
	};
	results.forEach((r) => {
		const line = `[verify] ${r.name}: ${r.status} — ${r.detail}`;
		if (r.status === 'ok') logger.info(line);
		else if (r.status === 'error') logger.warn(line);
		else logger.info(line);
	});
	return { summary, integrations: results, checkedAt: new Date().toISOString() };
}
