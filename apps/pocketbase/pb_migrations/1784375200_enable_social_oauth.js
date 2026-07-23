/// <reference path="../pb_data/types.d.ts" />

// Enable OAuth2 social sign-in providers on the users collection.
// Client IDs/secrets are placeholders — the customer configures live
// credentials in the PocketBase settings before production. Enabling the
// providers wires the auth endpoints + mapped profile fields so the
// frontend one-click buttons and account linking work end-to-end.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('users');

    const providers = [
      { name: 'google' },
      { name: 'github' },
      { name: 'facebook' },
      { name: 'microsoft' },
      { name: 'apple' },
      { name: 'linear' },
    ].map((p) => ({
      name: p.name,
      clientId: `${p.name.toUpperCase()}_CLIENT_ID`,
      clientSecret: `${p.name.toUpperCase()}_CLIENT_SECRET`,
      authURL: '',
      tokenURL: '',
      userInfoURL: '',
      displayName: '',
      pkce: null,
    }));

    const names = providers.map((p) => p.name);
    collection.oauth2.providers = [
      ...collection.oauth2.providers.filter((p) => !names.includes(p.name)),
      ...providers,
    ];
    collection.oauth2.enabled = true;
    collection.oauth2.mappedFields = {
      id: '',
      name: 'name',
      username: '',
      avatarURL: 'avatar',
    };

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('users');
      collection.oauth2.providers = [];
      collection.oauth2.enabled = false;
      app.save(collection);
    } catch (e) {
      if (e.message.includes('no rows in result set')) return;
      throw e;
    }
  },
);
