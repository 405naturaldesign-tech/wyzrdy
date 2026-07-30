---
name: pocketbase-record-operations
description: >
  PocketBase JSVM record helpers for hooks and migrations: typed getters,
  fetching records, and expanding relation fields with `$app.expandRecord`.
  Load when server-side code needs to read related records or inspect record
  fields before saving, emailing, validating, or backfilling data.
---

# Record Operations

Use these helpers inside PocketBase JS files (`pb_hooks/*.pb.js` and
`pb_migrations/*.js`). The examples mirror PocketBase's JavaScript record
operations docs: https://pocketbase.io/docs/js-records/

## Read Field Values

```js
record.get("someField"); // any, without cast
record.getBool("someField");
record.getString("someField");
record.getInt("someField");
record.getFloat("someField");
record.getDateTime("someField");
record.getStringSlice("someField");
```

Prefer typed getters when the value drives logic (`getInt`, `getBool`,
`getDateTime`, etc.). For strings, `getString("field")` is usually the
clearest choice.

Auth records also have convenience accessors like `record.email()`, but
`record.getString("email")` works consistently for both auth and base
collections.

## Fetch Records

Single-record helpers throw when no record is found.

```js
// Retrieve a single "articles" record by id.
const record = $app.findRecordById("articles", "RECORD_ID");

// Retrieve a single "articles" record by field value.
const article = $app.findFirstRecordByData("articles", "slug", "test");

// Retrieve a single record by filter. Use placeholders for untrusted input.
const publicArticle = $app.findFirstRecordByFilter(
  "articles",
  "status = 'public' && category = {:category}",
  { category: "news" },
);
```

Multiple-record helpers return an empty array when no records are found.

```js
const records = $app.findRecordsByFilter(
  "articles",
  "status = 'public' && category = {:category}",
  "-published",
  10,
  0,
  { category: "news" },
);
```

## Expand Relations

To read related records in JSVM code, expand the record first, then use
`expandedOne` or `expandedAll`.

```js
const record = $app.findFirstRecordByData("articles", "slug", "lorem-ipsum");

$app.expandRecord(record, ["author", "categories"], null);

const author = record.expandedOne("author");
const categories = record.expandedAll("categories");
```

For a hook event, prefer the record you already have:

```js
onRecordAfterCreateSuccess((e) => {
  const performance = e.record;

  $app.expandRecord(performance, ["runner", "race"], null);

  const runner = performance.expandedOne("runner");
  const race = performance.expandedOne("race");

  const recipientEmail = runner ? runner.getString("email") : "";
  const raceName = race ? race.getString("name") : "Unknown Race";

  // ...

  e.next();
}, "performances");
```

## Common Mistake: REST-Style Expand Options

Do not pass REST/SDK-style `{ expand: "..." }` options to
`$app.findRecordById`. In PocketBase JSVM this third argument is not an
options object; using one throws a `TypeError` like:

```text
could not convert [object Object] to func(*dbx.SelectQuery) error
```

```js
// WRONG — findRecordById does not accept REST-style expand options.
const rec = $app.findRecordById("performances", id, {
  expand: "runner,race",
});

// CORRECT — fetch or use the record, then expand it in-place.
const performance = e.record;

$app.expandRecord(performance, ["runner", "race"], null);

const runner = performance.expandedOne("runner");
const race = performance.expandedOne("race");
```

`expandedOne("rel")` returns `null` until the relation has been expanded.
Always call `$app.expandRecord(record, ["rel"], null)` before reading expanded
relations.
