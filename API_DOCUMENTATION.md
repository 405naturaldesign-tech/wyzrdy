# API Documentation

**Date:** 2026-07-23
**Status:** DRAFT
**Audience:** Frontend developers, third-party integrators

---

## Base URL

```
https://api.wyzrdy.com  (production)
http://localhost:3001   (development)
```

---

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <PocketBase_JWT>
```

Public endpoints require no auth.

---

## Table of Contents

1. [Payments & Checkout](#payments--checkout)
2. [Referrals & Viral Growth](#referrals--viral-growth)
3. [Composio OAuth & Integrations](#composio-oauth--integrations)
4. [Entitlements & Status](#entitlements--status)
5. [Error Responses](#error-responses)

---

## Payments & Checkout

### POST /checkout/founding

Initiate a one-time $11.69 founding offer checkout.

**Authentication:** Required

**Request Body:**
```json
{
  "ref": "ref_abc123def"  // optional: referral code
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

**Status Codes:**
- `200` — Success
- `400` — Already has founding access
- `429` — Sold out
- `503` — Stripe not configured

**Example:**
```bash
curl -X POST http://localhost:3001/checkout/founding \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ref":"ref_abc123"}'
```

---

### POST /checkout/subscription

Subscribe to monthly or annual plan.

**Authentication:** Required

**Query Parameters:**
- `cycle` — `monthly` or `annual` (default: `monthly`)

**Request Body:**
```json
{
  "cycle": "annual"  // optional: override query param
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_...",
  "session_id": "cs_..."
}
```

**Status Codes:**
- `200` — Success
- `422` — Invalid cycle
- `503` — Stripe not configured

---

### POST /checkout/tier

Advanced tier checkout (plato, viral_entry, promo_reward, enterprise).

**Authentication:** Required

**Query Parameters:**
- `tier` — `plato`, `viral_entry`, `promo_reward`, `enterprise`, `sprint_pipeline`

**Request Body:**
```json
{
  "tier": "viral_entry"  // optional: override query
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_...",
  "session_id": "cs_..."
}
```

**Status Codes:**
- `200` — Success
- `400` — Campaign inactive or tier unavailable
- `422` — Unknown tier

---

### GET /payments/crypto-quote

Real-time crypto price conversion (public).

**Query Parameters:**
- `amount` — USD amount to convert

**Response:**
```json
{
  "fiatAmount": 99,
  "currency": "USD",
  "quotes": [
    {
      "asset": "BTC",
      "priceUsd": 45000,
      "amount": 0.0022
    },
    {
      "asset": "ETH",
      "priceUsd": 2500,
      "amount": 0.0396
    },
    {
      "asset": "SOL",
      "priceUsd": 150,
      "amount": 0.66
    },
    {
      "asset": "USDC",
      "priceUsd": 1.0,
      "amount": 99.0
    }
  ],
  "asOf": "2026-07-23T12:34:56.789Z"
}
```

**Status Codes:**
- `200` — Success
- `422` — Missing or invalid amount

---

### GET /payments/status/:id

Check payment status.

**Authentication:** Required

**Path Parameters:**
- `id` — Payment record ID

**Response:**
```json
{
  "id": "pay_123",
  "status": "paid",  // pending, processing, paid, refunded, failed
  "provider": "stripe",
  "amount": 1169,
  "currency": "usd"
}
```

**Status Codes:**
- `200` — Success
- `404` — Payment not found

---

### POST /payments/refund

Request a refund for a payment.

**Authentication:** Required

**Request Body:**
```json
{
  "paymentId": "pay_123"
}
```

**Response:**
```json
{
  "id": "pay_123",
  "status": "refunded"
}
```

**Status Codes:**
- `200` — Success
- `404` — Payment not found
- `403` — Not your payment

---

### GET /invoices

List all invoices for authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "items": [
    {
      "id": "inv_123",
      "owner": "user_456",
      "number": "WZ-ABCD1234",
      "tier": "plato",
      "amount": 2222,
      "currency": "usd",
      "provider": "stripe",
      "status": "paid",
      "created": "2026-07-23T12:34:56Z"
    }
  ]
}
```

---

### GET /invoices/:id

Retrieve a specific invoice.

**Authentication:** Required

**Path Parameters:**
- `id` — Invoice ID

**Response:** Single invoice object (see `/invoices`)

---

### POST /subscriptions/upgrade

Upgrade to a higher tier.

**Authentication:** Required

**Request Body:**
```json
{
  "tier": "plato"
}
```

**Response:**
```json
{
  "tier": "plato",
  "direction": "upgrade",
  "message": "Subscription upgraded to plato."
}
```

---

### POST /subscriptions/downgrade

Downgrade to a lower tier.

**Authentication:** Required

**Request Body:**
```json
{
  "tier": "individual"
}
```

**Response:**
```json
{
  "tier": "individual",
  "direction": "downgrade",
  "message": "Subscription downgraded to individual."
}
```

---

### POST /subscriptions/cancel

Cancel subscription.

**Authentication:** Required

**Response:**
```json
{
  "status": "canceled",
  "message": "Your subscription has been canceled."
}
```

---

### POST /checkout/portal

Create a Stripe billing portal session.

**Authentication:** Required

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

## Referrals & Viral Growth

### POST /referral/generate-link

Generate or retrieve a referral link for the user.

**Authentication:** Required

**Request Body:** Empty or `{}`

**Response:**
```json
{
  "referral_code": "ref_abc123def789",
  "referral_url": "https://wyzrdy.com/signup?ref=ref_abc123def789"
}
```

**Status Codes:**
- `200` — Success

**Notes:**
- Returns existing pending code if available (idempotent)
- Retries up to 5 times to generate unique code

---

### GET /referral/status

Retrieve referral progress and unlock status.

**Authentication:** Required

**Response:**
```json
{
  "referral_count": 5,
  "promo_state": "active_2for1",  // inactive, active_2for1, free_year_1, free_year_2, free_year_5, expired_2for1
  "friends_to_2for1": 0,          // 0 if already unlocked
  "friends_to_free_year": 5,      // 5 more friends needed
  "friends_to_2_years": 15,
  "promo_expires_at": "2027-07-23T12:34:56Z",  // null if not active
  "free_months_remaining": 12,    // for free_year_* states
  "max_free_months": 60,
  "referral_link": "https://wyzrdy.com/signup?ref=ref_abc123",
  "message": "You've unlocked $2.22/mo. You're 5 friends away from a full year free."
}
```

**Thresholds:**
- 2 referrals → $2.22/mo for 12 months
- 10 referrals → 12 months free
- 20 referrals → 24 months free
- 30+ referrals → 60 months free (5-year cap)

---

### POST /checkout/viral-entry

Initiate $7.77/mo viral entry tier checkout.

**Authentication:** Required

**Query Parameters:**
- `referral_code` — Required referral code

**Request Body:**
```json
{
  "referral_code": "ref_abc123"
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/pay/cs_...",
  "session_id": "cs_..."
}
```

**Status Codes:**
- `200` — Success
- `400` — Invalid or already-used referral code
- `422` — Missing referral code
- `503` — Stripe or campaign not configured

---

## Composio OAuth & Integrations

### POST /integrations/oauth/init/:toolkitId

Initiate OAuth flow for a third-party integration.

**Authentication:** Required

**Path Parameters:**
- `toolkitId` — e.g., `gmail`, `slack`, `hubspot`

**Request Body:**
```json
{
  "redirect_uri": "https://wyzrdy.com/settings"  // optional
}
```

**Response:**
```json
{
  "authUrl": "https://app.composio.dev/oauth/authorize?...",
  "state": "eyJ1c2VySWQiOiJ1c2VyXzEyMyIsInRvb2xraXRJZCI6Imdt...",
  "connectionId": "conn_123",
  "expires": 1626792856000  // 10 minutes from now
}
```

**Status Codes:**
- `200` — Success
- `503` — Composio not configured

---

### GET /integrations/oauth/callback

Composio OAuth redirect (public).

**Query Parameters:**
- `code` — Authorization code from Composio
- `state` — State token from init

**Behavior:**
- Exchanges code for access token
- Stores token in `integrations` collection
- Redirects to success page with `integration` and `status` params

**Errors redirect to:**
```
https://wyzrdy.com/settings?error=oauth_failed&detail=<message>
```

---

### GET /integrations/connections

List all active OAuth connections for the user.

**Authentication:** Required

**Response:**
```json
{
  "connections": [
    {
      "id": "conn_123",
      "provider": "gmail",
      "status": "connected",
      "connected_at": "2026-07-23T10:00:00Z",
      "expires_at": "2026-08-23T10:00:00Z"
    },
    {
      "id": "conn_456",
      "provider": "slack",
      "status": "connected",
      "connected_at": "2026-07-22T14:30:00Z",
      "expires_at": null
    }
  ]
}
```

---

### DELETE /integrations/connections/:connectionId

Revoke an OAuth connection.

**Authentication:** Required

**Path Parameters:**
- `connectionId` — Connection ID to revoke

**Response:**
```json
{
  "success": true,
  "message": "Connection revoked"
}
```

**Status Codes:**
- `200` — Success
- `403` — Not your connection
- `404` — Connection not found

---

### POST /integrations/execute/:connectionId/:action

Execute a Composio action with stored credentials.

**Authentication:** Required

**Path Parameters:**
- `connectionId` — Connection ID
- `action` — Action ID (e.g., `send_email`)

**Request Body:**
```json
{
  "input": {
    "to": "user@example.com",
    "subject": "Hello",
    "body": "This is a test."
  },
  "params": {}
}
```

**Response:**
```json
{
  "result": { /* action-specific output */ },
  "executedAt": "2026-07-23T12:34:56Z"
}
```

**Status Codes:**
- `200` — Success
- `403` — Unauthorized or token expired
- `500` — Action execution failed

---

### GET /integrations/mcp-server-info

Retrieve MCP server configuration for Composio integrations.

**Authentication:** Required

**Response:**
```json
{
  "mcpServer": {
    "name": "wyzrdy-composio-mcp-bridge",
    "version": "1.0.0"
  },
  "transports": ["stdio", "sse", "ws"],
  "capabilities": {
    "resources": {
      "listChanged": true,
      "subscribe": true
    },
    "tools": true,
    "logging": true,
    "roots": false
  },
  "resources": [
    {
      "uri": "composio://gmail/conn_123",
      "name": "gmail",
      "mimeType": "application/vnd.composio.connection"
    }
  ],
  "toolkits": ["gmail", "slack"]
}
```

---

## Entitlements & Status

### GET /entitlement

Retrieve the authenticated user's entitlement status.

**Authentication:** Required

**Response:**
```json
{
  "user_id": "user_123",
  "entitlement_type": "founding_lifetime",
  "entitlement_status": "active",
  "purchase_type": "founding_lifetime",
  "payment_status": "succeeded",
  "completed_at": "2026-07-23T12:34:56Z",
  "subscription_period_end": "2027-07-23T12:34:56Z",
  "stripe_customer_id": "cus_abc123",
  "stripe_subscription_id": "sub_abc123"
}
```

**Possible entitlement_types:**
- `none` — No active purchase
- `founding_lifetime` — Founding offer (1 year access)
- `viral_entry` — $7.77/mo tier
- `plato` — $22.22/mo tier
- `agency` — $99/mo tier
- `enterprise` — Custom

---

### GET /founding/count

Public founding availability counter.

**Authentication:** Not required

**Response:**
```json
{
  "completed_purchases": 15234,
  "total_cap": 20000,
  "remaining": 4766,
  "sold_out": false
}
```

---

### GET /payments/config-status

Public Stripe configuration status.

**Authentication:** Not required

**Response:**
```json
{
  "stripe_configured": true
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "User-friendly error message",
  "detail": "Optional technical detail"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (invalid params) |
| `401` | Unauthorized (missing/invalid auth) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not found |
| `422` | Unprocessable entity (validation error) |
| `429` | Too many requests (rate limited) |
| `500` | Internal server error |
| `503` | Service unavailable (Stripe/Composio down) |

### Example Error Response

```bash
curl -X POST http://localhost:3001/checkout/founding
# Missing Authorization header

{
  "error": "Authentication required. Please sign in.",
  "detail": null
}

HTTP 401
```

---

## Webhook Events

### Stripe Webhooks

**Endpoint:** `POST /webhooks/stripe`

**Signature:** Required (HMAC-SHA256)

**Payload Types:**
- `checkout.session.completed` — Purchase completed
- `checkout.session.async_payment_succeeded` — Async payment confirmed
- `checkout.session.async_payment_failed` — Async payment failed
- `invoice.paid` — Subscription invoice paid
- `invoice.payment_failed` — Subscription invoice failed
- `customer.subscription.updated` — Subscription details changed
- `customer.subscription.deleted` — Subscription canceled
- `charge.refunded` — Charge refunded
- `charge.dispute.created` — Chargeback initiated

**Idempotency:** Event IDs are tracked to prevent double-processing.

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/ai/chat`, `/ai/blueprint`, `/ai/workflow`, `/ai/audit` | 20 | 60 seconds |
| `/scrape` | 15 | 60 seconds |
| Others | 30 | 60 seconds |
| Global (all endpoints) | 1000 | 1 minute |

**Response Header on Limit Exceeded:**
```
HTTP 429 Too Many Requests
Retry-After: 45
```

---

## Campaign Metadata

All checkout routes include campaign metadata in Stripe sessions:

```json
{
  "user_id": "user_123",
  "purchase_type": "founding_lifetime",  // or "viral_entry", "plato", etc.
  "referrer_id": "user_456",             // optional: referral attribution
  "tier": "viral_entry",                 // optional: for viral checkouts
  "referral_code": "ref_abc123"          // optional: for viral checkouts
}
```

This metadata is used by webhooks to:
- Attribute referral conversions
- Grant sprint credits
- Update promo state
- Enforce campaign rules

---

## Environment Configuration

Required environment variables:

```bash
# PocketBase
POCKETBASE_URL=https://pb.wyzrdy.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FOUNDING_PRICE_ID=price_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...
STRIPE_VIRAL_ENTRY_PRICE_ID=price_...
STRIPE_PROMO_REWARD_PRICE_ID=price_...
STRIPE_SPRINT_PRICE_ID=price_...

# Composio
COMPOSIO_API_BASE_URL=https://backend.composio.dev/api/v3
COMPOSIO_API_KEY=...
COMPOSIO_CLIENT_ID=...
COMPOSIO_CLIENT_SECRET=...

# CORS & URLs
CORS_ORIGIN=https://wyzrdy.com
APP_BASE_URL=https://wyzrdy.com
CALLBACK_BASE_URL=https://api.wyzrdy.com
FRONTEND_URL=https://wyzrdy.com
```

---

## Pagination

Endpoints that return lists (e.g., `/invoices`) support:
- `limit` — Results per page (default: 50)
- `offset` — Skip N results (default: 0)

Example:
```
GET /invoices?limit=10&offset=20
```

---

## Changelog

### v1.0.0 (2026-07-23)
- Initial API release
- Stripe checkout integration
- Viral referral system
- Composio OAuth bridge
- Founding offer with cap enforcement

---

## Support

For API issues, contact: `api-support@wyzrdy.com`

