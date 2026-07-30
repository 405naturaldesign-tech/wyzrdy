# Code Review: Recent Changes (Composio OAuth, Payments, Referrals)

**Date:** 2026-07-23
**Reviewer:** QA & Documentation Agent
**Status:** FINDINGS IDENTIFIED - Requires fixes before production

---

## Executive Summary

The codebase implements a sophisticated multi-tier payment system with founding offers, viral referral mechanics, and Composio OAuth integration. The architecture is sound with proper authentication and webhook signature verification, but several issues require attention:

- **CRITICAL:** SQL injection vectors in query filters
- **HIGH:** Missing CSRF protection on state-changing OAuth operations
- **HIGH:** Token refresh logic not implemented (TODO marker)
- **MEDIUM:** Race conditions in referral conversion deduplication
- **MEDIUM:** Incomplete error handling in critical paths

---

## 1. Composio OAuth Security Review

**File:** `apps/api/src/routes/composio-oauth.js`

### Findings

#### 1.1 CRITICAL: SQL Injection in Query Filters

**Lines 134, 303:**
```javascript
filter: `user_id = "${userId}" && provider = "${toolkitId}" && status = "pending"`
```

PocketBase query strings are string-interpolated. While PocketBase has some built-in protection, this pattern is dangerous if userId or toolkitId contain quotes.

**Risk:** If a user ID contains `"` characters (edge case but possible), it could break the query.

**Recommendation:**
- Use PocketBase's parameterized queries or safe escaping:
```javascript
const escapedUserId = userId.replace(/"/g, '\\"');
```
- Or refactor to use PocketBase SDK's filter builder if available.

#### 1.2 HIGH: Missing CSRF Protection on OAuth Init

**Lines 30-82: `initOAuthFlow`**

The function accepts a redirect URI from the client without validation. While the state parameter includes a timestamp, the redirect URI should be whitelisted.

**Risk:** CSRF attacks via malicious redirect URLs.

**Recommendation:**
```javascript
const ALLOWED_REDIRECT_URIS = new Set([
  `${CALLBACK_BASE_URL}/api/integrations/oauth/callback`,
  // Add other approved URIs
]);

if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
  return res.status(422).json({ error: 'Invalid redirect URI' });
}
```

#### 1.3 HIGH: Token Refresh Not Implemented

**Lines 250-256:**
```javascript
if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
  if (!conn.refresh_token) {
    return res.status(403).json({ error: 'Token expired and no refresh token available' });
  }
  // TODO: implement refresh token flow
}
```

**Risk:** Users cannot execute actions with expired tokens; must re-auth, poor UX.

**Recommendation:** Implement the refresh flow:
```javascript
if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
  if (!conn.refresh_token) {
    return res.status(403).json({ error: 'Token expired' });
  }
  try {
    const refreshRes = await fetch(`${COMPOSIO_API_BASE}/connected-accounts/refresh-token`, {
      method: 'POST',
      headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: conn.refresh_token, appName: conn.provider }),
    });
    if (!refreshRes.ok) throw new Error('Refresh failed');
    const { accessToken, expiresAt } = await refreshRes.json();
    await pb.collection('integrations').update(connectionId, {
      access_token: accessToken,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  } catch (err) {
    return res.status(403).json({ error: 'Token refresh failed' });
  }
}
```

#### 1.4 MEDIUM: Secrets in Error Messages

**Line 162:**
```javascript
errorUrl.searchParams.set('detail', err.message);
```

Error messages may leak implementation details. Avoid sending them to the frontend.

**Recommendation:**
```javascript
const publicMsg = 'OAuth connection failed. Please try again or contact support.';
errorUrl.searchParams.set('detail', 'auth_error');
logger.error(`[composio-oauth] error: ${err.message}`);
res.redirect(errorUrl.toString());
```

#### 1.5 MEDIUM: State Expiration Not Enforced

**Lines 35, 76:**
```javascript
state = Buffer.from(JSON.stringify({ userId, toolkitId, ts: Date.now() })).toString('base64');
// ...
expires: Date.now() + 600000, // 10 minutes
```

The expiration is sent to the client but not validated in the callback. A client could replay an old state.

**Recommendation:**
```javascript
// In handleOAuthCallback:
const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
const stateAge = Date.now() - stateData.ts;
if (stateAge > 600000) { // 10 minutes
  return res.status(401).json({ error: 'OAuth state expired' });
}
```

---

## 2. Stripe Webhook Security Review

**File:** `apps/api/src/routes/stripe-webhook.js`

### Findings

#### 2.1 GOOD: Signature Verification

**Lines 196:**
```javascript
event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
```

✓ Correctly verifies Stripe signature before processing. Registered with `express.raw()` to preserve body.

