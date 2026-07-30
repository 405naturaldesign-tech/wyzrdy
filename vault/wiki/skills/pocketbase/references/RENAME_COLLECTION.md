# Rename Collection

## What it preserves

- All records and their IDs (the `pbc_*` collection ID is unchanged, only
  the human-readable name changes).
- All field definitions and data.
- All access rules and indexes.

## What changes

- The REST URL: `/api/collections/{old}/records` → `/api/collections/{new}/records`.
- Filter expressions in OTHER collections that reference this one stay
  consistent because PB stores relations by the collection ID, not name.
- Any frontend code that uses `pb.collection("old")` must be updated.

## Template

```js
// apps/pocketbase/pb_migrations/1729500000_rename_tasks_to_todos.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tasks");
    collection.name = "todos";
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("todos");
      collection.name = "tasks";
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

## Frontend follow-up

After the migration applies, update React code:

```js
// before
await pb.collection("tasks").getFullList();
// after
await pb.collection("todos").getFullList();
```

If you forget this, the call fails with 404 and the agent will spend a turn
debugging it. Grep for `collection('old_name')` in `apps/web/src/` and update
all sites in the same task.

## Common mistakes

- Forgetting to update `pb.collection("...")` calls in `apps/web/src/`.
- Using a name that already exists → PB throws "Collection name must be
  unique". Pick a different name or delete the existing one first.
- Renaming to a system-reserved name like `_users` or `_superusers` → PB
  refuses. Don't prefix with underscore.
- Renaming to a name that contains spaces or special chars → PB enforces
  `^[a-zA-Z0-9_]+$`. Use snake_case.
