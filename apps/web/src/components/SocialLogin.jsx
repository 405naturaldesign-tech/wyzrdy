import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// One-click social sign-in buttons. Providers are filtered to those actually
// enabled in PocketBase (listAuthMethods), so buttons only show when the
// provider is configured. On success the user is routed to the dashboard.
const PROVIDERS = {
  google: { label: 'Google', color: '#EA4335' },
  github: { label: 'GitHub', color: '#f0f6fc' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  microsoft: { label: 'Microsoft', color: '#00A4EF' },
  apple: { label: 'Apple', color: '#f5f5f7' },
  linear: { label: 'Linear', color: '#5E6AD2' },
};

function ProviderIcon({ name, color }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: `${color}22`, color }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function SocialLogin({ onError }) {
  const { loginWithProvider, listAuthMethods } = useAuth();
  const nav = useNavigate();
  const [available, setAvailable] = React.useState([]);
  const [busy, setBusy] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    listAuthMethods()
      .then((methods) => {
        const list = methods?.oauth2?.providers?.map((p) => p.name) || [];
        if (alive) setAvailable(list.filter((n) => PROVIDERS[n]));
      })
      .catch(() => { if (alive) setAvailable([]); });
    return () => { alive = false; };
  }, [listAuthMethods]);

  if (!available.length) return null;

  const go = async (provider) => {
    onError?.('');
    setBusy(provider);
    try {
      await loginWithProvider(provider);
      nav('/dashboard', { replace: true });
    } catch (e) {
      onError?.(e?.message || `Could not sign in with ${PROVIDERS[provider].label}.`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {available.map((name) => {
          const p = PROVIDERS[name];
          return (
            <button
              key={name}
              type="button"
              onClick={() => go(name)}
              disabled={!!busy}
              className="glass flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-transform hover:border-gold/40 active:scale-[0.98] disabled:opacity-60"
            >
              {busy === name ? <Loader2 className="h-4 w-4 animate-spin" /> : <ProviderIcon name={name} color={p.color} />}
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
