# OAuth2 Providers

## Supported providers

`google`, `apple`, `microsoft`, `github`, `gitlab`, `bitbucket`, `discord`,
`facebook`, `twitter`, `instagram`, `kakao`, `livechat`, `mailcow`,
`oidc`, `oidc2`, `oidc3`, `patreon`, `planningcenter`, `spotify`, `strava`,
`twitch`, `vk`, `yandex`, `gitee`, `gitea`, `linear`, `notion`, `monday`, `lark`,
`box`, `trakt`, `wakatime`.

## Template — single provider

```js
// apps/pocketbase/pb_migrations/1729500000_enable_google_oauth_for_users.js
/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("users");

    const newProvider = {
      name: "google",
      clientId: "GOOGLE_CLIENT_ID", // customer provides
      clientSecret: "GOOGLE_CLIENT_SECRET", // customer provides
      authURL: "",
      tokenURL: "",
      userInfoURL: "",
      displayName: "",
      pkce: null,
    };

    // Upsert: keep providers that aren't "google", then append the new one.
    collection.oauth2.providers = [
      ...collection.oauth2.providers.filter((p) => p.name !== newProvider.name),
      newProvider,
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
      collection.oauth2.providers = collection.oauth2.providers.filter(
        (p) => p.name !== "google",
      );
      if (collection.oauth2.providers.length === 0) {
        collection.oauth2.enabled = false;
      }
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Collection not found, skipping revert");
        return;
      }
      throw e;
    }
  },
);
```

## Template — multiple providers

```js
const newProviders = [
  {
    name: "google",
    clientId: "GOOGLE_CLIENT_ID", // customer provides
    clientSecret: "GOOGLE_CLIENT_SECRET", // customer provides
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    displayName: "",
    pkce: null,
  },
  {
    name: "github",
    clientId: "GITHUB_CLIENT_ID", // customer provides
    clientSecret: "GITHUB_CLIENT_SECRET", // customer provides
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    displayName: "",
    pkce: null,
  },
];

const newNames = newProviders.map((p) => p.name);
collection.oauth2.providers = [
  ...collection.oauth2.providers.filter((p) => !newNames.includes(p.name)),
  ...newProviders,
];
collection.oauth2.enabled = true;
```

## `mappedFields` — what comes back from the provider

PB lifts profile data from the OAuth response into the auth record at
sign-in time. The keys are PB's own field slots; the values are the field
names on the auth collection.

```js
collection.oauth2.mappedFields = {
  id: "", // provider's external id — usually leave blank
  name: "name", // provider returns full name → store on `name`
  username: "",
  avatarURL: "avatar", // provider returns photo URL → store on `avatar` field
};
```

If you map to `avatar`, that field MUST already exist on the auth collection
as either `text` (for the URL) or `file` (PB will download to a file).
Add the field with `ADD_FIELD.md` first.

## Frontend usage (React-direct)

```js
import { pb } from "@/lib/pocketbaseClient";
const auth = await pb
  .collection("users")
  .authWithOAuth2({ provider: "google" });
```

## Custom scopes (Calendar app)

PocketBase supports custom scopes from OAuth2 providers, allowing custom API calls with the OAuth2 access token. The token can be accessed via `meta.accessToken`.

```js
import { pb } from "@/lib/pocketbaseClient";
const auth = await pb.collection("users").authWithOAuth2({
  provider: "google",
  scopes: [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
});
```

PB pops a popup or redirect to the provider, handles the callback at
`/hcgi/platform/api/oauth2-redirect`, and resolves with `{ token, record, meta }`.

## Common mistakes

- Setting `mappedFields.avatar` to a field that doesn't exist → migration
  applies but every OAuth login fails to create the user record.
- Forgetting `oauth2.enabled = true` — providers are configured but the
  endpoint stays disabled.
- Using express for oauth2.
- Using a `name` value other than the supported list → migration applies
  silently but the provider doesn't appear in `pb.collection().listAuthMethods()`.
- Re-running the migration without the upsert filter → duplicates the
  provider entry. The template above always filters by name first.
- Incorrectly configured redirect url on oauth2 provider by customer.
