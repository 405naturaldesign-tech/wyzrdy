---
name: express
description: >
  Apply Express backend guidance for server-side logic, external HTTP calls,
  secrets, API keys, scheduled jobs, and browser-unsafe operations. Use when
  functionality should run in the backend instead of the frontend.
---

# Express.js Backend Skill

Load this skill when the task involves any external HTTP call, third-party API,
secrets/API keys, server-side logic, scheduled jobs, or anything that should not
run in the browser.

## Prerequisite — Express must be enabled

`apps/api` and `apps/web/src/lib/apiServerClient.js` only exist once
`enable_api_server_integration` has run. If `CODEBASE.md` has no `## apps/api`
section, **the coding agent must call `enable_api_server_integration`** and
wait for its tool result before writing any route, import, or
`apiServerClient` reference. 

## Hard rules (blockers, not preferences)

- Do NOT call any third-party / external HTTP API from `apps/web`. No
  `fetch('https://...')`, no axios to external hosts, no SDKs that hit remote
  services from the browser. This includes "public, no-key" APIs (dog.ceo,
  jsonplaceholder, openweather, github, wikipedia, etc.). They all belong in
  Express.
- Do NOT put API keys, tokens, or secrets in `apps/web`. They live in Express
  env / config only.
- Do NOT hardcode API keys, tokens, or secrets anywhere in source — not in
  `apps/web`. Put them in `apps/api/.env` and read them
  via `process.env.NAME`. Env loading is handled by Node's built-in
  `node --env-file=.env` flag in `apps/api/package.json`, so
  `process.env.*` is already populated before any JS runs — including
  top-level `const` reads in route files. This includes keys the user
  pastes into the task prompt: add them to `.env`, never inline them as a
  JS constant. A literal key string in a `.js` file is a bug.
- Do NOT add `dotenv` or call `dotenv.config(...)` anywhere. Do not change
  the `node --env-file=.env ...` flag in `apps/api/package.json`.
  If `process.env.YOUR_KEY` is undefined after `reload_app`, the bug is
  one of:
  (a) the key is missing/misspelled in `apps/api/.env`,
  (b) you're reading it with the wrong name, or
  (c) you forgot to `reload_app` after editing `.env`.
  It is NEVER an env-loading-path problem — do not try to re-wire env
  loading, and do not verify env with `node -e '...'` (the REPL has a
  different cwd and different `import.meta.url` than `main.js` and will
  mislead you).
- `../.h5g_env` holds core infrastructure env variables managed by the
  platform. You MAY read it (e.g. to discover an already-provisioned value),
  but you MUST NOT modify it. Any NEW env variable your Express code needs
  goes in `apps/api/.env` — never add it to `../.h5g_env`.
- Do NOT bypass `apps/web/src/lib/apiServerClient.js`; the frontend reaches
  Express only through it (HTTP via `fetch`; the browser path prefix is
  `/hcgi/api`). The module exports `API_SERVER_URL` — use it when you need a
  backend base URL string (for example, building an absolute WebSocket URL from
  `window.location` with `ws`/`wss` matching the page scheme).
- Do NOT skip creating an Express route when the task needs external data.
  Even if "it would work" with a direct browser call, it is wrong here.
- Do NOT handle only the happy path. Every external call needs error handling.
  But error handling here means **throwing an `Error`** so `errorMiddleware`
  catches it — NOT a `try/catch` that returns `res.status(5xx).json(...)`.
  See "Critical error handling rules" below.

## Required workflow

1. **Probe the upstream API with `curl` before writing any code.** You must
   see an actual response body with your own eyes — do not assume the shape
   from the task description or prior knowledge. Call it twice in a row so
   you notice rate limits, tokens, or per-IP throttling. Examples:
   ```bash
   curl -sS -i "https://opentdb.com/api.php?amount=10&type=multiple"
   curl -sS -i "https://opentdb.com/api.php?amount=10&type=multiple"  # again
   ```
   Look for: HTTP status, envelope fields (`response_code`, `status`,
   `error`, `success`), pagination, auth requirements, and rate-limit
   headers (`X-RateLimit-*`, `Retry-After`). Many "public, no-key" APIs
   (OpenTDB, dog.ceo, jsonplaceholder, etc.) signal errors INSIDE a 200
   response body via a status field — treat non-zero/non-success values
   there as failures too.
