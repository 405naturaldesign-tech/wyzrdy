# Online Store — subscriptions (recurring billing / memberships)

Read this AFTER `../SKILL.md` when `<files_injected>` contains subscription
paths (`SubscribeButton`, `PlansList`, `SubscriptionAuthContext`, …) or the
task is recurring billing / memberships / plans / tiers / gated content.
Activation is already done — do not call enable tools from this doc.

Subscriptions is a **module on top of the base store**, so every hub rule still
applies (canonical injected files, restructure-don't-recolor, no parallel
flows). This doc covers only the subscription-specific contract.

## Dependencies (already provisioned by the enable tool)

- **Base store** — plans are products; checkout reuses base `EcommerceApi`.
- **Express API** (`apps/api`) — the subscription sub-router and tier helpers.
- **PocketBase** — visitor auth; `SubscriptionAuthContext` is PocketBase-backed.

Do not re-provision or rebuild any of these.

## Injected files — canonical, do not scaffold

Web (`apps/web/src/`):
- `contexts/SubscriptionAuthContext.jsx` — `SubscriptionAuthProvider` + `useSubscriptionAuth()`
- `components/SubscribeButton.jsx`, `components/ManageSubscriptionButton.jsx`
- `components/PlansList.jsx` (subscribe/manage swap + plan-locking live here)
- `components/SubscriptionAccountSection.jsx`
- `pages/PlansPage.jsx`, `pages/SubscriptionsPage.jsx`
- `hooks/useEcommerceSubscriptionsPlans.js`, `hooks/useUserTier.js`, `hooks/useSubscriptionPolling.js`
- `api/InternalEcommerceSubscriptionsApi.js`, `lib/ecommerceSubscriptionsUtils.js`
- `config/subscriptionRoutes.js`

API (`apps/api/src/`):
- `routes/ecommerce/subscriptions.js`, `api/ecommerce-subscriptions.js`, `utils/ecommerce-subscriptions.js`

Import these; never recreate the API client, auth context, polling loop, or a
hardcoded plans array — that builds a parallel, broken flow.

## Routing contract — paths are LOCKED

From `config/subscriptionRoutes.js` (`MANAGE_PATH=/subscriptions`,
`PLANS_PATH=/plans`, `LOGIN_PATH=/login`). Import these constants; never
hardcode or rename — `SubscribeButton`'s `successUrl`/`cancelUrl` build
`origin + MANAGE_PATH + '?just_subscribed=1'`, so renaming strands just-paid
users on a 404.

