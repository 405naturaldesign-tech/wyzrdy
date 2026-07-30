---
name: pocketbase
description: >
  Apply PocketBase persistence, auth, realtime, file storage, and access-rule
  guidance for generated apps. Use when adding users, saving data, uploads,
  histories, admin data, or other database-backed behavior.
---

# PocketBase Skill (Hub)

Load this skill when the task involves persistence — users, auth, saving,
lists, history, admin data, uploads, anything "save this to a database".

## Architecture — React talks to PB directly

This project has three tiers, but they are NOT all mandatory:

- `apps/web` — React + Vite.
- `apps/api` — Express. **OPTIONAL.** Only used when the task needs a
  3rd-party API call with a secret key, a webhook receiver, or
  multi-system server-side logic. If Express is not yet provisioned (no
  `## apps/api` section in `CODEBASE.md`), **the coding agent must call
  `enable_api_server_integration`** and wait for its tool result before
  writing any Express code. Do not hand-scaffold Express from this
  skill, and do not defer the decision to the user — the tool is the
  coding agent's to invoke.
- `apps/pocketbase` — the DB + auth + realtime + file server. Only
  exists once `enable_pocketbase_integration` has run. When enabled, the
  tool also installs the `pocketbase` SDK in `apps/web` and drops a
  ready-made client at `apps/web/src/lib/pocketbaseClient.js`. The SDK
  version in `apps/web/package.json` MUST be `>=0.24.0` (the current
  known-good pin is `0.26.9`).

**Default flow:** `apps/web → apps/pocketbase` (direct SDK call). No Express
in the middle for basic CRUD, auth, or realtime — PB already provides all of
that, and its access rules enforce authorization. See
`pocketbase/references/USING_IN_REACT.md`.

**Express escape hatch:** only add a route in `apps/api` when the operation
needs server-only logic (secrets, webhooks, 3rd-party APIs). If Express is
not yet enabled, **the coding agent must call `enable_api_server_integration`**
and wait for its tool result before writing route code. See
`express/references/CONNECTING_TO_POCKETBASE.md`.

## The three hard rules

1. **Default to least privilege. Public is opt-in, not the default.**
   Since `apps/web` calls PocketBase directly with the user's JWT, the
   collection rules ARE the auth layer. The default for any new app
   collection MUST scope every operation to the owner — only the user who
   created a record can list/view/update/delete it. Translate this into:

   ```js
   // Default rules for any user-owned collection. Use these UNLESS the
   // user explicitly asked for "public" / "shared" / "everyone can see"
   // semantics in the prompt.
   listRule:   "@request.auth.id != '' && @request.auth.id = owner",
   viewRule:   "@request.auth.id != '' && @request.auth.id = owner",
   createRule: "@request.auth.id != ''",
   updateRule: "@request.auth.id != '' && @request.auth.id = owner",
   deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
   ```

   This requires every owned collection to declare an `owner` relation
   field pointing at `users` (see the minimum template below). Use
   `""` (anyone, including anonymous) ONLY when the prompt explicitly
   asks for a public read — public form, public landing page, public
   directory, etc. Use `null` (nobody via REST) for collections that
   only server-side superuser code touches. Never default to "any
   logged-in user can see everything" — that's a leak waiting to happen.

2. **Writes = files. Reads = injected schema or read-only API snapshot.**
   - ANY schema change or seed data change must be a new file in
     `apps/pocketbase/pb_migrations/`. Never POST to `/api/collections` at
     runtime to create schema.
   - The current schema is injected into your context as `<pocketbase_schema>`.
     Trust it as the schema at the start of the turn.
   - **If a collection is already listed in `<pocketbase_schema>`, NEVER
     call `new Collection({ name: "<that name>" })` for it.** That throws
     `Collection name must be unique (case insensitive)` and aborts the
     migration. Resolve it with `app.findCollectionByNameOrId("<name>")`
     and continue. This applies to `users` in particular — the template
     ships with a `users` auth collection already provisioned, so almost
     every first-generation migration must `findCollectionByNameOrId("users")`,
     not create it.
   - Do NOT "fix" a unique-name failure by wrapping the failing
     `new Collection(...)` in `try/catch`. Delete it and switch to
     `findCollectionByNameOrId`. The try/catch leaves dead, never-executed
     code in the migration and hides intent.
   - If you need a fresh schema snapshot mid-work (for example after
     `reload_app`, after adding migrations, or when the injected schema is
     missing/ambiguous), use `get_pocketbase_schema`.
