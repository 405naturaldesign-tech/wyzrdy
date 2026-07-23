/// <reference path="../pb_data/types.d.ts" />

// SPRINT 1: Registration must create an ordinary account only. The previous
// auto-enrollment that granted `pilot_member` / `lifetime_free_status` to every
// signup has been REMOVED — founding access is granted exclusively by the
// server-side verified-purchase pipeline (Stripe webhook -> founding_purchases).
//
// Legacy pilot flags are no longer an authorization source anywhere.

// Public legacy counter kept for backwards compatibility only. It now reports
// zero enrollments so nothing reads a "free pilot" count from it; the real
// founding counter is GET /hcgi/api/founding/count (active paid entitlements).
routerAdd("GET", "/pilot-status", (e) => {
  const cap = 20000;
  return e.json(200, {
    cap: cap,
    enrolled: 0,
    remaining: cap,
    open: true,
    deprecated: true,
  });
});