#### 2.2 GOOD: Idempotency via Event ID

**Lines 203-208:**
```javascript
try {
  await pb.collection('webhook_events').getFirstListItem(`stripe_event_id = '${event.id}'`);
  return res.status(200).json({ received: true, duplicate: true });
} catch (_) { /* not processed yet */ }
```

✓ Prevents double-processing via event ID deduplication. However, note the SQL injection risk below.

#### 2.3 CRITICAL: SQL Injection in Event Lookup

**Lines 204:**
```javascript
`stripe_event_id = '${event.id}'`
```

If Stripe event IDs could be manipulated (unlikely but in principle), this is an injection vector.

**Recommendation:** Escape or use a safer query method.

#### 2.4 MEDIUM: Incomplete Referral Recording on Checkout

**Lines 94-107:**
```javascript
const referrerId = session.metadata?.referrer_id;
const referredUser = session.metadata?.user_id || purchase.user_id;
if (referrerId && referredUser && referrerId !== referredUser) {
  try {
    await pb.collection('referral_conversions').create({
      referrer: referrerId,
      referred_user: referredUser,
      referred_purchase_id: purchase.id,
      conversion_type: 'founding_purchase',
    });
  } catch (err) {
    logger.info(`[webhook] referral conversion skipped: ${err.message}`);
  }
}
```

This logs conversions but does NOT trigger the referral reward (promo state update). The viral.js flow handles viral_entry conversions, but founding_purchase conversions are orphaned here.

**Recommendation:** Call `applyRewardForCount()` or similar after successful referral recording.

#### 2.5 MEDIUM: No Retry Logic on DB Write Failure

**Lines 219-224:**
```javascript
try {
  await pb.collection('webhook_events').create({
    stripe_event_id: event.id,
    event_type: event.type,
    processed_at: nowIso(),
    status,
  });
} catch (err) {
  logger.error('[webhook] failed to record event ledger', err.message);
}
```

If the event ledger write fails, the webhook returns 200 anyway. This could lead to:
- Lost audit trail
- Potential re-processing on retry (if dedup check also fails)

**Recommendation:** Fail the webhook and let Stripe retry:
```javascript
try {
  await pb.collection('webhook_events').create({
    stripe_event_id: event.id,
    event_type: event.type,
    processed_at: nowIso(),
    status,
  });
} catch (err) {
  logger.error('[webhook] failed to record event ledger', err.message);
  return res.status(500).json({ error: 'Failed to record ledger' });
}
res.status(200).json({ received: true });
```

---

## 3. Viral Referral System Review

**File:** `apps/api/src/utils/viral.js` & `apps/api/src/routes/viral-referral.js`

### Findings

#### 3.1 CRITICAL: SQL Injection in Multiple Locations

**Lines 14, 28, 44, 94-95, 176, 204, 226, 276, 318, etc.**

```javascript
filter: `user_id = '${esc(userId)}'`
```

While `esc()` escapes single quotes, it doesn't fully sanitize for complex queries. PocketBase filters can be vulnerable to injection with certain characters.

**Recommendation:** Use a parameterized query library or strict allowlist for field values.

#### 3.2 MEDIUM: Race Condition in Referral Code Generation

**Lines 30-43:**
```javascript
let code = randCode();
let created = null;
for (let i = 0; i < 5 && !created; i++) {
  try {
    created = await pb.collection('viral_referrals').create(
      { referrer_id: req.userId, referral_code: code, status: 'pending' },
      { requestKey: `gen-${req.userId}-${i}` },
    );
  } catch (err) {
    if (String(err.message).includes('unique') || err.status === 400) { code = randCode(); continue; }
    throw err;
  }
}
```

**Risk:** Between checking for existing and creating a new one, another request could create a code, leading to duplicate attempts.

**Recommendation:** Rely on PocketBase's unique constraint, but wrap in a single try-catch with retry:
```javascript
for (let i = 0; i < 5; i++) {
  try {
    return await pb.collection('viral_referrals').create({
      referrer_id: req.userId,
      referral_code: randCode(),
      status: 'pending',
    });
  } catch (err) {
    if (i === 4) throw err;
    // Retry with a new code
  }
}
```

#### 3.3 MEDIUM: Self-Referral Detection Incomplete

**Lines 89-109:**
The `checkSelfReferral()` function checks device fingerprints but doesn't check for:
- VPN/proxy bypass (same device, different IP)
- Shared payment methods (family accounts)

**Recommendation:** Add logging of all fingerprint mismatches and consider manual review for edge cases.

#### 3.4 MEDIUM: Promo Expiry Lacks Notifications

