# Wyzrdy Codebase Map

Wyzrdy is a market-ready SaaS platform for AI-powered workflow automation, integrations, and analytics. The stack uses Next.js (frontend), Node.js/Express (backend), PocketBase (auth/database), Stripe (payments), OpenRouter (AI), Composio (integrations), Resend (email), and observability via PostHog/Sentry.

| Service | Purpose |
|---------|---------|
| **apps/pocketbase** | Auth, database, migrations, collections (users, workflows, audits, blueprints, integrations, referral_codes, referral_conversions) |
| **apps/api** | Node.js/Express backend; payment checkout, referral tracking, AI entitlement, integrations, usage tracking |
| **apps/web** | Next.js frontend; marketing, dashboard, checkout, settings, integrations, referral UI, viral pipeline pricing |

---

## apps/pocketbase

PocketBase backend; SQLite database, user auth, collections, migrations.

**Collections**
pb_collections/users.json — user records; email, password, verified, emailVisibility, subscription_tier, founding_access, pilot_status, system_role (owner/developer/creator flags)
pb_collections/workflows.json — user workflows; name, description, trigger, actions, status
pb_collections/audits.json — audit logs; user_id, action, timestamp, details
pb_collections/blueprints.json — AI blueprints; name, description, category, template
pb_collections/integrations.json — user integrations; provider, access_token, refresh_token, status
pb_collections/referral_codes.json — referral codes; user_id, code, created_at, status
pb_collections/referral_conversions.json — referral conversions; referrer_id, referred_user_id, conversion_type (2-for-1, free_year, 2_years), timestamp

**Migrations**
pb_migrations/1784616205_mark_owner_dev_creator.js — marks DM@wyzrdy.com as verified owner/developer/creator; sets verified: true, emailVisibility: true, system_role: ["owner", "developer", "creator"]

---

## apps/api

Node.js/Express backend; payment processing, referral tracking, AI entitlement, integrations, usage analytics.

**Routes**
src/routes/checkout.js — POST /api/checkout/founding; create Stripe checkout session for founding offer; POST /api/checkout/tier; create session for recurring subscription tier
src/routes/referral.js — POST /api/referral/generate-link; create referral code and return shareable link; GET /api/referral/status; fetch user's referral codes, conversions, track conversions, calculate viral pipeline progress (2-for-1, free year, 2 years)
src/routes/ai-usage.js — GET /api/ai-usage; fetch token/cost usage per provider/model/month
src/routes/integrations.js — POST /api/integrations/connect; OAuth callback handler for Composio integrations
src/routes/entitlement.js — GET /api/entitlement; check user's AI feature entitlement (active plan, founding access, pilot status); returns entitlement status without blocking

**Middleware**
src/middleware/ai-entitlement.js — entitlement check for AI endpoints; returns 403 with no_entitlement code if user lacks active plan

**Config**
.env — environment variables; Stripe keys, PocketBase URL, API secrets, OAuth credentials, email service keys (infrastructure, DO NOT edit)

Routes: GET /payments/config-status, POST /api/checkout/founding, POST /api/checkout/tier, POST /api/webhooks/stripe, POST /api/referral/generate-link, GET /api/referral/status, GET /api/ai-usage, POST /api/integrations/connect, GET /api/entitlement

---

## apps/web

Next.js frontend; marketing pages, user dashboard, checkout flow, integrations, settings, referral tracking, viral pipeline UI, pricing page with live viral pipeline pricing ($22.22, $7.77, $2.22, $333.33, $2.22/7 sprints) and monthly/yearly billing toggle with 50% discount.

**Pages**
src/pages/index.jsx — landing page; founding offer messaging (one-time founding access for your first year), counter display, call-to-action, pricing teaser with monthly/yearly toggle
src/pages/Pricing.jsx — viral pipeline pricing page; displays Plato ($22.22/mo), Viral Entry ($7.77/mo), Promo Reward ($2.22/mo, locked until 2 referrals), Enterprise ($333.33/mo), Sprint/Pipeline ($2.22/7 sprints); dynamic referral progress messaging from GET /api/referral/status; proactively checks GET /payments/config-status on mount and disables all checkout buttons with "Payments coming soon" label when Stripe is not configured; shows friendly banner instead of exposing raw backend errors
src/pages/dashboard.jsx — authenticated user dashboard; workflows, audits, blueprints, integrations, usage, settings, referral tracking (no client-side tier self-assignment)
src/pages/checkout.jsx — founding checkout flow; server-created session, Stripe redirect, success confirmation with one-year legal language
src/pages/settings.jsx — user settings; profile, subscription management, API keys, integrations
src/pages/Dashboard.jsx — main dashboard component; tabbed interface (profile, analytics, integrations, referrals); renders ViralPipeline component in referrals tab
src/pages/FoundingCheckout.jsx — founding offer checkout page; displays one-year access messaging, counter, Stripe payment element
src/pages/CheckoutSuccess.jsx — post-purchase confirmation; displays one-year access grant messaging and next steps
src/pages/AuthPage.jsx — signup/login page; founding offer banner with one-year language
src/pages/HomePage.jsx — home page with hero, founding offer banner (one-year), pricing teaser with monthly/yearly toggle, FAQ, social proof
src/pages/EasyBreezy.jsx — AI blueprint generator page; checks entitlement via GET /api/entitlement before calling /hcgi/api/ai/blueprint; shows graceful "locked" upgrade prompt for unentitled users instead of blocking on fetch error

