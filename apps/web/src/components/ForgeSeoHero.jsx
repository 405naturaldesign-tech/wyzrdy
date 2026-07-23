import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, ArrowRight, Loader2, CheckCircle2, AlertCircle, Lock, Search,
  Gauge, ShieldCheck, Zap, Star, Copy, FileJson, FileText, Printer, RefreshCw,
} from 'lucide-react';
import { Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import portal from '@/lib/portal';
import { copyText, downloadJSON, downloadMarkdown, toMarkdown, printHTML, fileName } from '@/lib/deliverable';
import { getEntitlement } from '@/lib/entitlement';

export const INPUT_TYPES = [
  { id: 'url', label: 'Website URL', ph: 'https://yourbusiness.com', valid: (v) => /\./.test(v) },
  { id: 'video', label: 'Video topic', ph: 'How to cold brew coffee at home', valid: (v) => v.trim().length > 4 },
  { id: 'product', label: 'Product description', ph: 'Ergonomic standing desk for small apartments', valid: (v) => v.trim().length > 8 },
  { id: 'transcript', label: 'Transcript', ph: 'Paste a transcript excerpt…', valid: (v) => v.trim().length > 20 },
  { id: 'business', label: 'Business name', ph: 'Breezy Bakehouse, Austin TX', valid: (v) => v.trim().length > 3 },
];

const STEPS = ['Fetching signals', 'Clustering keywords', 'Scoring gaps', 'Ranking priorities'];
const VIEWS = ['Summary', 'Keywords', 'Conversion', 'Content', 'Technical'];

const impactColor = (v) =>
  v === 'high' ? 'text-gold' : v === 'medium' ? 'text-accent' : 'text-muted-foreground';
const statusColor = (s) =>
  s === 'ok' ? 'text-accent' : s === 'warn' ? 'text-gold' : 'text-destructive';

function ScoreGauge({ score }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs tracking-widest text-muted-foreground">OPPORTUNITY SCORE</span>
      <span className="font-mono-lux text-3xl font-semibold text-gold">{s}<span className="text-base text-muted-foreground">/100</span></span>
    </div>
  );
}

