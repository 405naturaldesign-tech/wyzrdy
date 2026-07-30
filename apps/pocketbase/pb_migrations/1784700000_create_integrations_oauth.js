/// <reference path="../pb_types.d.ts" />
migrate(async (db) => {
  const jsonSchema = {
    fields: [
      {
        system: false,
        id: "user_id",
        name: "user_id",
        type: "relation",
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: "pbc_users_collection_id",
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"],
        },
      },
      {
        system: false,
        id: "provider",
        name: "provider",
        type: "text",
        required: true,
        presentable: true,
        unique: false,
        options: {
          min: null,
          max: 100,
          pattern: "",
        },
      },
      {
        system: false,
        id: "status",
        name: "status",
        type: "select",
        required: true,
        presentable: false,
        unique: false,
        options: {
          maxSelect: 1,
          values: ["pending", "connected", "revoked", "expired"],
        },
      },
      {
        system: false,
        id: "access_token",
        name: "access_token",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "refresh_token",
        name: "refresh_token",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "expires_at",
        name: "expires_at",
        type: "date",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: "",
          max: "",
        },
      },
      {
        system: false,
        id: "connected_at",
        name: "connected_at",
        type: "date",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: "",
          max: "",
        },
      },
      {
        system: false,
        id: "state",
        name: "state",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "metadata",
        name: "metadata",
        type: "json",
        required: false,
        presentable: false,
        unique: false,
        options: {
          maxSize: 2000000,
        },
      },
    ],
    indexes: [
      "CREATE INDEX `idx_integrations_user_id` ON `integrations` (`user_id`)",
      "CREATE INDEX `idx_integrations_provider` ON `integrations` (`provider`)",
      "CREATE INDEX `idx_integrations_status` ON `integrations` (`status`)",
      "CREATE UNIQUE INDEX `idx_integrations_user_provider` ON `integrations` (`user_id`, `provider`)",
    ],
  };

  const collection = new Collection({
    id: "integrations",
    created: "2024-01-01 00:00:00.000Z",
    updated: "2024-01-01 00:00:00.000Z",
    name: "integrations",
    type: "base",
    system: false,
    listRule: "user_id = @requestUser.id",
    viewRule: "user_id = @requestUser.id",
    createRule: "user_id = @requestUser.id",
    updateRule: "user_id = @requestUser.id",
    deleteRule: "user_id = @requestUser.id",
    options: {},
    schema: jsonSchema,
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("integrations");

  return dao.delete(collection);
});
