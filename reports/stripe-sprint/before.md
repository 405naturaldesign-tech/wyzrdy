# Wyzrdy Stripe Production-Readiness Sprint — Before State
**Date:** 2026-07-22  
**Architect:** Hermes  
**Repository:** `/home/yoshifed/Pictures/wyzrdy`  

## 1. Repository State

| Attribute | Value |
|-----------|-------|
| Git initialized | **No** — not a git repository |
| Runtime | Node v22.22.2, npm 10.9.7 |
| Package manager | npm workspaces (package-lock.json, 342KB) |
| Build status | **Passes** — Vite production build OK (4.00s, 674KB JS, 90KB CSS) |
| Lint status | **Passes** — both apps clean |

## 2. Codex Repair Archive

| Archive | Date | Size | Status |
|---------|------|------|--------|
| `wyzrdy.zip` | Jul 18 20:23 | 24.4 MB | Original archive |
| `wyzrdy21.zip` | Jul 21 22:39 | 24.5 MB | Codex repair archive |

**Finding:** The current working directory matches `wyzrdy21.zip` (file sizes, dates, and key file contents are identical). The Codex repair has already been applied to the working copy.

**Key file size comparison:**
| File | Original (wyzrdy.zip) | Repaired (current) |
|------|----------------------|-------------------|
| `payments.js` | 13,532 bytes | **13,559 bytes** ✓ |
| `founding-checkout.js` | 6,438 bytes | **8,761 bytes** ✓ |
| `index.js` | 4,971 bytes | **5,661 bytes** ✓ |
| `stripe-webhook.js` | N/A | **Present** ✓ (separate webhook handler) |

## 3. Stripe Configuration Status

### Environment Variables (`apps/api/.env`)

| Variable | Status | Notes |
|----------|--------|-------|
| `STRIPE_SECRET_KEY` | ❌ Missing | Defined in .env but empty |
| `STRIPE_PUBLISHABLE_KEY` | ❌ Missing | Not defined at all |
| `STRIPE_WEBHOOK_SECRET` | ❌ Missing | Defined in .env but empty |
| `STRIPE_FOUNDING_PRICE_ID` | ❌ Missing | Defined in .env but empty |
| `STRIPE_MONTHLY_PRICE_ID` | ❌ Missing | Non-canonical name; defined but empty |
| `STRIPE_ANNUAL_PRICE_ID` | ❌ Missing | Non-canonical name; defined but empty |
| `STRIPE_PLATO_PRICE_ID` | ❌ Missing | Viral tier; defined but empty |
| `STRIPE_ENTERPRISE_PRICE_ID` | ❌ Missing | Defined but empty |
| `STRIPE_SPRINT_PRICE_ID` | ❌ Missing | Defined but empty |
| `STRIPE_VIRAL_ENTRY_PRICE_ID` | ❌ Missing | Defined but empty |
| `STRIPE_PROMO_REWARD_PRICE_ID` | ❌ Missing | Defined but empty |
| `PAYPAL_CLIENT_ID` | ❌ Missing | Empty |
| `PAYPAL_SECRET` | ❌ Missing | Empty |
| `COINBASE_COMMERCE_KEY` | ❌ Missing | Empty |

**Key observation:** All Stripe env var names in `.env` use the non-canonical naming scheme (`STRIPE_MONTHLY_PRICE_ID` instead of `STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID`). There is no per-tier granularity.

### Stripe SDK Usage

- `apps/api/src/utils/stripeClient.js` — Uses Stripe SDK properly (`apiVersion: '2024-06-20'`), lazy construction, null-safe
- `apps/api/src/routes/payments.js` — **Uses raw `fetch()` calls to Stripe REST API** instead of SDK (lines 59-66, 201-204)
- `apps/api/src/routes/founding-checkout.js` — Uses Stripe SDK properly via `getStripe()`
- `apps/api/src/routes/stripe-webhook.js` — Verifies signatures via SDK

### Pricing Data

| Tier | Backend Price | Frontend Price | Match? |
|------|--------------|----------------|--------|
| Individual | $29/mo | **$22.22/mo** | ❌ **MISMATCH** |
| Business | $99/mo | **$77.77/mo** | ❌ **MISMATCH** |
| Agency | $499/mo | **$333.33/mo** | ❌ **MISMATCH** |
| Founding Access | $11.69 one-time | Not in frontend tiers | ⚠️ Not shown |

