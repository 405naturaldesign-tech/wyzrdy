import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Sparkles, ArrowRight, Clock, Share2 } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { getEntitlement, getFoundingCount } from '@/lib/entitlement';
import { FOUNDING } from '@/lib/founding';

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [ent, setEnt] = React.useState(null);
  const [count, setCount] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [attempts, setAttempts] = React.useState(0);

  // Poll entitlement — the webhook grants access asynchronously, so we wait
  // for it rather than trusting the redirect.
  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [e, c] = await Promise.all([getEntitlement(), getFoundingCount().catch(() => null)]);
        if (cancelled) return;
        setEnt(e);
        if (c) setCount(c);
        if (e.entitlement_status === 'active') { setLoading(false); return; }
      } catch (_) { /* keep polling */ }
      if (cancelled) return;
      setAttempts((a) => a + 1);
    };
    poll();
    const id = setInterval(() => {
      setAttempts((a) => {
        if (a >= 12) { clearInterval(id); setLoading(false); return a; }
        return a;
      });
      poll();
    }, 2500);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = ent?.entitlement_status === 'active';
  const claimNumber = count?.completed_purchases;

  return (
    <div className="min-h-screen">
      <Seo title="Payment received — Wyzrdy" description="Your Wyzrdy founding access is being confirmed." path="/checkout/success" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <motion.div {...reveal(0)} className="mx-auto max-w-xl text-center">
          {active ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-5 font-serif-lux text-4xl font-semibold">You're a Founding Wizard</h1>
              <p className="mt-3 text-muted-foreground">
                {ent.purchase_type === 'founding_lifetime'
                  ? 'One year of Individual-plan access is now active on your account.'
                  : `Your ${ent.purchase_type} subscription is active.`}
              </p>

              <div className="mt-6 glass rounded-2xl p-6 text-left">
                {ent.purchase_type === 'founding_lifetime' && claimNumber != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Claim #{claimNumber.toLocaleString()} of {FOUNDING.cap.toLocaleString()}
                  </div>
                )}
                <div className="mt-2 text-sm text-muted-foreground">
                  Access level: <span className="text-foreground">One year of Individual-plan access</span>
                </div>
                <div className="mt-4 grid gap-2">
                  <Link to="/dashboard" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold">
                    Go to your dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/pricing" className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary">
                    <Share2 className="h-4 w-4" /> Share Wyzrdy
                  </Link>
                </div>
              </div>
            </>
          ) : loading ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-gold" />
              <h1 className="mt-5 font-serif-lux text-3xl font-semibold">Confirming your payment…</h1>
              <p className="mt-3 text-muted-foreground">
                We're verifying your payment with Stripe. This usually takes a few seconds.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Clock className="h-8 w-8" />
              </div>
              <h1 className="mt-5 font-serif-lux text-3xl font-semibold">Payment processing</h1>
              <p className="mt-3 text-muted-foreground">
                Your payment is still being confirmed. Your access will activate automatically once
                Stripe confirms it — check your dashboard shortly.
              </p>
              <Link to="/dashboard" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary">
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
          {sessionId && <p className="mt-6 text-[11px] text-muted-foreground/70">Session: {sessionId}</p>}
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
