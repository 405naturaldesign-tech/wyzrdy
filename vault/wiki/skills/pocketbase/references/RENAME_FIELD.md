# Rename Field

## What it preserves

- The DB column is renamed in place — all existing values move with it.
- The field's id is unchanged, so no data is lost.

## What you must update afterwards

- Frontend references: any `record.field("old")`, `r.old`, filter expressions
  containing the old name in `apps/web/src/`.
- Backend references in Express routes and hooks.
- Any access rule on this collection or others that uses the old field name
  in its expression. Update the rule with `UPDATE_RULES.md` in the same
  task.
- Any index defined on the column — SQLite tracks the column name; the
  index either auto-updates (PB regenerates) or breaks. Check by running
  `.indexes` after migration; recreate any that ended up dangling using
  `UPDATE_INDEXES.md`.

## Template

```js
// apps/pocketbase/pb_migrations/1729500000_rename_authorId_to_author.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    const field = collection.fields.getByName("authorId");
    if (!field) {
      console.log("Field 'authorId' not found, skipping rename");
      return;
    }
    field.name = "author";
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("posts");
      const field = collection.fields.getByName("author");
      if (!field) {
        console.log("Field not found, skipping revert");
        return;
      }
      field.name = "authorId";
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

## Common mistakes

- Renaming and forgetting to update access rules that reference the old name
  → 500s on every read because the rule references a non-existent column.
- Renaming and forgetting to update frontend code → silent breakage at the
  next React render that touches the field.
- Renaming to a name that clashes with another field on the same collection
  → PB throws "field name must be unique". Pick a different name.
- Renaming to `id`, or to `email` / `password` / `tokenKey` / `verified` /
  `emailVisibility` on an auth collection — reserved system field names. PB
  rejects. Note: `created` / `updated` are reserved only on auth collections
  (where PB manages them); on base collections you own them as `autodate`
  fields and renaming a custom field to `created` would shadow/conflict with
  the autodate pattern — don't.
- Trying to also change the type in the same step. Use UPDATE_FIELD.md for
  property changes; for a type change you have to drop+re-add (and lose
  data) — see REMOVE_FIELD.md + ADD_FIELD.md.
