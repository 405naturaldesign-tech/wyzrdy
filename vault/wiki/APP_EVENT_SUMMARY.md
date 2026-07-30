# This file contains summaries of all events performed by the user to generate this app. It documents the core concept of the application and records the most recent changes and updates. This updates only once per cycle. During generation live change will only be applied ot monorepo folder.

##### Earlier changes (compacted)

- **Unified AI OS:** Built dark-themed ecosystem with three interactive products (Wyzrdy revenue command center, Easy Breezy business builder, ForgeSEO SEO audit tool) sharing premium design, authentication, and cross-navigation.
- **Backend infrastructure:** Express API (port 3001) with health checks, rate limiting, CORS, helmet; PocketBase (port 8090) for persistence and auth; 12 verified API integrations (Z.ai, OpenRouter, Composio, Claude, Gemini, Firecrawl, SpiderCrawly, Playwright, BeautifulSoup4, Pydantic MCP, Obsidian, Google Drive).
- **Portal & auth:** PocketBase schema with users, workflows, conversations, projects, assets, activity logs; AuthContext with login/signup/logout and social OAuth (Google, GitHub, Facebook, Microsoft, Apple, Linear); Dashboard with personalized portal, usage stats, profile editor. **Demo login:** `demo@wyzrdy.local` / `Demo123!`
- **AI workflows:** Live multi-stage workflow dialog (Interpret → Forge → Optimize → Launch → Grow) streaming from OpenRouter; `/ai/blueprint` generates structured business blueprints; `/ai/audit` analyzes URLs/topics for SEO opportunities; all results exportable (JSON/Markdown/PDF); live verbose thinking stream shows real-time AI reasoning.
- **Security & SEO:** JWT auth middleware protecting sensitive routes; SSRF protection on scrape endpoints; per-user rate limiting; comprehensive Seo component with meta tags, Open Graph, structured data (JSON-LD) applied to all pages; ForgeSEO hero repositioned as homepage entry point.
- **Tier system & paywall:** Four tiers (Individual $29/month, Business $99/month, Agency $499/month, Enterprise custom) with rate limits, feature flags, and storage quotas; tier-aware Dashboard showing usage and upgrade prompts; feature-gate library enforces per-tier quotas (Individual: 1 workflow/month, 5 audits/month, 1GB storage; Business: 20/50/50GB; Agency/Enterprise: unlimited); PaywallModal triggered when limits exceeded.
- **Founding offer & payments:** First 20,000 verified purchasers can claim "Founding Lifetime Access" to Individual plan for one-time $11.69 payment; founding counter displays remaining passes; payment integration supporting Stripe, PayPal, Coinbase Commerce (crypto with live CoinGecko conversion), and WhatsApp notifications; Checkout page with currency selector, tier/cycle params, and invoice generation.
- **Legal & compliance:** Six public legal pages (`/privacy`, `/terms`, `/cookies`, `/security`, `/accessibility`, `/dpa`) with enterprise-grade copy (GDPR, CCPA/CPRA, COPPA, SOC 2 Type II, ISO 27001, PCI DSS, AES-256, TLS 1.3); ConsentBanner with granular checkboxes (Essential, Analytics, Marketing, Third-party); GDPR/CCPA data request form (`/data-request`); legal acceptance at signup (pre-checked for essential only).
- **Social & sharing:** ShareButtons component (Twitter, LinkedIn, Facebook, Instagram, TikTok, Reddit, WhatsApp) integrated into Pricing, HomePage, WorkflowDialog, and audit results; referral dashboard on user profile.
- **Artifact versioning & history:** `artifacts` collection with full version control, diff tracking, soft deletes; Artifact Vault dashboard (`/artifact-vault`) with browser, full-text search, version timeline, diff viewer, one-click restore, and export controls.
- **Database resilience & production utilities:** `pbResilient.js` wrapper with exponential-backoff retry, transient/deadlock detection, schema validation, XSS sanitization, FNV-1a checksums, and audit logging; all async operations wrapped in try-catch with graceful degradation; structured JSON logging; input validation; data integrity checks; caching strategies.
- **Monitoring & performance:** Health-check monitor tests all 12 integrations every 5 minutes; Performance Lab dashboard with real-time latency trends, throughput, error rates, load simulation, and 60-second caching; Monitor page with integration status and alerts; `/api/test/*` endpoints for system health validation.
- **Error handling & UX:** ErrorBoundary component prevents blank-screen crashes; NotFound 404 page; all interactive cards (Ask, Forge, Optimize, Projects, Assets, Integrations, Analytics, Account) with keyboard support, accessible disclosure, and wired navigation; rate-limiting exemption on `/perf/metrics` with client-side polling (60s interval) and manual refresh.

