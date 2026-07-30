---
name: hostinger-ecommerce
description: >
  Adapt injected Online Store UI after the platform enables the store.
  Layout regeneration, restyling, and cart/checkout usage — not activation
  (that is enable_ecommerce_integration in horizons-ai). For recurring
  billing / memberships / plans / tiers, also read references/SUBSCRIPTIONS.md.
---

# Online Store — adapt injected UI

Use when `<files_injected>` store paths exist or the codebase map lists
`EcommerceApi` / store components. Activation is already done — do not call
enable tools from this doc.

**Subscriptions / memberships:** for recurring billing, plans, tiers, or gated
content (injected `SubscribeButton` / `PlansList` / `SubscriptionAuthContext`,
enabled via `enable_subscriptions_infrastructure` in horizons-ai), also read
[`references/SUBSCRIPTIONS.md`](references/SUBSCRIPTIONS.md) — the base rules
below still apply to the injected subscription UI.

## Do not scaffold

- Injected files are canonical. Import `@/api/EcommerceApi`; do not recreate
  the client, duplicate exports, or call store endpoints directly.

## Layout regeneration

Injected store UI is often template-generic. **Restructure** it, not only
recolor:

- **Change:** JSX layout, section order, grids, cards, imagery, spacing —
  match the site's strongest page and `design/SKILL.md` when present.
- **Keep:** `EcommerceApi` usage, cart/checkout flow, exported names,
  hooks/context, `localStorage` key `e-commerce-cart`.
- Prefer `write_file` / large `edit_file` on injected UI paths when layout
  feels stock; token-only class swaps are insufficient.

## Restyling

After layout fits the site, align tokens: CSS variables in `index.css`,
Tailwind theme, shadcn/ui patterns, typography, radii, buttons.

## Wiring

- Add routes, pages, and nav that compose the adapted components.
- Do not build a parallel cart or checkout implementation.

## UI rules

- **List:** `getProducts()` → `getProductQuantities({ fields: "inventory_quantity", product_ids })` → merge by variant id.
- **Detail:** `getProduct(id)` → refresh quantities → select variant before add-to-cart.
- **Multi-variant:** detail page before cart add.
- **Cart:** `{ product, variant, quantity }`; key `e-commerce-cart`.
- **Checkout:** `initializeCheckout` with `variant_id`. Optional `customer: { external_id, email }` for PocketBase.
- **Stock:** limit qty only when `manage_inventory === true` and qty > `inventory_quantity`.
- **HTML:** controlled render for `description` and `additional_info[].description`.

## API shapes

Trust injected `EcommerceApi.js` over this list: `getProducts`, `getProduct`,
`getProductQuantities`, `getCategories`, `initializeCheckout`, `formatCurrency`;
products expose `variants[]` with `manage_inventory`, `inventory_quantity`,
`price_in_cents`, `currency`.