- `/plans` → `<PlansPage />` — **public** route.
- `/subscriptions` → `<SubscriptionsPage />` — **protected** (wrap in the app's `ProtectedRoute`).
- Nav: add a public **"Plans"/"Pricing"** link to `/plans` and an authenticated
  link to `/subscriptions`.

## Provider wiring (App.jsx)

Mount `SubscriptionAuthProvider` around the routes, **inside** the agent's
`<AuthProvider>` if one exists:

```jsx
<AuthProvider>
  <SubscriptionAuthProvider>
    <Routes>…</Routes>
  </SubscriptionAuthProvider>
</AuthProvider>
```

`useSubscriptionAuth()` exposes `{ currentUser, isAuthenticated, subscriptions,
refreshSubscriptions, polling, pollingExhausted }`. Non-PocketBase auth
(Supabase/OAuth/OTP): you MAY edit `SubscriptionAuthContext.jsx` to swap the
auth source, but PRESERVE that returned contract.

## Runtime flow — preserve these

- **Plans:** `useEcommerceSubscriptionsPlans()` → `getProducts({ type: 'subscription' })`. Never hardcode tiers.
- **Subscribe:** `SubscribeButton` calls `initializeCheckout` with
  `items: [{ variant_id, quantity: 1 }]` and `customer: { external_id, email }`,
  sets `sessionStorage 'subscriptionPending'`, then redirects. Keep that payload.
- **Post-checkout polling** lives inside `SubscriptionAuthProvider` (every 2s,
  ~30s) — just mount the provider + `SubscriptionAccountSection`; do not
  reimplement.
- **Manage:** `ManageSubscriptionButton` → `getManageSubscriptionUrl({ subscriptionId, returnUrl })`
  → `window.location = url`. Test-mode subscriptions surface error `code:
  'STRIPE_NOT_CONFIGURED'` — the button already renders that message; don't treat it as a crash.

## Tier-gating

A subscription object: `{ id, product_id, product_title, variant_title,
billing_interval, status, current_period_start, current_period_end,
}`. "Has tier" = a subscription with `status` `active` or `trialing`.

**Web** — `useUserTier()` → `{ userTierNames, hasTier(title), hasAnyTier(titles) }`
(matches by `product_title`; anonymous/Free users always match `'Free'`):
```jsx
const { hasTier } = useUserTier();
if (!hasTier('Creator')) return <Navigate to={PLANS_PATH} replace />;
```
Do NOT bake tier state into `AuthContext.jsx` — it owns auth only, and importing
`useSubscriptionAuth` there inverts provider order.

**Server** — gate routes with the **title-based** helpers from
`utils/ecommerce-subscriptions.js`:
```js
await requireTierByTitle(userId, 'Creator'); // throws "Forbidden: …" → map to 403
```
Use title-based (`requireTierByTitle`/`hasTierByTitle`), NOT `requireTier`/`hasTier`
(those match `product_id`, which is generated at runtime and unknown at
code-gen time, so it always 403s). Titles must match EXACTLY (`'Creator'`, not
`'Creator Plan'`) — mismatches fail silently.

## Express sub-router (MANDATORY wiring)

The platform ships the sub-router and helpers — your job is **wiring only**,
usually exactly two files: `apps/api/src/middleware/auth.js` (create if
missing) and `apps/api/src/routes/index.js` (edit to add the mount). Without
this step, `InternalEcommerceSubscriptionsApi.getUserSubscriptions()` hits
`/hcgi/api/ecommerce/subscriptions` and returns **404**.

**Read-only — never modify or recreate:**
- `routes/ecommerce/subscriptions.js` — serves `/ecommerce/subscriptions` and `/ecommerce/subscriptions/manage`
- `api/ecommerce-subscriptions.js` — `getUserSubscriptions`, `createManageUserSubscriptionUrl`
- `utils/ecommerce-subscriptions.js` — tier helpers (`requireTierByTitle`, `hasTierByTitle`, …)

### `apps/api/src/middleware/auth.js`

Create when missing (if the file already exists, leave it alone):

```js
export default async function authMiddleware(req, res, next) {
  const reject = () => res.status(401).json({ error: 'Unauthorized' });
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return reject();
  const token = header.slice('Bearer '.length).trim();
  try {
    const response = await fetch('http://localhost:8090/api/collections/users/auth-refresh', {
      method: 'POST',
      headers: { Authorization: token },
    });
    if (!response.ok) return reject();
    const data = await response.json();
    if (!data?.record?.id) return reject();
    req.user = { id: data.record.id };
  } catch { return reject(); }
  return next();
}
```

### `apps/api/src/routes/index.js`

Defensive read-then-add — **never** blind rewrite:

1. Read the current file first.
2. Preserve every existing mount (`/health`, any other `router.use(...)`, and the function-wrapper export pattern).
3. Add the subscriptions mount only if missing — both imports and the `router.use` line:

```js
import { Router } from 'express';
import healthCheck from './health-check.js';
import subscriptionsRouter from './ecommerce/subscriptions.js'; // ADD if missing
import authMiddleware from '../middleware/auth.js';             // ADD if missing

export default () => {
  const router = Router();
  router.get('/health', healthCheck);                                          // PRESERVE
  router.use('/ecommerce/subscriptions', authMiddleware, subscriptionsRouter); // ADD if missing
  return router;
};
```

Mount the sub-router **directly** at `/ecommerce/subscriptions` — there is no
`routes/ecommerce.js` aggregator; do not create one. Do not add mounts in
`main.js`.

**Forbidden:** recreating subscription route handlers, importing Stripe in
Express, or rewriting `routes/index.js` from scratch (drops `/health` and other
module mounts).

## Restyle / restructure

Same as the hub: restructure layout to fit the site and align tokens
(`index.css`, Tailwind theme, shadcn/ui). Restyle `PlansPage`/`SubscriptionsPage`
hero and surrounding sections freely, but PRESERVE the `<PlansList />` and
`<SubscriptionAccountSection />` mounts, the locked routes, exports, the
`subscriptionPending` sessionStorage key, and all `EcommerceApi` /
`InternalEcommerceSubscriptionsApi` usage.
