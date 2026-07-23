import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { useConsent, CONSENT_CATEGORIES } from '@/lib/consent';

export default function ConsentBanner() {
  const { decided, prefs, acceptAll, rejectAll, save } = useConsent();
  const [customize, setCustomize] = React.useState(false);
  const [draft, setDraft] = React.useState(prefs);

  React.useEffect(() => setDraft(prefs), [prefs]);
  if (decided) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-label="Cookie consent"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-5 sm:pb-5"
      >
        <div className="glass mx-auto max-w-3xl rounded-2xl p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-gold">
              <Cookie className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-serif-lux text-lg font-semibold">Your privacy, your choice</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                We use essential cookies to run Wyzrdy, and optional cookies to improve it. Declining optional cookies never limits your access. See our{' '}
                <Link to="/cookies" className="text-gold underline-offset-4 hover:underline">Cookie Policy</Link>,{' '}
                <Link to="/privacy" className="text-gold underline-offset-4 hover:underline">Privacy Policy</Link> and{' '}
                <Link to="/terms" className="text-gold underline-offset-4 hover:underline">Terms</Link>.
              </p>

              <AnimatePresence initial={false}>
                {customize && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                      {CONSENT_CATEGORIES.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-[hsl(var(--gold))]"
                            checked={c.locked ? true : !!draft[c.id]}
                            disabled={c.locked}
                            onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.checked }))}
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {c.label}
                              {c.locked && <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Always on</span>}
                            </span>
                            <span className="block text-xs text-muted-foreground">{c.desc}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {customize ? (
                  <button
                    onClick={() => save(draft)}
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"
                  >
                    Save preferences
                  </button>
                ) : (
                  <button
                    onClick={acceptAll}
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"
                  >
                    Accept all
                  </button>
                )}
                <button
                  onClick={rejectAll}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  Reject non-essential
                </button>
                <button
                  onClick={() => setCustomize((v) => !v)}
                  className="rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {customize ? 'Hide options' : 'Customize'}
                </button>
                <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" /> GDPR &amp; CCPA compliant
                </span>
              </div>
            </div>
            <button
              onClick={rejectAll}
              aria-label="Dismiss and reject non-essential cookies"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
