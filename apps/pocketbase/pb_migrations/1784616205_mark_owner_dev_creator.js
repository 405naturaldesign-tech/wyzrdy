/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // Add a system_role field to track owner/dev/creator status if it doesn't exist yet.
    if (!users.fields.getByName("system_role")) {
      users.fields.add(
        new SelectField({
          name: "system_role",
          maxSelect: 3,
          values: ["owner", "developer", "creator", "admin", "member"],
          required: false,
        }),
      );
      app.save(users);
    }

    let target;
    try {
      target = app.findFirstRecordByFilter(
        "users",
        "email ~ 'DM@wyzrdy.com'",
      );
    } catch (e) {
      console.log("User DM@wyzrdy.com not found, skipping profile update");
      return;
    }

    target.set("verified", true);
    target.set("emailVisibility", true);
    target.set("system_role", ["owner", "developer", "creator"]);
    app.save(target);
  },
  (app) => {
    try {
      const target = app.findFirstRecordByFilter(
        "users",
        "email ~ 'DM@wyzrdy.com'",
      );
      target.set("verified", false);
      target.set("emailVisibility", false);
      target.set("system_role", []);
      app.save(target);
    } catch (e) {
      console.log("Rollback skipped:", e.message);
    }

    try {
      const users = app.findCollectionByNameOrId("users");
      if (users.fields.getByName("system_role")) {
        users.fields.removeByName("system_role");
        app.save(users);
      }
    } catch (e) {
      console.log("Field removal skipped:", e.message);
    }
  },
);
