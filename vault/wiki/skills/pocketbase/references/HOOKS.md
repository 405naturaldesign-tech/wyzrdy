---
name: pocketbase-hooks
description: >
  Add `pb_hooks/*.pb.js` files to react to record events, brand the built-in
  auth emails (password reset / verification / OTP / authAlert), reshape API
  responses per-request, or default fields on write. Load when the task
  needs server-side logic triggered by a PocketBase event — send a welcome
  email on signup, hide PII per request, auto-stamp ownership, etc.
---

# PocketBase Hooks

Load this skill when the task needs server-side logic that fires on a
PocketBase event — a new row, an auth email going out, a response being
serialized, or a write being validated, etc.

## What `pb_hooks/` is

Files in `apps/pocketbase/pb_hooks/` that end in `*.pb.js` are loaded by
PocketBase at boot and run inside the PB process.
You register handlers on PB events; PB calls them in-process during the
relevant request or save lifecycle.

- File path must be `apps/pocketbase/pb_hooks/<name>.pb.js`. Anything not
  ending in `.pb.js` is ignored.
- Email delivery is wired up by the platform. `$app.newMailClient().send(message)`
  works out of the box; no SMTP setup, no API key, nothing to install. The
  sender address is set by the platform — set `from: { name: "..." }` to brand
  the display name; don't bother with `from.address`.

**Prefer a hook for server-side reactions.** Hooks run in the PB process,
have direct access to records and the mailer, and don't require enabling
or scaffolding Express. Only reach for Express when the task needs
something the hook surface can't express.

One consequence of running in-process: an uncaught error in a hook can
crash PocketBase. Handle the failure modes that actually matter — network
calls, missing fields — instead of every line.

If a hook needs to fetch records, read typed field values, or expand
relations before sending an email / validating / enriching a record, also
use `pocketbase/references/RECORD_OPERATIONS.md`. In PB hooks, do not use
REST-style `{ expand: "rel" }` options with `$app.findRecordById`.

## Template 1 — Send an email when a record is created

The most common case: a form submission (newsletter signup, contact form,
new account) where you also want to email the submitter afterwards.

```js
// apps/pocketbase/pb_hooks/welcome-email.pb.js
/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  const recipient = e.record.get("email");

  const message = new MailerMessage({
    from:    { name: "Acme" },
    to:      [{ address: recipient }],
    subject: "Welcome to Acme",
    html:    `<p>Hi,</p><p>Thanks for signing up. We'll be in touch.</p>`,
  });

  try {
    $app.newMailClient().send(message);
  } catch (err) {
    $app.logger().error("welcome email failed", "to", recipient, "err", String(err));
  }

  e.next();
}, "subscribers");
```

The second argument (`"subscribers"`) scopes the hook to one collection.
Omit it to fire for every record create — usually too broad.

Variant — fire a webhook instead of an email:

```js
$http.send({
  url:     "https://hooks.example.com/new-signup",
  method:  "POST",
  body:    JSON.stringify({ email: recipient }),
  headers: { "Content-Type": "application/json" },
});
```

## Template 2 — Customize the built-in auth emails

PocketBase already sends password-reset, verification, OTP, email-change,
and new-device-login emails for any auth collection. Their defaults are
plain text from `noreply@`. Mutate `e.message` to brand them, then call
`e.next()` to send.

```js
// apps/pocketbase/pb_hooks/branded-password-reset.pb.js
/// <reference path="../pb_data/types.d.ts" />

