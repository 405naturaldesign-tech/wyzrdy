# Using PocketBase from React (Default Path)

Load this skill when the task needs the frontend to read or write PocketBase —
login/signup, list/create/update/delete records, realtime subscriptions. This
is the DEFAULT way to talk to PB in this project. Do NOT put an Express route
in the middle unless the task clearly needs server-side logic (see the
"When to add Express" note at the bottom).

## The client

A PocketBase client is already wired up at `apps/web/src/lib/pocketbaseClient.js`:

```js
import pb from "@/lib/pocketbaseClient";
```

## Auth — signup, login, logout, current user

```jsx
// apps/web/src/features/auth/useAuth.js
import { useEffect, useState } from "react";
import pb from "@/lib/pocketbaseClient";

export function useAuth() {
  const [user, setUser] = useState(pb.authStore.record);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => setUser(record));
    return unsub;
  }, []);

  return {
    user,
    isAuthed: pb.authStore.isValid,
    login: (email, password) =>
      pb.collection("users").authWithPassword(email, password),
    signup: async (email, password) => {
      await pb
        .collection("users")
        .create({ email, password, passwordConfirm: password });
      return pb.collection("users").authWithPassword(email, password);
    },
    logout: () => pb.authStore.clear(),
  };
}
```

`users` is an auth collection you define in a migration (see
`pocketbase/references/CREATE_AUTH_COLLECTION.md`). The JWT is persisted in localStorage
by the SDK automatically — refresh the page and the user stays logged in.

## CRUD — list, create, update, delete

The `tasks` collection in this example is owner-scoped (the default —
see "Access rules ARE your auth" below). That means:

- The `getFullList` call only returns rows owned by the current user;
  the `listRule` does the filtering server-side.
- Every `create` MUST set `owner: pb.authStore.record.id`, otherwise the
  `createRule` rejects the request with 403.

```jsx
// apps/web/src/features/tasks/TaskList.jsx
import { useEffect, useState } from "react";
import pb from "@/lib/pocketbaseClient";

export function TaskList() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    pb.collection("tasks")
      .getFullList({ sort: "-created" })
      .then(setTasks)
      .catch((err) => console.error("load tasks failed", err));
  }, []);

  const addTask = async (title) => {
    const rec = await pb.collection("tasks").create({
      title,
      done: false,
      owner: pb.authStore.record.id,
    });
    setTasks((prev) => [rec, ...prev]);
  };

  const toggle = async (id, done) => {
    const rec = await pb.collection("tasks").update(id, { done: !done });
    setTasks((prev) => prev.map((t) => (t.id === id ? rec : t)));
  };

  const remove = async (id) => {
    await pb.collection("tasks").delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id}>
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => toggle(t.id, t.done)}
          />
          {t.title}
          <button onClick={() => remove(t.id)}>x</button>
        </li>
      ))}
    </ul>
  );
}
```

## Realtime — subscribe to collection changes

**CRITICAL: `pb.collection(x).subscribe(...)` returns `Promise<UnsubscribeFunc>`
in PocketBase SDK v0.21+.** It is NOT synchronous. Either of the two correct
patterns below work — pick one. Never treat the return value as a sync function
(see the ❌ WRONG block for why).

### Pattern A (simplest — recommended)

Let the subscription start in the background and cancel everything via the
topic on cleanup. This is the canonical pattern for this project:

```jsx
useEffect(() => {
  pb.collection("tasks").subscribe("*", (e) => {
    // e.action is 'create' | 'update' | 'delete'; e.record is the row
    setTasks((prev) => {
      if (e.action === "create") return [e.record, ...prev];
      if (e.action === "update")
        return prev.map((t) => (t.id === e.record.id ? e.record : t));
      if (e.action === "delete")
        return prev.filter((t) => t.id !== e.record.id);
      return prev;
    });
  });
  return () => {
    pb.collection("tasks").unsubscribe("*");
  };
}, []);
```

