import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Hammer, Gauge, Rocket, TrendingUp, CheckCircle2, Loader2,
  ChevronDown, Play, Pause, RefreshCw, Copy, Download, FileJson, FileText, Printer, X, ArrowRight, AlertCircle,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import portal from '@/lib/portal';
import ShareButtons from '@/components/ShareButtons';
import { useAuth } from '@/lib/auth';
import { copyText, downloadJSON, downloadMarkdown, toMarkdown, printHTML, fileName } from '@/lib/deliverable';

export const STAGES = [
  { id: 'interpret', label: 'Interpret objective', icon: MessageSquare },
  { id: 'forge', label: 'Forge the system', icon: Hammer },
  { id: 'optimize', label: 'Optimize funnels', icon: Gauge },
  { id: 'launch', label: 'Launch', icon: Rocket },
  { id: 'grow', label: 'Grow', icon: TrendingUp },
];

// A tiny typewriter reveal for the reasoning text.
function useTypewriter(text, active) {
  const [shown, setShown] = React.useState('');
  React.useEffect(() => {
    if (!active || !text) { setShown(text || ''); return; }
    setShown('');
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 60));
    const t = setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [text, active]);
  return shown;
}

function StageCard({ stage, index, status, data, error, open, onToggle, onRegen }) {
  const Icon = stage.icon;
  const reveal = useTypewriter(data?.reasoning, status === 'running' || status === 'done');
  return (
    <div className={`rounded-2xl border transition-colors ${status === 'running' ? 'border-primary/50 bg-primary/5' : status === 'done' ? 'border-accent/30 bg-accent/[0.03]' : status === 'error' ? 'border-destructive/40' : 'border-border bg-secondary/30'}`}>
      <button onClick={onToggle} disabled={status === 'idle'} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background ${status === 'running' ? 'text-gold' : 'text-accent'}`}>
          {status === 'done' ? <CheckCircle2 className="h-4.5 w-4.5" /> : status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'error' ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="font-mono-lux text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            {stage.label}
          </div>
          {data?.title && <div className="truncate text-xs text-muted-foreground">{data.title}</div>}
        </div>
        <span className="font-mono-lux text-[10px] uppercase text-muted-foreground">{status === 'idle' ? 'queued' : status === 'running' ? '···' : status}</span>
        {status !== 'idle' && <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && status !== 'idle' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-border px-4 py-3">
              {error ? (
                <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {error}</p>
              ) : (
                <>
                  {reveal && <p className="text-sm italic text-muted-foreground">{reveal}{status === 'running' && reveal.length < (data?.reasoning?.length || 0) && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-gold align-middle" />}</p>}
                  <div className="space-y-2">
                    {(data?.items || []).map((it, i) => (
                      <div key={i} className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                        <div className="text-sm font-medium">{it.label}</div>
                        {it.detail && <div className="mt-0.5 text-xs text-muted-foreground">{it.detail}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {(status === 'done' || status === 'error') && (
                <button onClick={onRegen} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate stage
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowDialog({ objective, isAuthed, onClose }) {
  const [results, setResults] = React.useState({}); // stageId -> output
  const [statuses, setStatuses] = React.useState(() => Object.fromEntries(STAGES.map((s) => [s.id, 'idle'])));
  const [errors, setErrors] = React.useState({});
  const [open, setOpen] = React.useState({ interpret: true });
  const [cursor, setCursor] = React.useState(0); // index of stage to run next
  const [paused, setPaused] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const savedRef = React.useRef(false);
  const runningRef = React.useRef(false);

  const runStage = React.useCallback(async (index) => {
    const stage = STAGES[index];
    if (!stage) return;
    runningRef.current = true;
    setStatuses((s) => ({ ...s, [stage.id]: 'running' }));
    setOpen((o) => ({ ...o, [stage.id]: true }));
    setErrors((e) => ({ ...e, [stage.id]: null }));
    try {
      const res = await apiServerClient.fetch('/ai/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ objective, stage: stage.id, context: results }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setResults((r) => ({ ...r, [stage.id]: json.output }));
      setStatuses((s) => ({ ...s, [stage.id]: 'done' }));
      setCursor(index + 1);
    } catch (err) {
      setStatuses((s) => ({ ...s, [stage.id]: 'error' }));
      setErrors((e) => ({ ...e, [stage.id]: err.message || 'Generation failed.' }));
      setPaused(true);
    } finally {
      runningRef.current = false;
    }
  }, [objective, results]);

  // Sequential driver.
  React.useEffect(() => {
    if (paused || finished || runningRef.current) return;
    if (cursor >= STAGES.length) {
      setFinished(true);
      return;
    }
    if (statuses[STAGES[cursor].id] === 'idle') {
      runStage(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, paused, finished]);

  // Persist once complete.
  React.useEffect(() => {
    if (!finished || savedRef.current || !isAuthed) return;
    savedRef.current = true;
    (async () => {
      try {
        const wf = await portal.createWorkflow({
          name: (objective || 'New revenue system').slice(0, 120),
          type: 'wyzrdy',
          status: 'completed',
          objective,
          workflow_data: { stages: results },
        });
        await portal.createAsset({ type: 'blueprint', name: `Build plan — ${(objective || 'system').slice(0, 90)}`, data: { objective, stages: results } });
        await portal.logActivity('completed_workflow', 'wyzrdy', wf.id, { objective });
      } catch (_) { /* best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const completed = STAGES.filter((s) => statuses[s.id] === 'done').length;
  const pct = Math.round((completed / STAGES.length) * 100);

  const regen = (index) => {
    const id = STAGES[index].id;
    setStatuses((s) => ({ ...s, [id]: 'idle' }));
    setFinished(false);
    savedRef.current = false;
    setPaused(false);
    setCursor(index);
  };

  const mdSections = STAGES.filter((s) => results[s.id]).map((s) => ({
    label: s.label,
    detail: [results[s.id].reasoning, ...(results[s.id].items || []).map((it) => `• ${it.label}: ${it.detail || ''}`)].join('\n'),
  }));
  const title = `Wyzrdy build plan — ${(objective || 'system').slice(0, 70)}`;

  const doCopy = async () => { if (await copyText(JSON.stringify(results, null, 2))) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const doPrint = () => {
    const html = STAGES.filter((s) => results[s.id]).map((s) => {
      const o = results[s.id];
      const items = (o.items || []).map((it) => `<div class="item"><span class="label">${it.label}</span>${it.detail ? `<div>${it.detail}</div>` : ''}</div>`).join('');
      return `<h2>${s.label}</h2><p><em>${o.reasoning || ''}</em></p>${items}`;
    }).join('');
    printHTML(title, `<h1>${title}</h1>${html}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm md:p-8">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass my-auto w-full max-w-2xl rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5 text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> LIVE BUILD</span>
            </div>
            <h2 className="mt-1 truncate font-serif-lux text-2xl font-semibold">{objective || 'Your revenue system'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{finished ? 'Build complete' : paused ? 'Paused' : `Building — ${STAGES[Math.min(cursor, STAGES.length - 1)]?.label}`}</span>
            <span className="font-mono-lux">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-gold" animate={{ width: `${pct}%` }} transition={{ ease: 'easeOut' }} />
          </div>
        </div>

        <div className="space-y-2.5">
          {STAGES.map((s, i) => (
            <StageCard key={s.id} stage={s} index={i} status={statuses[s.id]} data={results[s.id]} error={errors[s.id]}
              open={!!open[s.id]} onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))} onRegen={() => regen(i)} />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!finished && (
            paused ? (
              <button onClick={() => setPaused(false)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"><Play className="h-4 w-4" /> Resume</button>
            ) : (
              <button onClick={() => setPaused(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-secondary"><Pause className="h-4 w-4" /> Pause</button>
            )
          )}
          {finished && (
            <>
              <button onClick={doCopy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-secondary"><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy JSON'}</button>
              <button onClick={() => downloadJSON(fileName(title, 'json'), results)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-secondary"><FileJson className="h-4 w-4" /> JSON</button>
              <button onClick={() => downloadMarkdown(fileName(title, 'md'), toMarkdown(title, mdSections))} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-secondary"><FileText className="h-4 w-4" /> Markdown</button>
              <button onClick={doPrint} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-secondary"><Printer className="h-4 w-4" /> Print / PDF</button>
              <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold">Open dashboard <ArrowRight className="h-4 w-4" /></Link>
            </>
          )}
        </div>
        {finished && <WorkflowShare />}
      </motion.div>
    </motion.div>
  );
}

function WorkflowShare() {
  const { user } = useAuth();
  return (
    <div className="mt-4">
      <ShareButtons userId={user?.id || ''} title="Share what you just built" context="workflow" />
    </div>
  );
}
