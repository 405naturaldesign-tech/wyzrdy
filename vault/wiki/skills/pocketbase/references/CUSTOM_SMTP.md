---
name: pocketbase-custom-smtp
description: >
  Send the app's emails through the user's own mail server (Hostinger mail,
  Gmail, custom domain SMTP) instead of the default platform relay. Load ONLY
  when the user explicitly asks to use their own SMTP / send from their own
  address / stop mail landing in spam from a generic sender. Writes a
  `settings.smtp` migration.
---

# Custom SMTP (send from the user's own address)

By default, generated apps send all mail (auth: password reset, verification,
OTP, invites; plus anything you send from a hook) through Hostinger's shared
relay, which uses a **generic sender address** (e.g. `my-site@hsend.ai`).
Recipients don't recognize that domain, so the mail often lands in **spam**.

When the user explicitly wants mail to come **from their own address**
(`info@theirdomain.com`, a Gmail account, etc.), point PocketBase at their SMTP
server. A platform hook (`apps/pocketbase/pb_hooks/builder-mailer.pb.js`)
already checks `settings.smtp.enabled`:

```js
onMailerSend((e) => {
    if (e.app.settings().smtp.enabled) return e.next()  // ← uses the SMTP below
    /* otherwise → Hostinger relay */
})
```

So enabling SMTP in settings is all it takes to switch over. **You cannot set
this from the API, the dashboard, or the PB CLI** (all locked down) — the only
working path is a **migration**.

## When to use this

Only when the user explicitly asks for it. Phrases like:
"use my own SMTP", "send from `info@mydomain.com`", "use my Hostinger mail /
Gmail", "emails are going to spam because of the sender", "configure SMTP".

If the user just wants email to *work*, do **nothing** — the default relay
already handles it. Do not enable custom SMTP unprompted.

## The migration

```js
// apps/pocketbase/pb_migrations/1729500100_enable_custom_smtp.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const s = app.settings();

    // --- SMTP transport (the user's mail server) ---
    s.smtp.enabled  = true;
    s.smtp.host     = "smtp.hostinger.com";   // Gmail: "smtp.gmail.com"
    s.smtp.port     = 465;                     // 465 = SSL/implicit TLS. 587 = STARTTLS
    s.smtp.tls      = true;                    // true for 465; false for 587
    s.smtp.username = "info@theirdomain.com";  // Gmail: the full gmail address
    s.smtp.password = "THE_MAILBOX_PASSWORD";  // Gmail: a 16-char App Password, NOT the login password

    // --- Sender identity (REQUIRED — this is the "From:" the recipient sees) ---
    // settings.smtp does NOT set the from-address. Without meta.senderAddress
    // the mail still goes out from the DEFAULT address and the spam problem
    // is not fixed.
    s.meta.senderAddress = "info@theirdomain.com";
    s.meta.senderName    = "Their Brand";

    app.save(s);
  },
  (app) => {
    // Rollback: turn custom SMTP back off → falls back to the platform relay.
    const s = app.settings();
    s.smtp.enabled = false;
    app.save(s);
  }
);
```

Then `reload_app` once, as with any migration.

## Port / TLS cheat-sheet

| Port | `s.smtp.tls` | Notes |
| ---- | ------------ | ----- |
| 465  | `true`       | Implicit SSL/TLS. The safe default for Hostinger mail. |
| 587  | `false`      | STARTTLS — PB upgrades the connection after connecting. |

## Gmail specifics

- `host: "smtp.gmail.com"`, `port: 465`, `tls: true`.
- `username` = the full Gmail address; the "from" (`meta.senderAddress`) should
  be that same Gmail address — Gmail rejects sends that spoof a different from.
- The password MUST be a Google **App Password** (a 16-char token generated
  after enabling 2-Step Verification), **not** the account's normal login
  password. A normal password will fail auth.

## ⚠️ The password is stored in plaintext

The value you put in `s.smtp.password` is written verbatim into this migration
`.js` file, which is committed into the app source (and synced to storage).
PocketBase encrypts settings **at rest in its DB**, but **not** this source
file. Tell the user their mail password will live in the project source, and
prefer a dedicated/app-specific credential (e.g. a Gmail App Password) over
their primary account password.

## Pitfalls

- **Setting `smtp.*` but forgetting `meta.senderAddress`** → mail switches to
  the new server but still shows the default "From:", so it still looks
  untrusted. Always set both.
- **Gmail with the normal password** → auth fails. Use an App Password.
- **Wrong port/tls combo** (e.g. `port: 587, tls: true`) → connection hangs or
  errors. Match the cheat-sheet above.
- **Editing an already-applied migration** → PB won't re-run it. To change SMTP
  later, add a NEW timestamped migration that sets the new values.
- **Never touch `_superusers`** — unrelated to SMTP; still off-limits.
- **Verify after enabling** — a bad host/credential means auth emails silently
  fail to send. Trigger a real send to confirm (see testing note below).
