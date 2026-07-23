/// <reference path="../pb_data/types.d.ts" />

// Enables Google and Facebook/Meta social login on the `users` auth collection.
// Client credentials are read from environment variables so no secrets live in
// source. Set these in the PocketBase environment (or platform env):
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
//   FACEBOOK_OAUTH_CLIENT_ID, FACEBOOK_OAUTH_CLIENT_SECRET
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    const newProviders = [
      {
        name: "google",
        clientId: $os.getenv("GOOGLE_OAUTH_CLIENT_ID") || "GOOGLE_CLIENT_ID",
        clientSecret: $os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") || "GOOGLE_CLIENT_SECRET",
        authURL: "",
        tokenURL: "",
        userInfoURL: "",
        displayName: "Google",
        pkce: null,
      },
      {
        name: "facebook",
        clientId: $os.getenv("FACEBOOK_OAUTH_CLIENT_ID") || "FACEBOOK_CLIENT_ID",
        clientSecret: $os.getenv("FACEBOOK_OAUTH_CLIENT_SECRET") || "FACEBOOK_CLIENT_SECRET",
        authURL: "",
        tokenURL: "",
        userInfoURL: "",
        displayName: "Facebook",
        pkce: null,
      },
    ];

    const newNames = newProviders.map((p) => p.name);
    collection.oauth2.providers = [
      ...collection.oauth2.providers.filter((p) => !newNames.includes(p.name)),
      ...newProviders,
    ];
    collection.oauth2.enabled = true;
    collection.oauth2.mappedFields = {
      id: "",
      name: "name",
      username: "",
      avatarURL: "avatar",
    };

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("users");
      const remove = ["google", "facebook"];
      collection.oauth2.providers = collection.oauth2.providers.filter(
        (p) => !remove.includes(p.name),
      );
      if (collection.oauth2.providers.length === 0) {
        collection.oauth2.enabled = false;
      }
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
