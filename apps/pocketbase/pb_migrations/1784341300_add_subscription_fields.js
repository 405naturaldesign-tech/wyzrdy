/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    if (!users.fields.getByName("subscription_status")) {
      users.fields.add(
        new SelectField({
          name: "subscription_status",
          maxSelect: 1,
          values: ["active", "past_due", "canceled", "trialing"],
        }),
      );
    }
    if (!users.fields.getByName("billing_cycle")) {
      users.fields.add(
        new SelectField({
          name: "billing_cycle",
          maxSelect: 1,
          values: ["monthly", "annual"],
        }),
      );
    }
    if (!users.fields.getByName("subscription_start")) {
      users.fields.add(new DateField({ name: "subscription_start" }));
    }
    if (!users.fields.getByName("subscription_end")) {
      users.fields.add(new DateField({ name: "subscription_end" }));
    }
    if (!users.fields.getByName("next_billing_date")) {
      users.fields.add(new DateField({ name: "next_billing_date" }));
    }
    if (!users.fields.getByName("usage_stats")) {
      users.fields.add(new JSONField({ name: "usage_stats", maxSize: 200000 }));
    }
    app.save(users);
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      for (const f of [
        "subscription_status",
        "billing_cycle",
        "subscription_start",
        "subscription_end",
        "next_billing_date",
        "usage_stats",
      ]) {
        users.fields.removeByName(f);
      }
      app.save(users);
    } catch (_) {
      /* ignore */
    }
  },
);
