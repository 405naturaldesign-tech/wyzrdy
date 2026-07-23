/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const rules = {
      listRule: "@request.auth.id != '' && @request.auth.id = owner",
      viewRule: "@request.auth.id != '' && @request.auth.id = owner",
      createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner",
      updateRule: "@request.auth.id != '' && @request.auth.id = owner",
      deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
    };
    const stamps = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];
    const ownerField = {
      name: "owner", type: "relation", required: true, maxSelect: 1,
      collectionId: users.id, cascadeDelete: true,
    };

    // --- artifacts (the current/head record) ---
    let artifacts;
    try {
      artifacts = app.findCollectionByNameOrId("artifacts");
    } catch (_) {
      artifacts = new Collection({
        type: "base",
        name: "artifacts",
        ...rules,
        fields: [
          ownerField,
          { name: "title", type: "text", required: true, max: 240 },
          {
            name: "type", type: "select", maxSelect: 1,
            values: ["blueprint", "audit", "workflow", "content", "document", "schema", "report", "export", "other"],
          },
          { name: "category", type: "text", max: 80 },
          { name: "tags", type: "json", maxSize: 50000 },
          { name: "summary", type: "text", max: 2000 },
          { name: "body", type: "text", max: 200000 },
          { name: "data", type: "json", maxSize: 2000000 },
          {
            name: "status", type: "select", maxSelect: 1,
            values: ["active", "archived"],
          },
          { name: "checksum", type: "text", max: 80 },
          { name: "current_version", type: "number", onlyInt: true },
          { name: "lineage", type: "json", maxSize: 200000 },
          { name: "access_count", type: "number", onlyInt: true },
          { name: "deleted", type: "bool" },
          ...stamps,
        ],
        indexes: [
          "CREATE INDEX idx_artifacts_owner ON artifacts (owner)",
          "CREATE INDEX idx_artifacts_type ON artifacts (type)",
        ],
      });
      app.save(artifacts);
    }

    // --- artifact_versions (immutable snapshots) ---
    try {
      app.findCollectionByNameOrId("artifact_versions");
    } catch (_) {
      const versions = new Collection({
        type: "base",
        name: "artifact_versions",
        ...rules,
        fields: [
          ownerField,
          {
            name: "artifact", type: "relation", required: true, maxSelect: 1,
            collectionId: artifacts.id, cascadeDelete: true,
          },
          { name: "version", type: "number", onlyInt: true },
          { name: "title", type: "text", max: 240 },
          { name: "summary", type: "text", max: 2000 },
          { name: "body", type: "text", max: 200000 },
          { name: "data", type: "json", maxSize: 2000000 },
          { name: "tags", type: "json", maxSize: 50000 },
          { name: "checksum", type: "text", max: 80 },
          { name: "change_note", type: "text", max: 500 },
          { name: "author", type: "text", max: 120 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: [
          "CREATE INDEX idx_artver_owner ON artifact_versions (owner)",
          "CREATE INDEX idx_artver_artifact ON artifact_versions (artifact)",
        ],
      });
      app.save(versions);
    }

    // --- artifact_access_log (view/modify/restore audit trail) ---
    try {
      app.findCollectionByNameOrId("artifact_access_log");
    } catch (_) {
      const accessLog = new Collection({
        type: "base",
        name: "artifact_access_log",
        ...rules,
        fields: [
          ownerField,
          {
            name: "artifact", type: "relation", maxSelect: 1,
            collectionId: artifacts.id, cascadeDelete: true,
          },
          {
            name: "action", type: "select", maxSelect: 1,
            values: ["view", "create", "update", "restore", "archive", "delete", "export"],
          },
          { name: "detail", type: "text", max: 500 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE INDEX idx_artlog_artifact ON artifact_access_log (artifact)"],
      });
      app.save(accessLog);
    }
  },
  (app) => {
    for (const name of ["artifact_access_log", "artifact_versions", "artifacts"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        /* ignore */
      }
    }
  },
);
