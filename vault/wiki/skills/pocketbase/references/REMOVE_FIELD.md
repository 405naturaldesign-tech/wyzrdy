# Remove Field from Collection

## Warning

**Permanently deletes the field and every row's data for it.** No automatic
recovery — the down section can re-add the field, but the data is gone.

## Index cascade

If any index on the collection references the field you're removing, drop
those indexes IN THE SAME MIGRATION before removing the field. Otherwise the
SQLite ALTER fails with "index references non-existent column" (or worse,
leaves a dangling index that breaks subsequent saves).

Check `<pocketbase_schema>` for the collection's `indexes:` list. Any index
SQL that mentions your field column needs to go.

## Template (with index cascade + rollback restoration)

```js
// apps/pocketbase/pb_migrations/1729500000_remove_legacy_field.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("orders");

    // 1. Drop indexes that reference the field. Filter by index name.
    collection.indexes = collection.indexes.filter(
      (idx) => !idx.includes("idx_orders_legacy_code"),
    );

    // 2. Remove the field.
    collection.fields.removeByName("legacy_code");

    app.save(collection);
  },
  (app) => {
    // Re-add the field with its original definition (data is lost).
    try {
      const collection = app.findCollectionByNameOrId("orders");
      collection.fields.add(
        new TextField({
          name: "legacy_code",
          max: 50,
          required: false,
        }),
      );
      // Restore the dropped index.
      collection.indexes.push(
        "CREATE INDEX idx_orders_legacy_code ON orders (legacy_code)",
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

## Removing a relation field

Same pattern — but if the relation has `cascadeDelete: true` and other code
relies on that behavior, the relation tied to ownership disappears. Audit
hooks and routes before removing.

```js
// apps/pocketbase/pb_migrations/1729500000_remove_posts_author.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");

    collection.fields.removeByName("author");

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    const users = app.findCollectionByNameOrId("users");

    if (collection.fields.getByName("author")) return;

    collection.fields.add(
      new RelationField({
        name: "author",
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      }),
    );

    app.save(collection);
  },
);
```

## Required `down` body — capture the field definition first

The down section can only restore the field if you encode its full original
definition into the migration. Read `<pocketbase_schema>` for the field's
type, required flag, min/max, values, etc., and bake them into the `down`
constructor literal. Do NOT leave `down` empty if the field was non-trivial —
a future rollback will create a column with default settings instead of the
original.

## Common mistakes

- Removing a field that an index depends on without dropping the index first
  → migration fails partway, schema half-updated.
- Removing a field referenced in a `listRule` / `viewRule` / etc. expression
  → every subsequent request to that collection 500s. Update the rule in the
  same migration (or first) — see `UPDATE_RULES.md`.
- Removing a field referenced in another collection's filter rule (e.g.
  `posts.viewRule = "category.published = true"` and you remove
  `categories.published`). PB doesn't notice at migration time but reads
  break at runtime.
- Empty `down` for a complex field → rollback "works" but loses everything
  about the field shape. Always populate the down with the original field
  definition.
- Using `removeById(field.id)` instead of `removeByName("name")` — the
  field id is randomly generated; use the human-readable name.
