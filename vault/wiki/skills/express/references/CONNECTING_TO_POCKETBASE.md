# Connecting Express to PocketBase (Opt-in)

Load this skill ONLY when the task has a clear server-side reason to go
through Express instead of calling PB directly from React. If the task is
"save X", "list X", "log me in", "show only my records", you DO NOT want
this skill — use `pocketbase/references/USING_IN_REACT.md` instead.

This skill assumes BOTH services are already enabled. Express must already
exist for the current conversation, and PocketBase must already be
provisioned. If PocketBase is not enabled (no `## apps/pocketbase` section
in `CODEBASE.md`), **the coding agent must call
`enable_pocketbase_integration`** and wait for its tool result before
continuing with this skill.

## When Express is justified

Add an Express route for one of these reasons, and no others:

1. **Secret key to a 3rd-party API** — Stripe charges, OpenAI calls,
   Twilio SMS, etc. Anything whose API key can't ship to the browser.
2. **Webhook receiver** — Stripe events, GitHub hooks, payment callbacks.
   The 3rd party POSTs to Express; Express validates the signature and
   writes to PB.
3. **Multi-system orchestration that must succeed/fail together** — e.g.
   charge Stripe AND create a record; either both or neither.
4. **Heavy computation** that shouldn't run in the client (rare in this
   sandbox).

If the task isn't one of those, close this file and use
`pocketbase/references/USING_IN_REACT.md`.

## The lazy client (safe pattern)

Do NOT use eager auth on import — if env is missing or PB is momentarily down,
`import`-side effects crash the whole Express process. Use the existing lazy
client, and make failures return 5xx from the route instead of crashing.

Use `apps/api/src/utils/pocketbaseClient.js`:

```js
// apps/api/src/utils/pocketbaseClient.js
//
// Lazy superuser client for Express. NEVER import this from main.js
// and NEVER call it at module load — only from inside a route handler.
//
// Env (loaded by `node --env-file-if-exists=.env` in apps/api/package.json):
//   POCKETBASE_URL          default http://localhost:8090
//   PB_SUPERUSER_EMAIL      set by sandbox/entrypoint.sh
//   PB_SUPERUSER_PASSWORD   set by sandbox/entrypoint.sh
import Pocketbase from "pocketbase";

const host = process.env.POCKETBASE_URL || "http://localhost:8090";
const pocketbaseClient = new Pocketbase(host);
pocketbaseClient.autoCancellation(false);

let authPromise = null;

export async function ensureSuperuserAuth() {
  if (pocketbaseClient.authStore.isValid) return pocketbaseClient;

  if (!authPromise) {
    const email = process.env.PB_SUPERUSER_EMAIL;
    const password = process.env.PB_SUPERUSER_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD missing in apps/api/.env",
      );
    }

    authPromise = pocketbaseClient
      .collection("_superusers")
      .authWithPassword(email, password)
      .finally(() => {
        authPromise = null;
      });
  }

  await authPromise;
  return pocketbaseClient;
}

pocketbaseClient.beforeSend = async function (url, options) {
  if (url.includes("/api/collections/_superusers/auth-with-password")) {
    return { url, options };
  }

  await ensureSuperuserAuth();

  if (pocketbaseClient.authStore.isValid && pocketbaseClient.authStore.token) {
    options.headers = options.headers || {};
    options.headers.Authorization = pocketbaseClient.authStore.token;
  }

  return { url, options };
};

export default pocketbaseClient;
export { pocketbaseClient };
```

Why lazy auth:

- Importing the file never blocks Express startup.
- Auth is retried on the next PB call if a previous attempt failed.
- `POCKETBASE_URL` defaults to `http://localhost:8090`, which matches the
  sandbox. Do not use the production `WEBSITE_DOMAIN` URL here.

## Concrete route example (3rd-party secret key)

```js
// apps/api/src/routes/checkout.js
import { Router } from "express";
import logger from "../utils/logger.js";
import pocketbaseClient from "../utils/pocketbaseClient.js";

const router = Router();

router.post("/checkout", async (req, res) => {
  const { userId, amount } = req.body ?? {};
  if (!userId || !amount) return res.status(400).json({ error: "bad input" });

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ amount, currency: "usd" }),
    });
    if (!stripeRes.ok) {
      return res.status(502).json({ error: "payment provider error" });
    }
    const charge = await stripeRes.json();

    const rec = await pocketbaseClient.collection("payments").create({
      user: userId,
      stripe_id: charge.id,
      amount,
      status: charge.status,
    });

    return res.status(201).json(rec);
  } catch (err) {
    logger.error("checkout failed", err);
    return res.status(500).json({ error: "internal error" });
  }
});

export default router;
```

Then register in `apps/api/src/routes/index.js`:

```js
import checkout from "./checkout.js";
// inside the default export:
router.post("/checkout", checkout);
// or:
router.use("/", checkout);
```

From the frontend:

```js
import apiServerClient from "@/lib/apiServerClient";

await apiServerClient.fetch("/checkout", {
  method: "POST",
  body: JSON.stringify({ userId: pb.authStore.record.id, amount: 2000 }),
  headers: { "Content-Type": "application/json" },
});
```

## Per-request user client (when PB rules should do the auth)

Use this pattern when you want PocketBase's own access rules to enforce
"only the owner can X" — the route forwards the user's JWT to PB.

```js
import Pocketbase from "pocketbase";

router.get("/my-stuff", async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const pb = new Pocketbase(
    process.env.POCKETBASE_URL || "http://localhost:8090",
  );
  pb.authStore.save(token, null);

  try {
    const records = await pb
      .collection("my_thing")
      .getFullList({ sort: "-created" });
    return res.json(records);
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: "forbidden" });
    return res.status(500).json({ error: "internal error" });
  }
});
```

## Rules

- NEVER call `ensureSuperuserAuth()` or any PB SDK method at module load time
  — only inside a handler.
- NEVER embed the superuser email/password in a response body or in frontend
  code.
- NEVER use the superuser client for an operation that is supposed to be the
  calling user's own (e.g. "delete MY task"). Either check ownership manually
  in the route, or use the per-request user client and let PB's rules do it.
- Small integer PB error codes to know: `404` (not found), `400` (validation),
  `403` (access rule denied).
- Always `try/catch` around PB SDK calls and return a JSON error on failure.

## Common mistakes

- Module-level `import pb from '../utils/pocketbaseClient.js'` + `await pb.auth...`
  at the top of the file — this crashes Express on startup if env is unset or
  PB hasn't warmed up. Always lazy.
- Forgetting to register the new route in `apps/api/src/routes/index.js` —
  returns 404 even though the file exists.
- Calling `pb.collection('x').create(data)` with field names that don't match
  the migration — PB returns 400 with a per-field error map. Read the
  response body to see which field.
- Using the superuser client to create a record on behalf of a user without
  checking ownership in the route — the calling user can now write anything
  they want via your endpoint. Either check ownership or use per-request.
