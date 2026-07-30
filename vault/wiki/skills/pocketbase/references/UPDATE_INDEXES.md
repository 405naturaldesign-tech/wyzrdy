# Update Indexes (existing collection)

## How indexes are stored

`collection.indexes` is a plain array of `CREATE INDEX` SQL strings. Mutate
the array, then `app.save(collection)`. PB diffs old vs new and runs the
appropriate `CREATE`/`DROP` statements.

## Naming convention (REQUIRED)

`idx_<collection>_<field(s)>` — names must be globally unique across the DB.
PB rejects duplicates. If you forget the prefix, prefix in your own head;
the migration generator in the old code used to auto-prefix but here you do
it explicitly.

## Add one index

```js
// apps/pocketbase/pb_migrations/1729500000_add_unique_slug_to_products.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("products");
    collection.indexes.push(
      "CREATE UNIQUE INDEX idx_products_slug ON products (slug)",
    );
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("products");
      collection.indexes = collection.indexes.filter(
        (idx) => !idx.includes("idx_products_slug"),
      );
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Collection not found, skipping revert");
        return;
      }
      throw e;
    }
  },
);
```

## Remove one index

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    collection.indexes = collection.indexes.filter(
      (idx) => !idx.includes("idx_posts_old_status"),
    );
    app.save(collection);
  },
  (app) => {
    // Restore the original SQL exactly as it was. Read from <pocketbase_schema>.
    const collection = app.findCollectionByNameOrId("posts");
    collection.indexes.push(
      "CREATE INDEX idx_posts_old_status ON posts (old_status)",
    );
    app.save(collection);
  },
);
```

## Add and remove together

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");
    collection.indexes = collection.indexes.filter(
      (idx) => !idx.includes("idx_orders_legacy"),
    );
    collection.indexes.push(
      "CREATE INDEX idx_orders_status_created ON orders (status, created DESC)",
    );
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");
    collection.indexes = collection.indexes.filter(
      (idx) => !idx.includes("idx_orders_status_created"),
    );
    collection.indexes.push(
      "CREATE INDEX idx_orders_legacy ON orders (legacy_field)",
    );
    app.save(collection);
  },
);
```

## Recipes by use case

### Add unique constraint to a column with possible duplicates

If existing rows have duplicates, the unique-index creation **fails halfway**
and the migration aborts. Run a `DELETE_RECORDS.md` (or raw-SQL) migration
first that deduplicates, then add the unique index in a follow-up migration.

### Add unique constraint to an OPTIONAL field (partial unique index)

When the field is optional (not `required: true`), a plain
`CREATE UNIQUE INDEX` will fail with `UNIQUE constraint failed: …` as soon as
two rows have the unset value. PocketBase stores unset text columns as `""`
(empty string), not `NULL`, so every empty row collides.

Use a SQLite partial index that excludes the empty value:

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.indexes.push(
      "CREATE UNIQUE INDEX idx_users_invite_code ON users (invite_code) WHERE invite_code != ''",
    );
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.indexes = collection.indexes.filter(
      (idx) => !idx.includes("idx_users_invite_code"),
    );
    app.save(collection);
  },
);
```

For nullable numeric or relation fields, exclude `NULL` too:

```js
collection.indexes.push(
  "CREATE UNIQUE INDEX idx_orders_external_id ON orders (external_id) WHERE external_id IS NOT NULL",
);
```

**When to reach for this:** any time a migration fails with
`UNIQUE constraint failed: <table>.<column>` AND the column is optional /
nullable. The right fix is almost always a partial unique index, not data
cleanup.

### Composite uniqueness ("one vote per user per post")

```js
collection.indexes.push(
  "CREATE UNIQUE INDEX idx_votes_user_post ON votes (user, post)",
);
```

### Partial index (only published posts)

```js
collection.indexes.push(
  "CREATE INDEX idx_posts_published ON posts (published) WHERE status = 'published'",
);
```

### Case-insensitive uniqueness on usernames

```js
collection.indexes.push(
  "CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username))",
);
```

## Common mistakes

- Forgetting the `idx_<collection>_` prefix → name collision with another
  collection's index → SQLite rejects the second one and the migration
  fails.
- Pushing a duplicate index (same name) → PB rejects. Filter the existing
  array first if you're unsure: `if (!collection.indexes.some(i => i.includes("idx_name")))`.
- Adding `UNIQUE` to a column with duplicate values → fails. Clean first.
- Adding `UNIQUE` to an **optional** column without a `WHERE` clause →
  fails the moment two rows have the unset value (PB stores it as `""`,
  not `NULL`). Use a partial index:
  `CREATE UNIQUE INDEX idx_x_y ON x (y) WHERE y != ''` (add
  `AND y IS NOT NULL` for nullable numbers/relations). See the
  "Add unique constraint to an OPTIONAL field" recipe above.
- Filtering by SQL substring that's too generic — `filter(idx => !idx.includes("status"))`
  also drops indexes whose names contain "status" but aren't the one you
  meant. Match on the full index name.
- Editing the index SQL on a previously-applied migration → ignored, PB
  only diffs at apply time. Add a new migration with the delta.
