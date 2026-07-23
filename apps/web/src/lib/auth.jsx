import React from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(pb.authStore.record);

  React.useEffect(() => {
    const unsub = pb.authStore.onChange((_t, record) => setUser(record));
    // best-effort token refresh on load
    if (pb.authStore.isValid) {
      pb.collection('users').authRefresh().catch(() => pb.authStore.clear());
    }
    // track referral link clicks (best-effort, once per session)
    if (typeof window !== 'undefined' && !sessionStorage.getItem('ref_click_logged')) {
      import('@/lib/social').then(({ logReferral, referralContext }) => {
        if (referralContext().ref) {
          sessionStorage.setItem('ref_click_logged', '1');
          logReferral('click');
        }
      }).catch(() => {});
    }
    return unsub;
  }, []);

  const logActivity = React.useCallback(async (action, resource_type, resource_id, meta) => {
    if (!pb.authStore.record) return;
    try {
      await pb.collection('activity_log').create({
        owner: pb.authStore.record.id,
        action,
        resource_type: resource_type || '',
        resource_id: resource_id || '',
        meta: meta || {},
      }, { requestKey: `activity-${Date.now()}-${Math.random()}` });
    } catch (_) { /* non-blocking */ }
  }, []);

  const value = {
    user,
    isAuthed: pb.authStore.isValid,
    login: async (email, password) => {
      const res = await pb.collection('users').authWithPassword(email, password);
      logActivity('login', 'auth');
      return res;
    },
    signup: async ({ email, password, name }) => {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name: name || email.split('@')[0],
        subscription_tier: 'individual',
        preferences: { theme: 'dark', notifications: true, privacy: 'private' },
      });
      const res = await pb.collection('users').authWithPassword(email, password);
      logActivity('signup', 'auth');
      try {
        const { logReferral } = await import('@/lib/social');
        await logReferral('signup');
      } catch (_) { /* referral tracking is best-effort */ }
      return res;
    },
    loginWithProvider: async (provider) => {
      const res = await pb.collection('users').authWithOAuth2({ provider });
      // Ensure a friendly display name + default tier on first social login.
      try {
        const rec = res.record;
        const patch = {};
        if (!rec.name && res.meta?.name) patch.name = res.meta.name;
        if (!rec.subscription_tier) patch.subscription_tier = 'individual';
        if (Object.keys(patch).length) await pb.collection('users').update(rec.id, patch);
      } catch (_) { /* non-blocking */ }
      logActivity('login_oauth', 'auth', provider);
      return res;
    },
    listAuthMethods: async () => pb.collection('users').listAuthMethods(),
    logout: () => { logActivity('logout', 'auth'); pb.authStore.clear(); },
    updateProfile: async (data) => {
      const rec = await pb.collection('users').update(pb.authStore.record.id, data);
      logActivity('update_profile', 'user', rec.id);
      return rec;
    },
    logActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
