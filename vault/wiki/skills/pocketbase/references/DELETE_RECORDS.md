# Delete Records by Filter

## Warning

**Permanent.** No automatic recovery from `down` — the row data is gone

## Template

```js
// apps/pocketbase/pb_migrations/1729500000_purge_completed_todos.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let records;
    try {
      records = app.findRecordsByFilter(
        "todos",
        "completed = true && updated < '2024-06-01'",
      );
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Nothing to delete");
        return;
      }
      throw e;
    }

    for (const record of records) {
      app.delete(record);
    }
  },
  (app) => {
    // Cannot recreate the deleted rows — original data is gone.
  },
);
```

## Delete a single record by id

```js
const record = app.findRecordById("todos", "abc123def456789");
app.delete(record);
```

## Cascade behavior

If the records you're deleting are referenced by relation fields in OTHER
collections:

- If those relation fields have `cascadeDelete: true`, dependent records
  are auto-deleted by PB.
- If those relation fields have `cascadeDelete: false`, the delete fails.
  PocketBase will not silently null the relation or leave dangling references.
  Remove references first, then delete the target records. If the relation is
  required, delete the dependent records instead.

## Remove references before deleting

For `cascadeDelete: false`, clean dependent relations in the same migration
before calling `app.delete(...)` on the referenced records.

If the dependent relation field is optional, clear it first:

```js
migrate(
  (app) => {
    const completedTodos = app.findRecordsByFilter(
      "todos",
      "completed = true && updated < '2024-06-01'",
    );

    for (const todo of completedTodos) {
      const comments = app.findRecordsByFilter("comments", `todo = '${todo.id}'`);
      for (const comment of comments) {
        comment.set("todo", "");
        app.save(comment);
      }

      app.delete(todo);
    }
  },
  (app) => {
    // Cannot recreate the deleted rows or their cleared references.
  },
);
```

If the dependent relation field is required, delete the dependent/reference
records first because `comment.set("todo", "")` would fail validation:

```js
migrate(
  (app) => {
    const completedTodos = app.findRecordsByFilter(
      "todos",
      "completed = true && updated < '2024-06-01'",
    );

    for (const todo of completedTodos) {
      const comments = app.findRecordsByFilter("comments", `todo = '${todo.id}'`);
      for (const comment of comments) {
        app.delete(comment);
      }

      app.delete(todo);
    }
  },
  (app) => {
    // Cannot recreate the deleted todos or dependent comments.
  },
);
```

For optional multi-relation fields, remove only the deleted id from the array
and save the dependent record before deleting the target record. For required
multi-relation fields where removing the id would violate `minSelect`, delete
or reassign the dependent record first.

## Delete ALL rows in a collection (without dropping the collection)

```js
const records = app.findRecordsByFilter("temp_data", "id != ''");
for (const r of records) {
  app.delete(r);
}
```

If you also want the collection schema gone, use `DELETE_COLLECTION.md`
instead.

## Common mistakes

- Filter expression that matches more than expected — test by reading
  count first (`findRecordsByFilter` then `.length`) before adding the
  delete loop. Especially `id != ''` matches everything.
- Deleting a record that's referenced by a relation with `cascadeDelete: false`
  → migration fails. Clear optional dependent relation fields first, delete
  dependent records when the relation is required, or explicitly change the
  relation to `cascadeDelete: true` in an `UPDATE_FIELD.md` migration if
  dependent records should be deleted too.
- Calling `app.delete("todos", "id123")` — wrong signature. `app.delete`
  takes the record model, not a name + id. Always `findRecordById` first.
