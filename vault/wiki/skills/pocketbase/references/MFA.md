# Multi-Factor Authentication (MFA)

## How PocketBase MFA works

After primary auth (`authWithPassword` or `authWithOAuth2`), PB returns
a **`mfaId`** instead of a token IF the auth record matches the
`mfa.rule` filter. The frontend then runs a second auth method
(typically OTP via email) and passes `mfaId` along — PB combines both
factors and returns the real token.

PB's built-in second factor is **OTP** (email code). True TOTP
(authenticator apps) requires custom hook code; the built-in MFA flow is
OTP-based.

## Two MFA modes

- **Optional (recommended for consumer apps).** Add a `mfaEnabled` boolean
  field to the auth collection; users opt in via a settings page. The
  `mfa.rule` is `mfaEnabled = true`, so users without it logged in
  normally.
- **Mandatory.** All users must use MFA. `mfa.rule` is `""` (always
  applies). Strong-security or compliance scenarios.

## Template — optional MFA on existing users collection

```js
// apps/pocketbase/pb_migrations/1729500000_enable_optional_mfa_for_users.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    collection.mfa.enabled = true;
    collection.mfa.duration = 300; // seconds the mfaId is valid
    collection.mfa.rule = "mfaEnabled = true"; // only opt-in users

    // Add the opt-in flag if it isn't already there.
    if (!collection.fields.getByName("mfaEnabled")) {
      collection.fields.add(
        new BoolField({
          name: "mfaEnabled",
          required: false,
        }),
      );
    }

    // Enable OTP as the second factor.
    collection.otp.enabled = true;
    collection.otp.duration = 300;
    collection.otp.length = 8;

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");
      collection.mfa.enabled = false;
      collection.otp.enabled = false;
      collection.fields.removeByName("mfaEnabled");
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

## Template — mandatory MFA

```js
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("staff");
    collection.mfa.enabled = true;
    collection.mfa.duration = 300;
    collection.mfa.rule = ""; // empty rule → applies to every login
    collection.otp.enabled = true;
    collection.otp.duration = 300;
    collection.otp.length = 8;
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("staff");
      collection.mfa.enabled = false;
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

## Frontend flow

```js
import { pb } from "@/lib/pocketbaseClient";

let auth;
try {
  // Step 1 — primary auth.
  auth = await pb.collection("users").authWithPassword(email, password);
  // No MFA → we got the token directly.
} catch (err) {
  // PB throws when MFA is required, with err.response.mfaId in the body.
  if (!err?.response?.mfaId) throw err;
  const { mfaId } = err.response;

  // Step 2 — request OTP by email.
  const { otpId } = await pb.collection("users").requestOTP(email);

  // Step 3 — submit code + mfaId together to complete MFA.
  auth = await pb.collection("users").authWithOTP(otpId, code, { mfaId });
}
// auth.token is now in pb.authStore.
```

## Common mistakes

- Enabling `mfa.enabled = true` without enabling `otp.enabled = true` (or
  another supported second factor) → primary auth returns `mfaId` but
  there's no second-factor method to complete the flow.
- Setting `mfa.rule = "mfaEnabled = true"` without adding the `mfaEnabled`
  field → rule references a non-existent column → primary auth 500s for
  every user. Always add the field in the same migration (template
  above does this with the `getByName` guard).
- Mandatory MFA (`mfa.rule = ""`) on a collection where users have never
  set up a second factor → existing users locked out. Use optional MFA for
  consumer apps; for mandatory, enroll users gradually.
- Calling `authWithOTP(otpId, code)` without the `{ mfaId }` third arg
  during MFA → PB issues a single-factor token instead of completing MFA,
  weakening security.
- Long `mfa.duration` (e.g. 86400) → the `mfaId` window stays open way too
  long. 300 (5 min) is the right default; matches `otp.duration`.
