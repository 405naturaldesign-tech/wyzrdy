import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Seo, { softwareAppSchema, breadcrumbSchema } from '@/components/Seo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind, ArrowRight, Loader2, CheckCircle2, AlertCircle, Lock, RefreshCw,
  Rocket, Target, Users, Globe, LineChart, FileText, Sparkles, FileJson, Printer,
} from 'lucide-react';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import portal from '@/lib/portal';
import { slugForLabel } from '@/lib/blueprint';
import { getEntitlement } from '@/lib/entitlement';
import { downloadJSON, downloadMarkdown, toMarkdown, printHTML, fileName } from '@/lib/deliverable';

const INTENTS = [
  { id: 'start', label: 'Start a Business', icon: Rocket, ph: 'e.g. A subscription coffee brand for remote workers' },
  { id: 'offer', label: 'Improve My Offer', icon: Target, ph: 'e.g. My coaching package converts too slowly' },
  { id: 'customers', label: 'Find Customers', icon: Users, ph: 'e.g. I sell handmade candles but sales stalled' },
  { id: 'website', label: 'Build a Website', icon: Globe, ph: 'e.g. A portfolio site for my consulting practice' },
  { id: 'revenue', label: 'Create a Revenue Plan', icon: LineChart, ph: 'e.g. Reach $5k MRR from my newsletter' },
];

const BLUEPRINT = [
  'Offer definition', 'Audience profile', 'Market position', 'Business model',
  'Brand direction', 'Landing-page copy', 'Outreach campaign', 'Task plan',
  'Financial assumptions', 'Next action',
];

// Map blueprint JSON -> readable summary rows for the success panel.
function summarize(bp) {
  if (!bp) return [];
  const rows = [];
  if (bp.offer?.headline) rows.push({ k: 'Offer', v: bp.offer.headline });
  if (bp.audience?.segment) rows.push({ k: 'Audience', v: bp.audience.segment });
  if (bp.market?.position) rows.push({ k: 'Position', v: bp.market.position });
  if (bp.model?.type) rows.push({ k: 'Model', v: bp.model.type });
  if (bp.landingCopy?.hero) rows.push({ k: 'Landing hero', v: bp.landingCopy.hero });
  if (bp.nextAction?.recommendation) rows.push({ k: 'Next action', v: bp.nextAction.recommendation });
  return rows;
}