3. **Wrapper by default, raw SQL only as an escape hatch.**
   - Use `new Collection({...})`, `app.save(collection)`, `new Record(col)`,
     `record.set(...)`, `app.save(record)` — the PocketBase JS wrapper.
   - Only drop to `app.db().newQuery("...")` for bulk updates or joins the
     wrapper can't express. See `pocketbase/references/RAW_SQL.md`.

## Minimum migration template

```js
// apps/pocketbase/pb_migrations/1729500000_create_tasks.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const collection = new Collection({
      type: "base",
      name: "tasks",
      // Owner-only by default. Switch to "" only if the user explicitly
      // asked for a public/shared collection — see hard rule #1.
      listRule: "@request.auth.id != '' && @request.auth.id = owner",
      viewRule: "@request.auth.id != '' && @request.auth.id = owner",
      createRule: "@request.auth.id != '' ",
      updateRule: "@request.auth.id != '' && @request.auth.id = owner",
      deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
      fields: [
        { name: "title", type: "text", required: true, max: 200 },
        { name: "done", type: "bool" },
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tasks");
    app.delete(collection);
  },
);
```

Filename MUST be `{unix_timestamp}_{short_description}.js`. Pick a timestamp
strictly greater than any existing migration (check `<pocketbase_schema>` or
`ls pb_migrations/`). A safe choice during dev is a large hand-picked number
like `1729500000` + N for the Nth new migration in this task.

After writing migrations, call `reload_app` once — PocketBase applies all
unapplied migrations automatically on `serve` inside a transaction. In case it fails and you need escape hatch - use `npm run migrations:up --workspace=pocketbase-app`.

## Runtime Paths And Debugging

- Migrations: `apps/pocketbase/pb_migrations/`
- Hooks: `apps/pocketbase/pb_hooks/`
- Runtime data: `apps/pocketbase/pb_data/`
- Main database: `apps/pocketbase/pb_data/data.db`
- PocketBase request/error log DB: `apps/pocketbase/pb_data/auxiliary.db`
- PocketBase request/error log table: `_logs`
  Use the injected `<pocketbase_recent_errors>` block when present. It contains
  the latest 5 stored PocketBase entries where `status >= 400` or `level > 0`,
  which filters out noisy successful realtime requests. If a PB request, auth
  flow, hook, or migration behaves unexpectedly after your changes, call
  `get_pocketbase_errors` before guessing. Typical useful fields are `message`,
  `data.status`, `data.error`, `data.details`, `data.url`, and `data.auth`.

Use `get_pocketbase_schema` for the current schema. It reads `pb_data/data.db`
directly with Node's built-in SQLite support and returns full app collections
plus compact summaries for auth-support system collections. It intentionally
excludes `_superusers`.

## Sub-skills (load the ones that match your task)

Each sub-skill is one operation, with a concrete template, the rollback
(`down`) section, and the common-mistake list. Load the 1–3 that match the
task — don't dump them all.

### Foundations (load when relevant)

| File                                      | Load when                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `pocketbase/references/MIGRATIONS.md`     | ANY schema change — load by default for DB tasks                                   |
| `pocketbase/references/USING_IN_REACT.md` | Frontend reads/writes PB (auth, CRUD, realtime) — the default path                 |
| `pocketbase/references/HOOKS.md`          | Server-side reactions (send transactional email, redact fields per request, default fields on insert, brand auth emails, etc.) |
| `pocketbase/references/CUSTOM_SMTP.md`    | User EXPLICITLY wants mail sent from their own address (their Hostinger mail / Gmail / custom-domain SMTP), or "emails go to spam from the default sender" |
| `pocketbase/references/RECORD_OPERATIONS.md` | JSVM record getters, fetching records, and expanding relations in hooks/migrations |
| `pocketbase/references/FIELD_TYPES.md`    | Uncertain about a field (select, relation, file, json, date, geoPoint)             |
| `pocketbase/references/ACCESS_RULES.md`   | Designing rules from scratch ("only X can do Y", per-user access, etc.)            |
| `pocketbase/references/INDEXES.md`        | Designing indexes for a NEW collection ("unique", "no duplicates", hot-path WHERE) |
| `pocketbase/references/RAW_SQL.md`        | Bulk update / complex join the wrapper can't express                               |

