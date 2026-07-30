import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const PROVIDERS = {
  google: { label: 'Google', color: '#EA4335' },
  github: { label: 'GitHub', color: '#f0f6fc' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
};

function ProviderIcon({ name, color }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: `${color}22`, color }}
    >
      {name === 'whatsapp' ? 'WA' : name === 'linkedin' ? 'LI' : name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function SocialLogin({ onError }) {
  const { loginWithProvider } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = React.useState('');

  const go = async (name) => {
    const p = PROVIDERS[name];
    if (!p || !['google', 'github', 'facebook'].includes(name)) {
      onError?.(`${p?.label || name} sign-in is not yet available.`);
      return;
    }
    onError?.('');
    setBusy(name);
    try {
      await loginWithProvider(name);
      nav('/dashboard', { replace: true });
    } catch (e) {
      onError?.(e?.message || `Could not sign in with ${p.label}.`);
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
        {Object.entries(PROVIDERS).map(([name, p]) => (
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
        ))}
      </div>
    </div>
  );
}