function AuditReport({ audit, meta, onReset }) {
  const [view, setView] = React.useState('Summary');
  const [copied, setCopied] = React.useState(false);
  const title = `ForgeSEO audit — ${(meta.input || 'scan').slice(0, 60)}`;

  const mdSections = [
    { label: 'Executive summary', detail: audit.summary },
    { label: 'Opportunity score', detail: `${audit.score}/100` },
    ...(audit.keywords?.missedThemes || []).map((k) => ({ label: `Keyword: ${k.cluster}`, detail: `${k.intent} · ${k.volume} — ${k.detail}` })),
    ...(audit.priorities || []).map((p) => ({ label: `Priority: ${p.action}`, detail: `Impact ${p.impact}/Effort ${p.effort} — ${p.detail}` })),
  ];

  const doCopy = async () => { if (await copyText(JSON.stringify(audit, null, 2))) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const doPrint = () => {
    const rows = mdSections.map((s) => `<h3>${s.label}</h3><p>${s.detail || ''}</p>`).join('');
    printHTML(title, `<h1>${title}</h1>${rows}`);
  };

  return (
    <motion.div key="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <ScoreGauge score={audit.score} />
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, audit.score)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--violet))] to-gold" />
      </div>
      {meta.fetched && <div className="inline-flex items-center gap-1.5 text-xs text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Live page content analyzed</div>}

      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
            {v}
          </button>
        ))}
      </div>

      <div className="space-y-2 text-sm">
        {view === 'Summary' && (
          <>
            <p className="text-muted-foreground">{audit.summary}</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(audit.scoreBreakdown || []).map((b) => (
                <div key={b.label} className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{b.label}</span><span className="font-mono-lux text-foreground">{b.value}</span></div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, b.value)}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="pt-2 text-xs tracking-widest text-muted-foreground">TOP PRIORITIES</div>
            {(audit.priorities || []).slice(0, 3).map((p, i) => (
              <div key={i} className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5">
                <div className="flex items-center justify-between"><span className="font-medium">{p.action}</span><span className={`text-xs uppercase ${impactColor(p.impact)}`}>{p.impact} impact</span></div>
                {p.detail && <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>}
              </div>
            ))}
          </>
        )}
        {view === 'Keywords' && (audit.keywords?.missedThemes || []).map((k, i) => (
          <div key={i} className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <div className="flex items-center justify-between"><span className="font-medium">{k.cluster}</span><span className="font-mono-lux text-xs text-muted-foreground">{k.volume}</span></div>
            <div className="mt-0.5 text-xs text-[hsl(var(--violet))]">{k.intent}</div>
            {k.detail && <p className="mt-1 text-xs text-muted-foreground">{k.detail}</p>}
          </div>
        ))}
        {view === 'Conversion' && (audit.conversion || []).map((c, i) => (
          <div key={i} className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <div className="flex items-center justify-between"><span className="font-medium">{c.issue}</span><span className={`text-xs uppercase ${impactColor(c.impact)}`}>{c.impact}</span></div>
            {c.fix && <p className="mt-0.5 text-xs text-muted-foreground">Fix: {c.fix}</p>}
          </div>
        ))}
        {view === 'Content' && (audit.content || []).map((c, i) => (
          <div key={i} className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <div className="font-medium">{c.gap}</div>
            {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
          </div>
        ))}
        {view === 'Technical' && (audit.technical || []).map((t, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <span className={`mt-0.5 text-xs uppercase ${statusColor(t.status)}`}>{t.status}</span>
            <div><div className="font-medium">{t.item}</div>{t.detail && <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={doCopy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy JSON'}</button>
        <button onClick={() => downloadJSON(fileName(title, 'json'), audit)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><FileJson className="h-3.5 w-3.5" /> JSON</button>
        <button onClick={() => downloadMarkdown(fileName(title, 'md'), toMarkdown(title, mdSections))} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><FileText className="h-3.5 w-3.5" /> Markdown</button>
        <button onClick={doPrint} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><Printer className="h-3.5 w-3.5" /> PDF</button>
        <button onClick={onReset} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5" /> New scan</button>
      </div>
    </motion.div>
  );
}

export default function ForgeSeoHero({ eyebrow = 'ForgeSEO — conversion & content engine', topPad = 'pt-36 lg:pt-44' }) {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = React.useState('url');
  const [value, setValue] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | validation | loading | success | error | locked
  const [step, setStep] = React.useState(0);
  const [audit, setAudit] = React.useState(null);
  const [meta, setMeta] = React.useState({});
  const [errMsg, setErrMsg] = React.useState('');
  const live = React.useRef(null);
  const cfg = INPUT_TYPES.find((t) => t.id === type);
  const announce = (m) => { if (live.current) live.current.textContent = m; };

  React.useEffect(() => {
    if (state !== 'loading') return;
    setStep(0);
    const t = setInterval(() => setStep((s) => (s >= STEPS.length - 1 ? s : s + 1)), 1400);
    return () => clearInterval(t);
  }, [state]);

  const run = async () => {
    if (!value.trim() || !cfg.valid(value)) { setState('validation'); announce('That input needs a bit more detail.'); return; }
    if (!isAuthed) {
      try { sessionStorage.setItem('forgeseo_pending', JSON.stringify({ type, value })); } catch (_) { /* ignore */ }
      navigate('/signup');
      return;
    }
    setState('loading'); setErrMsg(''); announce('Running your opportunity scan.');

    // Check entitlement before calling the credit-bearing audit endpoint —
    // avoids a noisy 403 round-trip when the user has no active plan yet.
    try {
      const entitlement = await getEntitlement();
      if (!entitlement || entitlement.entitlement_status !== 'active') {
        setState('locked');
        announce('An active plan is required to run this scan.');
        return;
      }
    } catch (_) {
      // If the entitlement check itself fails, fall through and let the
      // audit call surface a normal error rather than blocking silently.
    }

    try {
      const res = await apiServerClient.fetch('/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ type, input: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Scan failed (${res.status})`);
      setAudit(json.audit);
      setMeta({ input: value, type, fetched: json.fetched });
      setState('success');
      announce('Opportunity scan complete.');
      try {
        const project = await portal.createProject({ name: (value || 'SEO scan').slice(0, 120), type: 'forgeseo', data: { inputType: type, input: value } });
        await portal.createAsset({ project: project.id, type: 'audit', name: 'Opportunity scan — ' + (value || cfg.label).slice(0, 100), data: { score: json.audit.score, inputType: type, audit: json.audit } });
        await portal.logActivity('ran_audit', 'forgeseo', project.id, { type });
      } catch (_) { /* best-effort */ }
    } catch (err) {
      setState('error'); setErrMsg(err.message || 'Scan failed.'); announce('Scan failed.');
    }
  };

  // Resume a pending scan after signup/login.
  React.useEffect(() => {
    if (!isAuthed) return;
    try {
      const raw = sessionStorage.getItem('forgeseo_pending');
      if (raw) { const p = JSON.parse(raw); sessionStorage.removeItem('forgeseo_pending'); setType(p.type); setValue(p.value); }
    } catch (_) { /* ignore */ }
  }, [isAuthed]);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-[hsl(var(--violet)/0.14)] blur-[120px]" />
      <Section className={`relative grid items-start gap-12 pb-16 lg:grid-cols-[1fr_0.92fr] ${topPad}`}>
        <div>
          <motion.div {...reveal(0)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <Radar className="h-3.5 w-3.5 text-[hsl(var(--violet))]" /> {eyebrow}
          </motion.div>
          <motion.h1 {...reveal(0.05)} className="font-serif-lux text-4xl font-semibold leading-[1.05] md:text-6xl">
            Find the search opportunities your competitors are <span className="text-gold">already taking</span>
          </motion.h1>
          <motion.p {...reveal(0.12)} className="mt-6 max-w-xl text-lg text-muted-foreground">
            Evidence, scoring, priorities and expected impact — not unstructured AI text. Scan a URL, video topic, product, transcript, or business name.
          </motion.p>

          <motion.div {...reveal(0.18)} className="mt-8">
            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Scan input type">
              {INPUT_TYPES.map((t) => (
                <button key={t.id} role="tab" aria-selected={type === t.id} onClick={() => { setType(t.id); if (state !== 'success') setState('idle'); }}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${type === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className={`glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center ${state === 'validation' ? 'border-destructive/60' : ''}`}>
              <div className="flex flex-1 items-center gap-2 px-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input value={value} onChange={(e) => { setValue(e.target.value); if (state === 'validation') setState('idle'); }}
                  onKeyDown={(e) => e.key === 'Enter' && run()}
                  placeholder={cfg.ph} aria-label={cfg.label}
                  className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60" />
              </div>
              <button onClick={run} disabled={state === 'loading'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-70 glow-gold">
                {state === 'loading' ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning</> : <>Run Free Opportunity Scan <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Accepts: <span className="text-foreground/80">{cfg.label.toLowerCase()}</span> — {cfg.ph}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> No account needed for your first scan</span>
            </div>
            {state === 'validation' && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> That {cfg.label.toLowerCase()} looks incomplete. Add a little more detail.</p>
            )}
            {state === 'error' && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {errMsg}</p>
            )}
            {state === 'locked' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm">
                <Lock className="h-4 w-4 shrink-0 text-gold" />
                <span className="text-muted-foreground">An active plan unlocks the full opportunity scan.</span>
                <button onClick={() => navigate('/pricing')} className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  See plans <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div aria-live="polite" role="status" className="sr-only" ref={live} />

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-gold" /> Trusted by 1000+ businesses</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> SOC-grade data handling</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[hsl(var(--violet))]" /> Results in under a minute</span>
            </div>
          </motion.div>
        </div>

        <motion.div {...reveal(0.1)} className="glass rounded-3xl p-6">
          <AnimatePresence mode="wait">
            {(state === 'idle' || state === 'validation' || state === 'error' || state === 'locked') && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-4 text-xs tracking-widest text-muted-foreground">WHAT YOU'LL SEE</div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {['Opportunity score', 'Missed keyword themes', 'Conversion weakness', 'Content gap', 'Highest-priority action'].map((x) => (
                    <li key={x} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5"><Gauge className="h-4 w-4 text-[hsl(var(--violet))]" /> {x}</li>
                  ))}
                </ul>
              </motion.div>
            )}
            {state === 'loading' && (
              <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-4 text-xs tracking-widest text-muted-foreground">ANALYSIS SEQUENCE</div>
                <div className="space-y-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i <= step ? 'bg-primary/5' : 'opacity-50'}`}>
                      {i < step ? <CheckCircle2 className="h-4 w-4 text-accent" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin text-gold" /> : <span className="h-4 w-4 rounded-full border border-border" />}
                      <span className="text-sm">{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {state === 'success' && audit && (
              <AuditReport audit={audit} meta={meta} onReset={() => { setState('idle'); setAudit(null); setValue(''); }} />
            )}
          </AnimatePresence>
        </motion.div>
      </Section>
    </div>
  );
}
