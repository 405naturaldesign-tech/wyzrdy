# Update Records by Filter

## When to use this vs raw SQL

- `app.findRecordsByFilter("col", "expr")` + loop + `r.set` + `app.save(r)`:
  goes through PB validation, fires hooks, hashes passwords, etc.
  Use for **<~1000 rows** and any case where validation matters.
- Raw `app.db().newQuery("UPDATE ...").execute()`: bypasses validation, no
  hooks. Use for **bulk** updates (>~1000 rows) or pure-SQL transforms.
  See `RAW_SQL.md`.

## Template — wrapper-style (validated)

```js
// apps/pocketbase/pb_migrations/1729500000_archive_stale_tasks.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let records;
    try {
      records = app.findRecordsByFilter(
        "tasks",
        "due < '2024-01-01' && status != 'archived'",
      );
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("No matching records, nothing to update");
        return;
      }
      throw e;
    }

    for (const record of records) {
      record.set("status", "archived");
      record.set("archivedAt", new Date().toISOString());
      app.save(record);
    }
  },
  (app) => {
    // The original status per row isn't stored anywhere; Leave a note and accept that this
    // migration is one-way unless you can derive the prior state.
  },
);
```

## Reversible variant — when the prior value is derivable

If you're swapping a known value `A → B` (not "compute new from old"), the
down section can swap `B → A` for the same filter set. Always write a real
`down` when you can — the empty-down variant above is only justified when
the prior state genuinely can't be recovered.

```js
// apps/pocketbase/pb_migrations/1729500000_normalize_status_legacy_to_pending.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const records = app.findRecordsByFilter("tasks", "status = 'legacy'");
    for (const r of records) {
      r.set("status", "pending");
      app.save(r);
    }
  },
  (app) => {
    const records = app.findRecordsByFilter("tasks", "status = 'pending'");
    // WARNING: this also flips rows that were 'pending' before this migration
    // ran.
    for (const r of records) {
      r.set("status", "legacy");
      app.save(r);
    }
  },
);
```

## Updating a single record by id with full migration

If you know the exact id (rare in migrations, more common in hooks):

```js
// apps/pocketbase/pb_migrations/1729500000_mark_task_done.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const record = app.findRecordById("tasks", "abc123def456789");

    record.set("status", "done");

    app.save(record);
  },
  (app) => {
    try {
      const record = app.findRecordById("tasks", "abc123def456789");

      // Restore the known previous value. If the old value wasn't known,
      // this migration should document that rollback is manual.
      record.set("status", "pending");

      app.save(record);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Task abc123def456789 not found, skipping revert");
        return;
      }
      throw e;
    }
  },
);
```

## Resolving relations with the `_lookup` pattern

When the value to set is a relation, find the target record by filter
INSIDE the migration — never hardcode an ID:

```js
migrate(
  (app) => {
    const adminUser = app.findFirstRecordByFilter(
      "users",
      "email = 'admin@example.com'",
    );
    if (!adminUser) throw new Error("admin user missing — seed it first");

    const records = app.findRecordsByFilter("tasks", "owner = ''");
    for (const record of records) {
      record.set("owner", adminUser.id);
      app.save(record);
    }
  },
  (app) => {
    // Reset only the rows we just touched, identified by the same admin owner.
    // (Anything that legitimately had this owner before this migration will
    // also be cleared — accept that risk
    try {
      const adminUser = app.findFirstRecordByFilter(
        "users",
        "email = 'admin@example.com'",
      );
      if (!adminUser) return;
      const records = app.findRecordsByFilter(
        "tasks",
        `owner = '${adminUser.id}'`,
      );
      for (const record of records) {
        record.set("owner", "");
        app.save(record);
      }
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("No matching records, skipping revert");
        return;
      }
      throw e;
    }
  },
);
```

## Filter expression syntax

Same syntax as access rules: `=`, `!=`, `>`, `<`, `>=`, `<=`, `~` (LIKE),
`!~` (NOT LIKE), `&&`, `||`. String literals in single quotes. Date
literals: `'2024-01-01'` or `'2024-01-01 12:00:00.000Z'`.

```js
"status = 'pending' && created < '2024-06-01'";
"name ~ 'iPhone'";
"category.published = true"; // dot through a relation
"id != ''"; // matches every row
```

## Updating ALL rows

Use a tautology filter (`id != ''`) only when the rollback is manual or the
previous value is irrelevant. For reversible migrations, filter by the known
previous value in the up migration too:

```js
// apps/pocketbase/pb_migrations/1729500000_update_all_product_currency.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const records = app.findRecordsByFilter("products", "currency = 'EUR'");

    for (const record of records) {
      record.set("currency", "USD");
      app.save(record);
    }
  },
  (app) => {
    const records = app.findRecordsByFilter("products", "currency = 'USD'");

    for (const record of records) {
      record.set("currency", "EUR");
      app.save(record);
    }
  },
);
```

## Performance note

`findRecordsByFilter` loads ALL matching rows into memory before iterating.
For very large tables, batch with `getList` paging or drop down to raw SQL.

## Common mistakes

- Forgetting `app.save(record)` — the in-memory `set` is discarded.
- Calling `record.set("password", "raw")` on auth records — stores plaintext
  as the hash. Use `record.setPassword("raw")` instead.
- Hardcoding relation IDs — they differ across environments. Always look up
  by a stable field (`name`, `email`, `slug`).
- Updating a column that has a unique index, on multiple rows, to the same
  value → second-and-onward saves fail. Catch `Value must be unique` and
  decide per-case.
- Empty `down` body for a one-shot data backfill is acceptable — note it
  with a comment so future readers know rollback is manual.
- Filter expressions that reference a non-existent column → PB throws
  "no such column" at execute time, migration aborts.
