# Update Access Rules (existing collection)

## What this is

A migration that mutates `collection.listRule`, `viewRule`, `createRule`,
`updateRule`, `deleteRule` on an already-existing collection. PB stores
these as plain strings on the collection model.

For the rule expression syntax itself (`@request.auth.id`, `||`, `&&`,
filter-by-field, etc.), see `ACCESS_RULES.md` — load it together with this
one when crafting non-trivial expressions.

## Rule values reminder

| Value        | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `""`         | Anyone (anonymous included) can perform the op |
| `null`       | Nobody (except superuser server-side)          |
| `"<filter>"` | Per-record check, allow iff truthy             |

## Template

Default target shape: owner-scoped on every rule. Loosen reads (`""`)
ONLY when the user prompt explicitly asked for public/shared semantics.

```js
// apps/pocketbase/pb_migrations/1729500000_tighten_posts_rules.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("posts");
    collection.listRule = "@request.auth.id != '' && @request.auth.id = owner";
    collection.viewRule = "@request.auth.id != '' && @request.auth.id = owner";
    collection.createRule = "@request.auth.id != ''";
    collection.updateRule =
      "@request.auth.id != '' && @request.auth.id = owner";
    collection.deleteRule =
      "@request.auth.id != '' && @request.auth.id = owner";
    app.save(collection);
  },
  (app) => {
    // Restore the previous values exactly as they were before this migration.
    // Read them out of <pocketbase_schema> for the live collection and bake
    // them in here. Do not leave the down empty for a rules change — a
    // rollback that erases rules can expose private data.
    try {
      const collection = app.findCollectionByNameOrId("posts");
      collection.listRule = "";
      collection.viewRule = "";
      collection.createRule = null;
      collection.updateRule = null;
      collection.deleteRule = null;
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

## Updating only one rule

Only mutate the rules you actually want to change. Leave the rest alone.

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("comments");
    collection.deleteRule =
      "@request.auth.id != '' && (@request.auth.id = owner || @request.auth.role = 'admin')";
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("comments");
    collection.deleteRule =
      "@request.auth.id != '' && @request.auth.id = owner";
    app.save(collection);
  },
);
```

## Auth-collection extras

Auth collections also have `manageRule` (admin-style override that lets the
caller change another user's password without supplying the old one) and
`authRule` (extra constraint after primary auth, e.g. `verified = true`).

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.manageRule = "@request.auth.role = 'admin'";
    collection.authRule = "verified = true";
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("users");
    collection.manageRule = null;
    collection.authRule = "";
    app.save(collection);
  },
);
```

## Operator and quoting reminders

- Use `||` / `&&` — not `OR` / `AND`.
- String literals use single quotes: `'admin'`, not `"admin"`.
- Do NOT escape quotes in the JS string. Use the JS template `\`...\`` if
  the rule contains both kinds of quotes, or just stick to single quotes
  inside the rule and double quotes for the JS literal.
- No SQL subqueries inside rules. Use dot-notation through relations:
  `category.published = true`.

## Common mistakes

- **Loosening reads to `""` or `"@request.auth.id != ''"` without an
  explicit prompt request.** Those expose every user's records to anyone
  / every other user. The default target is owner-scoped (see template
  above) — don't relax it to be helpful.
- Empty `down` body → rollback wipes the rules to whatever the JS literal
  defaults are (often `""`/`null`), which can expose data. Always restore
  prior values explicitly.
- Pasting JS conditionals (`===`, `true`, `null`) into the rule string —
  rule language uses `=`, single-quoted literals, and `field = null` for
  null checks.
- Referencing a field that doesn't exist (typo or recently renamed) →
  every request to the collection 500s with "no such column".
- Setting `listRule = ""` on `users` → publishes everyone's email. Default
  to `id = @request.auth.id` unless you genuinely want a public roster.
