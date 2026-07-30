# Field Types

## `required` is opt-in, not opt-out

**Default to `required: false` (or omit the key entirely) on every field.**
Only set `required: true` when the row literally cannot exist with that field
empty. PocketBase's "required" semantics are **per-type and counter-intuitive**:
several field types reject the natural zero/empty value when `required` is on.

| Type              | Default `required`                                                | Why                                                                |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `text`            | only for titles / names / body the row is meaningless without     | empty string `""` is otherwise accepted                            |
| `bool`            | **NEVER**                                                         | `required: true` on `bool` rejects `false` — see the footgun below |
| `number`          | only when `0` is not an acceptable value                          | `0` is rejected when required                                      |
| `relation`        | yes when ownership is essential (`owner`, `author`)               | otherwise leave optional                                           |
| `select` (single) | yes when no value would mean "broken row" (`status`, `role`)      | leave optional otherwise                                           |
| `select` (multi)  | almost never                                                      | empty array `[]` is usually a valid state                          |
| `file`            | almost never                                                      | uploads are typically optional                                     |
| `email` / `url`   | only when presence is essential (system-required on `auth.email`) | empty string accepted otherwise                                    |
| `date`            | only when the row is meaningless without a date                   |                                                                    |
| `json`            | almost never                                                      | empty object/array is usually fine                                 |
| `autodate`        | n/a                                                               | PB always populates it; `required` is ignored                      |

### Footgun: `required: true` on `bool` rejects `false`

This is the single most common migration bug in this template.

```js
// ❌ WRONG — for a "completed" / "verified" / "isPublic" / "archived" flag.
//          PB rejects `false` because false is the field's empty/zero value.
{ name: "completed", type: "bool", required: true }

// ✅ CORRECT — natural false-default works on create, true on toggle.
{ name: "completed", type: "bool" }
```

Only mark a `bool` required when `false` is a meaningful, explicit choice that
must be set by the user — which is rare. For task-completion, post-publication,
verified, archived, public/private flags, etc., **always** leave it optional.

## All field types

| Type       | When to use                                | Key options                                                |
| ---------- | ------------------------------------------ | ---------------------------------------------------------- |
| `text`     | Short strings, titles, names               | `min`, `max`, `pattern` (regex)                            |
| `editor`   | Rich HTML content (WYSIWYG)                | `maxSize` (bytes)                                          |
| `number`   | Integers or floats                         | `min`, `max`, `onlyInt`                                    |
| `bool`     | true/false                                 | — (do NOT set `required: true`)                            |
| `email`    | Validated email strings                    | `exceptDomains`, `onlyDomains`                             |
| `url`      | Validated URLs                             | `exceptDomains`, `onlyDomains`                             |
| `date`     | Dates / datetimes (ISO 8601)               | `min`, `max`                                               |
| `autodate` | Auto-set timestamp on create and/or update | `onCreate`, `onUpdate`                                     |
| `select`   | Fixed set of values                        | `values: [...]`, `maxSelect`                               |
| `relation` | Foreign key to another collection          | `collectionId`, `maxSelect`, `cascadeDelete`, `minSelect`  |
| `file`     | Uploads (images, docs)                     | `maxSelect`, `maxSize`, `mimeTypes`, `thumbs`, `protected` |
| `json`     | Arbitrary structured data                  | `maxSize`                                                  |
| `geoPoint` | Lat/lng pairs                              | —                                                          |

## Object literal vs class

Both work. Prefer object literal for simple fields; use the `new XField({})`
class form when you want explicit typing or when the options are unusual.

```js
// Literal (preferred for brevity)
{ name: "title", type: "text", required: true, max: 200 }

// Class (equivalent)
new TextField({ name: "title", required: true, max: 200 })
```

## Concrete examples

### Relation

```js
const users = app.findCollectionByNameOrId("users");

// in fields: [...]
{
  name: "author",
  type: "relation",
  required: true,
  maxSelect: 1,              // single relation
  collectionId: users.id,
  cascadeDelete: true,       // delete this record when the user is deleted
}

// Many-to-many (multiple tags per post)
{
  name: "tags",
  type: "relation",
  maxSelect: 10,             // or a large number for "unlimited"
  collectionId: tagsCollection.id,
}
```

### Select (single or multi)

```js
{
  name: "status",
  type: "select",
  required: true,
  maxSelect: 1,              // single-select → stored as string
  values: ["draft", "published", "archived"],
}

{
  name: "categories",
  type: "select",
  maxSelect: 5,              // multi-select → stored as JSON array
  values: ["news", "sports", "tech", "food"],
}
```

### File (single image with thumbnails)

```js
{
  name: "cover",
  type: "file",
  maxSelect: 1,
  maxSize: 5242880,                          // 5 MB
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  thumbs: ["100x100", "400x300"],              // PB will generate on-demand
}

// Multiple files (up to 10)
{
  name: "gallery",
  type: "file",
  maxSelect: 10,
  maxSize: 10485760,
  mimeTypes: ["image/jpeg", "image/png"],
}
```

### Date / Autodate

```js
// User-editable date (e.g. due date)
{ name: "due", type: "date" }

// Canonical created / updated timestamps — MUST be declared on every
// base collection (PB does NOT add them implicitly for type: "base").
{ name: "created", type: "autodate", onCreate: true,  onUpdate: false }
{ name: "updated", type: "autodate", onCreate: true,  onUpdate: true  }

// Custom autodate — stamp only on update (e.g. "last seen")
{ name: "lastSeenAt", type: "autodate", onCreate: false, onUpdate: true }
```

### JSON

```js
{ name: "metadata", type: "json", maxSize: 2000000 }
```

Accessing JSON values in filter rules uses dotted notation: `metadata.source`.

### GeoPoint

```js
{ name: "location", type: "geoPoint" }
// Stored as { lon: number, lat: number }
```

## Common mistakes

- **`required: true` on `bool` rejects `false`.** PB treats `false` as the
  field's zero/empty value, so `{ type: "bool", required: true }` actually
  means _"value must be `true`"_ — every "incomplete task" / "unverified
  user" / "private post" insert will be rejected. For toggle-style flags
  (`completed`, `verified`, `isPublic`, `archived`), **always** leave
  `required` off. Only require a `bool` when `false` is a meaningful
  user-set choice (e.g. an explicit "I have read the terms" checkbox).
- **`required: true` on `number` rejects `0`.** Same shape as the bool
  footgun: `0` is the empty value. If `0` is a legitimate count (`reviews`,
  `score`, `attempts`), leave required off.
- **`required: true` on every text field by default** — a row often has
  optional fields (description, bio, notes). Required-by-reflex creates
  validation errors on the frontend that the agent then "fixes" by writing
  a follow-up migration. Decide once, before the first `reload_app`.
- `relation` with no `collectionId` → migration fails. Always resolve the
  target collection first: `const users = app.findCollectionByNameOrId("users")`.
- `relation.cascadeDelete: true` on a reference you didn't mean to cascade —
  e.g. deleting a category wipes all posts in it. Default is `false`; only
  enable when ownership is genuine.
- `select` with `maxSelect: 1` returns a string; `maxSelect > 1` returns an
  array. Frontend code must match.
- `file.maxSize` in bytes, not MB. 10 MB = `10485760`, not `10`.
- `file.thumbs` uses strings like `"100x100"`, not numbers. PB generates
  thumbnails lazily on first request at `/api/files/{collection}/{id}/{file}?thumb=100x100`.
- Using `type: "editor"` when the user just types plain text — editor stores
  HTML and can be a sanitization footgun. Default to `text` unless a rich
  editor is genuinely needed.
