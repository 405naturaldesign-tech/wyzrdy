/// <reference path="../pb_types.d.ts" />
migrate(async (db) => {
  const jsonSchema = {
    fields: [
      {
        system: false,
        id: "customer_id",
        name: "customer_id",
        type: "text",
        required: true,
        presentable: true,
        unique: false,
        options: {
          min: null,
          max: 500,
          pattern: "",
        },
      },
      {
        system: false,
        id: "domain",
        name: "domain",
        type: "text",
        required: true,
        presentable: true,
        unique: false,
        options: {
          min: null,
          max: 255,
          pattern: "",
        },
      },
      {
        system: false,
        id: "site_id",
        name: "site_id",
        type: "text",
        required: true,
        presentable: true,
        unique: false,
        options: {
          min: null,
          max: 255,
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
          values: ["provisioning", "provisioned", "active", "suspended", "error"],
        },
      },
      {
        system: false,
        id: "cms",
        name: "cms",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: 100,
          pattern: "",
        },
      },
      {
        system: false,
        id: "plan",
        name: "plan",
        type: "text",
        required: false,
        presentable: false,
        unique: false,
        options: {
          min: null,
          max: 100,
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
      "CREATE INDEX `idx_hostinger_customer_id` ON `hostinger_provisioning` (`customer_id`)",
      "CREATE INDEX `idx_hostinger_domain` ON `hostinger_provisioning` (`domain`)",
      "CREATE INDEX `idx_hostinger_status` ON `hostinger_provisioning` (`status`)",
      "CREATE UNIQUE INDEX `idx_hostinger_domain_unique` ON `hostinger_provisioning` (`domain`)",
    ],
  };

  const collection = new Collection({
    id: "hostinger_provisioning",
    created: "2024-01-01 00:00:00.000Z",
    updated: "2024-01-01 00:00:00.000Z",
    name: "hostinger_provisioning",
    type: "base",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    options: {},
    schema: jsonSchema,
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("hostinger_provisioning");

  return dao.delete(collection);
});
