/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // --- Pilot fields on users ---
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("pilot_member")) {
      users.fields.add(new BoolField({ name: "pilot_member" }));
    }
    if (!users.fields.getByName("lifetime_free_status")) {
      users.fields.add(new BoolField({ name: "lifetime_free_status" }));
    }
    if (!users.fields.getByName("pilot_enrollment_date")) {
      users.fields.add(new DateField({ name: "pilot_enrollment_date" }));
    }
    if (!users.fields.getByName("pilot_number")) {
      users.fields.add(new NumberField({ name: "pilot_number", onlyInt: true }));
    }
    if (!users.fields.getByName("pilot_tier")) {
      users.fields.add(new SelectField({
        name: "pilot_tier",
        maxSelect: 1,
        values: ["individual", "business", "agency", "enterprise"],
      }));
    }
    app.save(users);

    // --- Referrals collection (public create for tracking, owner reads own) ---
    let referralsExists = false;
    try { app.findCollectionByNameOrId("referrals"); referralsExists = true; } catch (_) { referralsExists = false; }
    if (!referralsExists) {
      const referrals = new Collection({
        type: "base",
        name: "referrals",
        listRule: "@request.auth.id != '' && @request.auth.id = referrer_id",
        viewRule: "@request.auth.id != '' && @request.auth.id = referrer_id",
        createRule: "",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "referrer_id", type: "text", required: true, max: 50 },
          { name: "source", type: "text", max: 40 },
          {
            name: "event",
            type: "select",
            maxSelect: 1,
            values: ["click", "signup", "conversion"],
          },
          { name: "landing", type: "text", max: 300 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE INDEX idx_referrals_ref ON referrals (referrer_id)"],
      });
      app.save(referrals);
    }
  },
  (app) => {
    try {
      const referrals = app.findCollectionByNameOrId("referrals");
      app.delete(referrals);
    } catch (_) {}
    try {
      const users = app.findCollectionByNameOrId("users");
      ["pilot_member", "lifetime_free_status", "pilot_enrollment_date", "pilot_number", "pilot_tier"].forEach((f) => {
        if (users.fields.getByName(f)) users.fields.removeByName(f);
      });
      app.save(users);
    } catch (_) {}
  },
);
