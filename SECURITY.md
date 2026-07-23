# Security & Credential Rotation

## ⚠️ Rotate these credentials immediately

The following keys were present in the repository history and MUST be treated as
compromised. Rotate them at the provider, then paste the new values into
`apps/api/.env` (never commit that file — it is git-ignored):

| Key | Where to rotate |
| --- | --- |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys — revoke old, create new |
| `COMPOSIO_API_KEY` | Composio dashboard → API keys → regenerate |
| `ZAI_API_KEY` | Z.ai console → API keys → regenerate |

After rotating, run the API (`reload_app` / restart) and confirm startup logs
show `Environment validation passed.` with no missing-key warnings for the keys
you set.

## What is protected now

- **`.gitignore`** excludes `.env*`, `pb_data/`, `*.db`, `node_modules/`, and
  build artifacts so secrets and databases are never committed.
- **Startup validation** (`apps/api/src/config/env.js`) fails fast on missing
  required vars and warns on missing recommended ones (OpenRouter, Composio).
- **API authentication** — every credit-bearing route (`/ai/chat`,
  `/ai/blueprint`, `/scrape`, `/composio/*`, `/integrations/status`,
  `/monitor/health`) requires a valid PocketBase session
  (`Authorization: Bearer <token>`); only `/health` is public.
- **Per-user rate limiting** — `apps/api/src/middleware/auth.js` limits AI
  (20/min) and scrape (15/min) calls per authenticated user.
- **SSRF protection** — `/scrape` rejects private/loopback/link-local hosts and
  can be restricted further with `SCRAPE_ALLOWED_DOMAINS`.
- **Request logging** — each authenticated API call logs method, path, user id
  and timestamp.

## Preventing future credential leaks

Add a pre-commit guard (optional, local): install a hook that greps staged
changes for high-entropy strings / `_API_KEY=` values and blocks the commit.
Because `.env` is git-ignored, the common leak vector is already closed.