2. If the API needs a key/token/secret, add it to `apps/api/.env` FIRST
   (before writing the route) and read it with `process.env.NAME` in the
   route. Example — for an OpenWeatherMap key:
   ```
   # apps/api/.env
   PORT=3001
   CORS_ORIGIN=
   OPENWEATHER_API_KEY=...
   ```
   Never inline the key as a JS string constant. If `process.env.NAME` is
   unset, `throw new Error('NAME is not set in apps/api/.env')` instead of
   calling upstream with `undefined` — let `errorMiddleware` turn it into a
   500. Do NOT return a 500 manually.
3. Add or extend a route under `apps/api/src/routes/` and register it in
   `apps/api/src/routes/index.js`. Use `apps/api/src/routes/health-check.js`
   as the template.
4. Implement the external HTTP call inside that route. Use Node's built-in
   `fetch`. Do NOT wrap in `try/catch`. On any upstream failure, `throw new
   Error(...)` and let `errorMiddleware` produce the response. Remember
   `fetch` does NOT throw on 4xx/5xx, so you MUST check `response.ok` (and
   the envelope fields you observed in step 1 — not just `response.ok`) and
   throw yourself.
5. Use `apps/api/src/utils/logger.js` for any logging.
6. **Verify your new route with `curl` after `reload_app`.** Do not trust
   "the code looks right" — hit the actual URL and read the response.
   Test both the happy path and a failure path (e.g. rate limit, bad
   input) so you know your error handling works:
   ```bash
   curl -sS -i "http://localhost:3001/your-route"
   # Trigger the failure case too if you can (invalid param, repeat calls
   # to force a rate limit, etc.)
   ```
7. From the frontend, call the new route via
   `apiServerClient.fetch('/your-route', ...)` — never the external host
   directly. Import `API_SERVER_URL` from the same module when you need that
   same `/hcgi/api` base for non-`fetch` use (e.g. WebSockets).
8. Build the UI on top of the Express route.

## Critical error handling rules

`main.js` registers `errorMiddleware`, which catches every error, logs it, and
sends the error response. The boilerplate runs Express 5, so errors thrown from
`async` handlers are forwarded to it automatically. Work WITH the middleware:

1. NEVER use `try/catch` in a route handler to convert an error into a
   response. Let the error propagate to `errorMiddleware`.
2. NEVER call `res.status(4xx).json(...)` or `res.status(5xx).json(...)` for
   *errors*. The middleware owns all error responses. (Exception: input
   validation — see below.)
3. NEVER use `console.error` / `console.log`. Use
   `logger` from `apps/api/src/utils/logger.js` for any intentional logging.
   (`errorMiddleware` already logs thrown errors, so you usually don't even
   need to log them yourself.)
4. To signal an error, **`throw`** it — do NOT build and return a response.
5. When you throw on an upstream failure, the message MUST include BOTH
   `response.status` AND `response.statusText` — e.g.
   `` `openweather current failed: ${res.status} ${res.statusText}` ``.
   `${res.status}` alone is NOT enough; the numeric code without the
   reason phrase makes failures much harder to diagnose. Every
   `throw new Error(...)` that reports an HTTP failure must interpolate
   `${res.statusText}` right after `${res.status}`.

`fetch()` does NOT throw on HTTP error statuses (4xx/5xx). When calling an
external API you MUST check `response.ok` (or `response.status`) yourself, and
on failure **`throw new Error(...)`** so `errorMiddleware` handles it. Always
include `${response.status} ${response.statusText}` in the thrown message.

The one place a manual status response is correct: **input validation**.
Missing/invalid request params → `return res.status(422).json(...)` is fine.

❌ BAD — `try/catch` returning an error response:

