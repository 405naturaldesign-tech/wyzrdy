/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		let user;
		try {
			user = app.findFirstRecordByFilter("users", "email = 'DM@wyzrdy.com'");
		} catch (e) {
			if (e.message && e.message.includes("no rows in result set")) {
				console.log("DM@wyzrdy.com not found, skipping grant");
				return;
			}
			throw e;
		}
		if (!user) return;

		const now = new Date();
		const nextYear = new Date(now.getTime());
		nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);

		user.set("verified", true);
		user.set("emailVisibility", true);
		user.set("subscription_tier", "individual");
		user.set("subscription_status", "active");
		user.set("billing_cycle", "annual");
		user.set("subscription_start", now.toISOString());
		user.set("subscription_end", nextYear.toISOString());
		user.set("next_billing_date", nextYear.toISOString());

		app.save(user);
	},
	(app) => {
		let user;
		try {
			user = app.findFirstRecordByFilter("users", "email = 'DM@wyzrdy.com'");
		} catch (e) {
			if (e.message && e.message.includes("no rows in result set")) {
				return;
			}
			throw e;
		}
		if (!user) return;

		user.set("subscription_tier", "");
		user.set("subscription_status", "");
		user.set("billing_cycle", "");
		user.set("subscription_start", "");
		user.set("subscription_end", "");
		user.set("next_billing_date", "");

		app.save(user);
	},
);