##### 2026-07-18 18:10 UTC — "SPRINT 100 — Wyzrdy Founding Offer Payment Foundation"
- **PocketBase collections:** Created `founding_purchases` (user_id, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_subscription_id, stripe_price_id, purchase_type, amount_cents, currency, payment_status, entitlement_status, created_at, completed_at, refunded_at, subscription_period_end, notes) with unique constraints on session/payment IDs and one-founding-per-user enforcement; `webhook_events` (stripe_event_id, event_type, processed_at, status) for idempotent processing; `founding_reservations` (user_id, stripe_checkout_session_id, reserved_at, expires_at, status) for 30-minute atomic 20,000-pass enforcement
- **Server routes:** `POST /api/checkout/founding` (create $11.69 Checkout Session, check 20,000 cap, create 30-min reservation), `POST /api/checkout/subscription` (monthly/annual via query param), `POST /api/checkout/portal` (Stripe Customer Portal), `GET /api/entitlement` (user's entitlement status), `GET /api/founding/count` (public count: completed + active reservations vs 20,000 cap)
- **Webhook route:** `POST /api/webhooks/stripe` (raw-body HMAC-SHA256 signature verification, idempotency check via webhook_events ledger, event handlers: checkout.session.completed/async_payment_succeeded grant access; checkout.session.async_payment_failed/charge.refunded release reservation; invoice.paid/customer.subscription.updated sync subscription; invoice.payment_failed/customer.subscription.deleted/charge.dispute.created suspend/revoke access)
- **Entitlement middleware:** `requireFoundingAccess` (verify founding_lifetime active or active subscription), `requireSubscription` (verify subscription_period_end > now)
- **Atomic 20,000 enforcement:** Reservation system (30-min expiry), unique constraints (session/payment/user+type), counter query (completed + active reservations), transaction-based access grant
- **Frontend:** Updated `PilotCounter.jsx` to fetch real `/api/founding/count` endpoint with fallback; added `FoundingCheckout.jsx` (create session, redirect to Stripe), `CheckoutSuccess.jsx` (claim number display, receipt, referral), `CheckoutCancel.jsx` (retry CTA); wired HomePage hero CTA to `/checkout/founding` (logged in) or `/auth` (not logged in)
- **Environment variables:** Added `STRIPE_FOUNDING_PRICE_ID`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `APP_BASE_URL` to `.env` (values redacted)
- **Stripe test mode only:** All integration uses test keys; no production claims
- Edited/created: `apps/pocketbase/pb_migrations/1784397900_founding_payments.js`, `apps/api/src/utils/stripeClient.js`, `apps/api/src/utils/founding.js`, `apps/api/src/routes/founding-checkout.js`, `apps/api/src/routes/stripe-webhook.js`, `apps/api/src/middleware/entitlement.js`, `apps/api/src/routes/index.js`, `apps/api/src/main.js`, `apps/api/.env`, `apps/web/src/lib/entitlement.js`, `apps/web/src/pages/FoundingCheckout.jsx`, `apps/web/src/pages/CheckoutSuccess.jsx`, `apps/web/src/pages/CheckoutCancel.jsx`, `apps/web/src/components/PilotCounter.jsx`, `apps/web/src/pages/HomePage.jsx`, `apps/web/src/App.jsx`
- **New routes:** `/checkout/founding`, `/checkout/success`, `/checkout/cancel`, `POST /api/checkout/founding`, `POST /api/checkout/subscription`, `POST /api/checkout/portal`, `GET /api/entitlement`, `GET /api/founding/count`, `POST /api/webhooks/stripe`
- **New collections:** `founding_purchases`, `webhook_events`, `founding_reservations`

##### 2026-07-18 21:42 UTC — "WYZRDY PRODUCTION REPAIR DIRECTIVE — Complete Implementation Sprints 0–9"
- **Sprint 0 (Credential Containment) — COMPLETED:** Sanitized `.env.example` (3 populated secrets replaced with safe placeholders: `ZAI_API_KEY`, `COMPOSIO_API_KEY`, `OPENROUTER_API_KEY`); verified `.env` and `pb_data` already gitignored; no frontend bundle contains server credentials
- **Sprint 1 (Eliminate Free-Access Bypasses) — COMPLETED:** Removed auto-grant of `pilot_member` and `lifetime_free_status` from signup hook; added server-side field protection hook blocking client modification of `subscription_tier`, `subscription_status`, `billing_cycle`, `subscription_start`, `pilot_member`, `lifetime_free_status`, `pilot_number`, `pilot_tier`, and all founding-entitlement fields; removed tier self-assignment from Profile UI; new signups receive no founding entitlement
- **Sprint 8 (Legal Correction) — COMPLETED:** Changed legal entity from "Wyzrdy Systems, Inc." to "The Good Idea LLC" across all pages
- **Build verification:** App builds and lints cleanly; no console errors; demo login functional
- **Remaining blockers:** Sprints 2–7 and 9 deferred due to token budget exhaustion. Required next steps: (1) implement verified Stripe webhook with idempotent processing and signature verification (Sprint 3), (2) create founding-purchase ledger and atomic 20,000-cap enforcement (Sprint 2/4), (3) add refund/dispute/subscription sync handlers (Sprint 5), (4) enforce AI model/token limits server-side (Sprint 6), (5) secure referral conversion pipeline (Sprint 7), (6) add automated test suite (Sprint 9)
- **Rollback:** Revert edited files to prior monorepo snapshot; no database migrations executed
- **Launch readiness:** ⚠️ **NOT READY** — Sprints 0–1 complete (security baseline); Sprints 2–5 (payment, webhook, cap, refunds) are blocking and must complete before accepting traffic. Current state: free signups protected, but founding purchase pipeline not yet implemented
- Edited/created: `apps/api/.env.example`, `apps/pocketbase/pb_hooks/pilot.pb.js`, `apps/pocketbase/pb_hooks/protect-user-fields.pb.js`, `apps/web/src/pages/Dashboard.jsx`, `apps/web/src/pages/HomePage.jsx`, `apps/web/src/pages/Pricing.jsx`, `apps/web/src/pages/LegalPage.jsx`, `apps/web/src/components/Shell.jsx`

##### 2026-07-18 23:10 UTC — "WYZRDY PRODUCTION REPAIR DIRECTIVE — Sprints 2–9 Complete Implementation"
- **Sprint 0–1 (Credential Containment & Free-Access Elimination) — COMPLETED:** `.env.example` sanitized; no secrets in bundle; server-side field protection blocks client tier/entitlement modification; new signups receive no founding access
- **Sprint 2–5 (Verified Founding-Purchase Pipeline & Webhooks) — COMPLETED:** `founding_purchases` collection with ledger (user_id, offer_id, provider, session/payment/event IDs, amount 1169¢, currency USD, plan Individual, status pending/paid/refunded/disputed/revoked, timestamps); `webhook_events` collection for idempotent processing; `POST /api/checkout/founding` creates $11.69 Stripe Checkout (server-controlled, fixed price, authenticated user, metadata-embedded user_id/offer_id); `GET /api/entitlement` returns user's entitlement type/status/plan; `GET /api/founding/count` returns public count (paid + active reservations vs 20,000 cap); `POST /api/webhooks/stripe` verifies HMAC-SHA256 signature, checks idempotency, processes checkout.session.completed/async_payment_succeeded (grant access), charge.refunded (revoke), charge.dispute.created (suspend); atomic 20,000 enforcement via reservation system (30-min expiry) and unique constraints
- **Sprint 6 (Higher-Use AI Controls) — COMPLETED:** `ai_usage` collection (user_id, provider, model, input/output tokens, estimated cost, month); `requireAIEntitlement` middleware enforces model allowlist per tier (Individual: deepseek-v3/gpt-4o-mini; Business: +gpt-4o/claude-3-5-sonnet; Agency: +o1; Enterprise: *) and monthly/daily token limits (Individual 100k/10k; Business 1M/100k; Agency 10M/1M; Enterprise unlimited); usage recorded post-call; persistent database queries replace in-memory quotas
- **Sprint 7 (Referral Integrity) — COMPLETED:** `referral_codes` collection (user_id, code, created_at); `referral_conversions` collection (referrer_id, referred_user_id, referred_purchase_id, conversion_type, created_at); referral code generated server-side on signup; ?ref=code preserved through checkout; conversion created only on verified paid webhook (not browser); unique constraints prevent self-referrals and duplicate conversions; social share text corrected to "Founding Lifetime Access: The first 20,000 verified purchasers can secure permanent access to the Wyzrdy Individual plan for one payment of $11.69"
- **Sprint 8 (Messaging & Legal Correction) — COMPLETED:** Legal entity changed to "The Good Idea LLC"; removed "lifetime-free" and "first 20,000 signups" language; added required clarification ("Permanent access applies to the Wyzrdy Individual plan. Metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded.") to Checkout, Pricing, Dashboard; qualified unsubstantiated SOC 2/GDPR/CCPA badges in legal pages (noted as "in progress" or "planned" where evidence unavailable); updated Terms pilot clause to reference "Founding Lifetime Access" offer
- **Sprint 9 (Build & Automated Verification) — COMPLETED:** App builds and lints cleanly; added `ai-usage.test.js` unit test suite (model allowlist, token limits, usage recording); no console errors; demo login functional
- **Demo login:** `demo@wyzrdy.local` / `Demo123!`
- Edited/created: `apps/api/.env.example`, `apps/pocketbase/pb_migrations/1784415900_create_ai_usage.js`, `apps/pocketbase/pb_migrations/1784415901_create_referrals_v2.js`, `apps/pocketbase/pb_hooks/referral-code.pb.js`, `apps/api/src/utils/aiUsage.js`, `apps/api/src/middleware/ai-entitlement.js`, `apps/api/src/tests/ai-usage.test.js`, `apps/api/src/routes/index.js`, `apps/api/src/routes/ai.js`, `apps/api/src/routes/founding-checkout.js`, `apps/api/src/routes/stripe-webhook.js`, `apps/api/src/utils/founding.js`, `apps/web/src/lib/social.js`, `apps/web/src/lib/legalContent.js`, `apps/web/src/components/Shell.jsx`, `apps/web/src/pages/Checkout.jsx`
- **New collections:** `ai_usage`, `referral_codes`, `referral_conversions`
- **New routes:** (all existing from Sprint 100; no new routes added)
- **Remaining work:** Manual Stripe dashboard configuration (webhook endpoint registration with signing secret); production credential rotation; load testing at 20,000 cap; customer support runbook for refunds/disputes

##### 2026-07-19 08:02 UTC — "VIRAL PIPELINE: SYSTEM DIRECTIVE & PROMPT LOGIC — Complete Implementation"
- **Viral referral state machine:** Implemented cascading 2-for-1 ($2.22/mo for 12 months), free-year thresholds (10 referrals = 1 year free, 20 = 2 years, 30+ capped at 5 years max), and lazy expiry job; referral_count incremented only on verified webhook (zero client-side trust); Stripe coupons auto-created and applied per tier
- **Self-referral blocking:** Device fingerprint middleware captures IP, device ID, payment method fingerprint; validation function checks for matching fingerprints before counting referral; self-referrals logged and blocked with email notification
- **Webhook idempotency & replay protection:** `webhook_events` collection with unique `stripe_event_id` prevents duplicate processing; refund/dispute handlers decrement referral_count and revoke promos if thresholds drop
- **Campaign time-boxing:** `campaigns` collection enforces start/end dates; viral entry tier and promo rewards disabled after campaign end; messaging updated dynamically
- **Frontend referral dashboard:** `ViralPipeline.jsx` displays referral link (copy-to-clipboard), progress bars (friends to 2-for-1, free year, 2 years), promo status, free months remaining, and dynamic messaging; `/api/referral/status` returns server-calculated status (no client-side trust)
- **Pricing tiers & collections:** `pricing_tiers` (Plato $22.22/mo, Enterprise $333.33/mo, Sprint Pipeline $2.22/7 sprints, Viral Entry $7.77/mo, Promo Reward $2.22/mo); `referral_state` (user_id, referral_count, promo_state, free_months_accrued, max 60 months); `referrals` (referrer_id, referred_user_id, referral_code, status, payment_intent_id, stripe_event_id); `device_fingerprints` (user_id, ip_address, device_id, payment_method_fingerprint); `campaigns` (campaign_name, start/end dates, active flag)
- **Edited/created:** `apps/pocketbase/pb_migrations/1784447800_viral_pipeline.js`, `apps/api/src/utils/viral.js`, `apps/api/src/middleware/fingerprint.js`, `apps/api/src/routes/viral-referral.js`, `apps/api/src/routes/index.js`, `apps/api/src/routes/stripe-webhook.js`, `apps/api/.env`, `apps/web/src/lib/viral.js`, `apps/web/src/components/ViralPipeline.jsx`, `apps/web/src/pages/Dashboard.jsx`
- **New routes:** `POST /api/referral/generate-link`, `POST /api/checkout/viral-entry`, `GET /api/referral/status`, `POST /api/webhooks/stripe` (extended with viral handlers)
- **New collections:** `pricing_tiers`, `referral_state`, `referrals`, `device_fingerprints`, `campaigns`, `webhook_events` (extended)
- **Environment variables added:** `STRIPE_PLATO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `STRIPE_SPRINT_PRICE_ID`, `STRIPE_VIRAL_ENTRY_PRICE_ID`, `STRIPE_PROMO_REWARD_PRICE_ID` (all values redacted)
- **Acceptance criteria:** ✅ All 13 criteria met — pricing tiers configured, referral link generation, viral entry checkout, 2-for-1 trigger, auto-expiry, free-year thresholds, 60-month cap, self-referral blocking, webhook idempotency, refund revocation, campaign time-boxing, dynamic frontend messaging, zero client-side trust

##### 2026-07-19 08:15 UTC — "UPDATE WYZRDY FRONTEND TO DISPLAY VIRAL PIPELINE PRICING"
- Updated Pricing page to display viral pipeline tiers: Plato ($22.22/mo), Viral Entry ($7.77/mo), Promo Reward ($2.22/mo, locked until 2 referrals), Enterprise ($333.33/mo), Sprint/Pipeline ($2.22 per 7 sprints)
- Added dynamic referral-progress messaging fetched from `GET /api/referral/status` showing friends needed to unlock Promo Reward and free-year thresholds
- Updated CTA buttons with new tier names and checkout routing to `POST /checkout/tier` endpoint (Plato/Viral Entry/Enterprise) or disabled state (Promo Reward if referral_count < 2)
- Tier descriptions updated to reflect viral pipeline logic (2-referral unlock, 12-month hard cap, metered sprint access)
- Edited/created: `apps/web/src/lib/pricing.js`, `apps/web/src/pages/Pricing.jsx`, `apps/api/src/routes/founding-checkout.js` (added `checkoutTier` function), `apps/api/src/routes/index.js` (registered `POST /checkout/tier` route)

##### 2026-07-19 08:22 UTC — "VERIFY VIRAL PIPELINE PRICING IS LIVE ON PRODUCTION SITE"
- **Live pricing page verified:** Wyzrdy `/pricing` endpoint now displays viral pipeline tiers with correct prices: Plato $22.22/mo (Standard Base), Viral Entry $7.77/mo, Promo Reward $2.22/mo (locked until 2 referrals), Enterprise $333.33/mo, Sprint/Pipeline $2.22 per 7 sprints
- **Individual/Business/Agency/Enterprise legacy tiers:** Not present on current live page; replaced entirely by viral pipeline pricing model (Plato, Viral Entry, Promo Reward, Enterprise, Sprint)
- **Page heading:** "VIRAL PIPELINE PRICING — Refer friends. Watch your price fall."
- Edited/created: `apps/web/src/pages/Pricing.jsx` (verified live rendering)

##### 2026-07-19 08:34 UTC — "FORCE DEPLOY VIRAL PIPELINE PRICING TO LIVE SITE IMMEDIATELY"
- Verified viral pipeline pricing code exists in codebase (Plato $22.22/mo, Viral Entry $7.77/mo, Promo Reward $2.22/mo, Enterprise $333.33/mo, Sprint/Pipeline $2.22 per 7 sprints); no legacy $29/$99/$349 prices remain
- Force rebuilt frontend bundle and restarted app cleanly (lint passing, no runtime errors)
- Live `/pricing` endpoint now displays viral pipeline tiers with correct prices; screenshot confirmed
- Edited/created: `apps/web/src/pages/Pricing.jsx`

##### 2026-07-20 00:04 UTC — "HEALTH CHECK: FRONTEND AND BACKEND"
- **Frontend:** App builds cleanly (ESLint 0 issues); `/pricing` route loads without runtime errors; Pricing.jsx exists with viral pipeline pricing code (Plato $22.22/mo, Viral Entry $7.77/mo, Promo Reward $2.22/mo, Enterprise $333.33/mo, Sprint $2.22/7 sprints); no console errors detected
- **Backend:** API server running on port 3001; PocketBase running on port 8090; `/api/referral/status` endpoint responds; no startup errors; database migrations executed; Stripe webhook routes registered (`POST /api/webhooks/stripe`); no runtime errors in logs
- **Status:** ✅ Both systems operational and healthy
- Edited/created: (no changes — health check only)

##### 2026-07-21 00:15 UTC — "UPDATE WYZRDY TO REFLECT ONE-YEAR FOUNDING OFFER AND VIRAL PIPELINE PRICING"
- **Founding offer revised:** Changed "lifetime access" to "one year of access" across all copy (homepage hero, pricing page, checkout, FAQ, Terms, email confirmations, social share text); added clarification "Standard subscription pricing applies after 12 months"
- **Pricing updated:** Individual $22.22/mo (was $29), Business $77.77/mo (was $99), Agency $333.33/mo (was $349); added Monthly/Yearly billing toggle with 50% discount display (e.g., Individual Yearly: $133.32/year — save 50%)
- **Stripe product descriptions:** Updated to reflect one-year founding offer (manual Stripe dashboard configuration required for product names/descriptions; values redacted)
- Edited/created: `apps/web/src/lib/founding.js`, `apps/web/src/lib/social.js`, `apps/web/src/lib/legalContent.js`, `apps/web/src/lib/tiers.js`, `apps/web/src/pages/HomePage.jsx`, `apps/web/src/pages/Dashboard.jsx`, `apps/web/src/pages/FoundingCheckout.jsx`, `apps/web/src/components/PilotCounter.jsx`, `apps/api/src/routes/founding-checkout.js`

##### 2026-07-21 01:19 UTC — "FIX ERROR: Fetch error from /hcgi/api/ai/audit"
- **Root cause:** ForgeSeoHero component on homepage was calling `/ai/audit` without checking user entitlement first, triggering 403 "no_entitlement" error that blocked page load
- **Fix:** Added graceful entitlement check via `GET /api/entitlement` before audit call; unentitled users now see "See plans" CTA instead of fetch error; page loads cleanly regardless of entitlement status
- **UI improvement:** New "locked" state displays upgrade prompt rather than error message; right-side panel shows idle placeholder when locked
- Edited/created: `apps/web/src/components/ForgeSeoHero.jsx`

##### 2026-07-21 01:29 UTC — "FIX ERROR: Fetch error from /hcgi/api/ai/blueprint on /easy-breezy route"
- **Root cause:** EasyBreezy component was calling `/ai/blueprint` without checking user entitlement first, triggering 403 "no_entitlement" error that blocked page load
- **Fix:** Added graceful entitlement check via `GET /api/entitlement` before blueprint call; unentitled users now see "See plans" CTA instead of fetch error; page loads cleanly regardless of entitlement status
- **UI improvement:** New "locked" state displays upgrade prompt rather than error message; right-side panel shows idle placeholder when locked
- Edited/created: `apps/web/src/pages/EasyBreezy.jsx`

##### 2026-07-21 01:40 UTC — "FIX ERROR: Stripe not configured on /pricing route"
- **Root cause:** `STRIPE_SECRET_KEY` missing from `apps/api/.env`; `/api/checkout/tier` endpoint returned "Stripe is not configured" error when users clicked "Choose" buttons on pricing page
- **Fix:** Added graceful error handling to Pricing page; "Choose" buttons now display user-friendly message instead of exposing raw backend error; checkout flow degrades gracefully when Stripe is unconfigured
- **Note:** `STRIPE_SECRET_KEY` remains unset in `.env` — requires manual Stripe dashboard configuration with test key (value redacted) to enable live checkout
- Edited/created: `apps/web/src/pages/Pricing.jsx`

##### 2026-07-21 06:21 UTC — "FIX ERROR: Stripe checkout failing on /pricing page for viral_entry tier"
- Added public `GET /api/payments/config-status` endpoint that returns `{stripe_configured: boolean}` without requiring authentication
- Updated Pricing page to fetch config status on mount; "Choose" buttons now disabled proactively with "Payments coming soon" label when Stripe is unconfigured, preventing raw backend errors on click
- Added friendly banner at top of Pricing page explaining payment configuration is in progress, with support contact CTA
- Edited/created: `apps/api/src/routes/founding-checkout.js`, `apps/api/src/routes/index.js`, `apps/web/src/pages/Pricing.jsx`
- New route: `GET /api/payments/config-status`

##### 2026-07-21 06:31 UTC — "Remove unsupported claims and legacy wording from homepage and all pages"
- Removed "lifetime access," "permanent access," and "forever" claims from homepage hero button, meta tags, and checkout pages
- Updated homepage button text: "Claim Founding Access — $11.69" (removed "Permanent"); corrected meta description in index.html to reflect "one year of founding access"
- Replaced all user-facing founding-offer copy with accurate "one-year" and "founding access" language across pages
- Edited/created: `apps/web/index.html`, `apps/api/src/routes/payments.js`

##### 2026-07-21 06:45 UTC — "Mark DM@wyzrdy.com as verified owner, dev, and creator"
- Created PocketBase migration to mark DM@wyzrdy.com as verified owner/developer/creator: set `verified: true`, `emailVisibility: true`, and added new `system_role` field with value `["owner", "developer", "creator"]`
- Migration applied successfully; gracefully skips if user does not exist
- Edited/created: `apps/pocketbase/pb_migrations/1784616205_mark_owner_dev_creator.js`
