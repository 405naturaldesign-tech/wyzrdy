import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Seo from '@/components/Seo';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, Mail, Lock, User, Sparkles } from 'lucide-react';
import { DecoLogo, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import PilotCounter from '@/components/PilotCounter';
import { logReferral } from '@/lib/social';
import SocialLogin from '@/components/SocialLogin';

export default function AuthPage() {
  const { login, signup, isAuthed } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const initialMode = loc.pathname === '/signup' ? 'signup' : 'login';
  const [mode, setMode] = React.useState(initialMode);
  const [form, setForm] = React.useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => { if (isAuthed) nav('/dashboard', { replace: true }); }, [isAuthed, nav]);
  React.useEffect(() => { logReferral('click'); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'signup') await signup(form);
      else await login(form.email, form.password);
      nav('/dashboard', { replace: true });
    } catch (e2) {
      const data = e2?.response?.data;
      const first = data && Object.values(data)[0]?.message;
      setErr(first || e2?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Seo title={`${mode === 'signup' ? 'Create account' : 'Sign in'} — Wyzrdy`} description="Sign in or create your Wyzrdy account to save workflows, blueprints and SEO audits." path={mode === 'signup' ? '/signup' : '/login'} noindex />
      <div className="absolute inset-0 bg-grid opacity-[0.2]" />
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
        <Link to="/" className="mb-8 inline-flex"><DecoLogo sub="AI OPERATING SYSTEM" /></Link>
        <motion.div {...reveal(0)} className="glass rounded-3xl p-7">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> {mode === 'signup' ? 'Start free' : 'Welcome back'}
          </div>
          <h1 className="mt-3 font-serif-lux text-3xl font-semibold">
            {mode === 'signup' ? 'Create your account' : 'Sign in to Wyzrdy'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === 'signup' ? 'Your workflows, blueprints and scans in one place.' : 'Access your personalized command center.'}
          </p>

          {mode === 'signup' && (
            <div className="mt-4">
              <PilotCounter />
              <p className="mt-2 text-xs text-gold">Founding Access: the first 20,000 verified purchasers secure one year of Wyzrdy Individual plan access for one payment of $11.69. Once the limit is reached, this offer is gone.</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === 'signup' && (
              <Field icon={User} label="Name" value={form.name} onChange={set('name')} placeholder="Your name" />
            )}
            <Field icon={Mail} label="Email" type="email" required value={form.email} onChange={set('email')} placeholder="you@company.com" />
            <Field icon={Lock} label="Password" type="password" required value={form.password} onChange={set('password')} placeholder="At least 8 characters" />

            {mode === 'signup' && (
              <p className="text-xs text-muted-foreground">
                By creating an account you agree to our{' '}
                <Link to="/terms" className="text-gold hover:underline">Terms of Service</Link> and{' '}
                <Link to="/privacy" className="text-gold hover:underline">Privacy Policy</Link>. You can manage cookie preferences anytime.
              </p>
            )}

            {err && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</p>}

            <button type="submit" disabled={busy}
              className="group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-70 glow-gold">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Please wait</> : <>{mode === 'signup' ? 'Claim Founding Access — $11.69' : 'Sign in'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>

          <SocialLogin onError={setErr} />

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(''); }} className="font-medium text-gold hover:underline">
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
      <div className="glass flex items-center gap-2 rounded-xl px-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <input {...props} className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/50" />
      </div>
    </label>
  );
}
