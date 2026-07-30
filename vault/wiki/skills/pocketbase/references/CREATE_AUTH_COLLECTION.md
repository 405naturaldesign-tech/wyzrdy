# Create Auth Collection

## READ THIS FIRST — `users` already exists in this template

The first-generation template **ships with a `users` auth collection already
provisioned** (system fields `id` / `email` / `password` / `tokenKey` /
`emailVisibility` / `verified` / `created` / `updated`, plus a `name` text
field and an `avatar` file field). It WILL appear in the injected
`<pocketbase_schema>`. The single most common failure mode in this skill is
ignoring that and writing a migration that calls
`new Collection({ type: "auth", name: "users", ... })` anyway. PocketBase
rejects it on apply with `name: Collection name must be unique
(case insensitive)`.

The fix is **not** `try/catch` around the failing `new Collection(...)` —
that just hides dead code in the migration. The fix is to delete the
`new Collection(...)` block entirely and resolve the existing collection:

```js
const users = app.findCollectionByNameOrId("users");
```

Then continue with whatever the migration actually needs: add fields to
`users` (`users.fields.add(new TextField({ name: "bio" }))`), tighten
rules, seed records, or create related collections like `tasks` with an
`owner` relation pointing at `users.id`.

Only fall back to `new Collection({ type: "auth", name: "users", ... })`
in the rare case where `<pocketbase_schema>` genuinely does NOT list a
`users` collection (e.g. you previously deleted it). Use the
`findCollectionByNameOrId` + create-on-NotFound pattern below for that.

## PocketBase auth basics

- An auth collection is a collection with `type: "auth"`. It adds
  system fields: `email`, `emailVisibility`, `verified`, `tokenKey`,
  `password` (hashed), plus the usual `id`, `created`, `updated`.
- Login happens via `pb.collection(name).authWithPassword(email, pw)` from
  React (client-side pattern; see `pocketbase/references/USING_IN_REACT.md`).
- Prefer one `users` collection with a `role` field to distinguish roles,
  permissions, and portals. When adding new user types, extend that schema
  instead of creating another auth-type collection; add a separate auth
  collection only when types genuinely cannot share one schema.

## Canonical template — find-or-create

This is the template you should imitate for ANY auth collection migration,
including changes to the pre-existing `users` collection. It guards against
the unique-name failure and lets the same migration run on a fresh DB and
on the shipped template.

```js
// apps/pocketbase/pb_migrations/1729500000_users_setup.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let users;
    try {
      users = app.findCollectionByNameOrId("users");
    } catch (_) {
      users = new Collection({
        type: "auth",
        name: "users",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "", // public sign-up allowed; set null to disable
        updateRule: "id = @request.auth.id",
        deleteRule: "id = @request.auth.id",
        fields: [{ name: "name", type: "text", max: 100 }],
        passwordAuth: { enabled: true },
        authAlert: { enabled: false },
      });
      app.save(users);
    }

    // From here use `users` for whatever this migration actually needs:
    // add a profile field, tighten rules, seed records, or create related
    // collections that relation-link to `users.id`.
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      app.delete(users);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
```

The `<pocketbase_schema>` in this template already lists `users` with `name`
and `avatar` — meaning the `try` branch is the path that will execute on a
real first-generation run. The `new Collection(...)` block is only here for
safety after a manual schema reset.

## With a role field (staff vs regular user)

Same find-or-create shape. Add the `role` field to the existing collection
when `users` is already there; only declare it inline on the brand-new
create path.

```js
migrate(
  (app) => {
    let users;
    try {
      users = app.findCollectionByNameOrId("users");
      if (!users.fields.getByName("role")) {
        users.fields.add(
          new SelectField({
            name: "role",
            required: true,
            maxSelect: 1,
            values: ["member", "staff", "admin"],
          }),
        );
        app.save(users);
      }
    } catch (_) {
      users = new Collection({
        type: "auth",
        name: "users",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: null,
        fields: [
          { name: "name", type: "text", max: 100 },
          {
            name: "role",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["member", "staff", "admin"],
          },
        ],
        passwordAuth: { enabled: true },
        authAlert: { enabled: false },
      });
      app.save(users);
    }

    // Seed a known-good admin for local testing. Remove/adjust for prod.
    try {
      app.findAuthRecordByEmail("users", "admin@example.com");
    } catch (_) {
      const admin = new Record(users);
      admin.setEmail("admin@example.com");
      admin.setPassword("macbookpro");
      admin.set("name", "admin");
      admin.set("role", "admin");
      app.save(admin);
    }
  },
  (app) => {
    try {
      const admin = app.findAuthRecordByEmail("users", "andrius@example.com");
      app.delete(admin);
    } catch (_) {
      /* already gone */
    }
  },
);
```