## 4. Webhook Architecture

### Current State: Two Separate Stripe Webhook Implementations

**Route A:** `POST /webhooks/stripe`
- File: `apps/api/src/routes/stripe-webhook.js`
- Raw body ✅ — registered before JSON parser in `main.js`
- Signature verification ✅ — uses `stripe.webhooks.constructEvent()`
- Idempotency ✅ — records `webhook_events` via PocketBase
- Event handling: checkout.session.completed, async_payment_succeeded/failed, invoice.paid/failed, customer.subscription.*, charge.refunded, charge.dispute.created
- **Named `stripeWebhook` (default export)**

**Route B:** `POST /payments/webhook/stripe`
- File: `apps/api/src/routes/payments.js`
- Raw body ❌ — uses regular JSON body parser, not raw
- Signature verification ❌ — none
- Idempotency ❌ — no dedup
- Handler: `webhookStripe` (named export)
- Uses `markPaidByExternalId()` which updates DB directly

**Other unsigned webhooks:** `webhookPaypal`, `webhookCoinbase` — no signature verification at all.

## 5. Entitlement System

- **Server-enforced:** Yes — `requireAIEntitlement` middleware checks plan + token limits
- **Plan resolution:** `getUserPlan()` in `aiUsage.js` — checks subscription status and founding purchases
- **Founding cap:** 20,000 (hardcoded in `founding.js`)
- **Reservation system:** Yes, with TTL (`founding_checkout.js` → `founding_reservations`)
- **Overselling protection:** Yes — double-check at webhook grant time (`stripe-webhook.js` lines 67-86)
- **Entitlement ledger:** `founding_purchases` collection (status: pending/active/suspended/revoked)

## 6. Existing Tests

| File | Lines | Type | Status |
|------|-------|------|--------|
| `apps/api/src/tests/ai-usage.test.js` | 36 | Unit test stub | Present but minimal |

**No other tests exist anywhere in the repository.**

## 7. Security Findings (Pre-Sprint)

| Finding | Severity | Location |
|---------|----------|----------|
| Dual webhook routes (one unsigned) | 🔴 Critical | `routes/index.js` lines 55, 80 |
| PayPal webhook no signature verification | 🔴 Critical | `routes/payments.js` line 242 |
| Coinbase webhook no signature verification | 🔴 Critical | `routes/payments.js` line 251 |
| `/perf/*` routes public (no auth) | 🟡 High | `middleware/global-rate-limit.js` skip list |
| `/test/*` routes public (no auth) | 🟡 High | `routes/index.js` lines 99-106 |
| `console.warn = () => {}` in vite.config.js | 🟡 High | `apps/web/vite.config.js` line 349 |
| `validateTrustProxy: false` on rate limiter | 🟡 Medium | `middleware/global-rate-limit.js` |
| Raw fetch to Stripe REST API instead of SDK | 🟡 Medium | `routes/payments.js` |
| Frontend/backend price mismatch | 🟡 Medium | `tiers.js` (back/front) |
| Empty REQUIRED env array | 🟢 Low | `config/env.js` line 12-15 |

## 8. Existing Environment Config

- `apps/api/.env.example` — comprehensive (300+ lines), documents all variables
- `apps/api/.env` — populated with non-Stripe API keys (OpenRouter, ZAI, Composio) ✅
- `.gitignore` — covers `.env*`, `*.db`, `node_modules/`, `dist/`, `pb_data/` ✅
- No `.env.example` at monorepo root

## 9. Frontend Cost

| Metric | Count |
|--------|-------|
| Total JS chunks | ~674KB gzipped ~200KB |
| CSS | 90KB gzipped ~15KB |
| Module count | 2,010 transformed |
| Page routes | 21 (all eager-loaded, no React.lazy) |

## 10. Audit Trail

- No Git history — cannot audit previous commits for leaked secrets
- `.env` is not tracked by Git (correctly ignored)
- Database files (`*.db`, `*.db-shm`, `*.db-wal`) present in `pb_data/` but gitignored