**Lines 315-330:**
```javascript
export async function expireStalePromos() {
  const now = nowIso();
  try {
    const stale = await pb.collection('referral_state').getFullList({
      filter: `promo_state = 'active_2for1' && promo_end_date != '' && promo_end_date <= '${now}'`,
    });
    for (const s of stale) {
      await pb.collection('referral_state').update(s.id, { promo_state: 'expired_2for1' }, { requestKey: `exp-${s.id}` });
      await revertStripe(s.user_id);
      await notify(s.user_id, 'Promo expired', 'Your $2.22/mo promo has expired. Reverting to $22.22/mo.');
    }
    if (stale.length) logger.info(`[viral] expired ${stale.length} 2for1 promos`);
  } catch (err) {
    logger.warn(`[viral] expireStalePromos failed: ${err.message}`);
  }
}
```

This is called on-demand only (no cron). If a user doesn't visit the app after expiry, they'll be charged at full price without advance notice.

**Recommendation:** Add a cron job or scheduled task to run this daily.

#### 3.5 MEDIUM: Stripe Coupon Creation Unbounded

**Lines 191:**
```javascript
const coupon = await stripe.coupons.create({ percent_off: percentOff, duration: 'repeating', duration_in_months: months });
```

Every referral milestone creates a new coupon. Over time, this pollutes the Stripe account with orphaned coupons.

**Recommendation:** Reuse coupons by ID if they exist:
```javascript
const couponId = `${promoState}-${months}mo`;
let coupon;
try {
  coupon = await stripe.coupons.retrieve(couponId);
} catch (_) {
  coupon = await stripe.coupons.create({
    id: couponId,
    percent_off: percentOff,
    duration: 'repeating',
    duration_in_months: months,
  });
}
await stripe.subscriptions.update(purchase.stripe_subscription_id, { coupon: coupon.id });
```

---

## 4. Payment Routes Review

**File:** `apps/api/src/routes/payments.js`

### Findings

#### 4.1 GOOD: Price Validation

**Lines 14-19:**
```javascript
function priceFor(tierId, cycle) {
  const tier = getTier(tierId);
  if (!tier || tier.price == null) return null;
  return cycle === 'annual' ? tier.price * 10 : tier.price;
}
```

✓ Properly validates tier existence and returns null on invalid tiers.

#### 4.2 MEDIUM: No Campaign Validation in Checkout

**Lines 131-178:**
```javascript
export const checkout = async (req, res) => {
  const { provider, tier, cycle = 'monthly', currency = 'USD', crypto_asset = '', method = '' } = req.body || {};
  if (!TIERS[tier]) return res.status(422).json({ error: 'A valid plan (tier) is required.' });
  // ...
  if (provider === 'stripe') result = await stripeCheckout({ userId: req.userId, email: req.user?.email, tier, cycle, amount, currency });
```

**Risk:** No check if a campaign is active for the requested tier. Users could trigger checkout for unavailable tiers.

**Recommendation:**
```javascript
const campaign = await getActiveCampaign();
if (!campaign || (tier === 'viral_entry' && !campaign.viral_entry_tier_enabled)) {
  return res.status(400).json({ error: 'This tier is not currently available.' });
}
```

#### 4.3 MEDIUM: Stripe Session Metadata Not Validated

**Lines 165:**
```javascript
const rec = await savePayment({ ...base, status: 'processing', external_id: result.external_id || '', checkout_url: result.checkout_url || '', meta: { cycle } });
```

The metadata sent to Stripe should include campaign information for webhook resolution. Verify that all checkout routes include consistent metadata.

**Recommendation:** See "Checkout Metadata Consistency" below.

---

## 5. Founding Checkout Review

**File:** `apps/api/src/routes/founding-checkout.js`

### Findings

#### 5.1 GOOD: Referral Code Validation

**Lines 52-62:**
```javascript
let referrerId = '';
const refCode = (req.body?.ref || '').toString().trim();
if (refCode) {
  try {
    const rc = await pb.collection('referral_codes').getFirstListItem(`code = '${refCode.replace(/'/g, '')}'`);
    if (rc && rc.owner && rc.owner !== req.userId) referrerId = rc.owner;
  } catch (_) { /* unknown code — ignore */ }
}
```

✓ Safely looks up referral code and ignores self-referrals.

#### 5.2 GOOD: Availability Gate

**Lines 41-45:**
```javascript
const avail = await getAvailability();
if (avail.sold_out || avail.remaining <= 0) {
  return res.status(429).json({ error: 'Founding offer sold out.', ...avail });
}
```

✓ Prevents overselling via availability check and reservation TTL.

#### 5.3 GOOD: Metadata Consistency

**Lines 64-76:**
```javascript
const metadata = { user_id: req.userId, purchase_type: 'founding_lifetime' };
if (referrerId) metadata.referrer_id = referrerId;

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [{ price: FOUNDING_PRICE_ID, quantity: 1 }],
  customer_email: req.user.email,
  success_url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${APP_BASE_URL}/checkout/cancel`,
  metadata,
  payment_intent_data: { metadata },
});
```

