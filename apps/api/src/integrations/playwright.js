import logger from '../utils/logger.js';

const BROWSER = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const HEADLESS = String(process.env.PLAYWRIGHT_HEADLESS || 'true') === 'true';
const NAV_TIMEOUT = Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS || 30000);
const REMOTE_ENDPOINT = process.env.PLAYWRIGHT_REMOTE_ENDPOINT;
const PROXY = process.env.PLAYWRIGHT_PROXY_SERVER;

const name = 'playwright';

// Playwright runs locally via the `playwright` package (not installed by default —
// it ships large browser binaries). This connector detects availability and
// drives navigation when the package is present.
async function loadPlaywright() {
	try {
		const mod = await import('playwright');
		return mod;
	} catch {
		return null;
	}
}

function isConfigured() {
	return true; // no API key; availability depends on the package being installed
}

async function fetchRendered({ url } = {}) {
	if (!url) throw new Error('[playwright] url is required');
	const pw = await loadPlaywright();
	if (!pw) throw new Error('[playwright] the "playwright" package is not installed in apps/api');
	const launchOpts = { headless: HEADLESS };
	if (PROXY) launchOpts.proxy = { server: PROXY };
	const browser = REMOTE_ENDPOINT
		? await pw[BROWSER].connect(REMOTE_ENDPOINT)
		: await pw[BROWSER].launch(launchOpts);
	try {
		const page = await browser.newPage();
		await page.goto(url, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
		const html = await page.content();
		logger.info('[playwright] fetchRendered ok');
		return { url, html };
	} finally {
		await browser.close();
	}
}

async function verify() {
	const pw = await loadPlaywright();
	if (!pw) {
		return { name, label: 'Playwright', configured: false, reachable: false, status: 'not_installed', detail: '"playwright" package not installed in apps/api', browser: BROWSER };
	}
	return { name, label: 'Playwright', configured: true, reachable: true, status: 'ok', detail: `package available (${BROWSER}, headless=${HEADLESS})` };
}

export default { name, isConfigured, verify, fetchRendered };