**Components**
src/components/FoundingCounter.jsx — displays founding offer counter (total_cap, purchased_count, remaining_count, open status)
src/components/CheckoutButton.jsx — initiates server-created founding checkout
src/components/SubscriptionTier.jsx — displays recurring subscription options (Individual, Business, Agency, Enterprise) with monthly/yearly toggle and 50% discount
src/components/ShareButtons.jsx — social share with corrected founding offer text (one-year access)
src/components/Shell.jsx — app shell; qualified compliance/security claims (removed unsubstantiated SOC 2, penetration test, GDPR, CCPA badges)
src/components/ReferralDashboard.jsx — legacy referral dashboard (referral_codes/referral_conversions); displays code, copy-to-clipboard, conversion count
src/components/ViralPipeline.jsx — viral pipeline UI; referral link, progress bars (2-for-1, free year, 2 years), promo status, free months remaining, milestone messaging, copy-to-clipboard, real-time status updates
src/components/PilotCounter.jsx — founding offer counter display; shows remaining slots, one-year access messaging
src/components/PaywallModal.jsx — paywall modal for unauthenticated users; founding offer banner with one-year language
src/components/PricingTeaser.jsx — pricing preview component with monthly/yearly toggle; displays Plato ($22.22/mo or $133.32/year), Viral Entry ($7.77/mo or $46.62/year), Promo Reward ($2.22/mo or $13.32/year), Enterprise ($333.33/mo or $1,999.98/year); shows 50% discount on yearly billing
src/components/ForgeSeoHero.jsx — SEO audit hero component; gracefully checks entitlement before calling /hcgi/api/ai/audit; shows "See plans" CTA for unentitled users instead of blocking on fetch error

**Utils & Libs**
src/utils/api.js — API client; fetch wrapper with auth token, error handling
src/utils/stripe.js — Stripe.js initialization, payment element setup
src/lib/founding.js — founding offer constants and messaging; FOUNDING_OFFER_TEXT: "One-time founding access for your first year. Once the limit is reached, this offer is gone. Standard subscription pricing applies after 12 months."
src/lib/pricing.js — pricing tier constants; PRICING_TIERS object with plato ($22.22/mo), viral_entry ($7.77/mo), promo_reward ($2.22/mo), enterprise ($333.33/mo), sprint_pipeline ($2.22/7 sprints); tier descriptions and Stripe price ID mappings
src/lib/social.js — social share text; exact core statement: "Founding One-Year Access: The first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69."
src/lib/legalContent.js — legal terms and compliance statements; qualified unsubstantiated claims, corrected legal entity to The Good Idea LLC, one-year founding offer language, removed "lifetime-free" and "first 20,000 signups" language
src/lib/entitlement.js — entitlement checking; queries user tier, subscription status, founding access, pilot status
src/lib/viral.js — viral pipeline client lib; fetch referral status, generate referral link, initiate tier checkout, calculate progress, format messaging
src/lib/tiers.js — pricing tier definitions; Plato $22.22/mo, Viral Entry $7.77/mo, Promo Reward $2.22/mo, Enterprise $333.33/mo, Sprint/Pipeline $2.22/7 sprints; yearly pricing with 50% discount

**Config**
.env.example — template for frontend environment variables (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL, etc.); no live keys

Routes: /, /pricing, /dashboard, /checkout, /settings, /easy-breezy, GET /payments/config-status, GET /api/referral/status, POST /api/referral/generate-link, POST /api/checkout/tier, GET /api/entitlement

---

## Root Files

.gitignore — excludes .env*, pb_data/, *.db, node_modules, dist, build artifacts, and other sensitive/generated files
.env.example — template for environment variables; all populated secrets replaced with safe placeholders (your_z_ai_key_here, your_composio_key_here, your_openrouter_key_here, etc.)
SECURITY.md — credential rotation guide, API authentication details, rate limiting policy, SSRF protection, production checklist, Stripe webhook signature verification, PCI compliance
DEPLOYMENT.md — deployment steps for production hosts, environment setup, systemd/cron monitoring (not available in this sandbox), and troubleshooting
DNS.md — DNS configuration and optimization guide; A/CNAME/MX/TXT/CAA records for wyzrdy.com, TTL optimization, Cloudflare integration, health checks, monitoring
ARCHITECTURE.md — market-ready stack overview: Supabase (auth), Stripe (payments), OpenRouter (AI), Composio (integrations), Resend (email), Cloudflare Turnstile (bot protection), PostHog (analytics), Sentry (monitoring), n8n (workflows)
