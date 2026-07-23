import React from 'react';
import pb from '@/lib/pocketbaseClient';

// Consent state is stored locally so it works pre-login and without friction.
// When a user is authenticated we also record the choice to activity_log for
// an auditable, timestamped compliance trail.

const KEY = 'wyzrdy_consent_v1';
export const CONSENT_VERSION = 1;

export const CONSENT_CATEGORIES = [
  { id: 'essential', label: 'Essential', desc: 'Required for authentication, security and core functionality.', locked: true },
  { id: 'analytics', label: 'Analytics', desc: 'Help us understand usage to improve the product.' },
  { id: 'marketing', label: 'Marketing', desc: 'Support retargeting and campaign measurement.' },
  { id: 'integrations', label: 'Integrations', desc: 'Enable connected third-party services you choose to use.' },
];

const DEFAULT = { essential: true, analytics: false, marketing: false, integrations: false };

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.version === CONSENT_VERSION) return raw;
  } catch (_) { /* ignore */ }
  return null;
}

const ConsentContext = React.createContext(null);

export function ConsentProvider({ children }) {
  const [record, setRecord] = React.useState(() => read());
  const decided = !!record;
  const prefs = record?.prefs || DEFAULT;

  const persist = React.useCallback((prefsNext) => {
    const next = { version: CONSENT_VERSION, prefs: { ...DEFAULT, ...prefsNext, essential: true }, decidedAt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { /* ignore */ }
    setRecord(next);
    // Best-effort audit trail when authenticated.
    if (pb.authStore.record) {
      pb.collection('activity_log').create({
        owner: pb.authStore.record.id,
        action: 'consent_update',
        resource_type: 'consent',
        meta: { prefs: next.prefs, version: CONSENT_VERSION },
      }, { requestKey: `consent-${Date.now()}` }).catch(() => {});
    }
    return next;
  }, []);

  const value = {
    decided,
    prefs,
    decidedAt: record?.decidedAt || null,
    acceptAll: () => persist({ analytics: true, marketing: true, integrations: true }),
    rejectAll: () => persist({ analytics: false, marketing: false, integrations: false }),
    save: (p) => persist(p),
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = React.useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}
