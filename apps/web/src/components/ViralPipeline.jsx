import React from 'react';
import { Loader2, Copy, Check, Gift, Rocket, Users, Sparkles, Clock } from 'lucide-react';
import { getReferralStatus, generateReferralLink } from '@/lib/viral';

const PROMO_LABELS = {
  inactive: 'Standard billing',
  active_2for1: '$2.22/mo unlocked',
  expired_2for1: '$2.22/mo promo expired',
  free_year_1: '1 year free',
  free_year_2: '2 years free',
  free_year_5: '5 years free (max)',
};

function Milestone({ icon: Icon, title, remaining, done, target }) {
  return (
    <div className={`glass rounded-2xl p-5 ${done ? 'glow-gold' : ''}`}>
      <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-secondary text-gold"><Icon className="h-4 w-4" /></div>
      <div className="font-serif-lux text-2xl font-semibold">{done ? 'Unlocked' : `${remaining} to go`}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
      {!done && <div className="mt-1 text-[11px] text-muted-foreground">at {target} verified friends</div>}
    </div>
  );
}

export default function ViralPipeline() {
  const [status, setStatus] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const s = await getReferralStatus();
      setStatus(s);
    } catch (e) {
      setErr(e.message || 'Could not load referral status.');
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const makeLink = async () => {
    setBusy(true); setErr('');
    try {
      await generateReferralLink();
      await load();
    } catch (e) {
      setErr(e.message || 'Could not generate a link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!status?.referral_link) return;
    try {
      await navigator.clipboard.writeText(status.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) { /* clipboard denied */ }
  };

  if (status === null && !err) {
    return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  }

  const count = status?.referral_count ?? 0;
  const pctToYear = Math.min(100, Math.round((count / 10) * 100));

  return (
    <div className="space-y-5">
      {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>}

      {/* Dynamic messaging */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-2 flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold" /> VIRAL PIPELINE
        </div>
        <p className="font-serif-lux text-xl leading-snug text-foreground md:text-2xl">{status?.message}</p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{count} of 10 friends referred</span>
            <span>{pctToYear}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctToYear}%` }} />
          </div>
        </div>
      </div>

      {/* Referral link */}
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 text-xs tracking-widest text-muted-foreground">YOUR REFERRAL LINK</div>
        {status?.referral_link ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={status.referral_link} className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 font-mono-lux text-sm text-foreground" />
            <button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
          </div>
        ) : (
          <button onClick={makeLink} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Generate referral link
          </button>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Friends who subscribe to the $7.77/mo Viral Entry Tier count once their payment is verified. Referrals are counted server-side only — never on clicks or signups.
        </p>
      </div>

      {/* Milestones */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Milestone icon={Users} title="$2.22/mo for 1 year" target={2} remaining={status?.friends_to_2for1} done={status?.friends_to_2for1 === 0} />
        <Milestone icon={Gift} title="1 year free" target={10} remaining={status?.friends_to_free_year} done={status?.friends_to_free_year === 0} />
        <Milestone icon={Sparkles} title="2 years free" target={20} remaining={status?.friends_to_2_years} done={status?.friends_to_2_years === 0} />
      </div>

      {/* Promo status */}
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 text-xs tracking-widest text-muted-foreground">PROMO STATUS</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-sm font-semibold text-gold">{PROMO_LABELS[status?.promo_state] || 'Standard billing'}</div>
            <div className="text-xs text-muted-foreground">Current state</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {status?.promo_expires_at ? new Date(status.promo_expires_at).toLocaleDateString() : '—'}
            </div>
            <div className="text-xs text-muted-foreground">$2.22/mo expires</div>
          </div>
          <div>
            <div className="text-sm font-semibold">{status?.free_months_remaining || 0} / {status?.max_free_months || 60} mo</div>
            <div className="text-xs text-muted-foreground">Free months (5-yr cap)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
