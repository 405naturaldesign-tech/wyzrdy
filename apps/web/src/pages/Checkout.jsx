import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Wallet, Loader2, ShieldCheck, ArrowRight, Sparkles, Bitcoin, CheckCircle2, AlertTriangle } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { TIERS, TIER_ORDER } from '@/lib/tiers';
import { PROVIDERS, CURRENCIES, startCheckout, cryptoQuote } from '@/lib/payments';
import PilotCounter from '@/components/PilotCounter';
import { FOUNDING } from '@/lib/founding';

const CRYPTO_ASSETS = ['BTC', 'ETH', 'SOL', 'USDC'];

export default function Checkout() {
  const { user, isAuthed } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialTier = TIERS[params.get('tier')] ? params.get('tier') : 'business';

  const [tier, setTier] = React.useState(initialTier);
  const [cycle, setCycle] = React.useState(params.get('cycle') === 'annual' ? 'annual' : 'monthly');
  const [currency, setCurrency] = React.useState('USD');
  const [provider, setProvider] = React.useState('stripe');
  const [cryptoAsset, setCryptoAsset] = React.useState('BTC');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [quote, setQuote] = React.useState(null);

  React.useEffect(() => { if (!isAuthed) nav('/signup', { replace: true }); }, [isAuthed, nav]);

  const t = TIERS[tier];
  const amount = t?.price == null ? null : (cycle === 'annual' ? t.price * 10 : t.price);

  React.useEffect(() => {
    if (provider !== 'crypto' || !amount) { setQuote(null); return; }
    let on = true;
    cryptoQuote(amount).then((q) => on && setQuote(q)).catch(() => on && setQuote(null));
    return () => { on = false; };
  }, [provider, amount]);

  const isPilot = user?.pilot_member || user?.lifetime_free_status;

  const pay = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await startCheckout({ provider, tier, cycle, currency, crypto_asset: cryptoAsset });
      if (res.pilot) { setNotice(res.message); setTimeout(() => nav('/dashboard'), 1400); return; }
      if (res.contactSales) { setNotice(res.message); return; }
      if (res.checkout_url) { window.location.href = res.checkout_url; return; }
      setNotice('Payment initiated.');
    } catch (e) {
      setError(e.data?.needsKeys
        ? e.message
        : (e.message || 'Something went wrong starting your checkout.'));
    } finally { setBusy(false); }
  };

  if (!isAuthed || !user) return null;

  return (
    <div className="min-h-screen">
      <Seo title="Checkout — Wyzrdy" description="Complete your Wyzrdy subscription with card, PayPal, Cash App, WhatsApp Pay or crypto." path="/checkout" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <motion.div {...reveal(0)} className="mx-auto max-w-5xl">
          <h1 className="font-serif-lux text-4xl font-semibold md:text-5xl">Checkout</h1>
          <p className="mt-2 text-muted-foreground">Choose your plan and pay with any method. Cancel anytime.</p>
          <div className="mt-6 max-w-md"><PilotCounter compact /></div>

          {isPilot && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm">
              <Sparkles className="h-5 w-5 shrink-0 text-accent" />
              <span>Founding access is granted only after a verified purchase. One year of access applies to the Wyzrdy Individual plan; metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. Standard subscription pricing applies after the first 12 months.</span>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            {/* Left: options */}
            <div className="space-y-5">
              <div className="glass rounded-2xl p-5">
                <div className="mb-3 text-xs tracking-widest text-muted-foreground">SELECT PLAN</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TIER_ORDER.map((id) => (
                    <button key={id} onClick={() => setTier(id)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${tier === id ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{TIERS[id].name}</span>
                        <span className="font-mono-lux text-sm text-gold">{TIERS[id].priceLabel}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{TIERS[id].blurb}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="mb-3 text-xs tracking-widest text-muted-foreground">BILLING</div>
                <div className="flex flex-wrap gap-2">
                  {['monthly', 'annual'].map((c) => (
                    <button key={c} onClick={() => setCycle(c)}
                      className={`rounded-full border px-4 py-2 text-sm capitalize ${cycle === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary'}`}>
                      {c}{c === 'annual' && <span className="ml-1 text-xs opacity-80">(2 months free)</span>}
                    </button>
                  ))}
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="ml-auto rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm outline-none">
                    {CURRENCIES.map((c) => <option key={c} value={c} className="bg-card">{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="mb-3 text-xs tracking-widest text-muted-foreground">PAYMENT METHOD</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROVIDERS.map((p) => (
                    <button key={p.id} onClick={() => setProvider(p.id)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${provider === p.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary'}`}>
                      {p.id === 'crypto' ? <Bitcoin className="h-4 w-4 text-gold" /> : p.id === 'paypal' ? <Wallet className="h-4 w-4 text-gold" /> : <CreditCard className="h-4 w-4 text-gold" />}
                      <span><span className="block text-sm font-medium">{p.label}</span><span className="text-xs text-muted-foreground">{p.hint}</span></span>
                    </button>
                  ))}
                </div>

                {provider === 'crypto' && (
                  <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                    <div className="flex flex-wrap gap-2">
                      {CRYPTO_ASSETS.map((a) => (
                        <button key={a} onClick={() => setCryptoAsset(a)} className={`rounded-lg border px-3 py-1.5 text-xs ${cryptoAsset === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary'}`}>{a}</button>
                      ))}
                    </div>
                    {quote && amount ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Pay approximately <span className="font-mono-lux text-gold">
                          {quote.quotes.find((q) => q.asset === cryptoAsset)?.amount} {cryptoAsset}
                        </span> — live rate as of {new Date(quote.asOf).toLocaleTimeString()}.
                      </p>
                    ) : <p className="mt-3 text-xs text-muted-foreground">Loading live conversion…</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Right: summary */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="glass rounded-2xl p-6">
                <div className="text-xs tracking-widest text-muted-foreground">ORDER SUMMARY</div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="font-serif-lux text-2xl font-semibold capitalize">{t?.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{cycle} billing</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif-lux text-3xl font-semibold">{amount == null ? 'Custom' : `${currency} ${amount}`}</div>
                    {amount != null && <div className="text-xs text-muted-foreground">/{cycle === 'annual' ? 'year' : 'month'}</div>}
                  </div>
                </div>

                {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
                {notice && <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-xs text-accent"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

                <button onClick={pay} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-70">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isPilot ? 'Activate free plan' : t?.price == null ? 'Contact sales' : `Pay ${currency} ${amount ?? ''}`}
                  {!busy && <ArrowRight className="h-4 w-4" />}
                </button>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" /> Encrypted checkout. PCI-handled by providers.</div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{FOUNDING.clarification}</p>
                <Link to="/pricing" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">Compare all plans</Link>
              </div>
            </div>
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
