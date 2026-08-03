import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, ShieldCheck, ArrowRight, Sparkles, AlertTriangle, CheckCircle2,
  Clock, Lock, Star, Flame, MessageCircle,
} from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { FOUNDING_MEMBER, foundingMemberRemainingLabel } from '@/lib/founding';
import { startFoundingMemberCheckout } from '@/lib/entitlement';

export default function FoundingMember() {
  const { isAuthed } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [countdown, setCountdown] = React.useState({ remaining: FOUNDING_MEMBER.cap, cap: FOUNDING_MEMBER.cap });

  React.useEffect(() => {
    if (!isAuthed) nav('/login?next=/checkout/founding-member', { replace: true });
  }, [isAuthed, nav]);

  React.useEffect(() => {
    fetch('/hcgi/api/founding/count')
      .then((r) => r.json())
      .then((d) => setCountdown({ remaining: d.remaining, cap: d.total_cap }))
      .catch(() => {});
  }, []);

  const claim = async () => {
    setBusy(true); setError('');
    try {
      const { url } = await startFoundingMemberCheckout();
      if (url) { window.location.href = url; return; }
      setError('Could not start checkout. Please try again.');
    } catch (e) {
      setError(e.message || 'Something went wrong starting your checkout.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) return null;

  const claimed = FOUNDING_MEMBER.cap - (countdown.remaining || FOUNDING_MEMBER.cap);
  const pct = Math.min(100, (claimed / FOUNDING_MEMBER.cap) * 100);

  return (
    <div className="min-h-screen">
      <Seo title="Founding Member $2 First Month — Wyzrdy" description="Lock in $2/mo forever. Only 20,000 founding spots. Claim yours now." path="/checkout/founding-member" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <motion.div {...reveal(0)} className="mx-auto max-w-2xl">
          {/* Urgency Banner */}
          <motion.div {...reveal(0.02)} className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
              <Flame className="h-3.5 w-3.5" /> {foundingMemberRemainingLabel(countdown.remaining)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-gold" /> Lock in before spots vanish
            </span>
          </motion.div>

          <h1 className="font-serif-lux text-4xl font-semibold md:text-5xl">
            Founding Member Launch —
            <span className="block text-gold">$2 First Month, Lock In Forever</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Join as a Founding Member at $2 for your first month. Your $2/mo rate is locked in for life — no price increases, ever. Only 20,000 spots exist, and once they're gone, standard pricing returns.
          </p>

          {/* Scarcity Progress Bar */}
          <div className="mt-6 glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{claimed.toLocaleString()} claimed</span>
              <span className="text-muted-foreground">{countdown.remaining?.toLocaleString?.() || FOUNDING_MEMBER.cap.toLocaleString()} remaining</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-destructive via-orange-400 to-gold"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Checkout Card */}
          <div className="mt-6 glass rounded-2xl p-6 border-2 border-primary/40 glow-gold">
            <div className="text-xs font-semibold tracking-widest text-gold uppercase mb-2">Founding Member Offer</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-serif-lux text-3xl font-semibold">Wyzrdy Individual</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  <span className="line-through text-muted-foreground/60">$29/mo</span>{' '}
                  <span className="text-accent font-semibold">→ $2 first month</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif-lux text-5xl font-semibold text-gold">$2</div>
                <div className="text-xs text-muted-foreground">first month</div>
                <div className="mt-0.5 text-xs text-accent font-semibold">then $2/mo forever</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>Rate locked for life — never increases</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>Founding Member badge on your profile</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>Cancel anytime — no lock-in contract</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>Full Individual plan access</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}

            <button onClick={claim} disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-bold text-primary-foreground glow-gold disabled:opacity-70 transition-transform active:scale-[0.97]">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {busy ? 'Creating secure checkout…' : `${FOUNDING_MEMBER.cta}`}
              {!busy && <ArrowRight className="h-5 w-5" />}
            </button>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-accent" /> Secure Stripe checkout. PCI-compliant. No card stored on our servers.
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {FOUNDING_MEMBER.clarification}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
              <Clock className="h-3.5 w-3.5" /> Warning: if you cancel, the $2/mo rate is gone forever. Standard pricing applies on re-subscription.
            </p>
            <Link to="/pricing" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
              Compare all plans →
            </Link>
          </div>

          {/* Social Proof */}
          <motion.div {...reveal(0.15)} className="mt-10">
            <h2 className="text-lg font-semibold text-center mb-6">What Founding Members are saying</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {FOUNDING_MEMBER.socialProof.map((t, i) => (
                <div key={i} className="glass rounded-xl p-5 text-center">
                  <div className="flex justify-center gap-0.5 mb-2">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-gold text-gold" />
                    ))}
                  </div>
                  <p className="text-sm italic text-muted-foreground">"{t.quote}"</p>
                  <div className="mt-3 text-xs">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-muted-foreground"> — {t.role}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="inline h-4 w-4 mr-1 text-accent" />
              <span className="font-semibold">{claimed.toLocaleString()}</span> founders have already claimed their spot. Don't miss out.
            </p>
          </motion.div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}