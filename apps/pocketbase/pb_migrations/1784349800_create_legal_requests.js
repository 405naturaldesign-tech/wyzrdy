/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("legal_requests");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "legal_requests",
        // Anonymous submission allowed (GDPR/CCPA requests may come from
        // non-users). Reads restricted to staff/superuser via server code.
        listRule: null,
        viewRule: null,
        createRule: "",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "email", type: "email", required: true },
          { name: "name", type: "text", max: 120 },
          {
            name: "request_type",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["access", "deletion", "correction", "portability", "opt_out", "other"],
          },
          {
            name: "regulation",
            type: "select",
            maxSelect: 1,
            values: ["gdpr", "ccpa", "other"],
          },
          { name: "details", type: "text", max: 5000 },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: ["received", "verifying", "in_progress", "completed", "rejected"],
          },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_legal_requests_email ON legal_requests (email)"],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("legal_requests"));
    } catch (_) {
      /* ignore */
    }
  },
);
