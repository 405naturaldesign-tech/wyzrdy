import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, ArrowRight, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { FOUNDING } from '@/lib/founding';
import PilotCounter from '@/components/PilotCounter';
import { startFoundingCheckout } from '@/lib/entitlement';

export default function FoundingCheckout() {
  const { isAuthed } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isAuthed) nav('/login?next=/checkout/founding', { replace: true });
  }, [isAuthed, nav]);

  const claim = async () => {
    setBusy(true); setError('');
    try {
      const { url } = await startFoundingCheckout();
      if (url) { window.location.href = url; return; }
      setError('Could not start checkout. Please try again.');
    } catch (e) {
      setError(e.message || 'Something went wrong starting your checkout.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <div className="min-h-screen">
      <Seo title="Claim Founding Access — Wyzrdy" description="Secure one year of Individual-plan access for one payment of $11.69." path="/checkout/founding" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <motion.div {...reveal(0)} className="mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Founding offer
          </span>
          <h1 className="mt-4 font-serif-lux text-4xl font-semibold md:text-5xl">
            Claim Founding Access
          </h1>
          <p className="mt-3 text-muted-foreground">{FOUNDING.headline}</p>

          <div className="mt-6"><PilotCounter /></div>

          <div className="mt-6 glass rounded-2xl p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-serif-lux text-2xl font-semibold">Founding Access</div>
                <div className="text-xs text-muted-foreground">One-time payment · one year of access</div>
              </div>
              <div className="text-right">
                <div className="font-serif-lux text-4xl font-semibold text-gold">$11.69</div>
                <div className="text-xs text-muted-foreground">one time</div>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}

            <button onClick={claim} disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-70">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Creating secure checkout…' : 'Claim Founding Access — $11.69'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-accent" /> Encrypted Stripe checkout (test mode). PCI-handled by Stripe.
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{FOUNDING.clarification}</p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Access is granted only after Stripe confirms your payment.
            </div>
            <Link to="/pricing" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
              Prefer a subscription? Compare all plans
            </Link>
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
