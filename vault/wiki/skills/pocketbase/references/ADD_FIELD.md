# Add Field to Collection

## Pattern

```js
const collection = app.findCollectionByNameOrId("name");
collection.fields.add(new XField({ name, ...options }));
app.save(collection);
```

The constructor matches the type: `TextField`, `NumberField`, `BoolField`,
`EmailField`, `URLField`, `DateField`, `AutodateField`, `SelectField`,
`FileField`, `JSONField`, `RelationField`, `EditorField`, `GeoPointField`.

## Idempotent template (recommended)

Defends against re-runs after `pb_data/` resets and against partial-state
recovery if a previous run failed mid-way. Skip if the field already exists
with the right type; remove and re-add if the type changed.

```js
// apps/pocketbase/pb_migrations/1729500000_add_due_to_tasks.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tasks");

    const existing = collection.fields.getByName("due");
    if (existing) {
      if (existing.type === "date") return; // correct type already, skip
      collection.fields.removeByName("due"); // wrong type, replace
    }

    collection.fields.add(
      new DateField({
        name: "due",
        required: false,
      }),
    );
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("tasks");
      collection.fields.removeByName("due");
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

## Adding a relation field

Resolve the target collection first to get its ID — don't hardcode `pbc_*`
IDs into migrations:

```js
migrate(
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
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    collection.fields.removeByName("author");
    app.save(collection);
  },
);
```

## Adding a select field

```js
collection.fields.add(
  new SelectField({
    name: "status",
    required: true,
    maxSelect: 1,
    values: ["draft", "published", "archived"],
  }),
);
```

## Adding a file field

```js
collection.fields.add(
  new FileField({
    name: "cover",
    maxSelect: 1,
    maxSize: 5242880, // 5 MB
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    thumbs: ["100x100", "400x300"],
  }),
);
```

## Adding an autodate field

```js
collection.fields.add(
  new AutodateField({
    name: "lastSeenAt",
    onCreate: false,
    onUpdate: true,
  }),
);
```

### Backfilling `created` / `updated` on an existing base collection

If an older migration created a base collection without `created` / `updated`
(PB does NOT auto-add them on `type: "base"`), frontends that sort by
`-created` will 400. Add them in a follow-up migration:

```js
collection.fields.add(
  new AutodateField({
    name: "created",
    onCreate: true,
    onUpdate: false,
  }),
);
collection.fields.add(
  new AutodateField({
    name: "updated",
    onCreate: true,
    onUpdate: true,
  }),
);
```

Existing rows get the current timestamp as their backfill value.

## NUMBER fields — the `required` gotcha

For `number`, `required: true` means **non-zero** validation, not just
"present". A `required: true` number field rejects `0` as invalid input. If
you want "present and ≥ 0", use `required: true, min: 0` AND know that 0
itself will be rejected — choose `required: false, min: 0` if 0 is a valid
business value. Always set `required: true` when `min > 0`.

## Common mistakes

- Adding a field with the same name as an existing one → PB error. Use the
  idempotent template above (`getByName` check).
- Forgetting to call `app.save(collection)` after `add(...)` — the change
  doesn't persist.
- Hardcoding `collectionId` as a string `"pbc_1234..."` — IDs differ between
  environments. Always `findCollectionByNameOrId(...).id`.
- Trying to add `id` → PB rejects, `id` is the only truly reserved system
  field. `created` / `updated` are NOT reserved on base collections — you
  own them, and you MUST add them as `autodate` fields if they were omitted
  in the create migration (see "Backfilling" above).
- On `type: "auth"` collections, PB already provides `created` / `updated` —
  re-adding them there WILL be rejected. Check the injected
  `<pocketbase_schema>` before adding.
- Adding `required: true` on a column to a collection that already has rows
  with no value for that column → PB applies the field but existing rows
  are now invalid for the next update. Use `required: false`, backfill
  with a separate update_records migration, then a follow-up update_field
  migration to flip `required` to `true`.
