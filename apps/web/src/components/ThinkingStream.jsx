import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Cpu, Database, Search, ShieldCheck, Zap, AlertTriangle, CheckCircle2,
  Clock, Coins, GitBranch, Loader2, Pause, Play, Square,
} from 'lucide-react';

/**
 * Live verbose "thinking & processing" display.
 *
 * Feed it a list of step objects. Each step:
 *   { id, kind, label, detail?, status?, ms?, tokens?, cost?, confidence?, cacheHit?, warning? }
 * kind ∈ reason | model | data | integration | validate | optimize | retry | cache | final
 * status ∈ pending | active | done | error
 *
 * Renders a streaming reasoning trace with per-step icons, timings, token/cost
 * meters, confidence bars, cache hits, warnings — and interrupt controls.
 */

const KIND_META = {
  reason: { icon: Brain, tint: 'text-[hsl(var(--violet))]' },
  model: { icon: Cpu, tint: 'text-gold' },
  data: { icon: Database, tint: 'text-[hsl(var(--teal))]' },
  search: { icon: Search, tint: 'text-[hsl(var(--teal))]' },
  integration: { icon: Zap, tint: 'text-gold' },
  validate: { icon: ShieldCheck, tint: 'text-[hsl(var(--teal))]' },
  optimize: { icon: GitBranch, tint: 'text-[hsl(var(--violet))]' },
  retry: { icon: Loader2, tint: 'text-amber-400' },
  cache: { icon: Coins, tint: 'text-[hsl(var(--teal))]' },
  final: { icon: CheckCircle2, tint: 'text-emerald-400' },
};

function StatusDot({ status }) {
  if (status === 'active') return <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />;
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return <span className="block h-2 w-2 rounded-full bg-muted-foreground/40" />;
}

export default function ThinkingStream({
  steps = [],
  running = false,
  paused = false,
  onPause,
  onResume,
  onStop,
  title = 'Live reasoning',
  totalTokens,
  totalCost,
}) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps.length]);

  const tokens = totalTokens ?? steps.reduce((s, x) => s + (x.tokens || 0), 0);
  const cost = totalCost ?? steps.reduce((s, x) => s + (x.cost || 0), 0);
  const elapsed = steps.reduce((s, x) => s + (x.ms || 0), 0);

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {running && !paused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${running ? 'bg-gold' : 'bg-muted-foreground/40'}`} />
          </span>
          <span className="font-mono-lux text-xs tracking-wider text-muted-foreground">{title.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          {(onPause || onResume) && running && (
            paused
              ? <button onClick={onResume} className="rounded-md border border-border p-1.5 hover:bg-secondary" aria-label="Resume"><Play className="h-3.5 w-3.5" /></button>
              : <button onClick={onPause} className="rounded-md border border-border p-1.5 hover:bg-secondary" aria-label="Pause"><Pause className="h-3.5 w-3.5" /></button>
          )}
          {onStop && running && (
            <button onClick={onStop} className="rounded-md border border-border p-1.5 text-destructive hover:bg-secondary" aria-label="Interrupt"><Square className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="max-h-80 space-y-1 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {steps.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Waiting for reasoning to begin…</p>
          )}
          {steps.map((step) => {
            const meta = KIND_META[step.kind] || KIND_META.reason;
            const Icon = meta.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tint} ${step.status === 'active' && step.kind === 'retry' ? 'animate-spin' : ''}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{step.label}</span>
                      <StatusDot status={step.status} />
                    </div>
                    {step.detail && (
                      <p className="mt-1 whitespace-pre-wrap break-words font-mono-lux text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
                    )}
                    {step.warning && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-400"><AlertTriangle className="h-3 w-3" /> {step.warning}</p>
                    )}
                    {typeof step.confidence === 'number' && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-[hsl(var(--teal))]" style={{ width: `${Math.round(step.confidence * 100)}%` }} />
                        </div>
                        <span className="font-mono-lux text-[10px] text-muted-foreground">{Math.round(step.confidence * 100)}%</span>
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono-lux text-[10px] text-muted-foreground/80">
                      {step.model && <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{step.model}</span>}
                      {step.ms != null && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{step.ms}ms</span>}
                      {step.tokens != null && <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />{step.tokens} tok</span>}
                      {step.cost != null && <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />${step.cost.toFixed(4)}</span>}
                      {step.cacheHit != null && <span className={step.cacheHit ? 'text-emerald-400' : ''}>{step.cacheHit ? 'cache hit' : 'cache miss'}</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
        <Metric icon={Clock} label="Elapsed" value={`${(elapsed / 1000).toFixed(1)}s`} />
        <Metric icon={Zap} label="Tokens" value={tokens.toLocaleString()} />
        <Metric icon={Coins} label="Cost" value={`$${cost.toFixed(4)}`} />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-0.5 font-mono-lux text-sm text-foreground">{value}</div>
    </div>
  );
}
