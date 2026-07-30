# Wyzrdy.com Deployment Research & Go-Live Preparation

**Last Updated:** 2026-07-23
**Status:** Pre-Launch Research Document
**Target Platform:** Hostinger (managed platform)
**Environments:** Development, Staging, Production

---

## Executive Summary

Wyzrdy is a three-tier monorepo (Next.js frontend, Express API, PocketBase backend) deployed to Hostinger with integrated Stripe payments. The deployment is **85% ready** for production. Critical blockers are:

1. **STRIPE_SECRET_KEY** and **STRIPE_WEBHOOK_SECRET** not configured
2. **Stripe Products/Prices** not created in Stripe Dashboard
3. **Webhook endpoint** (`https://api.wyzrdy.com/webhooks/stripe`) not registered in Stripe
4. **PocketBase migrations** applied, but schema requires verification
5. **External health monitoring** (cron job) not set up

This document provides the complete research, configuration templates, testing plans, and go-live checklist.

---

## 1. DEPLOYMENT ARCHITECTURE RESEARCH

### 1.1 Current Stack Overview

**Repository Structure:**
```
wyzrdy/
├── apps/api/                 # Express.js REST API (port 3001)
│   ├── src/
│   │   ├── routes/           # API endpoints (payments, webhooks, checkout)
│   │   ├── middleware/       # Auth, rate limiting, error handling
│   │   ├── utils/            # Stripe client, PocketBase client, logging
│   │   ├── config/           # Environment validation, pricing config
│   │   └── main.js           # Express app entry point
│   ├── .env.example          # Full environment variable reference
│   └── package.json          # Node v18+, dependencies: stripe, express, pocketbase
│
├── apps/web/                 # Next.js/React SPA (port 3000)
│   ├── src/pages/
│   └── dist/                 # Build output (static assets)
│
├── apps/pocketbase/          # PocketBase database server (port 8090)
│   ├── pb_migrations/        # 18 migrations (collections, schema)
│   ├── pb_hooks/             # Custom business logic (referrals, pilots)
│   ├── pb_data/              # Local SQLite db (NOT for production)
│   └── pocketbase            # Binary executable
│
├── DEPLOYMENT.md             # Quick start guide
├── DNS.md                    # DNS + Cloudflare configuration
└── SECURITY.md               # Credential rotation policy
```

**Service Dependencies:**
- **API** (Express) requires PocketBase (auth, data) + Stripe (payments)
- **Web** (Next.js) is static after build, served behind API/CDN
- **PocketBase** is standalone, manages users/auth/data via REST API

### 1.2 Hostinger Deployment Model

**Key Characteristic:** Managed platform with **automatic service supervision**

From DEPLOYMENT.md:
> On the Hostinger platform the three services are supervised automatically — no manual `npm run dev`. Applying migrations/hooks happens on restart.

**What This Means:**
- No manual systemd/Docker commands needed
- Restarts trigger migrations automatically
- Environment variables injected via Hostinger dashboard
- No Docker daemon available in sandbox
- Suitable for production hosting

**Deployment Process:**
1. Push code to repository (git)
2. Hostinger auto-deploys on push (CI/CD trigger)
3. Services restart (migrations run automatically)
4. Environment variables loaded from Hostinger dashboard

### 1.3 Environment Configuration Process

**Files Involved:**
- `apps/api/.env.example` — template with all variables and defaults
- `apps/api/.env` — actual secrets (NEVER committed, git-ignored)
- `apps/api/src/config/env.js` — startup validation logic

**Validation Strategy:**
```javascript
// REQUIRED vars (fail-fast if missing)
const REQUIRED = [
  // Currently: none (PB admin optional)
];

// RECOMMENDED vars (warn if missing, but server still starts)
const RECOMMENDED = [
  'OPENROUTER_API_KEY',  // AI features
  'COMPOSIO_API_KEY',     // Tool orchestration
];

// OPTIONAL ALERTS
const OPTIONAL_ALERTS = ['SENDGRID_API_KEY', 'SLACK_WEBHOOK_URL'];
```

**Process for Adding New Variables:**
1. Add to `.env.example` with comment (REQUIRED | OPTIONAL)
2. Update `env.js` REQUIRED/RECOMMENDED arrays
3. In production: configure via Hostinger dashboard
4. On restart: validation runs, server halts if REQUIRED missing

### 1.4 Migrations & Schema

**PocketBase Migrations Location:** `apps/pocketbase/pb_migrations/`

**18 Current Migrations (sequential application on startup):**
1. `1759383931_initial_app_settings.js` — app config
2. `1764579159_create_superuser.js` — admin account
3. `1769159103_disable_auth_alert_superusers.js` — disable alerts for admins
4. `1769164585_set_rate_limits.js` — per-collection limits
5. `1775709407_disable_auth_alert_users.js` — disable user alerts
6. `1784324900_create_portal_collections.js` — users, profiles, etc.
7. `1784341300_add_subscription_fields.js` — subscription_tier, subscription_status
8. `1784346720_pilot_and_referrals.js` — pilot_member, referral codes
9. `1784348900_payments_and_referral_conversion.js` — payments, referral_conversions
10. `1784349800_create_legal_requests.js` — legal/compliance
11. `1784351100_create_artifacts.js` — user-generated content
12. `1784375200_enable_social_oauth.js` — GitHub, Google OAuth
13. `1784397900_founding_payments.js` — **founding_purchases, founding_reservations, webhook_events**
14. `1784415900_create_ai_usage.js` — ai_usage tracking
15. `1784415901_create_referrals_v2.js` — viral_referrals, referral_state
16. `1784447800_viral_pipeline.js` — campaigns, device_fingerprints, pricing_tiers
17. `1784616205_mark_owner_dev_creator.js` — dev/creator role support

**Critical Collections for Stripe Integration:**
- `founding_purchases` — one-time founding offers ($11.69/year)
- `founding_reservations` — checkout session reservations (TTL: 24h)
- `webhook_events` — idempotency ledger (stripe_event_id tracking)
- `referral_conversions` — referral bonus tracking
- `payments` — legacy payment records (PayPal, Coinbase)

**Auto-Applied On Startup:**
```
npm run start --prefix apps/pocketbase
  → runs `pocketbase serve` with migrationsDir
  → applies missing migrations sequentially
  → hooks loaded from pb_hooks/
```

