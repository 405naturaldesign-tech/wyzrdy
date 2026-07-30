# Raw SQL (escape hatch)

## When raw SQL is justified

- Bulk update: `UPDATE tasks SET status = 'archived' WHERE …` across
  thousands of rows — looping with `app.save(record)` would trigger full
  validation per row and be ~100× slower.
- Complex multi-table read for a dashboard (e.g. "count posts per category,
  join author").
- Setting app settings or platform-level flags that don't have a collection.

## When NOT to use raw SQL

- Creating/updating a handful of records → use the wrapper.
- Anything that mutates schema (collections, fields, indexes) → always use
  `new Collection` / `collection.fields.add(...)`, never `ALTER TABLE`.
  PocketBase tracks schema in its own meta tables AND in SQLite; editing raw
  SQLite without going through the wrapper desyncs them and breaks the admin
  UI.

## The API

`app.db().newQuery("SQL").execute()` — for non-SELECT.
`app.db().newQuery("SQL").one(DynamicModel)` — for single-row SELECT.
`app.db().newQuery("SQL").all(arrayOf(DynamicModel))` — for multi-row SELECT.

Always bind user/dynamic values with `{:name}` placeholders and `.bind({...})`.
Never string-concatenate values into the SQL.

## Example — bulk UPDATE inside a migration

```js
// apps/pocketbase/pb_migrations/1729500005_archive_old_tasks.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE tasks SET status = 'archived' WHERE due < {:cutoff}")
      .bind({ cutoff: "2024-01-01 00:00:00.000Z" })
      .execute();
  },
  (app) => {
    // Down: we can't recover which rows were archived — leave empty with a note.
  },
);
```

**Important:** raw `$app.db().newQuery(...)` is ONLY available inside
`pb_migrations/*.js` and `pb_hooks/*.pb.js` (JSVM context). The `pocketbase`
Node SDK used by Express has no equivalent.

## Example — binding parameters safely

```js
migrate(
  (app) => {
    const emails = ["a@example.com", "b@example.com", "c@example.com"];

    // Wrong — SQL injection surface:
    // .newQuery(`DELETE FROM users WHERE email IN ('${emails.join("','")}')`)

    // Right — parameterized with IN(...):
    const placeholders = emails.map((_, i) => `{:e${i}}`).join(", ");
    const bind = Object.fromEntries(emails.map((e, i) => [`e${i}`, e]));
    app
      .db()
      .newQuery(`DELETE FROM users WHERE email IN (${placeholders})`)
      .bind(bind)
      .execute();
  },
  (app) => {
    // DELETE is destructive — original rows are gone.
  },
);
```

## SELECT via DynamicModel

```js
const row = new DynamicModel({
  totalPublished: 0,
  totalDraft: 0,
});
app
  .db()
  .newQuery(
    `
    SELECT
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS totalPublished,
      SUM(CASE WHEN status = 'draft'     THEN 1 ELSE 0 END) AS totalDraft
    FROM posts
  `,
  )
  .one(row);
console.log(row.totalPublished, row.totalDraft);
```

## Common mistakes

- Using raw SQL to create or alter collections/fields → desyncs PB's
  metadata. Always use the wrapper for schema.
- String-interpolating user input → SQL injection. Always `{:name}` + `.bind`.
- Expecting raw SQL to fire PocketBase event hooks — it doesn't. Use the
  wrapper if hooks need to run (e.g. search-index updates).
- Assuming raw SQL is faster for everything. For <~100 rows the wrapper's
  overhead is negligible and validation is worth it.