### Collection operations

| File                                              | Load when                                          |
| ------------------------------------------------- | -------------------------------------------------- |
| `pocketbase/references/CREATE_COLLECTION.md`      | Creating a new base (non-auth) collection          |
| `pocketbase/references/CREATE_AUTH_COLLECTION.md` | Creating a users / staff / clients auth collection |
| `pocketbase/references/DELETE_COLLECTION.md`      | "Drop the X collection", "remove this table"       |
| `pocketbase/references/RENAME_COLLECTION.md`      | "Rename the X collection to Y"                     |

### Field operations (existing collection)

| File                                    | Load when                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pocketbase/references/ADD_FIELD.md`    | "Add a column", "store the X on Y"                                                            |
| `pocketbase/references/REMOVE_FIELD.md` | "Drop the X column", "deprecate this field"                                                   |
| `pocketbase/references/RENAME_FIELD.md` | "Rename field X to Y", "fix the column-name typo"                                             |
| `pocketbase/references/UPDATE_FIELD.md` | "Make X required", "change min/max", "add a select option", "tighten regex", "change cascade" |

### Rules / indexes on existing collection

| File                                      | Load when                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `pocketbase/references/UPDATE_RULES.md`   | Changing list/view/create/update/delete/manage/auth rule on an existing collection |
| `pocketbase/references/UPDATE_INDEXES.md` | Adding or removing an index on an existing collection                              |

### Records / seeding / data

| File                                      | Load when                                                           |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `pocketbase/references/SEED_DATA.md`      | Pre-populating a collection with specific rows                      |
| `pocketbase/references/UPDATE_RECORDS.md` | "Set status=archived for all old tasks", backfill an existing field |
| `pocketbase/references/DELETE_RECORDS.md` | "Purge inactive users", clean up duplicates by filter               |

### Auth features

| File                                       | Load when                                               |
| ------------------------------------------ | ------------------------------------------------------- |
| `pocketbase/references/OAUTH_PROVIDERS.md` | "Sign in with Google / GitHub / Apple / Discord …"      |
| `pocketbase/references/OTP_AUTH.md`        | "Magic email code", "passwordless", "OTP"               |
| `pocketbase/references/MFA.md`             | "Two-factor", "2FA", "second-factor on top of password" |

## Pitfalls that bite every time

- **Re-creating a collection that's already in `<pocketbase_schema>`.** If
  `users` (or any other collection) appears in the injected schema, a
  `new Collection({ name: "<that name>" })` call will throw
  `name: Collection name must be unique (case insensitive)` and abort the
  whole `up` migration. The fix is NOT to wrap the failing block in
  `try/catch` — the fix is to use
  `app.findCollectionByNameOrId("<name>")` to grab the existing collection,
  then add fields, change rules, or relate other collections to it.

  ```js
  // ❌ WRONG — throws if users already exists, and try/catch only hides it
  const users = new Collection({ type: "auth", name: "users", ... });
  app.save(users);

  // ✅ CORRECT — first-gen template already ships with `users`
  const users = app.findCollectionByNameOrId("users");
  ```

- **Using old `schema` + nested `options` field definitions.** PocketBase
  v0.23+ migrations use `fields`, with field options flattened onto each
  field object. Do NOT write collection definitions with `schema: [...]` and
  `options: { ... }` — that format causes migration errors.

  ```js
  // ❌ WRONG — old/generated shape
  const collection = new Collection({
    type: "base",
    name: "tasks",
    schema: [
      {
        name: "title",
        type: "text",
        required: true,
        options: { max: 200 },
      },
    ],
  });

  // ✅ CORRECT — PocketBase v0.23+ migration shape
  const collection = new Collection({
    type: "base",
    name: "tasks",
    fields: [{ name: "title", type: "text", required: true, max: 200 }],
  });
  ```

- NEVER use `app.dao()` — it does NOT exist in PocketBase v0.23+. This is a
  common hallucination.
- NEVER use `app.dao().findCollectionByNameOrId()` — use
  `app.findCollectionByNameOrId()`.
- NEVER use `app.dao().saveCollection()` — use `app.save()`.
- NEVER use `app.dao().deleteCollection()` — use `app.delete()`.
- NEVER use `app.findCollection()` — use `app.findCollectionByNameOrId()`.
- **Reflexive `required: true` on fields.** `required` is **opt-in**, not
  opt-out. Most fields should NOT be required — the row is usually fine
  with empty descriptions, optional avatars, no due date, etc. Two PB
  semantics that bite hardest:
  - `{ type: "bool", required: true }` rejects `false`. A "completed",
    "verified", "isPublic", "archived" flag with `required: true` will
    fail every "not done yet" / "not verified" insert from the frontend.
    For toggle flags, **always** leave `required` off.
  - `{ type: "number", required: true }` rejects `0`. If `0` is a legal
    count (reviews, score, attempts), leave required off.

    See `pocketbase/references/FIELD_TYPES.md` for the full per-type policy. Decide
    `required` correctly **before** the first `reload_app` — fixing it
    after-the-fact requires a new delta migration via `UPDATE_FIELD.md`.

- **Returning early when a collection already exists** → dangerous in
  combined migrations. If `users` already exists, do NOT `return` from the
  whole migration before creating related collections like `tasks`. Resolve
  the existing collection with `app.findCollectionByNameOrId("users")` and
  continue, or split auth creation and app collection creation into separate
  timestamped migrations.
- **Writing a migration for `_superusers`** → don't. The superuser is
  provisioned by infrastructure during pocketbase enable. `_superusers` is a system collection; do not create,
  read, or seed it from a migration or an app route.
- **Password < 10 chars** → For your own user collections, set `min` to
  whatever you want.
- **Importing `apps/api/src/utils/pocketbaseClient.js` by default** → don't.
  The file exists as an Express escape hatch for server-side PB access, but
  basic CRUD/auth belongs in React via the PB SDK. Import the API client only
  inside route modules that truly need server-side PB access, and keep its
  lazy-auth behavior intact.
- **Adding an Express route for basic CRUD/auth, or for server-side reactions a `pb_hooks/*.pb.js` file can handle** → wrong tier. Use React → PB SDK directly (`pocketbase/references/USING_IN_REACT.md`) or a hook (`pocketbase/references/HOOKS.md`). Only add Express when the task has a clear server-side reason (3rd-party secret, webhook, etc.).
- **File NOT `.js`** → PB ignores it. Always `.js`, lowercase, under
  `apps/pocketbase/pb_migrations/`.
- **Timestamp prefix missing or smaller than the newest applied migration** →
  PB skips it silently. Check existing filenames before picking yours.
- **Changing an already-applied migration file** → PB will NOT re-run it.
  Add a NEW migration that makes the delta.
- **Hardcoding the superuser email/password in frontend** → never. Frontend
  uses user JWTs issued by your own auth collection (usually `users`), never
  the superuser.
- **Defaulting access rules to `""` or "any logged-in user"** → leak.
  `""` means "anyone, including anonymous". `"@request.auth.id != ''"` on
  `listRule` / `viewRule` means "every signed-in user can read every other
  user's records". Both are wrong as a default. Hard rule #1 is
  owner-scoped:
  ```js
  listRule:   "@request.auth.id != '' && @request.auth.id = owner",
  viewRule:   "@request.auth.id != '' && @request.auth.id = owner",
  createRule: "@request.auth.id != ''",
  updateRule: "@request.auth.id != '' && @request.auth.id = owner",
  deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
  ```
  Only loosen to `""` when the user prompt explicitly says public / shared /
  feed / public directory / "everyone can see". When in doubt: keep it
  owner-only. See `pocketbase/references/ACCESS_RULES.md`.
- **Pinning the `pocketbase` SDK below `0.24.0`** → don't. If you need to set the version, use
  `"pocketbase": "^0.26.9"` — or at minimum `>=0.24.0`. Anything older will
  silently break auth and realtime feature.
- **Using `sqlite3` / `psql` / the admin UI** → the sandbox has none of these.