✓ Metadata is consistent and duplicated to both session and payment intent.

#### 5.4 MEDIUM: checkoutTier Missing Campaign Validation

**Lines 147-178:**
```javascript
export async function checkoutTier(req, res) {
  // ...
  const session = await stripe.checkout.sessions.create({
    mode: cfg.mode,
    payment_method_types: ['card'],
    line_items: [{ price: cfg.price, quantity: 1 }],
    customer_email: req.user.email,
    success_url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE_URL}/checkout/cancel`,
    metadata: { user_id: req.userId, purchase_type: tier },
  });
```

**Risk:** No campaign or tier availability check. Viral entry, promo reward tiers may be unavailable.

**Recommendation:** Add validation before session creation:
```javascript
if (['viral_entry', 'promo_reward'].includes(tier)) {
  const campaign = await getActiveCampaign();
  if (!campaign) return res.status(400).json({ error: 'Tier not available.' });
}
```

---

## 6. Authentication & Authorization Review

**File:** `apps/api/src/middleware/auth.js`

### Findings

#### 6.1 GOOD: PocketBase Session Verification

**Lines 24-32:**
```javascript
try {
  await pb.collection('users').authRefresh();
} catch (_) {
  return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
}

if (!pb.authStore.isValid || !pb.authStore.record) {
  return res.status(401).json({ error: 'Invalid session.' });
}
```

✓ Validates JWT and checks auth store validity.

#### 6.2 GOOD: Per-User Rate Limiting

**Lines 47-66:**
```javascript
export function perUserRateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.userId || req.ip || 'anon';
    const now = Date.now();
    const rec = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) {
      rec.count = 0;
      rec.reset = now + windowMs;
    }
    rec.count += 1;
    hits.set(key, rec);
    if (rec.count > max) {
      const retryAfter = Math.ceil((rec.reset - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Rate limit exceeded. Slow down.', retryAfter });
    }
    next();
  };
}
```

✓ In-memory sliding window, per-user keying, Retry-After header.

#### 6.3 MEDIUM: Rate Limiter Lacks Persistence

**Note:** The comment on line 44 acknowledges this:
```javascript
// Note: in-memory only — resets on process restart
```

For multi-instance deployments, this is insufficient. Consider Redis or shared storage.

---

## 7. Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| **Secrets Not Logged** | PASS | No hardcoded keys in code |
| **SQL Injection** | FAIL | Multiple unescaped query filters |
| **XSS Protection** | PASS | Stripe data trusted, no user input in templates |
| **CSRF on State Changes** | FAIL | OAuth redirect URI not validated |
| **Rate Limiting** | PASS | Per-user limits on credit-bearing routes |
| **CORS** | PASS | Restricted to `CORS_ORIGIN` env var |
| **Authentication** | PASS | `requireAuth` on private endpoints |
| **Authorization** | PASS | User data isolation checks present |
| **Webhook Signatures** | PASS | Stripe signature verified |
| **Idempotency** | PASS | Event dedup via ID, but SQL injection risk |
| **Error Handling** | PARTIAL | Some paths leak error details |
| **Token Refresh** | FAIL | OAuth tokens not refreshed |

---

## Summary of Issues by Severity

### CRITICAL (Fix before any deployment)
1. **SQL Injection in PocketBase filters** — Multiple files use string interpolation
2. **Token refresh not implemented** — composio-oauth.js line 255

### HIGH (Fix before production)
1. **Missing CSRF protection on OAuth** — No redirect URI validation
2. **Webhook ledger failures silently continue** — No retry, loses audit trail

### MEDIUM (Fix in next sprint)
1. **State expiration not validated** — OAuth state can be replayed
2. **Referral conversions not applied for founding purchases**
3. **Race conditions in referral code generation**
4. **Campaign validation missing from tier checkout**
5. **Secrets in error messages**
6. **Promo expiry requires manual trigger**
7. **Stripe coupon proliferation**

---

## Recommendations for Code Quality

1. **Use parameterized queries** — Migrate to PocketBase SDK's safe query builder
2. **Add input validation schemas** — Use Zod or Yup for all API inputs
3. **Implement structured logging** — Replace string interpolation with JSON logging
4. **Add E2E tests** — Stripe webhook simulation, referral state transitions
5. **Document campaign fields** — What metadata is required, what is optional
6. **Add audit trails** — Log all payment/referral state changes

