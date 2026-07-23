/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // --- Extend referrals with conversion tracking fields ---
    const referrals = app.findCollectionByNameOrId("referrals");
    if (!referrals.fields.getByName("referred_user_id")) {
      referrals.fields.add(new TextField({ name: "referred_user_id", max: 50 }));
    }
    if (!referrals.fields.getByName("conversion_status")) {
      referrals.fields.add(new SelectField({
        name: "conversion_status",
        maxSelect: 1,
        values: ["pending", "signed_up", "converted"],
      }));
    }
    app.save(referrals);

    const users = app.findCollectionByNameOrId("users");

    // --- payments collection (owner-scoped) ---
    let paymentsExists = false;
    try { app.findCollectionByNameOrId("payments"); paymentsExists = true; } catch (_) { paymentsExists = false; }
    if (!paymentsExists) {
      const payments = new Collection({
        type: "base",
        name: "payments",
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "owner", type: "relation", required: true, maxSelect: 1,
            collectionId: users.id, cascadeDelete: true,
          },
          { name: "provider", type: "select", maxSelect: 1, values: ["stripe", "paypal", "cashapp", "whatsapp", "crypto"] },
          { name: "method", type: "text", max: 60 },
          { name: "tier", type: "select", maxSelect: 1, values: ["individual", "business", "agency", "enterprise"] },
          { name: "billing_cycle", type: "select", maxSelect: 1, values: ["monthly", "annual"] },
          { name: "amount", type: "number", min: 0 },
          { name: "currency", type: "text", max: 10 },
          { name: "crypto_asset", type: "text", max: 20 },
          { name: "status", type: "select", maxSelect: 1, values: ["pending", "processing", "paid", "failed", "refunded", "canceled"] },
          { name: "external_id", type: "text", max: 200 },
          { name: "checkout_url", type: "text", max: 800 },
          { name: "meta", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_payments_owner ON payments (owner)"],
      });
      app.save(payments);
    }

    // --- invoices collection (owner-scoped) ---
    let invoicesExists = false;
    try { app.findCollectionByNameOrId("invoices"); invoicesExists = true; } catch (_) { invoicesExists = false; }
    if (!invoicesExists) {
      const invoices = new Collection({
        type: "base",
        name: "invoices",
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "owner", type: "relation", required: true, maxSelect: 1,
            collectionId: users.id, cascadeDelete: true,
          },
          { name: "number", type: "text", max: 60 },
          { name: "tier", type: "text", max: 40 },
          { name: "amount", type: "number", min: 0 },
          { name: "currency", type: "text", max: 10 },
          { name: "provider", type: "text", max: 40 },
          { name: "status", type: "select", maxSelect: 1, values: ["paid", "due", "void"] },
          { name: "line_items", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_invoices_owner ON invoices (owner)"],
      });
      app.save(invoices);
    }
  },
  (app) => {
    ["payments", "invoices"].forEach((n) => {
      try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
    });
    try {
      const referrals = app.findCollectionByNameOrId("referrals");
      ["referred_user_id", "conversion_status"].forEach((f) => {
        if (referrals.fields.getByName(f)) referrals.fields.removeByName(f);
      });
      app.save(referrals);
    } catch (_) {}
  },
);
