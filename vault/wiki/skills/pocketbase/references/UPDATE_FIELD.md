# Update Field Properties

## What this is for

Changing the OPTIONS of an existing field WITHOUT removing/recreating it.
Data is preserved. Use this for:

- `required: true` ↔ `false`
- `min`, `max` (length for text, value for number, date bounds for date)
- `pattern` (text regex)
- `values` (select — add/remove options)
- `maxSelect` (select / file / relation)
- `maxSize` (file, in bytes)
- `cascadeDelete` (relation)
- `onCreate` / `onUpdate` (autodate)

To change the TYPE itself, you have to drop and re-add the field (data
loss) — see `REMOVE_FIELD.md` + `ADD_FIELD.md`.

## Template

```js
// apps/pocketbase/pb_migrations/1729500000_make_email_required.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("contacts");
    const field = collection.fields.getByName("email");
    field.required = true;
    field.max = 200;
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("contacts");
      const field = collection.fields.getByName("email");
      if (!field) {
        console.log("Field not found, skipping revert");
        return;
      }
      // Restore previous values explicitly — the up didn't capture them.
      field.required = false;
      field.max = 0; // 0 means "no limit" for text length
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

**Always read the current value from `<pocketbase_schema>` and bake it into
the down section.** Without it, rollback restores the wrong defaults.

## Adding a value to a select field

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    const field = collection.fields.getByName("status");
    field.values = ["draft", "published", "archived", "scheduled"]; // added "scheduled"
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    const field = collection.fields.getByName("status");
    field.values = ["draft", "published", "archived"];
    app.save(collection);
  },
);
```

## Removing a value from a select field — danger

If existing rows have the value you're about to remove, those rows become
invalid for any future update (the value is no longer in `values`). Run an
`UPDATE_RECORDS.md` migration FIRST that maps the obsolete value to a valid
one, then remove the option.

## Changing a relation's cascadeDelete

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("comments");
    const field = collection.fields.getByName("post");
    field.cascadeDelete = true;
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("comments");
    const field = collection.fields.getByName("post");
    field.cascadeDelete = false;
    app.save(collection);
  },
);
```

## Common mistakes

- Tightening `min`/`max` or `pattern` on a column that has rows violating
  the new constraint — PB applies the schema change but the rows become
  rejected on next save. Audit data first.
- Empty `down` section → cannot meaningfully roll back. Always restore the
  prior values from the schema.
- Trying to change `type` here — not supported, you must drop+re-add.
- Forgetting `app.save(collection)` after mutating field properties — the
  in-memory change is discarded.
- Editing `field.id` or `field.system` — these are immutable. Don't touch.
- **Bool field `required: true` rejects `false`.** This is the single most
  common reason a "fix this field" task gets created. PB treats `false` as
  the field's empty value, so flipping `required` to `true` on a `completed`
  / `verified` / `isPublic` flag breaks every existing row whose value is
  `false`. For toggle-style flags, set `required: false` and leave it that
  way — there is no good reason to require a bool.
- Number field `required: true` rejects `0`. If `0` is a valid value,
  use `required: false`.