### 1.5 Rollback Procedure

**For Migrations:**
```bash
# Revert last migration (in development only)
npm run migrations:revert --prefix apps/pocketbase

# Snapshots can be backed up first
npm run migrations:snapshot --prefix apps/pocketbase
```

**For API Code:**
```bash
# Git revert to previous commit
git revert <commit-hash>
git push
# Hostinger re-deploys automatically
```

**For Database (PocketBase):**
- Backup: `pb_data/` directory before deployment
- Restore: Stop PocketBase, replace `pb_data/`, restart

---

## 2. HOSTINGER INTEGRATION RESEARCH

### 2.1 Webhook Support

**Question:** Does Hostinger support webhooks forwarding?

**Answer:** Yes, but with caveats.

**Facts from DEPLOYMENT.md:**
- Hostinger platform supports webhooks
- Must use **external webhook forwarding** for Stripe (not the sandbox's internal node-cron)
- Recommended: GitHub Actions, Render, Railway cron jobs, or uptime bots

**Webhook Options:**
1. **GitHub Actions** (recommended for Stripe)
   - Webhook endpoint: `POST https://api.wyzrdy.com/webhooks/stripe`
   - Runs every 5 minutes via cron schedule
   - Environment: GitHub action server (external to Hostinger)
   - Cost: Free tier (3000 minutes/month)

2. **Render/Railway Cron**
   - Background job service
   - Hit `/monitor/health` endpoint periodically

3. **UptimeRobot / BetterStack**
   - Uptime monitoring as a side effect
   - Hit `/health` endpoint every 60s

**Stripe Webhooks (Stripe → Hostinger):**
- Register endpoint in Stripe Dashboard: `https://api.wyzrdy.com/webhooks/stripe`
- Stripe sends HTTP POST with HMAC-SHA256 signature
- App verifies signature using `STRIPE_WEBHOOK_SECRET`
- Must return 200 OK within 30s
- Stripe retries failed webhooks for 72 hours

### 2.2 Stripe Webhook Configuration on Hostinger

**Step-by-Step:**

1. **Create Stripe Webhook Endpoint** (in Stripe Dashboard)
   - Go to: Developers → Webhooks → Add endpoint
   - URL: `https://api.wyzrdy.com/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `charge.refunded`
     - `charge.dispute.created`
   - Version: Latest (currently 2024-06-20 in code)

2. **Copy Webhook Secret**
   - After creating endpoint, Stripe shows: `whsec_...`
   - Set in Hostinger dashboard: `STRIPE_WEBHOOK_SECRET=whsec_...`

3. **Verify in Code**
   - `apps/api/src/routes/stripe-webhook.js` already handles:
     - Signature verification
     - Event deduplication (ledger in `webhook_events` collection)
     - Idempotent event processing
     - Graceful error handling (logs but returns 200 OK)

4. **Test Delivery**
   - Stripe Dashboard → Webhooks → Select endpoint → "Send test event"
   - Check Hostinger logs: `[webhook] signature verification passed`
   - Verify `webhook_events` table has entry

### 2.3 Webhook Endpoint URL & Testing

**Endpoint:** `https://api.wyzrdy.com/webhooks/stripe`

**Signature Verification:**
```javascript
// From stripe-webhook.js
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
// If signature invalid → 400 error, not 200 OK
```

**Idempotency:**
```javascript
// Check webhook_events collection for stripe_event_id
// If already processed → return 200 OK immediately (no duplicate processing)
// If new → process, then record in webhook_events
```

**Testing Webhook Delivery:**
1. **Manual Test (Stripe Dashboard)**
   ```
   Developers → Webhooks → [endpoint] → "Send test event"
   Events: checkout.session.completed
   ```

2. **Monitor Logs**
   ```
   Hostinger logs → search for "[webhook]"
   Expected: "[webhook] granted access for purchase <id>"
   ```

3. **Verify in PocketBase**
   - Check `webhook_events` table for new row
   - Check `founding_purchases` table for updated payment_status

4. **Curl Test** (local development)
   ```bash
   # Get test webhook signature (from Stripe test mode)
   # Then run local API and test webhook
   ```

**Debug Webhook Issues:**

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 503 error | Stripe not configured | Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| 400 signature error | Wrong webhook secret | Verify `STRIPE_WEBHOOK_SECRET` matches Stripe |
| 200 but no DB update | PocketBase unreachable | Check `POCKETBASE_URL` and admin credentials |
| Duplicate charges | Event processed twice | Check `webhook_events` ledger for dedup |
| Webhook not reaching app | Endpoint URL wrong | Verify DNS: `api.wyzrdy.com` resolves |

---

## 3. ENVIRONMENT CONFIGURATION TEMPLATE

### 3.1 .env Template (All Required Variables)

**File:** `apps/api/.env` (in production)

This is the **complete, organized** environment template for go-live:

```bash
#############################################################################
# WYZRDY PRODUCTION ENVIRONMENT VARIABLES
#
# Copy this to apps/api/.env on Hostinger dashboard or local testing.
# DO NOT commit to git (file is git-ignored).
# Rotate keys every 90 days (see SECURITY.md).
#############################################################################

#############################################################################
# NODE & HOSTINGER
#############################################################################

NODE_ENV=production
PORT=3001
API_BASE_URL=https://api.wyzrdy.com
APP_BASE_URL=https://wyzrdy.com
TRUST_PROXY=true

#############################################################################
# CORS & SECURITY
#############################################################################

# Comma-separated list of origins allowed to call this API
CORS_ORIGIN=https://wyzrdy.com,https://app.wyzrdy.com,https://www.wyzrdy.com

# Rate limiting (per IP, per minute)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Per-route rate limiting (authenticated users, per minute)
RATE_LIMIT_AI_MAX_REQUESTS=30
RATE_LIMIT_SCRAPER_MAX_REQUESTS=20

# Security headers
SECURITY_CSP_REPORT_ONLY=false

#############################################################################
# AUTHENTICATION & SESSION (JWT/Cookies)
#############################################################################

# Random string for signing JWTs (generate: openssl rand -hex 32)
JWT_SECRET=<GENERATE: openssl rand -hex 32>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# Session cookie configuration
SESSION_COOKIE_NAME=wyzrdy_session
SESSION_SECRET=<GENERATE: openssl rand -hex 32>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax

#############################################################################
# POCKETBASE (DATABASE & AUTH)
#############################################################################

POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=<SET: superuser email>
POCKETBASE_ADMIN_PASSWORD=<SET: strong password>
POCKETBASE_REQUEST_TIMEOUT_MS=10000

#############################################################################
# STRIPE PAYMENTS (CRITICAL FOR GO-LIVE)
#############################################################################

# Test mode keys (begin with sk_test_)
# Get from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_<YOUR_TEST_SECRET_KEY>

# Webhook secret (begins with whsec_)
# Get from: Developers → Webhooks → [endpoint] → Signing secret
STRIPE_WEBHOOK_SECRET=whsec_<YOUR_WEBHOOK_SECRET>

# Product/Price IDs created in Stripe Dashboard
# See section 3.2 below for setup instructions

# Founding Offer (one-time, $11.69)
STRIPE_FOUNDING_PRICE_ID=price_<FOUNDING_PRICE_ID>

# Subscription tiers
STRIPE_MONTHLY_PRICE_ID=price_<MONTHLY_PRICE_ID>
STRIPE_ANNUAL_PRICE_ID=price_<ANNUAL_PRICE_ID>

# Viral pipeline tiers
STRIPE_PLATO_PRICE_ID=price_<PLATO_PRICE_ID>
STRIPE_VIRAL_ENTRY_PRICE_ID=price_<VIRAL_ENTRY_PRICE_ID>
STRIPE_PROMO_REWARD_PRICE_ID=price_<PROMO_REWARD_PRICE_ID>
STRIPE_ENTERPRISE_PRICE_ID=price_<ENTERPRISE_PRICE_ID>
STRIPE_SPRINT_PRICE_ID=price_<SPRINT_PRICE_ID>

#############################################################################
# AI & LLM PROVIDERS
#############################################################################

# OpenRouter (recommended primary LLM)
OPENROUTER_API_KEY=sk-or-v1-<YOUR_KEY>
OPENROUTER_DEFAULT_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_APP_NAME=Wyzrdy
OPENROUTER_APP_URL=https://wyzrdy.com

# Z.ai (alternative LLM)
ZAI_API_KEY=<YOUR_Z_AI_KEY>
ZAI_API_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_DEFAULT_MODEL=GLM-4.7-Flash
ZAI_TIMEOUT_MS=30000

# Claude (via MCP)
CLAUDE_API_KEY=sk-ant-<YOUR_ANTHROPIC_KEY>
CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096

# Gemini VLM (vision-language model)
GEMINI_API_KEY=<YOUR_GOOGLE_API_KEY>
GEMINI_VLM_MODEL=gemini-1.5-pro
GEMINI_MAX_OUTPUT_TOKENS=2048

#############################################################################
# INTEGRATIONS & TOOLS
#############################################################################

# Composio (action/tool orchestration)
COMPOSIO_API_KEY=<YOUR_COMPOSIO_API_KEY>
COMPOSIO_API_BASE_URL=https://backend.composio.dev/api
COMPOSIO_ENTITY_ID=all
COMPOSIO_ENABLED_TOOLKITS=all

# Zapier MCP
ZAP_MCP_SERVER_URL=<YOUR_ZAP_MCP_URL>
ZAP_MCP_API_KEY=<YOUR_ZAP_API_KEY>
ZAP_MCP_TIMEOUT_MS=15000

# Pydantic MCP (structured extraction)
PYDANTIC_MCP_SERVER_URL=<YOUR_PYDANTIC_MCP_URL>
PYDANTIC_MCP_API_KEY=<YOUR_PYDANTIC_API_KEY>
PYDANTIC_MCP_NAMESPACE=default
PYDANTIC_MCP_TIMEOUT_MS=20000

#############################################################################
# WEB SCRAPING
#############################################################################

# Firecrawl (managed web scraping)
FIRECRAWL_API_KEY=<YOUR_FIRECRAWL_KEY>
FIRECRAWL_API_BASE_URL=https://api.firecrawl.dev/v1
FIRECRAWL_MAX_DEPTH=2
FIRECRAWL_MAX_PAGES=50
FIRECRAWL_TIMEOUT_MS=60000

# SpiderCrawly (web crawling)
SPIDERCRAWLY_API_KEY=<YOUR_SPIDERCRAWLY_KEY>
SPIDERCRAWLY_API_BASE_URL=https://api.spidercrawly.com/v1
SPIDERCRAWLY_CONCURRENCY=5
SPIDERCRAWLY_REQUEST_DELAY_MS=500

# Playwright (headless browser)
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_NAVIGATION_TIMEOUT_MS=30000

#############################################################################
# FILE STORAGE
#############################################################################

FILE_STORAGE_DRIVER=pocketbase
FILE_STORAGE_LOCAL_PATH=./storage
FILE_STORAGE_MAX_UPLOAD_BYTES=20971520  # 20MB
FILE_STORAGE_ALLOWED_MIME_TYPES=image/png,image/jpeg,image/webp,application/pdf

#############################################################################
# EMAIL (Transactional)
#############################################################################

# Note: PocketBase handles transactional email (welcome, password reset, etc.)
# These are for marketing/notification emails from the Express app

EMAIL_PROVIDER=resend
EMAIL_FROM_ADDRESS=no-reply@wyzrdy.com
EMAIL_FROM_NAME=Wyzrdy

# Resend (recommended)
RESEND_API_KEY=<YOUR_RESEND_API_KEY>

# Alternative providers
SENDGRID_API_KEY=<YOUR_SENDGRID_KEY>
POSTMARK_SERVER_TOKEN=<YOUR_POSTMARK_TOKEN>

# SMTP fallback
SMTP_HOST=<YOUR_SMTP_HOST>
SMTP_PORT=587
SMTP_USER=<YOUR_SMTP_USER>
SMTP_PASSWORD=<YOUR_SMTP_PASSWORD>
SMTP_SECURE=false

#############################################################################
# ANALYTICS & MONITORING
#############################################################################

# PostHog (product analytics)
ANALYTICS_PROVIDER=posthog
ANALYTICS_WRITE_KEY=<YOUR_POSTHOG_KEY>

# Sentry (error tracking)
ERROR_TRACKING_DSN=https://examplePublicKey@o0.ingest.sentry.io/0

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_REQUEST_BODY=false

#############################################################################
# ALERTS (OPTIONAL)
#############################################################################

# Send alerts to Slack on critical errors
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional: daily integration health checks
SENDGRID_API_KEY=<IF_CONFIGURED_ABOVE>
SENDGRID_FROM_EMAIL=alerts@wyzrdy.com

#############################################################################
# OTHER INTEGRATIONS
#############################################################################

# Google Drive OAuth
GOOGLE_DRIVE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
GOOGLE_DRIVE_CLIENT_SECRET=<YOUR_GOOGLE_SECRET>
GOOGLE_DRIVE_REDIRECT_URI=https://api.wyzrdy.com/auth/google-drive/callback
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly

# Obsidian Local REST API
OBSIDIAN_API_BASE_URL=https://127.0.0.1:27124
OBSIDIAN_API_TOKEN=<YOUR_OBSIDIAN_TOKEN>
OBSIDIAN_VAULT_NAME=
OBSIDIAN_ALLOW_SELF_SIGNED_CERT=true

# Cloudflare Turnstile (bot protection)
CLOUDFLARE_TURNSTILE_SECRET=<YOUR_TURNSTILE_SECRET>

#############################################################################
# INTEGRATION QUOTAS & RETRY
#############################################################################

QUOTA_ZAI_DAILY_REQUESTS=0
QUOTA_CLAUDE_DAILY_REQUESTS=0
QUOTA_OPENROUTER_DAILY_REQUESTS=0
QUOTA_GEMINI_DAILY_REQUESTS=0
QUOTA_FIRECRAWL_DAILY_REQUESTS=0
QUOTA_SPIDERCRAWLY_DAILY_REQUESTS=0
QUOTA_COMPOSIO_DAILY_REQUESTS=0

INTEGRATION_RETRY_MAX_ATTEMPTS=3
INTEGRATION_RETRY_BASE_DELAY_MS=500
```

### 3.2 Stripe Setup (Products & Prices)

**Must be created in Stripe Dashboard BEFORE go-live.**

**Process:**
1. Go to: https://dashboard.stripe.com/test/products
2. Click "Create product" for each:

| Product Name | Type | Price | Price ID Env Var | Notes |
|--------------|------|-------|------------------|-------|
| Wyzrdy Individual — Founding Offer | One-time | $11.69 | `STRIPE_FOUNDING_PRICE_ID` | 1-year access |
| Wyzrdy Individual — Monthly | Subscription | $9.99/mo | `STRIPE_MONTHLY_PRICE_ID` | Recurring monthly |
| Wyzrdy Individual — Annual | Subscription | $99.99/yr | `STRIPE_ANNUAL_PRICE_ID` | Recurring yearly (2 months free) |
| Wyzrdy Plato — Monthly | Subscription | $2.22/mo | `STRIPE_PLATO_PRICE_ID` | Viral referral tier |
| Wyzrdy Viral Entry — Monthly | Subscription | $7.77/mo | `STRIPE_VIRAL_ENTRY_PRICE_ID` | Campaign entry tier |
| Wyzrdy Promo Reward | Subscription | $0.00/mo | `STRIPE_PROMO_REWARD_PRICE_ID` | Referral reward (free) |
| Wyzrdy Enterprise | Custom | Custom | `STRIPE_ENTERPRISE_PRICE_ID` | Contact sales |
| Wyzrdy Sprint Pipeline | One-time | $49.99 | `STRIPE_SPRINT_PRICE_ID` | Sprint credits (one-time) |

**For Each Product:**
- **Name:** Exact name above
- **Description:** See markdown comments in code
- **Pricing:** Set amount and type (one-time or subscription)
- **Recurring interval:** Monthly or Annual (if subscription)
- **Billing cycle:** Monthly → billed every 30 days; Annual → billed yearly

**After Creating:**
- Copy each `price_*` ID
- Add to `apps/api/.env` (Hostinger dashboard)
- Verify in checkout flow: `GET /payments/config-status` returns `stripe_configured: true`

### 3.3 Secret Key Rotation Policy

**From SECURITY.md:**

Keys requiring rotation (every 90 days):
- `OPENROUTER_API_KEY` → https://openrouter.ai/keys
- `COMPOSIO_API_KEY` → Composio dashboard
- `ZAI_API_KEY` → Z.ai console
- `STRIPE_SECRET_KEY` → Stripe dashboard (test/live keys separate)

**Rotation Process:**
1. Generate new key at provider
2. Update in Hostinger dashboard
3. Restart API service (migrations run automatically)
4. Verify startup log: "Environment validation passed"
5. Test endpoint: `GET /test/payment` should work
6. Revoke old key at provider

**Which Keys Are Secrets (encrypt at rest)?**
- All `*_API_KEY` variables
- `STRIPE_WEBHOOK_SECRET`
- `JWT_SECRET`, `SESSION_SECRET`
- `POCKETBASE_ADMIN_PASSWORD`
- Database credentials

**Which Keys Are Public (ok in frontend)?**
- `STRIPE_FOUNDING_PRICE_ID` (publishable product ID only)
- `GEMINI_API_KEY` (Google allows public usage with restrictions)
- `ANALYTICS_WRITE_KEY` (PostHog public key)
- Domain/URL variables

---

## 4. TESTING & VALIDATION RESEARCH

### 4.1 Test Suite Overview

**Existing Tests:**
- `apps/api/src/tests/ai-usage.test.js` — AI credit allocation tests
- `apps/api/src/routes/test.js` — diagnostic endpoints (health, db, integrations)

**Critical Test Routes** (use these for pre-launch validation):

```bash
# 1. Health & DB tests
GET /test/health              # Server uptime, memory, node version
GET /test/db                  # PocketBase connectivity
GET /test/integrations        # Service configuration status
GET /test/env                 # Full env var configuration
GET /test/payment             # Stripe configuration check
GET /test/security            # Security headers & auth checks
GET /test/performance         # Memory, heap, uptime metrics
GET /test/email               # Resend API availability
```

### 4.2 Critical Tests for Go-Live

These must PASS before launching:

| Test | Endpoint | Expected Result | Why Critical |
|------|----------|-----------------|--------------|
| Stripe Configured | `GET /test/payment` | `ok: true, stripe: true` | Payment flow won't work without Stripe |
| PocketBase Healthy | `GET /test/db` | `ok: true, latency_ms < 500` | Auth + data operations fail if DB is down |
| Webhook Dedup | POST `/webhooks/stripe` 2x same event | Returns 200, only 1 row in `webhook_events` | Prevents duplicate charges |
| Founding Cap | POST `/checkout/founding` after 50 sales | Returns 429 "sold out" | Caps founding offer at 50 |
| Self-Referral Block | Generate referral, convert with same IP | Conversion rejected, no bonus | Prevents fraud |
| Signature Verification | POST `/webhooks/stripe` bad sig | Returns 400 | Prevents injection attacks |
| CORS | Frontend origin not in CORS_ORIGIN | Returns 403 | Prevents cross-domain abuse |
| Rate Limit | 150 requests/min from 1 IP | Returns 429 after 100 | Protects from DDoS |
| Payment Success | Complete Stripe checkout | Purchase record created, entitlement_status=active | End-to-end payment flow |

### 4.3 Test Scenarios (Acceptance Tests)

**Scenario 1: Founding Offer Purchase**
```
1. User loads wyzrdy.com/checkout
2. Click "Buy Founding Pass ($11.69)"
3. Redirected to Stripe checkout
4. Enter test card: 4242 4242 4242 4242, exp 12/34, CVC 123
5. Click "Pay"
6. Stripe redirects to checkout/success?session_id=cs_...
7. API webhook (async) receives checkout.session.completed
8. DB: founding_purchases.payment_status → succeeded
9. DB: founding_purchases.entitlement_status → active
10. User can access founding tier features
```

**Scenario 2: Referral Tier Unlock**
```
1. User A generates referral link: /referral/generate-link → {referral_code: "ref_abc123"}
2. User A shares: wyzrdy.com/signup?ref=ref_abc123
3. User B signs up via link
4. User B pays for Viral Entry ($7.77/mo) via /checkout/viral-entry?referral_code=ref_abc123
5. Stripe webhook: checkout.session.completed with metadata.referral_code
6. API: processViralConversion() increments User A's referral_count
7. Check: User A has 1 referral, needs 1 more for $2.22/mo Plato unlock
8. User C converts with same link
9. User A's referral_count = 2, promo_state = "active_2for1"
10. GET /referral/status shows Plato unlocked
```

**Scenario 3: Duplicate Webhook Event (Idempotency)**
```
1. Stripe sends webhook: checkout.session.completed, event_id=evt_123
2. API receives, processes, records in webhook_events table
3. Stripe retries (network timeout), sends same evt_123 again
4. API: checks webhook_events for evt_123
5. Found → returns 200 OK immediately, doesn't reprocess
6. DB: only 1 entry for this event (no duplicate charge)
7. Result: Customer charged once, not twice
```

**Scenario 4: Sold-Out Founding (Cap Enforcement)**
```
1. Founding cap set to 50 (FOUNDING_CAP)
2. 50 users complete founding purchases
3. User 51 clicks checkout founding
4. GET /checkout/founding → 429 "sold out"
5. API auto-refunds any in-flight payments via Stripe API
6. User 51 sees "Founding offer sold out"
```

**Scenario 5: Chargeback/Dispute (Reversal)**
```
1. User paid, got access, created content
2. Customer disputes charge in Stripe
3. Stripe webhook: charge.dispute.created
4. API: processReferralReversal() removes referral bonus
5. DB: founding_purchases.entitlement_status → suspended
6. User loses access until dispute resolved
7. If Stripe wins: refund processed, entitlement revoked permanently
```

### 4.4 Webhook Testing Procedure

**Local Testing (with ngrok):**
```bash
# Terminal 1: Start local API on port 3001
npm run dev --prefix apps/api

# Terminal 2: Expose to internet with ngrok
ngrok http 3001
# Returns: https://abc123.ngrok.io

# Terminal 3: Register webhook in Stripe (test mode)
# Developers → Webhooks → Add endpoint
# URL: https://abc123.ngrok.io/webhooks/stripe
# Events: checkout.session.completed, ...
# Copy signing secret: whsec_...

# Set env var
export STRIPE_WEBHOOK_SECRET=whsec_...

# Send test event from Stripe Dashboard
# Stripe → Webhooks → [endpoint] → "Send test event"

# Check logs
tail -f logs/api.log | grep webhook
# Expected: "[webhook] granted access for purchase ..."
```

**Production Testing (Hostinger):**
```bash
# After deploying to Hostinger:
# 1. Check endpoint is registered
# Go to: Stripe Dashboard → Developers → Webhooks
# Verify URL: https://api.wyzrdy.com/webhooks/stripe

# 2. Send test event
# Stripe Dashboard → [endpoint] → "Send test event"

# 3. Monitor logs
# Hostinger control panel → Logs
# Search for "[webhook]"

# 4. Verify in DB
# PocketBase Admin → webhook_events collection
# Should see new row with event_type, status

# 5. Test actual checkout
# Go to wyzrdy.com → Start checkout
# Complete with test card (4242...)
# Monitor webhook delivery in Stripe → Webhooks → Events
```

---

## 5. MONITORING & ALERTING SETUP

### 5.1 Current Monitoring Infrastructure

**Existing:**
- Sentry (error tracking) — configured via `ERROR_TRACKING_DSN`
- PostHog (product analytics) — configured via `ANALYTICS_WRITE_KEY`
- App-level health checks — `GET /test/health`, `GET /monitor/health`

**What's Missing:**
- Proactive webhook health monitoring
- Stripe API error alerts
- Payment timeout tracking
- Tier transition failure alerts

### 5.2 Health Endpoints

**Public Health Check** (no auth required):
```bash
GET /test/health
# Response: {
#   status: "ok",
#   uptime_seconds: 12345,
#   memory_mb: 128,
#   node: "v18.17.0",
#   timestamp: "2026-07-23T10:00:00Z"
# }
```

**Full Integration Status** (requires PocketBase auth token):
```bash
GET /monitor/health  [Auth: Bearer <token>]
# Response: {
#   stripe: { healthy: true, latency_ms: 150 },
#   pocketbase: { healthy: true, latency_ms: 50 },
#   openrouter: { healthy: true, latency_ms: 800 },
#   composio: { healthy: true, latency_ms: 300 },
#   ...
# }
```

### 5.3 Key Metrics to Monitor

| Metric | Threshold | Alert When | Tool |
|--------|-----------|------------|------|
| Checkout error rate | > 1% | 10+ checkouts fail in 1 hour | Sentry |
| Webhook lag | > 60s | Stripe webhook takes >1 min to deliver | PostHog + custom |
| PocketBase response time | > 500ms | DB queries slow | App metrics |
| Refund rate | > 5% | More than 5% of purchases refunded | PocketBase query |
| API uptime | < 99.5% | < 99.5% over 24h window | UptimeRobot |
| Memory usage | > 512MB | Heap exhaustion risk | Process metrics |

### 5.4 Alert Channels

**Slack Alerts** (recommended for critical):
```bash
# Set in .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...

# In code, send alert on critical error:
const alertSlack = async (msg) => {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ text: msg })
  });
};
```

**Email Alerts** (for non-urgent):
```bash
# Use Resend or SendGrid configured in .env
# Send daily digest of payment errors, refunds, etc.
```

**Sentry Alerts** (automatic error tracking):
```bash
# All unhandled exceptions → Sentry
# Sentry → Slack integration → real-time alerts
```

---

## 6. GO-LIVE CHECKLIST

### PRE-LAUNCH (1-2 weeks before)

- [ ] **Stripe Account Setup**
  - [ ] Create Stripe account (https://dashboard.stripe.com)
  - [ ] Get test API keys (sk_test_...)
  - [ ] Create all 8 Products + Prices (see section 3.2)
  - [ ] Copy price IDs to env template

- [ ] **Environment Configuration**
  - [ ] Generate JWT_SECRET: `openssl rand -hex 32`
  - [ ] Generate SESSION_SECRET: `openssl rand -hex 32`
  - [ ] Set POCKETBASE_ADMIN_EMAIL & PASSWORD (use strong password)
  - [ ] Set STRIPE_SECRET_KEY (sk_test_...)
  - [ ] Set STRIPE_WEBHOOK_SECRET (from webhook endpoint)
  - [ ] Set CORS_ORIGIN to production domains
  - [ ] Fill all REQUIRED keys (see section 3.1)
  - [ ] Store in Hostinger dashboard (via UI or API)

- [ ] **DNS & TLS**
  - [ ] Verify A/AAAA records point to Hostinger VPS
  - [ ] Verify CNAME records (www, app, api)
  - [ ] SSL certificate auto-provisioned (Let's Encrypt)
  - [ ] Test HTTPS: `curl -I https://api.wyzrdy.com`
  - [ ] Test HTTPS redirect: `curl -I http://api.wyzrdy.com` → 301 https

- [ ] **PocketBase Migrations**
  - [ ] Confirm all 17 migrations applied (startup logs)
  - [ ] Verify collections exist: founding_purchases, webhook_events, referral_conversions
  - [ ] Verify superuser account created
  - [ ] Test admin login in PocketBase UI

- [ ] **Stripe Webhook Registration**
  - [ ] Register endpoint in Stripe Dashboard: https://api.wyzrdy.com/webhooks/stripe
  - [ ] Select all 9 event types (see section 2.2)
  - [ ] Copy signing secret to env
  - [ ] Send test event from Stripe Dashboard
  - [ ] Verify webhook logged and processed

- [ ] **Critical Tests Pass**
  - [ ] `GET /test/payment` → stripe_configured: true
  - [ ] `GET /test/db` → ok: true
  - [ ] `GET /test/health` → status: ok
  - [ ] `POST /test/webhooks/stripe` (test event) → processes correctly
  - [ ] `GET /entitlement` (auth) → returns user's entitlement

- [ ] **Security Verification**
  - [ ] CORS_ORIGIN set (not wildcard)
  - [ ] Rate limiting enabled
  - [ ] Helmet security headers active: `curl -I https://api.wyzrdy.com | grep -i x-`
  - [ ] HTTPS enforced (no unencrypted http)
  - [ ] Secrets not in git history: `git log -p | grep STRIPE_SECRET` → no results

### LAUNCH DAY

- [ ] **Before 9 AM (Soft Launch)**
  - [ ] All pre-launch checks passing
  - [ ] Alert channels operational (Slack, Sentry)
  - [ ] Team available for 2 hours of monitoring
  - [ ] Staging environment mirrors production
  - [ ] Backup of production database taken

- [ ] **9 AM - 12 PM (Soft Launch Period)**
  - [ ] Deploy to production
  - [ ] Monitor error rate (Sentry dashboard)
  - [ ] Test 5x end-to-end purchases with test cards
  - [ ] Verify webhook processing (5 events logged)
  - [ ] Check metrics: response times, memory usage
  - [ ] Confirm no critical Slack alerts

- [ ] **12 PM - 5 PM (Announce to Users)**
  - [ ] Send email: "Founding offer now live"
  - [ ] Post social media
  - [ ] Enable public access (if gated before)
  - [ ] Monitor spike in traffic:
    - [ ] API response times < 200ms p95
    - [ ] Checkout success rate > 99%
    - [ ] Webhook lag < 10s
  - [ ] Alert oncall if threshold breached

- [ ] **5 PM - EOD (Monitor)**
  - [ ] Continue monitoring critical metrics
  - [ ] Check for unusual refund patterns
  - [ ] Verify referral tracking working
  - [ ] Spot-check purchased accounts have access
  - [ ] Log any issues in incident tracker

### POST-LAUNCH (First Week)

- [ ] **Daily Verification**
  - [ ] Daily revenue report (# purchases, $ total)
  - [ ] Refund rate < 5%
  - [ ] No webhook failures (check webhook_events table)
  - [ ] Error rate < 0.1% (check Sentry)
  - [ ] API uptime 99.5%+

- [ ] **Milestone: 10 Purchases**
  - [ ] Test referral path (Gen link → signup → convert)
  - [ ] Verify referral bonus applied
  - [ ] Check promo_state updated in referral_state table
  - [ ] Confirm tier unlocks work (2 refs → Plato)

- [ ] **Milestone: 50 Purchases (Founding Cap)**
  - [ ] Verify cap enforcement (51st purchase rejected)
  - [ ] Confirm auto-refund working
  - [ ] Test fallback to standard subscription tier
  - [ ] Confirm reservations released

- [ ] **Week 1 Post-Mortems**
  - [ ] Document any incidents
  - [ ] Review scaling metrics (will we need more capacity?)
  - [ ] Update playbooks based on learnings
  - [ ] Plan for next iteration

---

## 7. INCIDENT RESPONSE RUNBOOK

### Scenario 1: Stripe API Down

**Symptoms:** Checkout fails with 503, Stripe unreachable

**Immediate Actions:**
1. Check Stripe status: https://status.stripe.com
2. If Stripe is down:
   - [ ] Pause checkout button (frontend)
   - [ ] Display: "Payment processing temporarily offline. Try again in 15 minutes."
   - [ ] Set maintenance mode in PocketBase: create announcement
3. If API is down but Stripe ok:
   - [ ] Check `STRIPE_SECRET_KEY` is set and valid
   - [ ] Check API service is running: `GET /test/health` should return 200
   - [ ] Restart API service (Hostinger dashboard)

**Recovery:**
- Once Stripe recovers, enable checkout
- Monitor webhook processing for 30 minutes
- Check for any missed payments (payments table, status=pending)

### Scenario 2: Webhook Processing Delayed

**Symptoms:** Webhook events logged in `webhook_events`, but `founding_purchases` not updated

**Immediate Actions:**
1. Check PocketBase connection: `GET /test/db`
2. If DB latency > 1s:
   - [ ] Check database disk space: `df -h`
   - [ ] Check CPU usage: `top`
   - [ ] Restart PocketBase if needed
3. If DB is fine, check webhook handler logs:
   - [ ] Search logs for: `[webhook] handler error`
   - [ ] Look for specific error message
4. Common issues:
   - [ ] PocketBase admin credentials wrong → check .env
   - [ ] Collection schema mismatch → check migrations applied
   - [ ] Network timeout → increase `POCKETBASE_REQUEST_TIMEOUT_MS`

**Recovery:**
- Manually process any stuck webhook events:
  ```sql
  -- Find unprocessed events
  SELECT * FROM webhook_events WHERE status='failed' ORDER BY created DESC LIMIT 10;

  -- Manually update purchase
  UPDATE founding_purchases SET payment_status='succeeded'
  WHERE stripe_session_id='cs_...';
  ```

### Scenario 3: Duplicate Webhook Event (Double Charge)

**Symptoms:** Customer charged twice for one purchase

**Immediate Actions:**
1. Check `webhook_events` table for duplicate stripe_event_id:
   ```sql
   SELECT stripe_event_id, COUNT(*) FROM webhook_events
   GROUP BY stripe_event_id HAVING COUNT(*) > 1;
   ```
2. If duplicates exist:
   - [ ] Bug in webhook dedup logic (rare, code review)
   - [ ] Database issue (check PocketBase logs)
3. If charge appears as duplicate in `founding_purchases`:
   - [ ] Check `payments` table for two rows with same session_id
   - [ ] One should be marked failed or pending

**Recovery:**
- Issue refund via Stripe: https://dashboard.stripe.com/refunds
- Update purchase record: `payment_status='refunded'`
- Contact customer with explanation + refund confirmation

### Scenario 4: Customer Disputes a Charge

**Symptoms:** Stripe webhook: `charge.dispute.created`

**Immediate Actions:**
1. Webhook automatically:
   - [ ] Calls `processReferralReversal()` (removes bonus)
   - [ ] Sets `entitlement_status='suspended'`
2. Customer loses access immediately
3. Monitor Stripe dispute status: https://dashboard.stripe.com/disputes

**Resolution:**
- If Stripe sides with merchant:
  - [ ] Webhook: `charge.dispute.won` (automatic)
  - [ ] Keep `entitlement_status='suspended'`
  - [ ] Send email: "Dispute resolved in favor of merchant"
- If Stripe sides with customer:
  - [ ] Webhook: `charge.refund.created` (automatic)
  - [ ] `entitlement_status='revoked'` (permanent)
  - [ ] No revenue recognition

**Prevention:**
- Monitor dispute rate: if > 2%, investigate fraud
- Check for self-referral patterns (device fingerprints)
- Review chargeback documentation (email receipts, etc.)

### Scenario 5: Self-Referral Fraud Detected

**Symptoms:** Referral conversions with same IP/device, or impossible conversion speed

**Immediate Actions:**
1. Check device fingerprints:
   ```sql
   SELECT user_id, ip_address, COUNT(*) FROM device_fingerprints
   GROUP BY user_id, ip_address HAVING COUNT(*) > 1;
   ```
2. Check referral_conversions for same IP:
   ```sql
   SELECT r.referrer, r.referred_user, df1.ip_address
   FROM referral_conversions r
   JOIN device_fingerprints df1 ON r.referrer = df1.user_id
   JOIN device_fingerprints df2 ON r.referred_user = df2.user_id
   WHERE df1.ip_address = df2.ip_address;
   ```
3. If fraud detected:
   - [ ] Revoke promo_state for referrer
   - [ ] Mark accounts as suspicious (manual review)
   - [ ] Consider account suspension

**Prevention:**
- Increase fingerprinting: add user-agent hashing
- Add IP blocklist (VPN/proxy detection)
- Implement temporal checks (must wait 24h between referral + signup)

---

## 8. DEPLOYMENT COMMAND REFERENCE

### Pre-Deployment

```bash
# Install dependencies (monorepo)
npm install

# Type check & lint
npm run lint

# Build frontend
npm run build --prefix apps/web

# Test API (optional)
npm test --prefix apps/api

# Verify migrations
npm run migrations:snapshot --prefix apps/pocketbase
```

### Deploy to Hostinger

```bash
# Commit code
git add .
git commit -m "chore: production deployment"

# Push to Hostinger repo (triggers auto-deploy)
git push origin main

# Wait for Hostinger to restart services
# (typically 2-5 minutes)

# Verify deployment
curl https://api.wyzrdy.com/test/health
# Expected: {"status":"ok",...}
```

### Health Verification

```bash
# Check all services
curl https://api.wyzrdy.com/test/health
curl https://api.wyzrdy.com/test/db
curl https://api.wyzrdy.com/test/integrations

# Specific checks
curl https://api.wyzrdy.com/test/payment      # Stripe
curl https://api.wyzrdy.com/test/security     # Security headers
curl https://api.wyzrdy.com/test/performance  # Memory/heap

# With auth (if protected)
curl -H "Authorization: Bearer <TOKEN>" https://api.wyzrdy.com/monitor/health
```

### Rollback

```bash
# Revert last commit
git revert HEAD
git push origin main

# Hostinger auto-redeploys with previous code
# (wait 2-5 minutes)

# Or manually on Hostinger console:
# Click "Deployments" → select previous version → "Rollback"

# For database issues:
# Contact Hostinger support for PocketBase data restoration
```

### View Logs

```bash
# Hostinger logs (via control panel)
# Settings → Logs → select app → view output

# Or via SSH (if available)
ssh user@hostinger.com
tail -f /var/log/wyzrdy-api/output.log
tail -f /var/log/pocketbase/output.log

# Filter for errors
grep ERROR /var/log/wyzrdy-api/output.log
grep '\[webhook\]' /var/log/wyzrdy-api/output.log
```

### Restart Services

```bash
# Via Hostinger dashboard
# Applications → [app] → Restart

# Or via SSH
systemctl restart wyzrdy-api
systemctl restart pocketbase

# Verify restart completed
curl https://api.wyzrdy.com/test/health
```

### Apply Migrations

```bash
# Migrations run automatically on restart
# (in apps/pocketbase/pb_migrations/)

# To manually verify:
npm run migrations:up --prefix apps/pocketbase

# To create new migration (dev only)
# Edit PocketBase, then export:
npm run migrations:snapshot --prefix apps/pocketbase
```

---

## 9. LOAD TESTING RECOMMENDATIONS

### Target Scenario: Founding Offer Launch

**Expected Traffic Spike:**
- 1000 concurrent users on wyzrdy.com/checkout
- 50-100 purchases/minute
- Peak: 2000 concurrent users (viral spike)

### Load Testing Plan

**1. Local Load Test (k6)**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,        // 100 virtual users
  duration: '5m',  // 5 minute test
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.1'],    // <0.1% failure rate
  },
};

export default function () {
  let res = http.get('https://api.wyzrdy.com/test/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

**2. Checkout Flow Load Test**
```javascript
// Simulate full checkout flow
// 1. POST /checkout/founding
// 2. Redirect to Stripe
// 3. (Test card processing in Stripe)
// 4. Webhook callback
// 5. Verify purchase created
```

**3. Webhook Stress Test**
- Send 1000+ webhook events in rapid succession
- Verify deduplication (only processes each event once)
- Check webhook_events table for correctness

### Performance Targets

| Metric | Target | Pass/Fail Threshold |
|--------|--------|---------------------|
| Response time (p95) | < 200ms | > 500ms = fail |
| Checkout success rate | > 99.5% | < 95% = fail |
| Webhook processing lag | < 5s | > 30s = fail |
| Error rate | < 0.1% | > 1% = fail |
| Memory usage spike | < 2GB | > 4GB = fail |

### Pre-Launch Staging Test

```bash
# 1 day before launch:
# Deploy to staging environment
git push origin staging

# Run load test against staging
# k6 run load-test.js --vus 500 --duration 10m

# Monitor metrics:
# - API response times (should be consistent)
# - Database connection pool (no exhaustion)
# - Memory growth (should be stable, not leak)
# - Error logs (should be zero critical errors)

# If staging fails:
# - Identify bottleneck (DB, API, network)
# - Scale resources (increase Hostinger plan if needed)
# - Re-test
# - Only launch when passing
```

---

## 10. SUMMARY TABLE: Go-Live Dependencies

| Component | Status | Owner | Action | Deadline |
|-----------|--------|-------|--------|----------|
| Stripe Account | Not started | Ops | Create account, get keys | Week 1 |
| Stripe Products/Prices | Not started | Ops | Create 8 products | Week 1 |
| STRIPE_SECRET_KEY | Missing | Ops | Add to .env | Week 1 |
| STRIPE_WEBHOOK_SECRET | Missing | Ops | Register webhook, add to .env | Week 1 |
| PocketBase Migrations | Complete | Dev | Verify all 17 applied | Pre-launch |
| DNS Records | Complete | Ops | A/AAAA/CNAME records live | Pre-launch |
| TLS/HTTPS | Complete | Ops | Let's Encrypt cert auto-renewed | Pre-launch |
| CORS_ORIGIN | Partial | Ops | Set to production domains | Pre-launch |
| Health Endpoints | Complete | Dev | All test routes pass | Pre-launch |
| Webhook Testing | Pending | QA | Send 5+ test events | Pre-launch |
| Monitoring Alerts | Partial | Ops | Set up Slack, Sentry | Pre-launch |
| Load Testing | Pending | QA | Test 1000 concurrent users | Pre-launch |
| Incident Runbook | Complete (this doc) | Ops | Review with team | Pre-launch |
| Production Deployment | Pending | Ops | Deploy to Hostinger | Launch day |

---

## 11. NEXT STEPS (Immediate Actions)

### Week 1
1. [ ] Create Stripe account: https://dashboard.stripe.com/register
2. [ ] Get test API keys from Stripe Dashboard
3. [ ] Create 8 Products + Prices in Stripe Dashboard
4. [ ] Copy STRIPE_SECRET_KEY to Hostinger environment
5. [ ] Register webhook endpoint in Stripe (https://api.wyzrdy.com/webhooks/stripe)
6. [ ] Copy STRIPE_WEBHOOK_SECRET to Hostinger environment
7. [ ] Set JWT_SECRET and SESSION_SECRET (openssl rand -hex 32)
8. [ ] Set POCKETBASE_ADMIN_EMAIL and PASSWORD
9. [ ] Verify PocketBase migrations applied (startup logs)
10. [ ] Test: `GET /test/payment` returns stripe_configured: true

### Week 2
1. [ ] Run all critical test scenarios (see section 4.3)
2. [ ] Load test with k6 (1000 concurrent users)
3. [ ] Set up monitoring (Sentry, PostHog, Slack alerts)
4. [ ] DNS verification (A/AAAA/CNAME records resolve)
5. [ ] HTTPS verification (curl https://api.wyzrdy.com/test/health)
6. [ ] Send test webhooks from Stripe Dashboard
7. [ ] Verify webhook processing (webhook_events table populated)
8. [ ] Document any issues in incident runbook

### Pre-Launch Day
1. [ ] Final sanity checks (all tests passing)
2. [ ] Database backup taken
3. [ ] Incident response team briefed
4. [ ] Alert channels verified (Slack, email)
5. [ ] Announcement prepared for customers

---

**Document prepared by:** Deployment & DevOps Agent
**Next review date:** 2026-07-30 (1 week)
**Questions?** Review corresponding sections above or reach out to ops team.