### Pattern B — await the unsub function

Store the promise and resolve it in the cleanup. Works, but verbose:

```jsx
useEffect(() => {
  const unsubPromise = pb.collection("tasks").subscribe("*", (e) => {
    /* ... */
  });
  return () => {
    unsubPromise.then((unsub) => unsub()).catch(() => {});
  };
}, []);
```

### ❌ WRONG — don't do this

```jsx
// BROKEN: `unsub` is a Promise, not a function. Calling it throws
// "TypeError: unsub is not a function" during unmount. Combined with
// conditional rendering (`isAuthed ? <TaskList/> : ...`) on logout, React
// unmounts the tree, the cleanup throws, and the whole app goes BLANK
// because there's no error boundary.
const unsub = pb.collection("tasks").subscribe("*", handler);
return () => unsub();
```

This is the #1 cause of "the page goes blank on logout". The symptom is
always the same: `TypeError: unsub is not a function` in the console, then
an empty `<div id="root"></div>`.

### If you also read the collection, subscribe BEFORE `getFullList`

Otherwise a row inserted between the initial fetch and the subscription
starting never shows up. Either call `getFullList` inside the callback of
a first `subscribe(...)` resolve, or just accept the tiny race (usually
fine) and fetch first for simplicity.

## File uploads

`pocketbase` SDK accepts `FormData` directly — pass a `File` from an
`<input type="file" />` as a field value and the SDK handles the multipart
encoding:

```jsx
const onUpload = async (file) => {
  const fd = new FormData();
  fd.append("title", "Avatar");
  fd.append("image", file);
  const rec = await pb.collection("photos").create(fd);
  // URL for the uploaded file:
  const url = pb.files.getURL(rec, rec.image);
};
```

## Filtering & pagination

```js
const page1 = await pb.collection("tasks").getList(1, 20, {
  filter: 'done = false && created > "2024-01-01"',
  sort: "-created",
  expand: "owner", // follows a relation field
});
// page1.items, page1.totalItems, page1.totalPages
```

Escape user input in filters with `pb.filter()`:

```js
await pb.collection("tasks").getList(1, 20, {
  filter: pb.filter("title ~ {:q}", { q: searchText }),
});
```

## Error handling pattern

Every PB call throws a `ClientResponseError` on non-2xx. Useful fields:

- `err.status` — HTTP status (400 = validation, 403 = access rule denied, 404).
- `err.response.data` — per-field validation error map for 400s.

```js
try {
  await pb.collection("tasks").create({ title: "" });
} catch (err) {
  if (err.status === 400) {
    // err.response.data = { title: { code: 'validation_required', message: 'Missing required value.' } }
    setFieldErrors(err.response.data);
    return;
  }
  throw err;
}
```

## Auto-cancellation & concurrent requests

The SDK auto-cancels duplicate in-flight requests. Every request gets a key
derived from `HTTP_METHOD + path` (e.g. `POST /api/collections/tasks/records`);
when a new request starts while one with the same key is still pending, the
earlier one is aborted and rejects with a `ClientResponseError` whose `status`
is `0`. See https://github.com/pocketbase/js-sdk#auto-cancellation.

This is expected SDK behavior, not a network failure. Two situations need care.

### Parallel writes to the same collection — give each call its own `requestKey`

Issuing several calls to the same collection at once makes them share one key,
so all but the last get cancelled and **their data is silently lost**:

```js
// WRONG — only one of these records reliably gets created; the rest are cancelled.
await Promise.all(rows.map((row) => pb.collection("items").create(row)));
```

Give each call its own unique `requestKey` so they no longer share one
identifier. This keeps auto-cancellation working for genuine duplicates while
letting these distinct writes all run (passing `requestKey: null` also works but
disables cancellation for that call entirely):

