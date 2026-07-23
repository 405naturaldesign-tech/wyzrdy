/// <reference path="../pb_data/types.d.ts" />

// VIRAL PIPELINE — cascading multi-tier referral loop.
// Collections: pricing_tiers, referral_state, viral_referrals,
// device_fingerprints, campaigns. (webhook_events already exists and is reused
// for idempotency.) NOTE: the task requested a `referrals` collection, but one
// with an incompatible shape already exists — this uses `viral_referrals`.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // ---- pricing_tiers (server-managed catalog; public read) ----
    if (!safeFind(app, "pricing_tiers")) {
      const pricing = new Collection({
        type: "base",
        name: "pricing_tiers",
        listRule: "",
        viewRule: "",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "tier_name", type: "text", required: true, max: 60 },
          { name: "amount_cents", type: "number", onlyInt: true, min: 0 },
          {
            name: "billing_cycle",
            type: "select",
            maxSelect: 1,
            values: ["monthly", "per_7_sprints"],
          },
          { name: "stripe_price_id", type: "text", max: 200 },
          { name: "active", type: "bool" },
          { name: "created_at", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_pricing_tier_name ON pricing_tiers (tier_name)",
          "CREATE UNIQUE INDEX idx_pricing_price_id ON pricing_tiers (stripe_price_id) WHERE stripe_price_id != ''",
        ],
      });
      app.save(pricing);
      seedPricing(app);
    }

    // ---- referral_state (server-only writes; owner read) ----
    if (!safeFind(app, "referral_state")) {
      const state = new Collection({
        type: "base",
        name: "referral_state",
        listRule: "@request.auth.id != '' && @request.auth.id = user_id",
        viewRule: "@request.auth.id != '' && @request.auth.id = user_id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "user_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          { name: "referral_count", type: "number", onlyInt: true, min: 0 },
          {
            name: "promo_state",
            type: "select",
            maxSelect: 1,
            values: [
              "inactive",
              "active_2for1",
              "expired_2for1",
              "free_year_1",
              "free_year_2",
              "free_year_5",
            ],
          },
          { name: "promo_start_date", type: "date" },
          { name: "promo_end_date", type: "date" },
          { name: "free_months_accrued", type: "number", onlyInt: true, min: 0 },
          { name: "max_free_months", type: "number", onlyInt: true, min: 0 },
          { name: "last_webhook_processed", type: "text", max: 200 },
          { name: "created_at", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated_at", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_refstate_user ON referral_state (user_id)",
          "CREATE INDEX idx_refstate_promo ON referral_state (promo_state)",
        ],
      });
      app.save(state);
    }

    // ---- viral_referrals (server-only writes; owner read) ----
    if (!safeFind(app, "viral_referrals")) {
      const referrals = new Collection({
        type: "base",
        name: "viral_referrals",
        listRule: "@request.auth.id != '' && @request.auth.id = referrer_id",
        viewRule: "@request.auth.id != '' && @request.auth.id = referrer_id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "referrer_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          {
            name: "referred_user_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "referred_email", type: "text", max: 200 },
          { name: "referral_code", type: "text", required: true, max: 80 },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: [
              "pending",
              "signup_complete",
              "payment_verified",
              "self_referral_blocked",
              "refunded",
              "disputed",
            ],
          },
          { name: "payment_intent_id", type: "text", max: 200 },
          { name: "stripe_event_id", type: "text", max: 200 },
          { name: "created_at", type: "autodate", onCreate: true, onUpdate: false },
          { name: "verified_at", type: "date" },
          { name: "refunded_at", type: "date" },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_vref_code ON viral_referrals (referral_code)",
          "CREATE UNIQUE INDEX idx_vref_pi ON viral_referrals (payment_intent_id) WHERE payment_intent_id != ''",
          "CREATE UNIQUE INDEX idx_vref_event ON viral_referrals (stripe_event_id) WHERE stripe_event_id != ''",
          "CREATE INDEX idx_vref_referrer ON viral_referrals (referrer_id)",
        ],
      });
      app.save(referrals);
    }

    // ---- device_fingerprints (server-only) ----
    if (!safeFind(app, "device_fingerprints")) {
      const fp = new Collection({
        type: "base",
        name: "device_fingerprints",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "user_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          { name: "ip_address", type: "text", max: 100 },
          { name: "device_id", type: "text", max: 200 },
          { name: "payment_method_fingerprint", type: "text", max: 200 },
          { name: "created_at", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE INDEX idx_devfp_user ON device_fingerprints (user_id)",
          "CREATE INDEX idx_devfp_ip ON device_fingerprints (ip_address)",
          "CREATE INDEX idx_devfp_device ON device_fingerprints (device_id)",
          "CREATE INDEX idx_devfp_pm ON device_fingerprints (payment_method_fingerprint)",
        ],
      });
      app.save(fp);
    }

    // ---- campaigns (public read; server-only write) ----
    if (!safeFind(app, "campaigns")) {
      const campaigns = new Collection({
        type: "base",
        name: "campaigns",
        listRule: "",
        viewRule: "",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "campaign_name", type: "text", required: true, max: 80 },
          { name: "start_date", type: "date" },
          { name: "end_date", type: "date" },
          { name: "active", type: "bool" },
          { name: "viral_entry_tier_enabled", type: "bool" },
          { name: "promo_reward_tier_enabled", type: "bool" },
          { name: "created_at", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_campaign_name ON campaigns (campaign_name)",
        ],
      });
      app.save(campaigns);
      seedCampaign(app);
    }
  },
  (app) => {
    for (const name of [
      "pricing_tiers",
      "referral_state",
      "viral_referrals",
      "device_fingerprints",
      "campaigns",
    ]) {
      const col = safeFind(app, name);
      if (col) app.delete(col);
    }
  },
);

function safeFind(app, name) {
  try {
    return app.findCollectionByNameOrId(name);
  } catch (_) {
    return null;
  }
}

function seedPricing(app) {
  const col = app.findCollectionByNameOrId("pricing_tiers");
  const rows = [
    { tier_name: "plato", amount_cents: 2222, billing_cycle: "monthly" },
    { tier_name: "enterprise", amount_cents: 33333, billing_cycle: "monthly" },
    { tier_name: "sprint_pipeline", amount_cents: 222, billing_cycle: "per_7_sprints" },
    { tier_name: "viral_entry", amount_cents: 777, billing_cycle: "monthly" },
    { tier_name: "promo_reward", amount_cents: 222, billing_cycle: "monthly" },
  ];
  for (const r of rows) {
    const rec = new Record(col);
    rec.set("tier_name", r.tier_name);
    rec.set("amount_cents", r.amount_cents);
    rec.set("billing_cycle", r.billing_cycle);
    rec.set("stripe_price_id", "");
    rec.set("active", true);
    app.save(rec);
  }
}

function seedCampaign(app) {
  const col = app.findCollectionByNameOrId("campaigns");
  const rec = new Record(col);
  const now = new Date();
  const end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  rec.set("campaign_name", "viral_pipeline_2026");
  rec.set("start_date", now.toISOString().replace("T", " "));
  rec.set("end_date", end.toISOString().replace("T", " "));
  rec.set("active", true);
  rec.set("viral_entry_tier_enabled", true);
  rec.set("promo_reward_tier_enabled", true);
  app.save(rec);
}
