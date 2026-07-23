/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // --- Extend users with profile + preference fields ---
    if (!users.fields.getByName("subscription_tier")) {
      users.fields.add(
        new SelectField({
          name: "subscription_tier",
          maxSelect: 1,
          values: ["individual", "business", "agency", "enterprise"],
        }),
      );
    }
    if (!users.fields.getByName("bio")) {
      users.fields.add(new TextField({ name: "bio", max: 500 }));
    }
    if (!users.fields.getByName("company")) {
      users.fields.add(new TextField({ name: "company", max: 120 }));
    }
    if (!users.fields.getByName("website")) {
      users.fields.add(new URLField({ name: "website" }));
    }
    if (!users.fields.getByName("preferences")) {
      users.fields.add(new JSONField({ name: "preferences", maxSize: 200000 }));
    }
    app.save(users);

    const owner = (col) => ({
      name: "owner",
      type: "relation",
      required: true,
      maxSelect: 1,
      collectionId: users.id,
      cascadeDelete: true,
    });
    const stamps = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];
    const rules = {
      listRule: "@request.auth.id != '' && @request.auth.id = owner",
      viewRule: "@request.auth.id != '' && @request.auth.id = owner",
      createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner",
      updateRule: "@request.auth.id != '' && @request.auth.id = owner",
      deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
    };

    const make = (name, extraFields, indexes) => {
      try {
        return app.findCollectionByNameOrId(name);
      } catch (_) {
        const c = new Collection({
          type: "base",
          name,
          ...rules,
          fields: [owner(), ...extraFields, ...stamps],
          indexes: indexes || [],
        });
        app.save(c);
        return c;
      }
    };

    const workflows = make(
      "workflows",
      [
        { name: "name", type: "text", required: true, max: 200 },
        { name: "type", type: "select", maxSelect: 1, values: ["wyzrdy", "easybreezy", "forgeseo"] },
        { name: "status", type: "select", maxSelect: 1, values: ["draft", "in-progress", "completed", "archived"] },
        { name: "objective", type: "text", max: 2000 },
        { name: "plan", type: "json", maxSize: 500000 },
        { name: "workflow_data", type: "json", maxSize: 2000000 },
        { name: "version", type: "number" },
        { name: "deleted", type: "bool" },
      ],
      ["CREATE INDEX idx_workflows_owner ON workflows (owner)"],
    );

    make(
      "workflow_history",
      [
        { name: "workflow", type: "relation", required: true, maxSelect: 1, collectionId: workflows.id, cascadeDelete: true },
        { name: "version", type: "number" },
        { name: "data", type: "json", maxSize: 2000000 },
      ],
      ["CREATE INDEX idx_wfhistory_owner ON workflow_history (owner)"],
    );

    const conversations = make(
      "conversations",
      [
        { name: "title", type: "text", required: true, max: 200 },
        { name: "type", type: "select", maxSelect: 1, values: ["easybreezy", "wyzrdy", "forgeseo"] },
        { name: "intent", type: "text", max: 100 },
        { name: "deleted", type: "bool" },
      ],
      ["CREATE INDEX idx_conversations_owner ON conversations (owner)"],
    );

    make(
      "messages",
      [
        { name: "conversation", type: "relation", required: true, maxSelect: 1, collectionId: conversations.id, cascadeDelete: true },
        { name: "role", type: "select", maxSelect: 1, values: ["user", "assistant", "system"] },
        { name: "content", type: "text", max: 20000 },
      ],
      ["CREATE INDEX idx_messages_owner ON messages (owner)", "CREATE INDEX idx_messages_conv ON messages (conversation)"],
    );

    const projects = make(
      "projects",
      [
        { name: "name", type: "text", required: true, max: 200 },
        { name: "type", type: "select", maxSelect: 1, values: ["wyzrdy", "easybreezy", "forgeseo"] },
        { name: "status", type: "select", maxSelect: 1, values: ["active", "paused", "completed", "archived"] },
        { name: "data", type: "json", maxSize: 2000000 },
        { name: "deleted", type: "bool" },
      ],
      ["CREATE INDEX idx_projects_owner ON projects (owner)"],
    );

    make(
      "assets",
      [
        { name: "project", type: "relation", maxSelect: 1, collectionId: projects.id, cascadeDelete: false },
        { name: "type", type: "select", maxSelect: 1, values: ["blueprint", "audit", "content", "schema", "report", "export"] },
        { name: "name", type: "text", required: true, max: 200 },
        { name: "url", type: "text", max: 500 },
        { name: "data", type: "json", maxSize: 2000000 },
        { name: "deleted", type: "bool" },
      ],
      ["CREATE INDEX idx_assets_owner ON assets (owner)"],
    );

    make(
      "activity_log",
      [
        { name: "action", type: "text", required: true, max: 120 },
        { name: "resource_type", type: "text", max: 60 },
        { name: "resource_id", type: "text", max: 60 },
        { name: "meta", type: "json", maxSize: 200000 },
      ],
      ["CREATE INDEX idx_activity_owner ON activity_log (owner)"],
    );

    make(
      "user_integrations",
      [
        { name: "service_name", type: "text", required: true, max: 80 },
        { name: "status", type: "select", maxSelect: 1, values: ["connected", "disconnected", "error"] },
        { name: "config", type: "json", maxSize: 200000 },
      ],
      ["CREATE INDEX idx_integrations_owner ON user_integrations (owner)"],
    );
  },
  (app) => {
    for (const name of [
      "user_integrations",
      "activity_log",
      "assets",
      "projects",
      "messages",
      "conversations",
      "workflow_history",
      "workflows",
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* ignore */
      }
    }
    try {
      const users = app.findCollectionByNameOrId("users");
      for (const f of ["subscription_tier", "bio", "company", "website", "preferences"]) {
        users.fields.removeByName(f);
      }
      app.save(users);
    } catch (_) {
      /* ignore */
    }
  },
);
