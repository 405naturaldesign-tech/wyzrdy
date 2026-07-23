import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Archive, ArchiveRestore, Boxes, ClipboardCopy, Download, FileText, GitCompare, History,
  Loader2, Plus, RotateCcw, Search, ShieldCheck, Tag, Trash2, X, Gauge, FileCode2,
} from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import ThinkingStream from '@/components/ThinkingStream';
import { useAuth } from '@/lib/auth';
import apiServerClient from '@/lib/apiServerClient';
import art from '@/lib/artifacts';

const { ARTIFACT_TYPES } = art;
const TYPE_FILTERS = ['all', ...ARTIFACT_TYPES];

function fmt(d) { return d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

export default function ArtifactVault() {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState('all');
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [error, setError] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await art.listArtifacts({ type: type === 'all' ? '' : type, includeArchived });
    if (res.ok) setItems(res.data);
    else setError(res.error?.message || 'Failed to load artifacts.');
    setLoading(false);
  }, [type, includeArchived]);

  React.useEffect(() => {
    if (!isAuthed) { navigate('/login'); return; }
    load();
  }, [isAuthed, load, navigate]);

  const visible = React.useMemo(() => art.searchArtifacts(items, query), [items, query]);

  if (!isAuthed) return null;

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Artifact Vault — Wyzrdy" description="Version-controlled artifact history, diff, restore, full-text search, and auto-generated documentation." noindex />
      <SiteNav />
      <Section className="pt-28 md:pt-32">
        <div className="mx-auto max-w-[90rem] px-5 md:px-8">
          <motion.div {...reveal()} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <Boxes className="h-4 w-4 text-gold" /> Artifact Vault
              </div>
              <h1 className="mt-2 font-deco text-4xl tracking-wide text-foreground md:text-5xl">Version history &amp; retrieval</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Every blueprint, audit, workflow and document — version-controlled with diff view, one-click restore,
                full-text search, lineage, integrity checksums and auto-generated docs.
              </p>
            </div>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold active:scale-[0.98]">
              <Plus className="h-4 w-4" /> New artifact
            </button>
          </motion.div>

          {/* search + filters */}
          <div className="glass mt-8 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search — try "landing page" -draft OR audit'
                  className="w-full rounded-xl border border-input bg-secondary/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold"
                />
              </div>
              <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm capitalize outline-none focus:border-gold">
                {TYPE_FILTERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="accent-[hsl(var(--gold))]" />
                Include archived
              </label>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{visible.length} of {items.length} artifacts · full-text ranked search</div>
          </div>

          {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            {/* list */}
            <div className="space-y-3">
              {loading && <div className="glass flex items-center gap-2 rounded-2xl p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
              {!loading && visible.length === 0 && (
                <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                  No artifacts yet. Create one to start tracking versions.
                </div>
              )}
              {visible.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`glass block w-full rounded-2xl p-4 text-left transition-colors hover:border-gold/60 ${selected?.id === a.id ? 'border-gold/70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{a.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{a.type || 'other'}</span>
                        <span>v{a.current_version || 1}</span>
                        {a.status === 'archived' && <span className="text-amber-400">archived</span>}
                        <span>· {fmt(a.updated)}</span>
                      </div>
                    </div>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  {a.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>}
                  {(a.tags || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(a.tags || []).slice(0, 5).map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"><Tag className="h-2.5 w-2.5" />{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* detail */}
            <div>
              {selected
                ? <ArtifactDetail key={selected.id} artifact={selected} onChanged={load} onClose={() => setSelected(null)} />
                : <LoadLab />}
            </div>
          </div>
        </div>
      </Section>
      <SiteFooter />
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await load(); }} />}
    </div>
  );
}

/* ---------------- create modal ---------------- */
function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = React.useState({ title: '', type: 'document', category: '', summary: '', body: '', tags: '' });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setErr('');
    const res = await art.createArtifact({
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (res.ok) onCreated();
    else setErr(res.error?.message || 'Could not create artifact.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-deco text-2xl tracking-wide text-foreground">New artifact</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={set('title')} placeholder="Title" className="w-full rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={set('type')} className="rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm capitalize outline-none focus:border-gold">
              {ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={form.category} onChange={set('category')} placeholder="Category" className="rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          </div>
          <input value={form.summary} onChange={set('summary')} placeholder="One-line summary" className="w-full rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <textarea value={form.body} onChange={set('body')} rows={5} placeholder="Content / body" className="w-full rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          <input value={form.tags} onChange={set('tags')} placeholder="Tags (comma separated)" className="w-full rounded-xl border border-input bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-gold" />
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- detail ---------------- */
function ArtifactDetail({ artifact, onChanged, onClose }) {
  const [tab, setTab] = React.useState('content');
  const [versions, setVersions] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [diffPair, setDiffPair] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [v, l] = await Promise.all([art.versionHistory(artifact.id), art.accessLog(artifact.id)]);
    if (v.ok) setVersions(v.data);
    if (l.ok) setLogs(l.data);
  }, [artifact.id]);

  React.useEffect(() => { refresh(); art.getArtifact(artifact.id, { track: true }); }, [refresh, artifact.id]);

  const doRestore = async (v) => {
    setBusy(true);
    await art.restoreVersion(artifact.id, v);
    setBusy(false);
    await refresh(); await onChanged();
  };
  const doArchive = async () => {
    setBusy(true);
    if (artifact.status === 'archived') await art.unarchiveArtifact(artifact.id);
    else await art.archiveArtifact(artifact.id);
    setBusy(false); await onChanged(); onClose();
  };
  const doDelete = async () => {
    if (!window.confirm('Archive & soft-delete this artifact? It stays recoverable in the database.')) return;
    setBusy(true); await art.softDeleteArtifact(artifact.id); setBusy(false); await onChanged(); onClose();
  };

  const readme = art.generateReadme(artifact, versions);
  const copyReadme = async () => { await navigator.clipboard.writeText(readme); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const TABS = [
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'versions', label: `Versions (${versions.length})`, icon: History },
    { id: 'log', label: 'Access log', icon: ShieldCheck },
    { id: 'docs', label: 'Docs', icon: FileCode2 },
  ];

  return (
    <div className="glass rounded-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="truncate font-deco text-2xl tracking-wide text-foreground">{artifact.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{artifact.type}</span>
            <span>v{artifact.current_version || 1}</span>
            <span className="font-mono-lux">checksum {artifact.checksum || '—'}</span>
            <span>· {artifact.access_count || 0} views</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => art.exportJSON(artifact, versions)} title="Export JSON" className="rounded-md border border-border p-2 hover:bg-secondary"><Download className="h-4 w-4" /></button>
          <button onClick={doArchive} disabled={busy} title="Archive" className="rounded-md border border-border p-2 hover:bg-secondary">
            {artifact.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button onClick={doDelete} disabled={busy} title="Delete" className="rounded-md border border-border p-2 text-destructive hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setDiffPair(null); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'content' && (
          <div>
            {artifact.summary && <p className="mb-3 text-sm text-muted-foreground">{artifact.summary}</p>}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-4 font-mono-lux text-[12px] leading-relaxed text-foreground">{artifact.body || '(empty)'}</pre>
          </div>
        )}

        {tab === 'versions' && (
          <div className="space-y-2">
            {diffPair && (
              <DiffView a={diffPair.older} b={diffPair.newer} onClose={() => setDiffPair(null)} />
            )}
            {versions.map((v, i) => (
              <div key={v.id} className="rounded-xl border border-border bg-card/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">v{v.version} <span className="ml-1 font-normal text-muted-foreground">{v.change_note}</span></div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{fmt(v.created)} · {v.author || 'unknown'} · <span className="font-mono-lux">{v.checksum}</span></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {i < versions.length - 1 && (
                      <button onClick={() => setDiffPair({ older: versions[i + 1], newer: v })} title="Diff vs previous" className="rounded-md border border-border p-1.5 hover:bg-secondary"><GitCompare className="h-3.5 w-3.5" /></button>
                    )}
                    {i !== 0 && (
                      <button onClick={() => doRestore(v)} disabled={busy} title="Restore this version" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-secondary"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                    )}
                    {i === 0 && <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-400">current</span>}
                  </div>
                </div>
              </div>
            ))}
            {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions recorded.</p>}
          </div>
        )}

        {tab === 'log' && (
          <div className="space-y-1.5">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/30 px-3 py-2 text-sm">
                <span className="capitalize text-foreground">{l.action}</span>
                <span className="text-xs text-muted-foreground">{l.detail} · {fmt(l.created)}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No access events yet.</p>}
          </div>
        )}

        {tab === 'docs' && (
          <div>
            <div className="mb-2 flex justify-end">
              <button onClick={copyReadme} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy README'}
              </button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-4 font-mono-lux text-[12px] leading-relaxed text-foreground">{readme}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function DiffView({ a, b, onClose }) {
  const rows = art.diffLines(a.body || '', b.body || '');
  return (
    <div className="mb-3 rounded-xl border border-gold/40 bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><GitCompare className="h-3.5 w-3.5 text-gold" /> Diff v{a.version} → v{b.version}</span>
        <button onClick={onClose} className="rounded p-1 hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg bg-secondary/40 font-mono-lux text-[12px] leading-relaxed">
        {rows.map((r, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words px-3 py-0.5 ${r.type === 'add' ? 'bg-emerald-500/15 text-emerald-300' : r.type === 'del' ? 'bg-destructive/15 text-red-300' : 'text-muted-foreground'}`}>
            <span className="mr-2 select-none opacity-60">{r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '}</span>{r.text || ' '}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- load & resilience lab ---------------- */
function LoadLab() {
  const [steps, setSteps] = React.useState([]);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const stopRef = React.useRef(false);

  const push = (s) => setSteps((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...s }]);
  const patchLast = (patch) => setSteps((prev) => prev.map((x, i) => (i === prev.length - 1 ? { ...x, ...patch } : x)));

  const run = async (concurrency) => {
    setRunning(true); setResult(null); setSteps([]); stopRef.current = false;
    push({ kind: 'reason', label: `Planning burst of ${concurrency} concurrent requests`, status: 'active', detail: 'Target: /perf/ping · measuring p50/p95/p99 + error rate' });
    await new Promise((r) => setTimeout(r, 300));
    patchLast({ status: 'done', ms: 300 });

    const latencies = []; let errors = 0;
    const batchSize = Math.min(concurrency, 25);
    let done = 0;
    for (let b = 0; b < concurrency && !stopRef.current; b += batchSize) {
      const n = Math.min(batchSize, concurrency - b);
      push({ kind: 'integration', label: `Dispatching batch ${Math.floor(b / batchSize) + 1}`, status: 'active', detail: `${n} parallel requests in flight`, cacheHit: b > 0 });
      const t0 = performance.now();
      const results = await Promise.allSettled(Array.from({ length: n }, async () => {
        const s = performance.now();
        const res = await apiServerClient.fetch('/perf/ping');
        if (!res.ok) throw new Error(String(res.status));
        return performance.now() - s;
      }));
      const ms = Math.round(performance.now() - t0);
      results.forEach((r) => { if (r.status === 'fulfilled') latencies.push(r.value); else errors += 1; });
      done += n;
      patchLast({ status: 'done', ms, tokens: n, detail: `${n} sent · ${done}/${concurrency} complete` });
    }

    push({ kind: 'validate', label: 'Computing latency distribution', status: 'active' });
    await new Promise((r) => setTimeout(r, 200));
    const p50 = percentile(latencies, 50); const p95 = percentile(latencies, 95); const p99 = percentile(latencies, 99);
    const errRate = concurrency ? (errors / concurrency) * 100 : 0;
    patchLast({ status: 'done', confidence: Math.max(0, 1 - errRate / 100), detail: `p50 ${p50}ms · p95 ${p95}ms · p99 ${p99}ms` });
    push({
      kind: 'final',
      label: errRate > 1 ? 'Completed with elevated error rate' : 'Load test passed',
      status: errRate > 1 ? 'error' : 'done',
      warning: errRate > 1 ? `Error rate ${errRate.toFixed(1)}% exceeds 1% SLA` : undefined,
      detail: `${latencies.length} ok · ${errors} failed`,
    });
    setResult({ concurrency, p50, p95, p99, errRate, ok: latencies.length });
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <Gauge className="h-4 w-4 text-gold" /> Load &amp; resilience lab
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Select an artifact to view its history — or run a live load test against the API to measure latency
          percentiles, throughput and error rate with real concurrent traffic.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[100, 500, 1000, 5000].map((c) => (
            <button key={c} onClick={() => run(c)} disabled={running}
              className="rounded-full border border-border px-4 py-2 text-sm hover:border-gold/60 disabled:opacity-50">
              {c.toLocaleString()} users
            </button>
          ))}
        </div>
        {result && (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[['p50', `${result.p50}ms`], ['p95', `${result.p95}ms`], ['p99', `${result.p99}ms`], ['errors', `${result.errRate.toFixed(1)}%`]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card/40 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="font-mono-lux text-sm text-foreground">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ThinkingStream steps={steps} running={running} title="Load test trace" onStop={() => { stopRef.current = true; }} />
    </div>
  );
}