```js
router.post("/", async (req, res) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("API error:", error); // ❌ console + manual 500
    res.status(500).json({ error: "Something went wrong" });
  }
});
```

❌ BAD — inline `if (!response.ok)` returning a 5xx (also bypasses the
middleware):

```js
router.get("/", async (req, res) => {
  const response = await fetch(url);
  if (!response.ok) {
    return res.status(500).json({ error: "Failed to fetch data" }); // ❌
  }
  const data = await response.json();
  res.json(data);
});
```

❌ BAD — throwing with only `status` (no `statusText`):

```js
export default async (req, res) => {
  const curRes = await fetch(url);
  if (!curRes.ok) {
    throw new Error(`openweather current failed: ${curRes.status}`); // ❌ status only — include statusText too
  }
  // ...
};
```

✅ GOOD — validate input with a 400, throw everything else (note both
`status` AND `statusText` in every thrown message):

```js
import logger from "../utils/logger.js"; // only if you log on purpose

export default async (req, res) => {
  const { city } = req.query;
  if (!city) {
    return res.status(422).json({ error: "City parameter is required" }); // ✅ input validation
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`External API error: ${response.status} ${response.statusText}`); // ✅ throw, don't return
  }

  const data = await response.json();
  res.json(data);
};
```

Summary:
- Input validation (missing/invalid params) → `return res.status(422).json(...)` is OK.
- External API errors, server errors, misconfiguration → `throw new Error(...)`,
  never `return res.status(5xx)`.
- Every HTTP-failure throw must include BOTH `${res.status}` and
  `${res.statusText}` in the message — never `${res.status}` on its own.

## Route template

Route files export a **plain handler function** — not a Router. The path is
registered in `index.js`.

```js
// apps/api/src/routes/example.js
// Read secrets from env, NEVER hardcode them. `process.env.*` is populated
// by Node (via `--env-file=.env`) before this module evaluates,
// so a top-level const here is safe.
const EXAMPLE_API_KEY = process.env.EXAMPLE_API_KEY;

export default async (req, res) => {
  // Input validation: returning a 4xx is OK.
  const { id } = req.query;
  if (!id) {
    return res.status(422).json({ error: "id query param is required" });
  }

  // Server misconfiguration / upstream failures: THROW, never return a 5xx.
  // No try/catch — errorMiddleware (registered in main.js) catches throws
  // from async handlers (Express 5) and logs + responds for you.
  if (!EXAMPLE_API_KEY) {
    throw new Error("EXAMPLE_API_KEY is not set in apps/api/.env");
  }

  const upstream = await fetch(
    `https://example.com/api/thing?id=${id}&apikey=${EXAMPLE_API_KEY}`,
  );

  // fetch does NOT throw on 4xx/5xx — check and throw yourself.
  if (!upstream.ok) {
    throw new Error(
      `example upstream failed: ${upstream.status} ${upstream.statusText}`,
    );
  }

  const data = await upstream.json();
  res.json(data);
};
```

Register it in `apps/api/src/routes/index.js` by importing the handler and
adding a `router.get` / `router.post` line inside the factory function:

```js
// apps/api/src/routes/index.js
import { Router } from "express";
import healthCheck from "./health-check.js";
import example from "./example.js"; // ← add import

const router = Router();

export default () => {
  router.get("/health", healthCheck);
  router.get("/example", example); // ← add route
  return router;
};
```

## Pitfalls

- Do NOT use an `/api/` prefix when calling routes from the frontend.
  `apiServerClient` already adds the `/hcgi/api` base for you, so call
  `apiServerClient.fetch('/your-route', ...)` — NOT
  `apiServerClient.fetch('/api/your-route', ...)`. Routes are registered
  bare (e.g. `router.get('/your-route', ...)`) in
  `apps/api/src/routes/index.js`; an extra `/api/` prefix produces a 404.

## Under what conditions can you skip Express?

Only when the task is purely visual/UX — styling, copy, animations, routing
between existing pages — with no external calls and no persistence. If in
doubt, add the Express route.
