# Indexes

## How indexes are defined

Indexes are raw `CREATE INDEX` SQL strings in the collection's `indexes`
array. PB's SQLite engine supports standard SQLite index syntax.

```js
indexes: [
  "CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)",
  "CREATE INDEX idx_posts_status ON posts (status)",
];
```

Naming convention: `idx_{collection}_{field(s)}`. Keep names unique across
the entire DB.

## Recipes

### Unique field (slug, username, email-on-non-auth-collection)

```js
indexes: ["CREATE UNIQUE INDEX idx_products_slug ON products (slug)"];
```

### Composite unique (one like per user per post)

```js
indexes: ["CREATE UNIQUE INDEX idx_likes_user_post ON likes (user, post)"];
```

### Plain lookup index (speeds up WHERE / list rule)

```js
indexes: [
  "CREATE INDEX idx_orders_customer ON orders (customer)",
  "CREATE INDEX idx_orders_status_created ON orders (status, created DESC)",
];
```

### Partial index (only-published posts)

```js
indexes: [
  "CREATE INDEX idx_posts_published ON posts (published) WHERE status = 'published'",
];
```

### Partial UNIQUE index on an optional field (the most common fix)

Use this whenever a column is **optional** (not `required: true`) but must be
**unique when set**. Examples: optional `invite_code`, optional `slug`,
optional `external_id`, optional `phone`. A plain `CREATE UNIQUE INDEX`
treats every empty string `""` as equal and fails with a `UNIQUE constraint
failed` error the moment a second row stores `""` (PB writes `""` for unset
text fields, not `NULL`).

The fix is a SQLite partial index that excludes empty values:

```js
indexes: [
  "CREATE UNIQUE INDEX idx_users_invite_code ON users (invite_code) WHERE invite_code != ''",
];
```

For nullable numeric / relation fields, also exclude `NULL`:

```js
indexes: [
  "CREATE UNIQUE INDEX idx_orders_external_id ON orders (external_id) WHERE external_id IS NOT NULL",
];
```

Composite partial unique (e.g. one optional referral code per campaign):

```js
indexes: [
  "CREATE UNIQUE INDEX idx_referrals_campaign_code ON referrals (campaign, code) WHERE code != ''",
];
```

### Case-insensitive uniqueness

```js
indexes: [
  "CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username))",
];
```

## Full example (new collection with a unique index)

`products` is a deliberately PUBLIC catalog (anyone can browse the shop;
nobody can write from the frontend — admins seed via migrations or
server-side superuser code). For user-owned data, default to the
owner-scoped rules from `ACCESS_RULES.md` instead.

```js
// apps/pocketbase/pb_migrations/1729500000_create_products.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = new Collection({
      type: "base",
      name: "products",
      listRule: "", // public catalog
      viewRule: "", // public catalog
      createRule: null, // writes only via superuser / migrations
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "name", type: "text", required: true, max: 200 },
        { name: "slug", type: "text", required: true, max: 200 },
        { name: "price", type: "number", required: true, min: 0 },
        { name: "description", type: "text" },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["draft", "published"],
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_products_slug ON products (slug)",
        "CREATE INDEX idx_products_status ON products (status)",
      ],
    });
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("products");
    app.delete(collection);
  },
);
```

## Adding an index to an existing collection

```js
// apps/pocketbase/pb_migrations/1729500001_add_unique_slug_to_products.js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("products");
    collection.addIndex("idx_products_slug", true, "slug", "");
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("products");
    collection.removeIndex("idx_products_slug");
    app.save(collection);
  },
);
```

`addIndex(name, unique, columns, where)`:

- `name` — index name (must be DB-unique)
- `unique` — boolean
- `columns` — comma-separated column names (a single string)
- `where` — optional partial-index predicate (empty string if none)

## Common mistakes

- **Indexing `id` inside a create migration.** `id` is populated by PB after
  `app.save()`, so it doesn't exist when the `indexes` array is evaluated and
  the migration fails with "no such column". `id` already has an implicit
  primary-key index anyway — never index it yourself.
- **Indexing `created` / `updated` on an auth collection in the create
  migration.** Auth collections auto-add these after `app.save()`, so the
  index won't see them yet. Add the index in a follow-up migration via
  `collection.addIndex(...)`. Base collections are fine because you declare
  the `created` / `updated` autodate fields yourself in `fields[]` — an
  `indexes: ["CREATE INDEX idx_x_created ON x (created)"]` in the same
  migration works.
- Duplicating an index name across collections → SQLite rejects the second
  `CREATE INDEX`. Always prefix with `idx_{collection}_`.
- Creating a unique index on a column that already has duplicate values —
  migration fails mid-way. Clean the data first (with a prior data migration
  or a raw SQL DELETE) before adding uniqueness.
- **Plain `CREATE UNIQUE INDEX` on an optional text field.** PB stores unset
  text as `""` (empty string), not `NULL`, so the second row with an empty
  value blows up with `UNIQUE constraint failed`. For any optional unique
  field (`invite_code`, optional `slug`, optional `external_id`, …) use a
  partial index that filters out empties:
  `CREATE UNIQUE INDEX idx_x_y ON x (y) WHERE y != ''`. Add
  `AND y IS NOT NULL` if the column can also be `NULL` (numbers, relations).
- Using DB column names that don't match the field `name` in the
  collection. The DB column name IS the field name.
- Forgetting the composite index when two-field queries are the hot path.
  If your app always filters by `(status, created DESC)`, add that composite
  index — a single-column index on `status` won't help the ORDER BY.
- Adding an index via the admin UI and expecting it to persist across
  container restarts. It won't. Use a migration.
