import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle2, Loader2, AlertCircle, ChevronRight, Mail, User } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import pb from '@/lib/pocketbaseClient';

const TYPES = [
  { id: 'access', label: 'Access my data' },
  { id: 'deletion', label: 'Delete my data' },
  { id: 'correction', label: 'Correct my data' },
  { id: 'portability', label: 'Export / port my data' },
  { id: 'opt_out', label: 'Opt out of sale/sharing' },
  { id: 'other', label: 'Other request' },
];

export default function DataRequest() {
  const authed = pb.authStore.record;
  const [form, setForm] = React.useState({
    email: authed?.email || '',
    name: authed?.name || '',
    request_type: 'access',
    regulation: 'gdpr',
    details: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await pb.collection('legal_requests').create({ ...form, status: 'received' }, { requestKey: `dsar-${Date.now()}` });
      setDone(true);
    } catch (e2) {
      setErr(e2?.response?.data ? 'Please check the form and try again.' : (e2?.message || 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Seo title="Data Subject Access Request — Wyzrdy" description="Exercise your GDPR and CCPA rights: request access, correction, deletion, portability, or opt-out of your personal data." path="/data-request" />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.1]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Data request</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <motion.div {...reveal(0)}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> GDPR · CCPA / CPRA
            </div>
            <h1 className="font-serif-lux text-4xl font-semibold leading-tight md:text-5xl">Data Subject Access Request</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Submit a request to access, correct, delete, or port your personal data, or to opt out of sale or sharing. You do not need an account to submit a request.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {['We verify your identity to protect your data.', 'We respond within 30 days (GDPR) or 45 days (CCPA).', 'We never charge or discriminate for exercising your rights.'].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Prefer email? Write to <a href="mailto:privacy@wyzrdy.com" className="text-gold hover:underline">privacy@wyzrdy.com</a>. Read our{' '}
              <Link to="/privacy" className="text-gold hover:underline">Privacy Policy</Link>.
            </p>
          </motion.div>

          <motion.div {...reveal(0.08)} className="glass rounded-3xl p-6 md:p-7">
            {done ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent"><CheckCircle2 className="h-7 w-7" /></div>
                <h2 className="font-serif-lux text-2xl font-semibold">Request received</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  We&apos;ve logged your request and sent a confirmation to <span className="text-foreground">{form.email}</span>. Our privacy team will follow up to verify your identity.
                </p>
                <Link to="/" className="mt-6 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">Back to home</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <Field label="Email" required>
                  <div className="glass flex items-center gap-2 rounded-xl px-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input type="email" required value={form.email} onChange={set('email')} placeholder="you@company.com" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" />
                  </div>
                </Field>
                <Field label="Name">
                  <div className="glass flex items-center gap-2 rounded-xl px-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <input value={form.name} onChange={set('name')} placeholder="Your name (optional)" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" />
                  </div>
                </Field>
                <Field label="Request type" required>
                  <select value={form.request_type} onChange={set('request_type')} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm outline-none focus:border-primary">
                    {TYPES.map((t) => <option key={t.id} value={t.id} className="bg-card">{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Applicable regulation">
                  <select value={form.regulation} onChange={set('regulation')} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm outline-none focus:border-primary">
                    <option value="gdpr" className="bg-card">GDPR (EU / UK)</option>
                    <option value="ccpa" className="bg-card">CCPA / CPRA (California)</option>
                    <option value="other" className="bg-card">Other / not sure</option>
                  </select>
                </Field>
                <Field label="Details">
                  <textarea value={form.details} onChange={set('details')} rows={4} placeholder="Anything that helps us process your request" className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50" />
                </Field>

                {err && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</p>}

                <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold transition-transform active:scale-[0.98] disabled:opacity-70">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting</> : 'Submit request'}
                </button>
                <p className="text-center text-xs text-muted-foreground">Your submission is logged with a timestamp for compliance.</p>
              </form>
            )}
          </motion.div>
        </div>
      </Section>

      <SiteFooter />
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-widest text-muted-foreground">{label.toUpperCase()}{required && <span className="text-gold"> *</span>}</span>
      {children}
    </label>
  );
}