```js
// CORRECT — each create gets a distinct key, so none cancel the others.
await Promise.all(
  rows.map((row, i) =>
    pb.collection("items").create(row, { requestKey: `create-item-${i}` }),
  ),
);
```

The same applies to any batch of updates or deletes fired together.

### Rapid repeated writes to one record — write less often

When a value is persisted on every change (auto-save fields, sliders, rapidly
toggled controls), each save cancels the previous one. Don't disable
cancellation here with `requestKey: null` — keeping only the last write is the
behavior you want. Instead, fire fewer writes: debounce the save or persist on
`onBlur` rather than on every change (standard React).

## Access rules ARE your auth — default is owner-only

Since React calls PB directly, you CANNOT rely on "the backend checks this".
The access rules on the collection (`listRule`, `viewRule`, `createRule`,
`updateRule`, `deleteRule`) are the enforcement layer. Define them carefully
in the migration — see `pocketbase/references/ACCESS_RULES.md`.

**Default for every owned collection: least privilege.** Only the user
who created a record may read or change it. Use this verbatim unless the
prompt explicitly asks for public / shared / feed semantics:

```js
listRule:   "@request.auth.id != '' && @request.auth.id = owner",
viewRule:   "@request.auth.id != '' && @request.auth.id = owner",
createRule: "@request.auth.id != ''",
updateRule: "@request.auth.id != '' && @request.auth.id = owner",
deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
```

This requires an `owner` relation field (pointing at `users`) on the
collection.

`owner` (no `.id` suffix) is correct for a relation field — PocketBase
compares the relation's referenced id automatically. Writing
`owner.id` only works on relation fields and adds no value here.

## When to add Express in front

Keep React → PB direct UNLESS the task needs one of:

1. A 3rd-party API call with a secret key (Stripe, OpenAI, etc.) —
   the secret can't ship to the browser.
2. A webhook receiver (Stripe events, GitHub, etc.).
3. Logic that touches multiple external systems atomically.
4. Heavy computation that shouldn't run in the client.

If none of those apply, do NOT introduce an Express route. Use PB access
rules + migrations + direct SDK calls. See
`express/references/CONNECTING_TO_POCKETBASE.md` only when you've confirmed Express is
actually needed.

## Pitfalls

- **Forgetting the collection access rules.** Default rules are `null` (nobody
  can do anything). If `getFullList()` returns `[]` or create returns 403,
  the rule is the reason — add it in the migration.
- **Using `pb.authStore.token` in custom fetches.** The SDK already adds the
  `Authorization` header when you call `pb.collection(...)` — you only need
  the raw token if you build a separate fetch, which should be rare.
- **Treating `subscribe(...)` as sync.** It returns `Promise<UnsubscribeFunc>`.
  See the Realtime section — this breaks logout (`isAuthed ? <List/> : ...`)
  and blanks the screen.
- **Subscribing and not unsubscribing** — the effect cleanup MUST call
  `unsubscribe`, otherwise you get double updates after re-mounts.
- **Concurrent writes to one collection without a `requestKey`.** Calls sharing
  the default key (`METHOD + path`) auto-cancel each other, so a `Promise.all`
  of creates/updates silently drops all but the last. Pass a unique
  `requestKey` per call (or `{ requestKey: null }`) for parallel writes;
  debounce rapid repeated writes to the same record instead. See
  "Auto-cancellation & concurrent requests".
- **Using `expand` without the matching field being a relation** — PB returns
  the record but `record.expand` is empty and you spend 10 minutes debugging.
  Check `FIELD_TYPES.md` for how to define relation fields.
- **Any uncaught error in a `useEffect` cleanup blanks the whole app.** React
  has no error boundary by default, so a single throw during unmount (e.g.
  the broken subscribe cleanup above) unmounts the entire tree. When the user
  reports "the page goes blank on logout / route change", check console for
  a cleanup-phase error first; the fix is almost always in an effect's
  returned cleanup function, not in the rendering logic.
