/// <reference path="../pb_data/types.d.ts" />

// SPRINT 1: Protect server-controlled user fields from client modification.
// A logged-in user may edit their own profile (name, bio, company, website,
// avatar, preferences) but MUST NOT be able to change any billing / entitlement
// field through the PocketBase REST API. These are set only by trusted
// server-side code (Stripe webhook / superuser client).
//
// Any REST update request that attempts to change a protected field is reverted
// to its stored value before the write is persisted.

const PROTECTED_USER_FIELDS = [
  "subscription_tier",
  "subscription_status",
  "billing_cycle",
  "subscription_start",
  "subscription_end",
  "next_billing_date",
  "pilot_member",
  "lifetime_free_status",
  "pilot_number",
  "pilot_tier",
  "pilot_enrollment_date",
];

onRecordUpdateRequest((e) => {
  // Superuser / server-side writes bypass this guard.
  const auth = e.requestInfo && e.requestInfo.auth;
  const isSuperuser = auth && auth.collection && auth.collection().name === "_superusers";

  if (!isSuperuser) {
    // Load the currently stored record and force protected fields back to
    // their persisted values, discarding any client-supplied changes.
    const original = $app.findRecordById("users", e.record.id);
    for (const f of PROTECTED_USER_FIELDS) {
      e.record.set(f, original.get(f));
    }
  }

  e.next();
}, "users");
