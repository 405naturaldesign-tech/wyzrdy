# Delete Collection

## Warning

**Permanently destroys the collection and every record in it.** No automatic
recovery from `down` — the down section can recreate structure but not data.

## Dependency order

If other collections have a `relation` field pointing at the one you're
deleting, you have two choices:

1. **Two-migration approach (safer).** First migration removes the dangling
   relation fields from dependent collections; second migration deletes the
   target. Pick consecutive timestamps so they apply in order.
2. **Single migration with `cascadeDelete: true`.** Only valid when the
   relation field on the dependent collection was originally created with
   `cascadeDelete: true` — PB then nukes the dependent rows automatically.
   Won't auto-remove the field definition itself, just the rows.

Check `<pocketbase_schema>` for relation fields pointing at your target before
deciding. If you see any without `cascadeDelete: true`, use approach 1.

## Template

```js
// apps/pocketbase/pb_migrations/1729500000_delete_old_logs.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("old_logs");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Collection already gone, skipping");
        return;
      }
      throw e;
    }
  },
  (app) => {
    // Data is gone, but down should recreate the exact original structure.
    // Copy this shape from the original create migration / <pocketbase_schema>.
    try {
      app.findCollectionByNameOrId("old_logs");
      return; // structure already exists
    } catch (_) {
      const collection = new Collection({
        type: "base",
        name: "old_logs",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "level",
            type: "select",
            maxSelect: 1,
            values: ["info", "warn", "error"],
          },
          { name: "message", type: "text", required: true },
          {
            name: "created",
            type: "autodate",
            onCreate: true,
            onUpdate: false,
          },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(collection);
    }
  },
);
```

## Required `down` body — recreate structure

The down section cannot restore deleted records, but it should recreate the
collection shape so later rollback steps have a valid schema to attach fields,
rules, indexes, or relations to. Copy the original `new Collection(...)`
definition into `down` and keep it complete: type, rules, fields, indexes, and
collection options.

For base collections, include the original `created` / `updated` autodate
fields if they existed. For auth collections, do not add `created` / `updated`
manually — PocketBase injects them for `type: "auth"`.

## Two-migration cascade example

If `posts.author` is a `relation` field pointing at `users`, and you want to
delete `users`:

```js
// apps/pocketbase/pb_migrations/1729500000_drop_author_from_posts.js
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.removeByName("author");
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    const users = app.findCollectionByNameOrId("users");

    if (posts.fields.getByName("author")) return;

    posts.fields.add(
      new RelationField({
        name: "author",
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      }),
    );
    app.save(posts);
  },
);
```

```js
// apps/pocketbase/pb_migrations/1729500001_delete_users.js
migrate(
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
  (app) => {
    // Recreate the structure only. Deleted auth records are not recoverable.
    try {
      app.findCollectionByNameOrId("users");
      return;
    } catch (_) {
      const collection = new Collection({
        type: "auth",
        name: "users",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: "id = @request.auth.id",
        fields: [
          { name: "name", type: "text", max: 100 },
          { name: "avatar", type: "file", maxSelect: 1 },
        ],
        passwordAuth: { enabled: true },
        authAlert: { enabled: false },
      });
      app.save(collection);
    }
  },
);
```

## Common mistakes

- Deleting a collection that other collections relate to without removing
  those relations first → migration fails mid-apply, schema ends up in a
  half-broken state. Always check the schema first.
- Trying to delete a system collection (`_superusers`, `_externalAuths`,
  `_mfas`, `_otps`) — PB refuses. Don't attempt.
- Using `app.delete(name)` with a string — `app.delete` expects the
  collection model, not a name. Always `findCollectionByNameOrId(...)` first.
- Re-running the same delete (after `pb_data` reset) without the try/catch
  guard → "no rows in result set" stops the migration.
- Leaving `down` empty for a collection that other rollback steps depend on →
  reverse migration fails when those steps try to restore fields, rules, or
  relations against a missing collection. Recreate the structure first.
