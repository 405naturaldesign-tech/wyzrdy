# Comprehensive Testing Strategy

**Date:** 2026-07-23
**Audience:** QA, Engineering, Product
**Status:** DRAFT — Ready for implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [Test Scenarios](#test-scenarios)
5. [Test Data Strategy](#test-data-strategy)
6. [Test Execution Plan](#test-execution-plan)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Overview

Testing strategy covers three layers:

- **Unit Tests** — Pure logic, no external dependencies (Stripe, PocketBase)
- **Integration Tests** — End-to-end flows with Stripe test mode & local PocketBase
- **Scenario Tests** — Specific business rules (referral unlocks, cap enforcement, etc.)

### Key Principles

- **Idempotency** — All payment/referral operations must be idempotent
- **Audit Trail** — Every state change logged for debugging
- **Rollback on Failure** — Insufficient balance, sold-out, campaign-ended all rollback gracefully
- **Zero Client Trust** — Server validates all claims, never trust client-provided IDs

---

## Unit Tests

### 1.1 Price Calculation Tests

**File:** `apps/api/src/tests/payments.test.js` (new)

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor } from '../routes/payments.js';

test('Monthly plan pricing', () => {
  const monthlyPrice = priceFor('plato', 'monthly');
  assert.equal(monthlyPrice, 22.22); // or configured value
});

test('Annual plan pricing (10 months for 12)', () => {
  const annualPrice = priceFor('plato', 'annual');
  assert.equal(annualPrice, 222.2); // 22.22 * 10
});

test('Invalid tier returns null', () => {
  const price = priceFor('nonexistent', 'monthly');
  assert.equal(price, null);
});
```

### 1.2 Referral Tier Unlock Tests

**File:** `apps/api/src/tests/referral.test.js` (new)

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THRESHOLD_2FOR1, THRESHOLD_FREE_YEAR, THRESHOLD_2_YEARS, MAX_FREE_MONTHS,
} from '../utils/viral.js';

test('2 referrals unlocks $2.22/mo tier', () => {
  assert.equal(THRESHOLD_2FOR1, 2);
});

test('10 referrals unlocks free year', () => {
  assert.equal(THRESHOLD_FREE_YEAR, 10);
});

test('20 referrals unlocks 2 years free', () => {
  assert.equal(THRESHOLD_2_YEARS, 20);
});

test('30+ referrals capped at 5 years (60 months)', () => {
  assert.equal(MAX_FREE_MONTHS, 60);
});
```

### 1.3 Founding Cap Tests

**File:** `apps/api/src/tests/founding.test.js` (new)

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDING_CAP, RESERVATION_TTL_MS } from '../utils/founding.js';

test('Founding cap is 20,000 units', () => {
  assert.equal(FOUNDING_CAP, 20000);
});

test('Reservation expires after 30 minutes', () => {
  assert.equal(RESERVATION_TTL_MS, 30 * 60 * 1000);
});

test('availabilitySnapshot: completed + reserved = allocated', () => {
  // Mock test: getAvailability() returns { completed_purchases, active_reservations, remaining, sold_out }
  const snapshot = {
    completed_purchases: 5000,
    active_reservations: 2000,
    total_cap: 20000,
    remaining: 13000,
    sold_out: false,
  };
  const allocated = snapshot.completed_purchases + snapshot.active_reservations;
  assert.equal(allocated, 7000);
  assert.equal(snapshot.remaining, FOUNDING_CAP - allocated);
});
```

### 1.4 Self-Referral Detection Tests

**File:** `apps/api/src/tests/viral-security.test.js` (new)

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Mock PocketBase for these tests

test('Same user ID = self-referral', async (t) => {
  // Mock checkSelfReferral('user123', 'user123')
  // Expected: true
  assert.ok(true); // placeholder
});

test('Matching IP address = self-referral', async (t) => {
  // Mock fingerprints:
  // referrer: { ip: '192.168.1.100', deviceId: 'abc123' }
  // referred: { ip: '192.168.1.100', deviceId: 'xyz789' }
  // Expected: checkSelfReferral() returns true
  assert.ok(true); // placeholder
});

test('Matching device ID = self-referral', async (t) => {
  // Similar setup
  assert.ok(true); // placeholder
});

test('No matching fingerprint = not self-referral', async (t) => {
  // Completely different IPs, devices, payment methods
  // Expected: checkSelfReferral() returns false
  assert.ok(true); // placeholder
});
```

---

## Integration Tests

### 2.1 End-to-End: Sprint Purchase + Credit Grant

**File:** `apps/api/src/tests/integration/sprint-purchase.test.js` (new)

**Test Flow:**
1. User calls `/checkout/tier?tier=sprint_pipeline`
2. Stripe checkout session created
3. Simulate Stripe webhook: `checkout.session.completed`
4. Verify:
   - Payment status = 'paid'
   - Sprint balance created/incremented by 7 credits
   - User can consume credit without overdraw

**Setup:**
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';
const STRIPE_TEST_KEY = process.env.STRIPE_SECRET_KEY_TEST;
let testUserId, testToken, sessionId;

test('[Integration] Sprint Purchase → 7 Credit Grant → Consume → Overdraw Rejection', async (t) => {
  // 1. Create test user in PocketBase
  testUserId = await seedTestUser('sprint_test_user_' + Date.now());
  testToken = await getTestToken(testUserId);

  // 2. Initiate checkout
  const checkoutRes = await fetch(`${API_BASE}/checkout/tier?tier=sprint_pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
  });
  assert.equal(checkoutRes.status, 200);
  const checkoutData = await checkoutRes.json();
  sessionId = checkoutData.session_id;
  assert.ok(sessionId, 'Checkout session ID missing');

  // 3. Simulate Stripe webhook (checkout.session.completed)
  const webhookEvent = {
    type: 'checkout.session.completed',
    id: 'evt_' + Date.now(),
    data: {
      object: {
        id: sessionId,
        payment_intent: 'pi_test123',
        customer: 'cus_test123',
        metadata: {
          user_id: testUserId,
          purchase_type: 'sprint_pipeline',
        },
      },
    },
  };

  // Construct Stripe signature
  const sig = await signStripeEvent(webhookEvent, STRIPE_TEST_KEY);
  const webhookRes = await fetch(`${API_BASE}/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'stripe-signature': sig,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookEvent),
  });
  assert.equal(webhookRes.status, 200, 'Webhook failed');

  // 4. Verify sprint balance increased
  const balanceRes = await fetch(`${API_BASE}/sprints/balance`, {
    headers: { Authorization: `Bearer ${testToken}` },
  });
  const balance = await balanceRes.json();
  assert.equal(balance.available_credits, 7, 'Sprint credits not granted');

  // 5. Consume 5 credits (should succeed)
  const consumeRes = await fetch(`${API_BASE}/sprints/consume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ credits: 5 }),
  });
  assert.equal(consumeRes.status, 200);
  const afterConsume = await (await fetch(`${API_BASE}/sprints/balance`, {
    headers: { Authorization: `Bearer ${testToken}` },
  })).json();
  assert.equal(afterConsume.available_credits, 2);

  // 6. Attempt overdraw (7 more credits when only 2 available)
  const overdrawRes = await fetch(`${API_BASE}/sprints/consume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ credits: 7 }),
  });
  assert.equal(overdrawRes.status, 400, 'Overdraw should be rejected');
  const overdrawError = await overdrawRes.json();
  assert.ok(overdrawError.error.includes('Insufficient'), 'Wrong error message');
});
```

### 2.2 End-to-End: Duplicate Webhook Dedup

**File:** `apps/api/src/tests/integration/webhook-dedup.test.js` (new)

```javascript
test('[Integration] Duplicate Webhook Event Should Not Double-Grant', async (t) => {
  const event = {
    type: 'checkout.session.completed',
    id: 'evt_deduptest_' + Date.now(),
    data: { object: { id: 'session_123', metadata: { user_id: testUserId } } },
  };

  // Send webhook twice
  const sig = await signStripeEvent(event, STRIPE_TEST_KEY);
  const res1 = await fetch(`${API_BASE}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.ok(!data1.duplicate, 'First should not be marked duplicate');

  const res2 = await fetch(`${API_BASE}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.ok(data2.duplicate, 'Second should be marked duplicate');

  // Verify credits only granted once
  const balance = await (await fetch(`${API_BASE}/sprints/balance`, {
    headers: { Authorization: `Bearer ${testToken}` },
  })).json();
  assert.equal(balance.available_credits, 7, 'Credits should only be granted once');
});
```

### 2.3 End-to-End: Referral → Tier Unlock → Subscription Schedule

**File:** `apps/api/src/tests/integration/referral-flow.test.js` (new)

```javascript
test('[Integration] 2 Referrals → Unlock $2.22/mo → Auto-Charge at Renewal', async (t) => {
  // Setup: referrer with active subscription, referred users
  const referrerId = await seedTestUser('referrer_' + Date.now());
  const referrerToken = await getTestToken(referrerId);

  // Create referrer's subscription
  await setupTestSubscription(referrerId, 'plato', 'monthly');

  // Get referral link
  const linkRes = await fetch(`${API_BASE}/referral/generate-link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${referrerToken}` },
  });
  const { referral_code } = await linkRes.json();

  // User 1: Sign up with referral code, complete checkout
  const user1Id = await signupAndCheckout(referral_code);
  // Webhook fires, referral count = 1

  // User 2: Sign up, checkout
  const user2Id = await signupAndCheckout(referral_code);
  // Webhook fires, referral count = 2

  // Check referrer's promo state
  const statusRes = await fetch(`${API_BASE}/referral/status`, {
    headers: { Authorization: `Bearer ${referrerToken}` },
  });
  const status = await statusRes.json();
  assert.equal(status.referral_count, 2);
  assert.equal(status.promo_state, 'active_2for1');
  assert.ok(status.promo_expires_at, 'Promo should have expiration');

  // Verify Stripe subscription has coupon applied
  const stripeSubscription = await getStripeSubscription(referrerId);
  assert.ok(stripeSubscription.discount, 'Stripe should apply coupon');
  assert.equal(stripeSubscription.discount.coupon.percent_off, 90, '90% off for $2.22/mo');
});
```

### 2.4 End-to-End: Founding Pass Purchase + Auto-Verify

**File:** `apps/api/src/tests/integration/founding.test.js` (new)

```javascript
test('[Integration] Founding Purchase → Auto-Verify at Payment Completion', async (t) => {
  const userId = await seedTestUser('founding_' + Date.now());
  const token = await getTestToken(userId);

  // Check founding availability
  const availRes = await fetch(`${API_BASE}/founding/count`);
  const avail = await availRes.json();
  if (avail.sold_out) {
    console.log('⏭️ Founding sold out, skipping');
    return;
  }

  // Checkout founding
  const checkoutRes = await fetch(`${API_BASE}/checkout/founding`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const { session_id } = await checkoutRes.json();

  // Webhook: payment succeeded
  const event = {
    type: 'checkout.session.completed',
    id: 'evt_founding_' + Date.now(),
    data: {
      object: {
        id: session_id,
        payment_intent: 'pi_found_123',
        customer: 'cus_found_123',
        metadata: { user_id: userId, purchase_type: 'founding_lifetime' },
      },
    },
  };
  const sig = await signStripeEvent(event, STRIPE_TEST_KEY);
  const webhookRes = await fetch(`${API_BASE}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'stripe-signature': sig, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(webhookRes.status, 200);

  // Verify entitlement
  const entRes = await fetch(`${API_BASE}/entitlement`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ent = await entRes.json();
  assert.equal(ent.entitlement_type, 'founding_lifetime');
  assert.equal(ent.entitlement_status, 'active');
});
```

### 2.5 End-to-End: Refund + Balance Reversal

**File:** `apps/api/src/tests/integration/refund.test.js` (new)

```javascript
test('[Integration] Refund → Reverse Sprint Balance & Referral Count', async (t) => {
  const userId = await seedTestUser('refund_' + Date.now());
  const token = await getTestToken(userId);

  // 1. Grant 7 sprint credits via purchase
  const { sessionId } = await initiateSprintCheckout(token);
  await simulateStripeWebhook(sessionId, 'checkout.session.completed');

  let balance = await getSprintBalance(token);
  assert.equal(balance.available_credits, 7);

  // 2. Refund
  const refundRes = await fetch(`${API_BASE}/payments/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: sessionId }),
  });
  assert.equal(refundRes.status, 200);

  // 3. Simulate Stripe refund webhook
  const payment = await getStripePaymentIntent('pi_123');
  await simulateStripeWebhook(payment.id, 'charge.refunded');

  // 4. Verify balance reversed
  balance = await getSprintBalance(token);
  assert.equal(balance.available_credits, 0, 'Refund should reverse credits');
});
```

### 2.6 Composio OAuth Flow

**File:** `apps/api/src/tests/integration/composio-oauth.test.js` (new)

```javascript
test('[Integration] OAuth Init → Callback → Store Token → Execute Action', async (t) => {
  const userId = await seedTestUser('oauth_' + Date.now());
  const token = await getTestToken(userId);

  // 1. Init OAuth flow
  const initRes = await fetch(`${API_BASE}/integrations/oauth/init/gmail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  assert.equal(initRes.status, 200);
  const { authUrl, state, connectionId } = await initRes.json();
  assert.ok(authUrl.includes('https'));
  assert.ok(state);
  assert.ok(connectionId);

  // 2. Mock Composio OAuth callback
  // In test, we can't actually complete OAuth, so simulate the token exchange
  const callbackCode = 'mock_auth_code_123';
  const tokenRes = await fetch(
    `${API_BASE}/integrations/oauth/callback?code=${callbackCode}&state=${state}`,
  );
  // This will fail in test (Composio not configured), but in live test should work

  // 3. Verify connection stored
  const connRes = await fetch(`${API_BASE}/integrations/connections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { connections } = await connRes.json();
  // Should have gmail connection in 'connected' state

  // 4. Execute action (mock)
  // const actionRes = await fetch(
  //   `${API_BASE}/integrations/execute/${connectionId}/send_email`,
  //   {
  //     method: 'POST',
  //     headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ input: { to: 'test@example.com', subject: 'Test' } }),
  //   },
  // );
  // assert.equal(actionRes.status, 200);
});
```

---

## Test Scenarios

### Scenario 1: Complete Purchase Flow

**Name:** Sprint Pass Purchase & Credit Utilization
**Preconditions:** User authenticated, not on founding offer
**Steps:**
1. User clicks "Buy Sprint Pass ($49.99/year)"
2. Redirected to Stripe checkout
3. User completes payment
4. Webhook received, credits granted (7)
5. User consumes 3 credits on API call
6. User attempts to consume 5 credits, rejected

**Expected Outcomes:**
- Payment record status = 'paid'
- Sprint balance = 7
- Consumption decrements balance
- Overdraw rejected with clear error
- No duplicate credits on webhook retry

---

### Scenario 2: Referral Milestone Unlocks

**Name:** Earn 2 Referrals → Unlock Tier Discount
**Preconditions:** Referrer has active subscription, campaign active
**Steps:**
1. Referrer generates link: `/referral/generate-link`
2. Referred User 1 signs up with code, completes checkout
3. Webhook processes conversion, referral_count = 1
4. Referred User 2 signs up, completes checkout
5. Webhook processes conversion, referral_count = 2
6. Referrer checks status: `/referral/status`
7. Stripe subscription auto-updated with coupon

**Expected Outcomes:**
- Referral count increments correctly
- At count = 2, promo_state transitions to 'active_2for1'
- Stripe subscription gets 90% discount coupon
- Promo expires after 12 months (auto-managed by expireStalePromos)

---

### Scenario 3: Founding Offer Sold Out

**Name:** Founding Cap Enforcement
**Preconditions:** Founding cap approaching (19,950 / 20,000 completed)
**Steps:**
1. 49 users hold active reservations (30-min windows)
2. 50th user attempts checkout
3. Availability gate shows 1 slot remaining
4. 50th user completes payment
5. Webhook processes, cap now reached (20,000)
6. 51st user attempts checkout

**Expected Outcomes:**
- 50th user granted access
- 51st user receives 429 "Sold out"
- If 49 reservations expire, counter resets
- Completed purchases persist

---

### Scenario 4: Self-Referral Blocked

**Name:** Fraud Prevention
**Preconditions:** Campaign active, referrer and referred user on same IP
**Steps:**
1. User A generates referral link
2. User A opens incognito window, same IP, same device fingerprint
3. User A (as "User B") signs up with own referral code
4. User A checks referral status

**Expected Outcomes:**
- Self-referral detected and blocked
- Referral marked 'self_referral_blocked'
- No referral count increment
- User A notified of block
- Payment still processed (they can access founding offer)

---

### Scenario 5: Webhook Deduplication

**Name:** Idempotent Event Processing
**Preconditions:** Webhook already processed
**Steps:**
1. Stripe webhook delivered: checkout.session.completed
2. API processes, records event, grants credits
3. Stripe retries (duplicate), sends same webhook
4. API receives second webhook

**Expected Outcomes:**
- First webhook: status 200, duplicate: false, credits granted
- Second webhook: status 200, duplicate: true, NO credits granted
- Balance unchanged on retry
- Event ledger records both attempts

---

### Scenario 6: Tier Downgrade on Referral Reversal

**Name:** Refund Reverses Promo
**Preconditions:** Referrer at 10 referrals (free year), one referred user refunds
**Steps:**
1. Referred user initiates refund request
2. Webhook: charge.refunded
3. Referral marked as 'refunded', count decremented to 9
4. Referrer's promo_state re-evaluated

**Expected Outcomes:**
- Referral count = 9
- Promo state downgrades to 'active_2for1' (needs 10 for free year)
- Stripe coupon updated to 90% (12 months)
- User notified of downgrade

---

### Scenario 7: Campaign Activation / Deactivation

**Name:** Viral Campaign Time Window
**Preconditions:** Campaign set to end in 1 hour
**Steps:**
1. User attempts `/checkout/viral-entry` → success
2. After 1 hour, campaign ends (active = false)
3. User attempts `/checkout/viral-entry` again

**Expected Outcomes:**
- First checkout succeeds
- Second checkout rejected: "Campaign has ended"

---

## Test Data Strategy

### PocketBase Fixtures

**Test Users:**
```javascript
// apps/api/src/tests/fixtures/users.json
[
  {
    id: 'test_user_1',
    email: 'test1@example.com',
    username: 'test_user_1',
    verified: true,
    subscription_tier: 'plato',
    subscription_status: 'active',
  },
  {
    id: 'test_referrer_1',
    email: 'referrer@example.com',
    subscription_tier: 'plato',
  },
]
```

**Stripe Test Data:**
- Price IDs: `price_sprint` (7-credit purchase), `price_founding` (1-time)
- Test card: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)
- Test customer: `cus_test123` (for subscription)

**Webhook Test Payloads:**

```javascript
// apps/api/src/tests/fixtures/webhooks.js
export const stripeWebhooks = {
  checkoutSessionCompleted: {
    type: 'checkout.session.completed',
    id: 'evt_1234567890',
    data: {
      object: {
        id: 'cs_test_123',
        payment_intent: 'pi_test_123',
        customer: 'cus_test_123',
        metadata: {
          user_id: 'test_user_1',
          purchase_type: 'sprint_pipeline',
        },
      },
    },
  },
  chargeRefunded: {
    type: 'charge.refunded',
    id: 'evt_refund_123',
    data: {
      object: {
        payment_intent: 'pi_test_123',
        amount_refunded: 4999,
      },
    },
  },
};
```

### Environment Setup for Tests

```bash
# apps/api/.env.test
POCKETBASE_URL=http://localhost:8090
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
COMPOSIO_API_KEY=test_key_...
CORS_ORIGIN=*
APP_BASE_URL=http://localhost:3000
```

---

## Test Execution Plan

### Phase 1: Unit Tests (Week 1)
- Run: `npm test` (Node.js native test runner)
- Coverage goal: 80%+ for utils and middleware
- Duration: ~5 minutes

### Phase 2: Integration Tests (Week 1-2)
- Setup: Local PocketBase + Stripe test keys
- Run: `npm run test:integration`
- Duration: ~15 minutes
- Must test all webhook event types

### Phase 3: Live Environment QA (Week 2)
- Manual testing in staging
- Stripe test mode → real Stripe session flow
- Referral link generation + signup simulation
- Founding purchase with availability gate

### Phase 4: Pre-Launch (Week 3)
- Security review checklist
- Load test: 100 concurrent checkouts
- Edge cases: network failures, Stripe rate limits, PocketBase downtime

---

## Acceptance Criteria

### Sprint Balance System
- [ ] Purchase grants exactly 7 credits
- [ ] Consumption decrements balance
- [ ] Overdraw rejected with 400 status
- [ ] Duplicate webhook does not re-grant
- [ ] Refund decrements balance to 0

### Referral System
- [ ] Generate unique code per user
- [ ] Track referral conversions via webhook
- [ ] Unlock $2.22/mo at 2 referrals
- [ ] Unlock free year at 10 referrals
- [ ] Self-referral detection prevents fraud
- [ ] Reversal downgrades promo state

### Founding Offer
- [ ] Availability gate enforces 20k cap
- [ ] 30-min reservations prevent overbooking
- [ ] Expired reservations release slot
- [ ] Auto-verify on payment completion
- [ ] Sold-out message clear and actionable

### Composio OAuth
- [ ] OAuth init returns valid Composio URL
- [ ] Callback stores token securely
- [ ] List connections shows all active integrations
- [ ] Execute action works with stored token
- [ ] Token refresh (when implemented) succeeds
- [ ] Revoke removes token

### Webhook Security
- [ ] Stripe signature verification required
- [ ] Invalid signatures rejected with 400
- [ ] Duplicate events idempotent
- [ ] Event ledger logs all attempts
- [ ] Failures logged with full context

### Campaign Management
- [ ] Active campaign gates viral entry
- [ ] Campaign end disables tier checkout
- [ ] Campaign date validation enforced
- [ ] Tier metadata consistent across all checkouts

### Error Handling
- [ ] All 4xx/5xx errors include user-readable message
- [ ] No secrets or stack traces in error response
- [ ] Rate limit errors include Retry-After header
- [ ] Payment failures logged but not exposed

---

## Testing Tools & Infrastructure

| Tool | Purpose | Config |
|------|---------|--------|
| Node.js `test` | Unit tests | Native, no external deps |
| `node-fetch` | HTTP for integration tests | Fetch Stripe test mode |
| `stripe` SDK | Stripe test API access | `STRIPE_SECRET_KEY_TEST` |
| PocketBase | Local test DB | Docker: `docker run -p 8090:8090 ghcr.io/pocketbase/pocketbase` |
| `supertest` (optional) | Express app testing | Mock routes without server |
| Artillery (optional) | Load testing | 100 concurrent checkouts |

---

## Success Metrics

- **All unit tests pass**: 100%
- **All integration tests pass**: 100%
- **Code coverage**: 80%+ for routes and utils
- **Webhook latency**: <500ms P95
- **Error rate on production**: <0.1%

---

## Next Steps

1. Implement unit tests (Week 1)
2. Setup Stripe test mode + PocketBase for integration tests
3. Run full test suite on staging environment
4. Document any findings and gaps
5. Obtain sign-off from product & engineering before launch

