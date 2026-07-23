# Deployment

The stack is a monorepo with three apps:

- `apps/web` — React + Vite frontend (port 3000)
- `apps/api` — Express API (port 3001)
- `apps/pocketbase` — PocketBase DB/auth (port 8090)

## Environment

1. Copy `apps/api/.env.example` → `apps/api/.env` and fill in **rotated** keys
   (see `SECURITY.md`).
2. Required-on-startup validation runs automatically (`apps/api/src/config/env.js`).
   OpenRouter + Composio are recommended; without `OPENROUTER_API_KEY` the AI
   blueprint route returns `503`.

## Run (managed platform)

On the Hostinger platform the three services are supervised automatically — no
manual `npm run dev`. Applying migrations/hooks happens on restart.

## Real cron monitoring — important limitation

This sandbox instance **hibernates when idle**, so there is no always-on Node
process to run `node-cron`. The monitoring endpoint (`GET /monitor/health`,
auth-required) is production-ready and returns live per-integration status,
response times and an aggregate error rate. To get true 5-minute checks in
production, point an **external scheduler** at it:

- GitHub Actions scheduled workflow (`on: schedule: - cron: '*/5 * * * *'`)
- Render / Railway cron job
- An uptime bot (UptimeRobot, BetterStack) hitting the endpoint

Each of these should send `Authorization: Bearer <service-user-token>` and can
forward failures to Slack (`SLACK_WEBHOOK_URL`) or email
(`SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL`).

## Containerized deployment (reference)

Docker/Docker-Compose and Docker-MCP orchestration are **not available inside
this sandbox** (no Docker daemon). For a self-hosted target, a compose file
would run three services (`web`, `api`, `pocketbase`) on a shared network with
`pb_data` mounted as a named volume, plus a scheduler container hitting
`/monitor/health`. Build the web app with `npm run build --prefix apps/web` and
serve the static `dist/` behind the API/CDN.

## CI/CD (reference)

A CI pipeline should run `npm run lint` and `npm run build` on push. These files
are not added here because they cannot execute in this sandbox; add them in your
own git host when you self-deploy.
