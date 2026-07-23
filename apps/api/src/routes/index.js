import { Router } from 'express';
import healthCheck from './health-check.js';
import { status, statusOne } from './integrations.js';
import { chat } from './ai.js';
import { generateBlueprint } from './blueprint.js';
import { runStage } from './workflow.js';
import { runAudit } from './audit.js';
import { scrape, composioToolkits } from './scrape.js';
import { health as monitorHealth } from './monitor.js';
import {
    health as testHealth, db as testDb, integrations as testIntegrations,
    env as testEnv, emailTest, paymentTest, security as testSecurity,
    performance as testPerformance,
} from './test.js';
import { ping as perfPing, metrics as perfMetrics, tiers as perfTiers } from './perf.js';
import {
    cryptoQuote, status as paymentStatus, refund,
    listInvoices, invoiceById,
    subscriptionUpgrade, subscriptionDowngrade, subscriptionCancel,
} from './payments.js';
import { requireAuth, perUserRateLimit } from '../middleware/auth.js';
import { requireAIEntitlement } from '../middleware/ai-entitlement.js';
import { tierRateLimit } from '../middleware/tier.js';
import {
    checkoutFounding, checkoutSubscription, checkoutPortal,
    getEntitlement, foundingCount, paymentsConfigStatus,
} from './founding-checkout.js';
import { generateLink, checkoutViralEntry, referralStatus } from './viral-referral.js';
import { captureDeviceFingerprint } from '../middleware/fingerprint.js';

const router = Router();

// Credit-bearing route limiter (per authenticated user).
const aiLimit = perUserRateLimit({ windowMs: 60_000, max: 20 });
const scrapeLimit = perUserRateLimit({ windowMs: 60_000, max: 15 });

export default () => {
    // Public liveness probe (no auth).
    router.get('/health', healthCheck);

    // Performance / load-testing surface (public — used by the browser load tester).
    router.get('/perf/ping', perfPing);
    router.get('/perf/metrics', perfMetrics);
    router.get('/perf/tiers', perfTiers);

    // Integration verification (requires auth).
    router.get('/integrations/status', requireAuth, status);
    router.get('/integrations/status/:name', requireAuth, statusOne);

    // Unified AI chat (auth + tier + per-user rate limit).
    router.post('/ai/chat', requireAuth, requireAIEntitlement, tierRateLimit, aiLimit, chat);

    // Real AI Business Launch Blueprint generation (OpenRouter / deepseek-v4-flash).
    router.post('/ai/blueprint', requireAuth, requireAIEntitlement, tierRateLimit, aiLimit, generateBlueprint);

    // Live multi-stage build workflow (Interpret → Forge → Optimize → Launch → Grow).
    router.post('/ai/workflow', requireAuth, requireAIEntitlement, tierRateLimit, aiLimit, runStage);

    // Real ForgeSEO opportunity audit (OpenRouter + optional Firecrawl fetch).
    router.post('/ai/audit', requireAuth, requireAIEntitlement, tierRateLimit, aiLimit, runAudit);

    // Web scraping / crawling with SSRF protection (auth + rate limit).
    router.post('/scrape', requireAuth, scrapeLimit, scrape);

    // Composio tool orchestration (requires auth).
    router.get('/composio/toolkits', requireAuth, composioToolkits);

    // ---- Payments & subscriptions ----
    // Stripe webhook — MUST be registered with raw body in main.js, NOT here.
    // The single Stripe webhook route is in main.js: POST /webhooks/stripe

    router.get('/payments/crypto-quote', cryptoQuote); // public real-time crypto conversion
    router.get('/payments/status/:id', requireAuth, paymentStatus);
    router.post('/payments/refund', requireAuth, refund);
    router.get('/invoices', requireAuth, listInvoices);
    router.get('/invoices/:id', requireAuth, invoiceById);
    router.post('/subscriptions/upgrade', requireAuth, subscriptionUpgrade);
    router.post('/subscriptions/downgrade', requireAuth, subscriptionDowngrade);
    router.post('/subscriptions/cancel', requireAuth, subscriptionCancel);
    // PayPal and Coinbase webhooks — disabled until signature verification is implemented.
    // router.post('/payments/webhook/paypal', webhookPaypal);
    // router.post('/payments/webhook/coinbase', webhookCoinbase);

    // ---- Founding checkout (uses Stripe SDK, mode: payment) ----
    router.get('/founding/count', foundingCount); // public
    router.get('/payments/config-status', paymentsConfigStatus); // public
    router.get('/entitlement', requireAuth, getEntitlement);
    router.post('/checkout/founding', requireAuth, checkoutFounding);

    // ---- Standard subscription checkout (uses Stripe SDK, mode: subscription) ----
    router.post('/checkout/subscription', requireAuth, checkoutSubscription);
    router.post('/checkout/portal', requireAuth, checkoutPortal);

    // ---- Viral referral pipeline (zero client-side trust) ----
    router.post('/referral/generate-link', requireAuth, captureDeviceFingerprint, generateLink);
    router.post('/checkout/viral-entry', requireAuth, captureDeviceFingerprint, checkoutViralEntry);
    router.get('/referral/status', requireAuth, captureDeviceFingerprint, referralStatus);

    // ---- Diagnostic / prerequisite test surface (public — powers /admin/checklist) ----
    router.get('/test/health', testHealth);
    router.get('/test/db', testDb);
    router.get('/test/integrations', testIntegrations);
    router.get('/test/env', testEnv);
    router.post('/test/email', emailTest);
    router.post('/test/payment', paymentTest);
    router.get('/test/security', testSecurity);
    router.get('/test/performance', testPerformance);

    // Scheduled monitoring agent — health check across all integrations (requires auth).
    router.get('/monitor/health', requireAuth, monitorHealth);

    return router;
};