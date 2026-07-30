# OTP (One-Time Password) Auth

## What this is

OTP lets users sign in with a numeric code emailed to them, no password
required. Two valid setups:

- **OTP-only** — the auth collection has `passwordAuth.enabled = false` and
  `otp.enabled = true`. Users only sign in via email code.
- **Hybrid** — both enabled. Password is the default; OTP is a fallback or
  admin-trigger ("forgot password" → email code → set new one).

Pocketbase is able to send otp emails via already pre-configured mailer on `apps/pocketbase/pb_hooks/builder-mailer.pb.js`

For OTP-only signup, PocketBase doesn't create missing auth records
automatically. Add an OTP request hook that creates the `users` record before
the OTP email is sent.

## Template — enable OTP on existing auth collection

```js
// apps/pocketbase/pb_migrations/1729500000_enable_otp_for_users.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    collection.otp.enabled = true;
    collection.otp.duration = 300; // seconds the code is valid (5 min)
    collection.otp.length = 8; // digits in the code

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");
      collection.otp.enabled = false;
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

## Template — OTP-only auth collection (passwordless)

Use this when the default `users` auth collection already exists. The migration
enables OTP and disables password auth without creating or deleting the
collection, which keeps the down migration safe across different collection
setup flows:

```js
// apps/pocketbase/pb_migrations/1729500000_enable_users_otp_only.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    collection.passwordAuth.enabled = false;
    collection.otp.enabled = true;
    collection.otp.duration = 300; // seconds the code is valid (5 min)
    collection.otp.length = 8; // digits in the code

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");

      collection.otp.enabled = false;
      collection.passwordAuth.enabled = true;

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

## Template — create missing user on OTP request

Use this hook when `requestOTP` should work for both existing users and new
passwordless signups:

```js
// apps/pocketbase/pb_hooks/create-user-on-otp-request.pb.js
/// <reference path="../pb_data/types.d.ts" />

onRecordRequestOTPRequest((e) => {
  // PocketBase only sends OTP for an existing auth record by default.
  if (!e.record) {
    const email = e.requestInfo().body["email"];

    const record = new Record(e.collection);
    record.setEmail(email);
    record.setPassword($security.randomString(30));

    e.app.save(record);
    e.record = record;
  }

  return e.next();
}, "users");
```

## Frontend flow

```js
import { pb } from "@/lib/pocketbaseClient";

// Step 1 — request the OTP. PB emails the code to `email`.
const { otpId } = await pb.collection("users").requestOTP("user@example.com");

// Step 2 — user types the code from their email; submit it.
const auth = await pb.collection("users").authWithOTP(otpId, "12345678");
// auth.token is now stored in pb.authStore — same as authWithPassword.
```

## Common mistakes

- Setting `otp.enabled = true` and `passwordAuth.enabled = false` without
  adding the `onRecordRequestOTPRequest` hook. New users won't get an OTP
  because their auth record doesn't exist yet.
- Tiny `otp.duration` (e.g. 30 seconds) — users can't read the email and
  type the code in time. 300 (5 min) is a safe default.
- Long `otp.length` (e.g. 16) — bad UX. 6–8 is standard.
- Forgetting `app.save(collection)` after mutating `collection.otp.*`.
- Calling `authWithOTP` with the OTP `code` only — the SDK requires the
  `otpId` returned from `requestOTP` as the first argument.
