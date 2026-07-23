/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // referral_codes — one unique code per user.
    try {
      app.findCollectionByNameOrId("referral_codes");
    } catch (_) {
      const codes = new Collection({
        type: "base",
        name: "referral_codes",
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: null, // server-side generation only
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "owner",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          { name: "code", type: "text", required: true, max: 40 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_refcodes_owner ON referral_codes (owner)",
          "CREATE UNIQUE INDEX idx_refcodes_code ON referral_codes (code)",
        ],
      });
      app.save(codes);
    }

    // referral_conversions — verified paid conversions only.
    try {
      app.findCollectionByNameOrId("referral_conversions");
    } catch (_) {
      const conv = new Collection({
        type: "base",
        name: "referral_conversions",
        listRule: "@request.auth.id != '' && @request.auth.id = referrer",
        viewRule: "@request.auth.id != '' && @request.auth.id = referrer",
        createRule: null, // server-side (verified webhook) only
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "referrer",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          {
            name: "referred_user",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          { name: "referred_purchase_id", type: "text", max: 40 },
          {
            name: "conversion_type",
            type: "select",
            maxSelect: 1,
            values: ["signup", "founding_purchase"],
          },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_refconv_pair ON referral_conversions (referrer, referred_user)",
          "CREATE UNIQUE INDEX idx_refconv_purchase ON referral_conversions (referred_purchase_id) WHERE referred_purchase_id != ''",
        ],
      });
      app.save(conv);
    }
  },
  (app) => {
    for (const name of ["referral_conversions", "referral_codes"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* noop */
      }
    }
  },
);
