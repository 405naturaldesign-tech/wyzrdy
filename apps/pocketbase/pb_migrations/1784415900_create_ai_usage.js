/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("ai_usage");
    } catch (_) {
      const users = app.findCollectionByNameOrId("users");
      collection = new Collection({
        type: "base",
        name: "ai_usage",
        // Owner can read their own usage; writes happen server-side only
        // (Express superuser client bypasses these rules).
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: null,
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
          {
            name: "provider",
            type: "select",
            maxSelect: 1,
            values: ["openrouter", "z_ai", "composio", "claude", "gemini"],
          },
          { name: "model", type: "text", max: 120 },
          { name: "input_tokens", type: "number", onlyInt: true, min: 0 },
          { name: "output_tokens", type: "number", onlyInt: true, min: 0 },
          { name: "estimated_cost_cents", type: "number", min: 0 },
          { name: "month", type: "text", max: 7 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_ai_usage_owner ON ai_usage (owner)",
          "CREATE INDEX idx_ai_usage_owner_month ON ai_usage (owner, month)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("ai_usage");
      app.delete(collection);
    } catch (_) {
      /* noop */
    }
  },
);
