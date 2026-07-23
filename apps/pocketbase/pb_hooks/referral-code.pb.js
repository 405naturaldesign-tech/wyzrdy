/// <reference path="../pb_data/types.d.ts" />

// Generate a unique referral code for every new user, server-side. The code is
// the only referral artifact created at signup — a referral NEVER grants any
// entitlement. Conversions are recorded only from verified paid webhooks.
onRecordAfterCreateSuccess((e) => {
  try {
    const userId = e.record.id;
    const rand = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
    const code = "wiz_" + rand;

    const col = $app.findCollectionByNameOrId("referral_codes");
    const rec = new Record(col);
    rec.set("owner", userId);
    rec.set("code", code);
    $app.save(rec);
  } catch (err) {
    $app.logger().error("referral code generation failed", "err", String(err));
  }
  e.next();
}, "users");
