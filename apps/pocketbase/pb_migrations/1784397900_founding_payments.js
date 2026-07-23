/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // ---- founding_purchases ----
    let purchases;
    try {
      purchases = app.findCollectionByNameOrId("founding_purchases");
    } catch (_) {
      purchases = new Collection({
        type: "base",
        name: "founding_purchases",
        // Owner can read their own purchase. Writes are server-side (superuser) only.
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
          { name: "stripe_customer_id", type: "text", max: 200 },
          { name: "stripe_checkout_session_id", type: "text", max: 200 },
          { name: "stripe_payment_intent_id", type: "text", max: 200 },
          { name: "stripe_subscription_id", type: "text", max: 200 },
          { name: "stripe_price_id", type: "text", max: 200 },
          {
            name: "purchase_type",
            type: "select",
            maxSelect: 1,
            values: ["founding_lifetime", "monthly", "annual"],
          },
          { name: "amount_cents", type: "number", onlyInt: true },
          { name: "currency", type: "text", max: 10 },
          {
            name: "payment_status",
            type: "select",
            maxSelect: 1,
            values: ["pending", "succeeded", "failed", "canceled"],
          },
          {
            name: "entitlement_status",
            type: "select",
            maxSelect: 1,
            values: ["pending", "active", "suspended", "revoked"],
          },
          { name: "completed_at", type: "date" },
          { name: "refunded_at", type: "date" },
          { name: "subscription_period_end", type: "date" },
          { name: "notes", type: "text", max: 2000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_fp_session ON founding_purchases (stripe_checkout_session_id) WHERE stripe_checkout_session_id != ''",
          "CREATE UNIQUE INDEX idx_fp_pi ON founding_purchases (stripe_payment_intent_id) WHERE stripe_payment_intent_id != ''",
          "CREATE UNIQUE INDEX idx_fp_founding_user ON founding_purchases (user_id) WHERE purchase_type = 'founding_lifetime'",
          "CREATE INDEX idx_fp_user ON founding_purchases (user_id)",
          "CREATE INDEX idx_fp_type_status ON founding_purchases (purchase_type, payment_status)",
        ],
      });
      app.save(purchases);
    }

    // ---- webhook_events (idempotency ledger, server-side only) ----
    try {
      app.findCollectionByNameOrId("webhook_events");
    } catch (_) {
      const events = new Collection({
        type: "base",
        name: "webhook_events",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "stripe_event_id", type: "text", required: true, max: 200 },
          { name: "event_type", type: "text", max: 120 },
          { name: "processed_at", type: "date" },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: ["success", "failed", "retry"],
          },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_we_event ON webhook_events (stripe_event_id)",
        ],
      });
      app.save(events);
    }

    // ---- founding_reservations ----
    try {
      app.findCollectionByNameOrId("founding_reservations");
    } catch (_) {
      const reservations = new Collection({
        type: "base",
        name: "founding_reservations",
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
          { name: "stripe_checkout_session_id", type: "text", max: 200 },
          { name: "reserved_at", type: "date" },
          { name: "expires_at", type: "date" },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: ["active", "completed", "expired", "released"],
          },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_fr_session ON founding_reservations (stripe_checkout_session_id) WHERE stripe_checkout_session_id != ''",
          "CREATE INDEX idx_fr_status ON founding_reservations (status)",
          "CREATE INDEX idx_fr_user ON founding_reservations (user_id)",
        ],
      });
      app.save(reservations);
    }
  },
  (app) => {
    for (const name of ["founding_reservations", "webhook_events", "founding_purchases"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* not present */
      }
    }
  },
);
