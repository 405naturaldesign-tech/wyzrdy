import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Loader2, Sparkles, ArrowRight, Lock, Users, Zap } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { VIRAL_TIERS, SPRINT_PIPELINE } from '@/lib/pricing';
import { getReferralStatus } from '@/lib/viral';
import apiServerClient from '@/lib/apiServerClient';
import pb from '@/lib/pocketbaseClient';
import ShareButtons from '@/components/ShareButtons';

export default function Pricing() {
  const { user, isAuthed } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [ref, setRef] = React.useState(null);
  const [refLoading, setRefLoading] = React.useState(false);
  const [stripeReady, setStripeReady] = React.useState(true);
  const [stripeChecked, setStripeChecked] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!isAuthed) { setRef(null); return; }
    setRefLoading(true);
    getReferralStatus()
      .then((data) => { if (alive) setRef(data); })
      .catch(() => { if (alive) setRef(null); })
      .finally(() => { if (alive) setRefLoading(false); });
    return () => { alive = false; };
  }, [isAuthed]);

  React.useEffect(() => {
    let alive = true;
    apiServerClient.fetch('/payments/config-status')
      .then((r) => (r.ok ? r.json() : { stripe_configured: false }))
      .then((data) => { if (alive) setStripeReady(!!data.stripe_configured); })
      .catch(() => { if (alive) setStripeReady(false); })
      .finally(() => { if (alive) setStripeChecked(true); });
    return () => { alive = false; };
  }, []);

  const referralCount = ref?.referral_count ?? 0;

  const startCheckout = async (tier) => {
    if (!isAuthed) { nav('/signup'); return; }
    if (stripeChecked && !stripeReady) {
      setError('Payments are being finalized for this plan. Please check back shortly — no charge has been made.');
      return;
    }
    setError('');
    setBusy(tier.checkoutTier);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (pb.authStore.isValid && pb.authStore.token) headers.Authorization = `Bearer ${pb.authStore.token}`;
      const res = await apiServerClient.fetch(`/checkout/tier?tier=${encodeURIComponent(tier.checkoutTier)}`, { method: 'POST', headers });
      const data = await res.json().catch(() => null);
      if (res.status === 503) {
        throw new Error('Payments are being finalized for this plan. Please check back shortly — no charge has been made.');
      }
      if (!res.ok) throw new Error(data?.error || `Checkout failed (${res.status})`);
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error('Checkout session could not be created.');
    } catch (err) {
      setError(err.message || 'Unable to start checkout.');
      setBusy('');
    }
  };

  const buttonState = (t) => {
    const referralLocked = t.minReferrals && referralCount < t.minReferrals;
    const paymentsLocked = stripeChecked && !stripeReady;
    const locked = referralLocked || paymentsLocked;
    const label = referralLocked ? `Unlock with ${t.minReferrals} referrals` : paymentsLocked ? 'Payments coming soon' : t.cta;
    return { locked, label };
  };

  return (
    <div className="min-h-screen">
      <Seo title="Viral Pipeline Pricing — Wyzrdy" description="Plato $22.22/mo, Viral Entry $7.77/mo, Promo Reward $2.22/mo, Enterprise $333.33/mo, and metered Sprint access. Refer friends to unlock lower rates." path="/pricing" />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-8 text-center md:pt-40">
        <motion.div {...reveal(0)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs tracking-widest text-gold">
            <Sparkles className="h-3.5 w-3.5" /> VIRAL PIPELINE PRICING
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-serif-lux text-4xl font-semibold leading-tight md:text-6xl">
            Refer friends. Watch your price <span className="text-gold">fall</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Every plan includes Wyzrdy, Easy Breezy and ForgeSEO. Verified referrals cascade your rate down to $2.22/mo — and stack toward free years.
          </p>
        </motion.div>
      </Section>

      {/* Referral progress */}
      {isAuthed && (
        <Section className="relative pb-6">
          <motion.div {...reveal(0)} className="glass mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl p-6 text-center">
            <Users className="h-5 w-5 text-accent" />
            {refLoading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your referral progress…</span>
            ) : ref ? (
              <>
                <p className="text-sm text-foreground md:text-base">
                  You are <span className="font-semibold text-gold">{ref.friends_to_2for1}</span> verified friend{ref.friends_to_2for1 === 1 ? '' : 's'} away from unlocking Plato for $2.22/mo, or <span className="font-semibold text-gold">{ref.friends_to_free_year}</span> friend{ref.friends_to_free_year === 1 ? '' : 's'} away from a full year free.
                </p>
                <p className="text-xs text-muted-foreground">{referralCount} verified referral{referralCount === 1 ? '' : 's'} so far</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Refer friends to unlock lower rates. Your progress will appear here.</p>
            )}
          </motion.div>
        </Section>
      )}

      {stripeChecked && !stripeReady && (
        <Section className="relative pb-2">
          <p className="mx-auto max-w-2xl rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-gold">
            Card payments are being finalized for these plans. Checkout will open as soon as they go live — no charge has been made.
          </p>
        </Section>
      )}

      {error && (
        <Section className="relative pb-2">
          <p className="mx-auto max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive-foreground">{error}</p>
        </Section>
      )}

      {/* Plan cards */}
      <Section className="relative pb-12">
        <div className="grid gap-4 lg:grid-cols-4">
          {VIRAL_TIERS.map((t, i) => {
            const { locked, label } = buttonState(t);
            return (
              <motion.div key={t.id} {...reveal(i * 0.05)}
                className={`glass relative flex flex-col rounded-3xl p-6 ${t.highlight ? 'border-primary/50 glow-gold' : ''}`}>
                {t.highlight && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-widest text-primary-foreground">STANDARD BASE</span>}
                <div className="text-sm font-semibold tracking-widest text-gold">{t.name.toUpperCase()}</div>
                <p className="mt-1 min-h-[3.5rem] text-xs text-muted-foreground">{t.blurb}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className="font-serif-lux text-4xl font-semibold">{t.priceLabel}</span>
                  <span className="mb-1 text-sm text-muted-foreground">{t.cadence}</span>
                </div>
                <button onClick={() => !locked && startCheckout(t)} disabled={locked || busy === t.checkoutTier}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 ${t.highlight ? 'bg-primary text-primary-foreground glow-gold' : 'border border-border hover:bg-secondary'} ${locked ? 'cursor-not-allowed' : ''}`}>
                  {busy === t.checkoutTier ? <Loader2 className="h-4 w-4 animate-spin" /> : locked ? <Lock className="h-4 w-4" /> : null}
                  {isAuthed ? label : 'Sign up to choose'}
                  {!locked && busy !== t.checkoutTier && <ArrowRight className="h-4 w-4" />}
                </button>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">{t.support}</div>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* Sprint / Pipeline metered access */}
      <Section className="relative pb-16">
        <motion.div {...reveal(0)} className="glass mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl p-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-accent/10 p-3"><Zap className="h-6 w-6 text-accent" /></span>
            <div>
              <div className="text-sm font-semibold tracking-widest text-gold">{SPRINT_PIPELINE.name.toUpperCase()}</div>
              <p className="mt-1 text-sm text-muted-foreground">{SPRINT_PIPELINE.blurb}</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-serif-lux text-3xl font-semibold">{SPRINT_PIPELINE.priceLabel}</span>
                <span className="mb-1 text-sm text-muted-foreground">{SPRINT_PIPELINE.cadence}</span>
              </div>
            </div>
          </div>
          <button onClick={() => startCheckout(SPRINT_PIPELINE)} disabled={busy === SPRINT_PIPELINE.checkoutTier || (stripeChecked && !stripeReady)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-transform hover:bg-secondary active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
            {busy === SPRINT_PIPELINE.checkoutTier ? <Loader2 className="h-4 w-4 animate-spin" /> : (stripeChecked && !stripeReady) ? <Lock className="h-4 w-4" /> : null}
            {!isAuthed ? 'Sign up to buy' : (stripeChecked && !stripeReady) ? 'Payments coming soon' : SPRINT_PIPELINE.cta}
            {stripeReady && busy !== SPRINT_PIPELINE.checkoutTier && <ArrowRight className="h-4 w-4" />}
          </button>
        </motion.div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          All recurring plans billed monthly. Promo Reward requires 2+ verified referrals and is hard-capped at 12 months. Sprint access is a metered one-off consumable.
        </p>
      </Section>

      <Section className="relative pb-24">
        <motion.div {...reveal(0)} className="mx-auto max-w-xl text-center">
          <h2 className="font-serif-lux text-3xl font-semibold">Lower your price by sharing</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every verified friend moves you toward $2.22/mo and free years. Share your link.</p>
          <div className="mt-6 text-left"><ShareButtons userId={user?.id || ''} title="Share Wyzrdy" context="pricing" /></div>
        </motion.div>
      </Section>

      <SiteFooter />
    </div>
  );
}
