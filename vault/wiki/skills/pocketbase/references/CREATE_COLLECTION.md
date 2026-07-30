# Create Collection (base)

## Minimum create

Owner-scoped by default (see hub `SKILL.md` hard rule #1). The `owner`
relation field plus the matching rules give the user-only semantics; the
frontend MUST send `owner: pb.authStore.record.id` on `create`.

```js
// apps/pocketbase/pb_migrations/1729500000_create_notes.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("notes");
    } catch (_) {
      const users = app.findCollectionByNameOrId("users");
      collection = new Collection({
        type: "base",
        name: "notes",
        // Owner-only defaults. Loosen reads to "" ONLY when the user
        // prompt explicitly asked for public/shared semantics.
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.id = owner",
        deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
        fields: [
          { name: "title", type: "text", required: true, max: 200 },
          { name: "body", type: "text" },
          {
            name: "owner",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
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
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("notes");
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

## `created` / `updated` — YOU must declare them on base collections

For `type: "base"` collections, PocketBase only auto-adds `id`. It does NOT
auto-add `created` or `updated`. If you skip them, any frontend call like
`getFullList({ sort: '-created' })` or filter like `created > '2024-01-01'`
will 400 with "Something went wrong" because the columns don't exist.

ALWAYS include these two `autodate` fields in every base collection:

```js
{ name: "created", type: "autodate", onCreate: true, onUpdate: false },
{ name: "updated", type: "autodate", onCreate: true, onUpdate: true },
```

(Auth collections — `type: "auth"` — are different: PB auto-adds `created`
and `updated` for you. See `CREATE_AUTH_COLLECTION.md`. Don't re-declare them
there.)

## Idempotency without stopping later work

When creating a collection, check for the existing collection before creating
it. Do not catch `Collection name must be unique` and `return` from the whole
`up` function if the migration still needs to create fields, records, indexes,
or other collections afterwards.

Without the existing-collection guard:

- Re-creating an existing collection throws `Collection name must be unique`
  and aborts the apply chain.
- Reverting a not-yet-created collection throws `no rows in result set` and
  the down migration fails.

Bake the "find existing, otherwise create" pattern into every create migration.
Use `return` only when the current migration has no later work to perform.

## Full example with relation, index, and rules

Owner-only writes; reads are also owner-only (least privilege). To turn
this into a "public posts" collection — only when the user asked for
that — change `listRule` and `viewRule` to `""` and leave the rest
unchanged. See `ACCESS_RULES.md` for the full recipe library.

```js
// apps/pocketbase/pb_migrations/1729500000_create_posts.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const collection = new Collection({
      type: "base",
      name: "posts",
      listRule: "@request.auth.id != '' && @request.auth.id = owner",
      viewRule: "@request.auth.id != '' && @request.auth.id = owner",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && @request.auth.id = owner",
      deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
      fields: [
        { name: "title", type: "text", required: true, max: 200 },
        { name: "body", type: "editor" },
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["draft", "published"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_posts_status ON posts (status)",
        "CREATE INDEX idx_posts_owner ON posts (owner)",
      ],
    });
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    app.delete(collection);
  },
);
```

## Field shorthand vs explicit class

Both work. Shorthand object literals (`{ name, type, required, ... }`) are
enough for most cases. Use explicit `new TextField({...})`, `new DateField({...})`,
etc. when you want the type-check of the JSVM class or when an option is not
obvious (see `FIELD_TYPES.md`).

## Rules cheat sheet

| Value               | Meaning                                            |
| ------------------- | -------------------------------------------------- |
| `""` (empty string) | Anyone can perform this operation                  |
| `null`              | Nobody can (except superuser via server-side code) |
| A filter            | Per-record check, e.g. `@request.auth.id = owner`  |

Default for any owned collection: owner-scoped on every rule. Never
default to `""` for `list` / `view` / `create` / `update` / `delete` —
only loosen reads when the prompt explicitly says public / shared /
"everyone can see". See `ACCESS_RULES.md` for the full recipe library
and expression syntax.

## Common mistakes

- Forgetting to declare `created` / `updated` autodate fields on a base
  collection. PB does NOT add them implicitly for `type: "base"`. The frontend
  then 400s on `sort: '-created'` / `sort: '-updated'` and any
  `created > 'date'` filter. Always include both autodate fields (see the
  template above).
- Returning from the whole migration when a collection already exists. In a
  combined migration, this skips later collections or seed data. Find the
  existing collection and continue, or split the work into separate migrations.
- Creating an `id` field manually → PB refuses with a "reserved system field"
  error. Only `id` is truly reserved; `created` / `updated` are regular
  `autodate` fields you own and must declare on base collections.
- **Defaulting reads to `""` or "any logged-in user".** Both expose every
  user's records to every other user. Use the owner-scoped template above
  unless the prompt explicitly asked for public / shared / feed semantics.
- **Declaring an owner/author field as `text` when it should be `relation`** —
  storing the creator ID as `type: "text"` instead of `type: "relation"` is a
  common mistake. It silently works for data storage but breaks access rules:
  any rule using dot notation (`author.id`, `owner.id`) will fail at migration
  time with `field "author" is not a valid relation — invalid right operand`.
  Dot traversal only works on `type: "relation"` fields. Always declare
  ownership fields as a relation pointing at the users collection:
  ```js
  const users = app.findCollectionByNameOrId("users");
  { name: "owner", type: "relation", required: true,
    maxSelect: 1, collectionId: users.id, cascadeDelete: true }
  ```
  The rule `@request.auth.id = owner` then works without dot notation
  (PocketBase compares the relation's referenced id automatically).
- Relation `collectionId` pointing at a collection that doesn't exist yet →
  run that migration FIRST (earlier timestamp), or use
  `app.findCollectionByNameOrId("name").id` in this migration.
- `listRule: null` when the app expects users to read the data from the
  frontend (via Express) — not fatal (Express uses superuser), but tighten
  the rule to what the app really needs.
- Indexes referencing a column name that doesn't match the field name — the
  index body must use the actual DB column name, which is the field `name`.