Seeding auth records uses `record.setEmail(...)` + `record.setPassword(...)`
(which hashes), plus normal `record.set(...)` for the extra fields. See
`SEED_DATA.md`.

## OTP-only collection (example)

```js
migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("clients");
    } catch (_) {
      collection = new Collection({
        type: "auth",
        name: "clients",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: null,
        fields: [{ name: "company", type: "text", required: true, max: 100 }],
        passwordAuth: { enabled: false },
        authAlert: { enabled: false },
        otp: { enabled: true },
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("clients");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
```

For dedicated guides on auth features (extras you can layer on top), load
the matching skill:

- `OTP_AUTH.md` — passwordless or hybrid email-code login
- `MFA.md` — second-factor (2FA) on top of password
- `OAUTH_PROVIDERS.md` — Google, GitHub, Apple, … social login
- `HOOKS.md` — customize subject/HTML of the built-in password-reset / verification / OTP / authAlert emails

## Auth-collection options reference

| Option                        | What it controls                                                                                                   | Default                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `passwordAuth.enabled`        | Allow `authWithPassword`                                                                                           | `true`                                                 |
| `passwordAuth.identityFields` | Allow `authWithPassword(username, …)` instead of email if identityFields contain `["username"]`                    | `["email"]`                                            |
| `otp.enabled`                 | Allow OTP login (see `OTP_AUTH.md`)                                                                                | `false`                                                |
| `mfa.enabled`                 | Require second factor (see `MFA.md`)                                                                               | `false`                                                |
| `manageRule`                  | Filter — who can call admin-style record updates (e.g. change another user's password without knowing the old one) | `null`                                                 |
| `authRule`                    | Filter applied AFTER primary auth, e.g. `verified = true` to require email confirmation                            | `null` (any auth record allowed once it authenticates) |
| `authAlert.enabled`           | Email user on new-device login                                                                                     | `true`                                                 |
| `oauth2.enabled`              | Allow OAuth2 sign-in (see `OAUTH_PROVIDERS.md`)                                                                    | `false`                                                |

Note: `_superusers` (the built-in admin collection) enforces a stricter
`minPasswordLength` of **10**. The user collections you create can use any
value you set on password field and specifying `min` (default 8).

## Full create with extra options

```js
migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("users");
    } catch (_) {
      collection = new Collection({
        type: "auth",
        name: "users",
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: "",
        updateRule: "id = @request.auth.id",
        deleteRule: "id = @request.auth.id",

        // Require verified email before login is allowed.
        authRule: "verified = true",

        // Admins can update any user's password without the old one.
        manageRule: "@request.auth.collectionName = 'admins'",

        passwordAuth: { enabled: true },

        // Do not email user when they sign in from a new device.
        authAlert: { enabled: false },

        fields: [{ name: "name", type: "text", max: 100 }],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");
      app.delete(collection);
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

## Rules for auth collections

The default rule pattern `id = @request.auth.id` means "only the user
themselves can read/update their own record". Tighten or relax to match the
app:

- Public profile listing: `listRule: ""`, `viewRule: ""`.
- Admin-only management: `listRule: "@request.auth.role = 'admin'"` (requires
  `role` field in the auth record the caller is signed in as).
- No self-delete: `deleteRule: null`.

See `ACCESS_RULES.md` for full expression syntax.

## Common mistakes

- **Calling `new Collection({ type: "auth", name: "users", ... })` when
  `users` is already in `<pocketbase_schema>`.** This is the #1 failure
  in this skill. PB throws `name: Collection name must be unique
(case insensitive)` and the entire `up` migration is rolled back.
  Fix: use the find-or-create template above. Wrapping the failing
  `new Collection(...)` in `try/catch` to "swallow" the error is wrong —
  it leaves dead code in the file and the agent reading it later cannot
  tell which branch is the intended path.
- Catching `Collection name must be unique` and `return`ing from a migration
  that still has more work to do. This is how apps end up with `users` but no
  `tasks`. Find the existing collection and continue.
- Leaving `passwordAuth: { enabled: false }` AND no other auth options `otp: { enabled: false }` →
  no way to authenticate. At least one must be enabled.
- Using `email` / `password` as custom field names — they are system fields
  on auth collections, auto-added. Do not re-declare.
- Using `record.set("password", "...")` without `record.setPassword(...)` —
  the raw `set` stores plaintext and breaks auth. Always use `setPassword`.
- `listRule` / `viewRule` = `""` on a user collection exposes everyone's
  emails publicly. Default to `id = @request.auth.id` unless you genuinely
  want a public roster.