function ConversationalHero() {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [intent, setIntent] = React.useState('start');
  const [value, setValue] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | focused | generating | success | error | locked
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [errMsg, setErrMsg] = React.useState('');
  const live = React.useRef(null);
  const current = INTENTS.find((i) => i.id === intent);

  const announce = (m) => { if (live.current) live.current.textContent = m; };

  // Animated progress through the 10 sections while awaiting the real response.
  React.useEffect(() => {
    if (state !== 'generating') return;
    setStep(0);
    const t = setInterval(() => {
      setStep((s) => (s >= BLUEPRINT.length - 1 ? s : s + 1));
    }, 550);
    return () => clearInterval(t);
  }, [state]);

  const submit = async () => {
    if (!value.trim()) { setState('error'); setErrMsg('Please describe what you want to build, then try again.'); announce('Please describe what you want to build.'); return; }
    if (!isAuthed) { navigate('/signup'); return; }

    setState('generating'); setErrMsg(''); announce('Generating your blueprint with AI.');

    // Check entitlement before calling the credit-bearing endpoint — avoids
    // a noisy 403 round-trip when the user has no active plan yet.
    try {
      const entitlement = await getEntitlement();
      if (!entitlement || entitlement.entitlement_status !== 'active') {
        setState('locked');
        announce('An active plan is required to generate a blueprint.');
        return;
      }
    } catch (_) {
      // If the entitlement check itself fails, fall through and let the
      // blueprint call surface a normal error rather than blocking silently.
    }

    try {
      const res = await apiServerClient.fetch('/ai/blueprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({ intent, idea: value.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);

      const bp = json.blueprint;
      setResult(bp);
      setState('success');
      announce('Your Business Launch Blueprint is ready.');

      // Persist full blueprint content (not just names) to PocketBase.
      try {
        const conv = await portal.createConversation({ title: (value || 'New blueprint').slice(0, 100), type: 'easybreezy', intent });
        await portal.addMessage(conv.id, 'user', value);
        await portal.addMessage(conv.id, 'assistant', JSON.stringify(bp).slice(0, 19000));
        const project = await portal.createProject({ name: (bp.offer?.headline || value || 'New blueprint').slice(0, 120), type: 'easybreezy', data: { intent, blueprint: bp } });
        await portal.createAsset({ type: 'blueprint', name: (bp.offer?.headline || 'Business Launch Blueprint').slice(0, 120), project: project.id, data: { intent, blueprint: bp } });
        await portal.logActivity('generated_blueprint', 'easybreezy', project.id, { intent });
      } catch (_) { /* persistence is best-effort */ }
    } catch (err) {
      setState('error');
      setErrMsg(err.message || 'Something went wrong generating your blueprint.');
      announce('Blueprint generation failed.');
    }
  };

  const rows = summarize(result);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-accent/15 blur-[130px]" />
      <Section className="relative grid items-start gap-12 pb-16 pt-36 lg:grid-cols-[1fr_0.9fr] lg:pt-44">
        <div>
          <motion.div {...reveal(0)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <Wind className="h-3.5 w-3.5 text-accent" /> Easy Breezy — guided business builder
          </motion.div>
          <motion.h1 {...reveal(0.05)} className="font-serif-lux text-5xl font-semibold leading-[1.02] md:text-7xl">
            What are you <span className="text-gold">ready to build?</span>
          </motion.h1>
          <motion.p {...reveal(0.12)} className="mt-6 max-w-xl text-lg text-muted-foreground">
            Easy Breezy converts an idea, a problem, a skill, or an existing business into a clear, structured path forward — a personalized Business Launch Blueprint, generated by AI.
          </motion.p>

          <motion.div {...reveal(0.18)} className="mt-8">
            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Select an intent">
              {INTENTS.map((i) => (
                <button key={i.id} role="tab" aria-selected={intent === i.id}
                  onClick={() => { setIntent(i.id); if (state === 'error') setState('idle'); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${intent === i.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  <i.icon className="h-3.5 w-3.5" /> {i.label}
                </button>
              ))}
            </div>
            <div className={`glass rounded-2xl p-3 transition-shadow ${state === 'focused' ? 'glow-gold' : ''} ${state === 'error' ? 'border-destructive/60' : ''}`}>
              <textarea value={value} rows={2}
                onFocus={() => setState((s) => (s === 'idle' || s === 'error' ? 'focused' : s))}
                onChange={(e) => { setValue(e.target.value); if (state === 'error') setState('focused'); }}
                placeholder={current.ph}
                aria-label={`Describe: ${current.label}`}
                className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60" />
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Private — never shared or sold</span>
                <button onClick={submit} disabled={state === 'generating'}
                  className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-70 glow-gold">
                  {state === 'generating' ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating</> : <>Create My Blueprint <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                </button>
              </div>
            </div>
            {state === 'error' && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {errMsg}</p>
            )}
            {state === 'locked' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm">
                <Lock className="h-4 w-4 shrink-0 text-gold" />
                <span className="text-muted-foreground">An active plan is required to generate a blueprint.</span>
                <Link to="/pricing" className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  See plans <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            {!isAuthed && (
              <p className="mt-2 text-xs text-muted-foreground/80">You'll be asked to sign in — AI generation runs on your authenticated account.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground/70">Example: <button onClick={() => { setValue(current.ph.replace('e.g. ', '')); setState('focused'); }} className="underline underline-offset-4">"{current.ph.replace('e.g. ', '')}"</button></p>
            <div aria-live="polite" className="sr-only" ref={live} />
          </motion.div>

          <motion.div {...reveal(0.24)} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Powered by OpenRouter · deepseek-v4-flash</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Saved to your dashboard</span>
          </motion.div>
        </div>

        {/* dynamic panel */}
        <motion.div {...reveal(0.1)} className="glass rounded-3xl p-6">
          <AnimatePresence mode="wait">
            {(state === 'idle' || state === 'focused' || state === 'error' || state === 'locked') && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-4 text-xs tracking-widest text-muted-foreground">BLUEPRINT PREVIEW</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {BLUEPRINT.map((b) => (
                    <Link key={b} to={`/blueprint/${slugForLabel(b)}`}
                      className="group flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground">
                      {b}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground/70">Tap any section to open it or trigger its workflow.</p>
              </motion.div>
            )}
            {state === 'generating' && (
              <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-4 flex items-center gap-2 text-sm text-accent"><Sparkles className="h-4 w-4" /> AI is drafting your blueprint</div>
                <div className="space-y-2">
                  {BLUEPRINT.map((b, i) => (
                    <div key={b}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${i <= step ? 'bg-primary/5 text-foreground' : 'text-muted-foreground/50'}`}>
                      {i < step ? <CheckCircle2 className="h-4 w-4 text-accent" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin text-gold" /> : <span className="h-4 w-4 rounded-full border border-border" />}
                      <span className="text-sm">{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {state === 'success' && (
              <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-2 text-accent"><CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Blueprint ready</span></div>
                <p className="mt-2 text-sm text-muted-foreground">Your personalized, AI-generated Business Launch Blueprint — saved to your dashboard.</p>
                <div className="mt-4 space-y-2">
                  {rows.map((r) => (
                    <div key={r.k} className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm">
                      <span className="text-xs uppercase tracking-wide text-accent">{r.k}</span>
                      <div className="mt-0.5 text-foreground">{r.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <button onClick={() => downloadJSON(fileName('business-launch-blueprint', 'json'), result)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileJson className="h-3.5 w-3.5" /> JSON</button>
                  <button onClick={() => downloadMarkdown(fileName('business-launch-blueprint', 'md'), toMarkdown('Business Launch Blueprint', result))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileText className="h-3.5 w-3.5" /> Markdown</button>
                  <button onClick={() => printHTML('Business Launch Blueprint', '<h1>Business Launch Blueprint</h1>' + Object.entries(result).map(([k, v]) => `<h2>${k}</h2><pre style="white-space:pre-wrap;font-family:inherit">${typeof v === 'object' ? Object.entries(v).map(([kk, vv]) => `${kk}: ${Array.isArray(vv) ? vv.join(', ') : vv}`).join('\n') : v}</pre>`).join(''))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><Printer className="h-3.5 w-3.5" /> Print / PDF</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold">Open in dashboard <ArrowRight className="h-4 w-4" /></Link>
                  <button onClick={() => { setState('idle'); setValue(''); setResult(null); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-secondary"><RefreshCw className="h-4 w-4" /> Start another</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Section>
    </div>
  );
}

export default function EasyBreezy() {
  const outputs = [
    { icon: Target, t: 'Offer & positioning', d: 'A sharp offer with market position and audience profile.' },
    { icon: FileText, t: 'Landing-page copy', d: 'Conversion-ready copy you can publish immediately.' },
    { icon: Users, t: 'Outreach campaign', d: 'A first campaign to reach your earliest customers.' },
    { icon: LineChart, t: 'Financial assumptions', d: 'Grounded numbers and a task plan to execute.' },
  ];
  return (
    <div className="min-h-screen">
      <Seo
        title="Easy Breezy — AI Business Plan Generator & Idea Validator"
        description="Easy Breezy is an AI business plan generator and business idea validator. Start a business with AI, validate ideas, and get a business launch checklist."
        path="/easy-breezy"
        keywords="AI business plan generator, business idea validator, start a business with AI, AI business automation, small-business AI tools"
        jsonLd={[
          softwareAppSchema({ name: 'Easy Breezy', description: 'Guided AI business builder and business plan generator.', url: '/easy-breezy' }),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Easy Breezy', path: '/easy-breezy' }]),
        ]}
      />
      <SiteNav />
      <ConversationalHero />

      <Section className="py-20 md:py-28">
        <motion.div {...reveal()} className="max-w-2xl">
          <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">A calm, confident path from idea to launch</h2>
          <p className="mt-4 text-muted-foreground">Onboarding, active projects, AI guidance, templates, saved history, generated documents, progress tracking and exportable assets — all in one guided flow.</p>
        </motion.div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {outputs.map((o, i) => (
            <motion.div key={o.t} {...reveal(i * 0.05)} className="glass rounded-2xl p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-accent"><o.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{o.t}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{o.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="pb-28">
        <motion.div {...reveal()} className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <h2 className="mx-auto max-w-2xl font-serif-lux text-4xl font-semibold md:text-5xl">Your blueprint is one answer away</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Then convert it into a live operating system with Wyzrdy.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-secondary">Meet Wyzrdy</Link>
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