onMailerRecordPasswordResetSend((e) => {
  const appUrl = $app.settings().meta.appUrl;
  const link   = `${appUrl}/_/#/auth/confirm-password-reset/${e.meta.token}`;

  e.message.from.name = "Acme Notes";
  e.message.subject   = "Reset your Acme password";
  e.message.html      = `
    <h1>Reset your password</h1>
    <p>Click the link to set a new password (valid 30 minutes):</p>
    <p><a href="${link}">Reset password</a></p>
  `;

  e.next();
}, "users");
```

The other auth-mailer hooks follow the identical shape — only the trigger
and `e.meta` payload differ:

- `onMailerRecordVerificationSend` — email-verification link (`e.meta.token`)
- `onMailerRecordOTPSend` — OTP login code (`e.meta.otpId`, `e.meta.password`)
- `onMailerRecordEmailChangeSend` — confirm-new-email link (`e.meta.token`, `e.meta.newEmail`)
- `onMailerRecordAuthAlertSend` — new-device-login alert (`e.meta.info`)

## Template 3 — Reshape what the API returns

`onRecordEnrich` runs whenever a record is serialized for an API response
(list, view, realtime). Use it to hide fields based on the caller or to
add computed fields.

```js
// apps/pocketbase/pb_hooks/redact-submissions.pb.js
/// <reference path="../pb_data/types.d.ts" />

onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  const isAdmin = !!auth && auth.get("role") === "admin";

  if (!isAdmin) {
    e.record.hide("email", "phone");
  }

  e.next();
}, "submissions");
```

Add a computed field — needs `withCustomData(true)` first for security:

```js
onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  e.record.withCustomData(true);
  e.record.set("isOwner", !!auth && auth.id === e.record.get("userId"));
  e.next();
}, "posts");
```

## Template 4 — Defaults on write

Use `onRecordCreateRequest` (and `onRecordUpdateRequest`) to set fields
from server-side context, normalize input, or reject the write — instead
of trusting whatever the client sent. Use the `*Request` variants when you
need request context like the caller's auth state; the plain
`onRecordCreate` / `onRecordUpdate` fire for every save (including
programmatic) and don't carry `requestInfo`.

```js
// apps/pocketbase/pb_hooks/post-defaults.pb.js
/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const auth = e.requestInfo.auth;
  if (auth) {
    e.record.set("userId", auth.id);
  }

  const email = e.record.get("email");
  if (email) {
    e.record.set("email", email.toLowerCase().trim());
  }

  e.next();
}, "posts");
```

## Common variants

- **`onRecordAfterUpdateSuccess` / `onRecordAfterDeleteSuccess`** — same
  shape as Template 1, at the other lifecycle stages.
- **`onRecordValidate`** — custom cross-field validation; throw
  `new BadRequestError("...")` to reject the save.
- **`onRecordAuthWithOAuth2Request`** — bootstrap a profile row the first
  time a user signs in via Google/GitHub/etc.
- **`routerAdd("POST", "/path", handler)`** — register a custom HTTP route
  inside PB. Useful when the logic isn't tied to a record lifecycle but
  doesn't justify Express.

## Pitfalls

- **Forgetting `e.next()`** — the hook chain halts and the original
  operation is silently aborted. Always end the handler with `e.next()`.
- **Adding your own `onMailerSend`** — outgoing-mail interception is
  already handled at the platform level. Use `onMailerRecord*Send` to
  change the content of built-in auth emails; use
  `$app.newMailClient().send()` to send your own.
- **Configuring SMTP** — not needed by default; the platform relay handles
  delivery with no setup. Only when the user **explicitly** asks to send from
  their own address (their Hostinger mail, Gmail, custom-domain SMTP — often
  because the default sender lands in spam), enable custom SMTP via a
  `settings.smtp` migration. It cannot be set from the API/dashboard/CLI — see
  `pocketbase/references/CUSTOM_SMTP.md`.
- **Picking the wrong hook variant** — record-model hooks
  (`onRecordCreate`, `onRecordUpdate`, `onRecordValidate`) fire for every
  save and don't carry `requestInfo`. If you need IP / headers / the
  caller's auth, use the `*Request` variants.
- **File extension** — must end in `.pb.js`. Plain `.js` is silently ignored.
- **Goja is not Node.** No `fetch`, no `axios`, no `process.env`, no
  npm packages. Use the PB globals: `$http.send(...)` for HTTP,
  `$os.getenv(...)` for env, `$app` for DB / mailer / logger.
