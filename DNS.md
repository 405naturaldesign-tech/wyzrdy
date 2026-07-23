# DNS, CDN & Domain Optimization — Wyzrdy

This document is the reference for configuring DNS for `wyzrdy.com` (or your
custom domain) when the Wyzrdy ecosystem is deployed to a Hostinger VPS with an
optional Cloudflare front door. Records below use placeholder values — replace
`203.0.113.10` with your VPS IPv4 and `2001:db8::10` with your IPv6.

## 1. Core records

| Type  | Name              | Value / Target        | TTL  | Purpose                                  |
| ----- | ----------------- | --------------------- | ---- | ---------------------------------------- |
| A     | `@`               | `203.0.113.10`        | 300  | Apex → VPS (web app)                     |
| AAAA  | `@`               | `2001:db8::10`        | 300  | Apex IPv6                                |
| CNAME | `www`             | `wyzrdy.com`          | 3600 | Redirect www → apex                      |
| A     | `api`             | `203.0.113.10`        | 300  | `api.wyzrdy.com` → Express API           |
| CNAME | `app`             | `wyzrdy.com`          | 3600 | `app.wyzrdy.com` → dashboard SPA         |
| CNAME | `status`          | `wyzrdy.com`          | 3600 | `status.wyzrdy.com` → monitor page       |

### TTL strategy
- Use **300s (5 min)** on records you may fail over (`@`, `api`) so DNS changes
  propagate fast during incidents.
- Use **3600s (1 hr)** on stable CNAMEs to cut resolver load.
- When behind Cloudflare (proxied / orange cloud), Cloudflare manages edge TTL;
  keep the origin TTL low but let Cloudflare cache aggressively via page rules.

## 2. Email authentication (only if sending mail from the domain)

| Type | Name              | Value                                                             | Purpose |
| ---- | ----------------- | ---------------------------------------------------------------- | ------- |
| MX   | `@`               | `10 mail.wyzrdy.com`                                              | Inbound mail |
| TXT  | `@`               | `v=spf1 include:_spf.your-mail-provider.com ~all`                | SPF     |
| TXT  | `resend._domainkey` | `v=DKIM1; k=rsa; p=<public-key>`                               | DKIM    |
| TXT  | `_dmarc`          | `v=DMARC1; p=quarantine; rua=mailto:dmarc@wyzrdy.com; pct=100`    | DMARC   |

> Transactional email in this stack is sent by PocketBase's built-in mailer /
> hooks. Point SPF/DKIM at whichever relay PocketBase SMTP is configured to use.

## 3. SSL / certificate authority

| Type | Name | Value                                | Purpose                                   |
| ---- | ---- | ------------------------------------ | ----------------------------------------- |
| CAA  | `@`  | `0 issue "letsencrypt.org"`          | Only Let's Encrypt may issue certs        |
| CAA  | `@`  | `0 issue "pki.goog"`                 | Allow Google Trust Services (Cloudflare)  |
| CAA  | `@`  | `0 iodef "mailto:security@wyzrdy.com"` | Report unauthorized issuance attempts   |

## 4. Cloudflare (DNS + CDN + DDoS)

1. Add `wyzrdy.com` to Cloudflare; update the registrar nameservers to the two
   Cloudflare NS records shown in the dashboard.
2. Set records above with the **proxy (orange cloud) ON** for `@`, `www`, `app`
   and `status`; keep `api` proxied too unless you need raw client IPs (then
   read `CF-Connecting-IP`).
3. SSL/TLS mode: **Full (strict)** — install a valid origin cert on the VPS.
4. Enable: Always Use HTTPS, HTTP/3 (QUIC), Brotli, Auto Minify (JS/CSS),
   Tiered Cache, and Bot Fight Mode.
5. Cache rule for the SPA build assets: cache `*/assets/*` for 1 year
   (immutable, content-hashed by Vite). Bypass cache for `/hcgi/*` (API + PB).
6. Rate limiting rule (WAF): mirror the per-tier gateway limits as a coarse
   edge safety net (e.g. 2000 req/min/IP) to absorb volumetric attacks before
   they reach the origin.

## 5. Health checks & monitoring

- Cloudflare **Health Checks**: monitor `https://api.wyzrdy.com/health`
  (expects `{"status":"ok"}`) every 60s from multiple regions; alert on 2
  consecutive failures.
- App-level: `GET /health` (liveness) and `GET /perf/metrics` (latency,
  throughput, error rate) power the in-app Performance Lab (`/performance`).
- Integration health: `GET /monitor/health` verifies all upstream API
  integrations; surfaced on the `/monitor` page.
- External uptime (99.9% SLA target): point an uptime monitor (UptimeRobot,
  Better Stack, Pingdom) at `https://wyzrdy.com` and `https://api.wyzrdy.com/health`.

## 6. Verification commands

```bash
dig +short wyzrdy.com A
dig +short api.wyzrdy.com A
dig +short wyzrdy.com CAA
dig +short TXT _dmarc.wyzrdy.com
curl -fsS https://api.wyzrdy.com/health
```

## 7. Propagation checklist

- [ ] Registrar nameservers point to Cloudflare (or Hostinger DNS)
- [ ] A/AAAA resolve to the VPS
- [ ] `www` and subdomains resolve
- [ ] HTTPS valid (Full strict), HTTP → HTTPS redirect works
- [ ] SPF/DKIM/DMARC pass (mail-tester.com) — if sending email
- [ ] CAA restricts issuance to your CA(s)
- [ ] `/health` returns 200 through the proxy
- [ ] Uptime + Cloudflare health checks green
