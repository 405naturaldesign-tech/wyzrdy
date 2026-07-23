import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Check, Sparkles, ArrowRight, Info } from 'lucide-react';
import { getTier } from '@/lib/tiers';
import { nextTierId, QUOTA_FEATURES } from '@/lib/featureGate';

/**
 * Paywall modal — triggered when a feature quota is exceeded (or proactively
 * from an upgrade prompt). Non-intrusive, dismissible, and routes the user to
 * checkout for the recommended tier.
 *
 * Props:
 *  - open (bool), onClose ()
 *  - feature (string key of QUOTA_FEATURES), currentTierId
 *  - used, limit (numbers, optional — for the "limit reached" headline)
 */
export default function PaywallModal({ open, onClose, feature, currentTierId = 'individual', used, limit }) {
  const nav = useNavigate();
  const [cycle, setCycle] = React.useState('monthly');

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const recId = nextTierId(currentTierId);
  const rec = getTier(recId);
  const cur = getTier(currentTierId);
  const f = QUOTA_FEATURES[feature] || { label: feature, noun: feature };
  const annual = rec.price != null ? Math.round(rec.price * 12 * 0.8) : null;

  const goCheckout = () => {
    onClose?.();
    nav(`/checkout?tier=${recId}&cycle=${cycle === 'annual' ? 'annual' : 'monthly'}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog" aria-modal="true" aria-label="Upgrade required"
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="glass relative w-full max-w-lg overflow-hidden rounded-2xl p-6"
          initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        >
          <button onClick={onClose} aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-gold"><Lock className="h-5 w-5" /></div>
            <div>
              <div className="text-xs tracking-widest text-muted-foreground">PLAN LIMIT REACHED</div>
              <h2 className="font-serif-lux text-2xl font-semibold">You've hit your {f.label} limit</h2>
            </div>
          </div>

          {typeof used === 'number' && typeof limit === 'number' && (
            <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              You've used <span className="font-semibold text-foreground">{used} / {limit}</span> {f.label} on your{' '}
              <span className="capitalize text-gold">{cur.name}</span> plan this month. Upgrade to keep building.
            </p>
          )}

          {/* Cycle toggle */}
          <div className="mb-4 inline-flex rounded-xl border border-border bg-secondary/40 p-1 text-sm">
            {['monthly', 'annual'].map((c) => (
              <button key={c} onClick={() => setCycle(c)}
                className={`rounded-lg px-4 py-1.5 capitalize transition-colors ${cycle === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {c}{c === 'annual' && <span className="ml-1 text-[10px] text-accent">-20%</span>}
              </button>
            ))}
          </div>

          {/* Recommended tier card */}
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="font-serif-lux text-xl font-semibold capitalize">{rec.name}</span>
                {rec.highlight && <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">Most popular</span>}
              </div>
              <div className="text-right">
                {rec.price == null ? (
                  <span className="font-serif-lux text-2xl font-semibold">Custom</span>
                ) : cycle === 'annual' ? (
                  <><span className="font-serif-lux text-2xl font-semibold">${annual}</span><span className="text-xs text-muted-foreground">/year</span></>
                ) : (
                  <><span className="font-serif-lux text-2xl font-semibold">${rec.price}</span><span className="text-xs text-muted-foreground">/month</span></>
                )}
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {(rec.perks || []).slice(0, 5).map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={goCheckout}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold">
              {rec.price == null ? 'Contact sales' : 'Upgrade now'} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => { onClose?.(); nav('/pricing'); }}
              className="rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary">Learn more</button>
            <button onClick={onClose}
              className="rounded-xl px-4 py-3 text-sm text-muted-foreground hover:text-foreground">Maybe later</button>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Secure checkout · cancel anytime · founding members get one year of Individual plan access for $11.69.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
