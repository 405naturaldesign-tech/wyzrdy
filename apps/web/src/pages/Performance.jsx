import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, Gauge, Zap, AlertTriangle, Cpu, HardDrive, Play, Square,
  Timer, TrendingUp, Server, Loader2, Download, RefreshCw, WifiOff,
} from 'lucide-react';
import Seo from '@/components/Seo';
import { DecoLogo, reveal } from '@/components/Shell';
import apiServerClient from '@/lib/apiServerClient';

const PRESETS = [100, 500, 1000, 5000];
const ENDPOINTS = [
  { id: 'ping', label: 'Gateway ping', work: 0 },
  { id: 'light', label: 'Light compute', work: 50000 },
  { id: 'heavy', label: 'Heavy compute (AI-like)', work: 800000 },
];
const CONCURRENCY = 40; // browser-side worker pool cap

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 100) / 100;
}

export default function Performance() {
  const [users, setUsers] = React.useState(500);
  const [endpoint, setEndpoint] = React.useState('ping');
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [report, setReport] = React.useState(null);
  const [metrics, setMetrics] = React.useState(null);
  const [metricsError, setMetricsError] = React.useState(null);
  const [metricsLoading, setMetricsLoading] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState(null);
  const abortRef = React.useRef(false);

  // Live server metrics — fetched once on load, then only on manual
  // refresh (or a slow background poll every 60s). The endpoint itself is
  // exempt from the global rate limiter and cached for 60s server-side, but
  // we still avoid hammering it: a single in-flight request is shared by
  // all callers (request coalescing) and a min 5s gap is enforced between
  // network calls even on manual refresh spam-clicks.
  const liveRef = React.useRef(true);
  const lastFetchRef = React.useRef(0);
  const backoffRef = React.useRef(0);
  const timerRef = React.useRef(null);
  const inFlightRef = React.useRef(null);
  const abortRef2 = React.useRef(null);

  const loadMetrics = React.useCallback(async (force = false) => {
    const now = Date.now();
    // Hard floor: never fire two requests within 5s of each other, even on
    // manual refresh spam-clicks.
    if (!force && now - lastFetchRef.current < 5000) return;
    if (force && now - lastFetchRef.current < 5000) return;
    // Request coalescing: if a fetch is already in flight, don't start another.
    if (inFlightRef.current) return inFlightRef.current;

    lastFetchRef.current = now;
    setMetricsLoading(true);
    abortRef2.current?.abort();
    const controller = new AbortController();
    abortRef2.current = controller;

    const p = (async () => {
      try {
        const r = await apiServerClient.fetch('/perf/metrics', { signal: controller.signal });
        if (r.status === 429) {
          const retryAfter = Number(r.headers.get('Retry-After')) || 30;
          throw new Error(`Rate limited — retrying in ${retryAfter}s`);
        }
        if (!r.ok) throw new Error(`Server responded with ${r.status}`);
        const d = await r.json();
        if (!liveRef.current) return;
        setMetrics(d);
        setMetricsError(null);
        setLastUpdated(Date.now());
        backoffRef.current = 0;
      } catch (e) {
        if (e?.name === 'AbortError' || !liveRef.current) return;
        setMetricsError(e.message || 'Unable to reach the metrics endpoint');
        backoffRef.current = Math.min(60000, (backoffRef.current || 5000) * 2);
      } finally {
        if (liveRef.current) setMetricsLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = p;
    return p;
  }, []);

  React.useEffect(() => {
    liveRef.current = true;
    let cancelled = false;
    // Fetch once immediately on mount.
    loadMetrics(true);
    // Then poll infrequently (every 60s) as a background refresh —
    // manual "Refresh" clicks cover the rest.
    const tick = async () => {
      if (cancelled) return;
      const delay = 60000 + (backoffRef.current || 0);
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        await loadMetrics();
        tick();
      }, delay);
    };
    tick();
    return () => {
      cancelled = true;
      liveRef.current = false;
      abortRef2.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setRunning(true); setProgress(0); setReport(null); abortRef.current = false;
    const total = users;
    const work = ENDPOINTS.find((e) => e.id === endpoint)?.work || 0;
    const latencies = [];
    let done = 0, errors = 0;
    const start = performance.now();

    const worker = async () => {
      while (!abortRef.current) {
        const i = done + inflight.started;
        if (i >= total) return;
        inflight.started += 1;
        const t0 = performance.now();
        try {
          const r = await apiServerClient.fetch(`/perf/ping${work ? `?work=${work}` : ''}`);
          if (!r.ok) errors += 1;
          else latencies.push(performance.now() - t0);
        } catch { errors += 1; }
        done += 1;
        if (done % Math.max(1, Math.floor(total / 100)) === 0 || done === total) {
          setProgress(Math.round((done / total) * 100));
        }
      }
    };
    const inflight = { started: 0 };
    const pool = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
    await Promise.all(pool);

    const elapsed = (performance.now() - start) / 1000;
    const ok = latencies.length;
    setReport({
      users: total,
      endpoint,
      total,
      ok,
      errors,
      errorRate: total ? Math.round((errors / total) * 10000) / 100 : 0,
      throughput: Math.round((total / elapsed) * 100) / 100,
      elapsed: Math.round(elapsed * 100) / 100,
      avg: ok ? Math.round((latencies.reduce((a, b) => a + b, 0) / ok) * 100) / 100 : 0,
      min: ok ? Math.round(Math.min(...latencies) * 100) / 100 : 0,
      max: ok ? Math.round(Math.max(...latencies) * 100) / 100 : 0,
      p50: pct(latencies, 50),
      p95: pct(latencies, 95),
      p99: pct(latencies, 99),
      histogram: buildHistogram(latencies),
      ts: new Date().toISOString(),
    });
    setRunning(false); setProgress(100);
  };

  const stop = () => { abortRef.current = true; };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ report, serverMetrics: metrics }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `wyzrdy-loadtest-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <Seo title="Performance & Load Testing — Wyzrdy" description="Stress test the Wyzrdy API and monitor real-time latency, throughput and error rates." path="/performance" noindex />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />
      <div className="relative mx-auto max-w-[80rem] px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/"><DecoLogo sub="PERFORMANCE LAB" /></Link>
          <div className="flex items-center gap-2 text-xs">
            <Link to="/monitor" className="rounded-lg border border-border px-3 py-2 hover:bg-secondary">Integrations status</Link>
            <Link to="/dashboard" className="rounded-lg border border-border px-3 py-2 hover:bg-secondary">Dashboard</Link>
          </div>
        </div>

        <motion.div {...reveal(0)}>
          <h1 className="font-serif-lux text-3xl font-semibold md:text-4xl">Performance & Stress Testing</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drive concurrent traffic at the API gateway and watch latency, throughput and error rates in real time. Requests run through the same tier-aware routing layer used in production.
          </p>
        </motion.div>

        {/* Live server metrics status bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {metricsError ? (
              <><WifiOff className="h-4 w-4 text-destructive" /> <span className="text-destructive">{metricsError}</span></>
            ) : metricsLoading && !metrics ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading live metrics…</>
            ) : (
              <><span className="h-2 w-2 rounded-full bg-accent" /> Live · updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}</>
            )}
          </div>
          <button onClick={() => loadMetrics(true)} disabled={metricsLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Live server metrics */}
        {metricsError && !metrics ? (
          <div className="mt-4 glass rounded-2xl p-8 text-center">
            <WifiOff className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Couldn't load live metrics right now.</p>
            <button onClick={() => loadMetrics(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Timer} label="Avg latency" value={metrics ? `${metrics.latency?.avg ?? 0} ms` : '—'} sub={metrics ? `p95 ${metrics.latency?.p95 ?? 0} · p99 ${metrics.latency?.p99 ?? 0} ms` : ''} />
          <Metric icon={TrendingUp} label="Throughput" value={metrics ? `${metrics.throughputPerSec ?? 0}/s` : '—'} sub={metrics ? `${metrics.throughputPerMin ?? 0}/min` : ''} />
          <Metric icon={AlertTriangle} label="Error rate" value={metrics ? `${metrics.errorRate ?? 0}%` : '—'} sub={metrics ? `${metrics.errors ?? 0} / ${metrics.total ?? 0} reqs` : ''} tint={metrics && (metrics.errorRate ?? 0) > 5 ? 'text-destructive' : 'text-accent'} />
          <Metric icon={Server} label="Uptime" value={metrics ? fmtUptime(metrics.uptimeSec ?? 0) : '—'} sub={metrics ? `${metrics.total ?? 0} total reqs` : ''} />
          <Metric icon={HardDrive} label="Heap used" value={metrics ? `${metrics.memory?.heapUsedMB ?? 0} MB` : '—'} sub={metrics ? `RSS ${metrics.memory?.rssMB ?? 0} MB` : ''} />
          <Metric icon={Cpu} label="CPU time" value={metrics ? `${metrics.cpu?.userMs ?? 0} ms` : '—'} sub={metrics ? `sys ${metrics.cpu?.systemMs ?? 0} ms` : ''} />
          <Metric icon={Gauge} label="Latency p50" value={metrics ? `${metrics.latency?.p50 ?? 0} ms` : '—'} sub={metrics ? `${metrics.latency?.count ?? 0} samples` : ''} />
          <Metric icon={Activity} label="Max latency" value={metrics ? `${metrics.latency?.max ?? 0} ms` : '—'} sub={metrics ? `min ${metrics.latency?.min ?? 0} ms` : ''} />
        </div>
        )}

        {/* Load test controls */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <motion.div {...reveal(0.05)} className="glass rounded-2xl p-6">
            <div className="text-xs tracking-widest text-muted-foreground">SIMULATED CONCURRENT USERS</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setUsers(p)} disabled={running}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${users === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {p >= 1000 ? `${p / 1000}k` : p}
                </button>
              ))}
            </div>

            <div className="mt-5 text-xs tracking-widest text-muted-foreground">TARGET ENDPOINT PROFILE</div>
            <div className="mt-3 space-y-2">
              {ENDPOINTS.map((e) => (
                <button key={e.id} onClick={() => setEndpoint(e.id)} disabled={running}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${endpoint === e.id ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-secondary'}`}>
                  <span>{e.label}</span>
                  <span className="font-mono-lux text-xs text-muted-foreground">{e.id}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              {!running ? (
                <button onClick={run} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground glow-gold">
                  <Play className="h-4 w-4" /> Run load test
                </button>
              ) : (
                <button onClick={stop} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/50 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10">
                  <Square className="h-4 w-4" /> Stop
                </button>
              )}
              <button onClick={exportReport} disabled={!report} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary disabled:opacity-40">
                <Download className="h-4 w-4" />
              </button>
            </div>
            {running && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Running…</span><span>{progress}%</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-gold transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              The browser issues traffic through a bounded worker pool (cap {CONCURRENCY}), simulating {users.toLocaleString()} virtual users. Server-side metrics above update live as the run progresses.
            </p>
          </motion.div>

          {/* Report */}
          <motion.div {...reveal(0.1)} className="glass rounded-2xl p-6">
            {!report && !running && (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <Zap className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Configure a run and press <span className="text-gold">Run load test</span> to generate a report.</p>
              </div>
            )}
            {running && !report && (
              <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
            )}
            {report && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-xs tracking-widest text-muted-foreground">LOAD TEST REPORT</div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs">{report.users.toLocaleString()} users · {report.endpoint}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Throughput" value={`${report.throughput}/s`} />
                  <Stat label="Error rate" value={`${report.errorRate}%`} tint={report.errorRate > 5 ? 'text-destructive' : 'text-accent'} />
                  <Stat label="Duration" value={`${report.elapsed}s`} />
                  <Stat label="Avg" value={`${report.avg} ms`} />
                  <Stat label="p95" value={`${report.p95} ms`} />
                  <Stat label="p99" value={`${report.p99} ms`} />
                  <Stat label="Min" value={`${report.min} ms`} />
                  <Stat label="Max" value={`${report.max} ms`} />
                  <Stat label="Success" value={`${report.ok}/${report.total}`} />
                </div>
                <div className="mt-6 text-xs tracking-widest text-muted-foreground">LATENCY DISTRIBUTION</div>
                <div className="mt-3 flex h-32 items-end gap-1">
                  {report.histogram.map((h, i) => {
                    const max = Math.max(...report.histogram.map((x) => x.count), 1);
                    return (
                      <div key={i} className="group flex flex-1 flex-col items-center justify-end">
                        <div className="w-full rounded-t bg-gradient-to-t from-accent/40 to-gold" style={{ height: `${(h.count / max) * 100}%` }} title={`${h.label}: ${h.count}`} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{report.histogram[0]?.label}</span>
                  <span>{report.histogram[report.histogram.length - 1]?.label}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function buildHistogram(latencies) {
  if (!latencies.length) return [];
  const max = Math.max(...latencies);
  const buckets = 12;
  const size = Math.max(1, max / buckets);
  const bins = Array.from({ length: buckets }, (_, i) => ({ label: `${Math.round(i * size)}ms`, count: 0 }));
  for (const l of latencies) {
    const idx = Math.min(buckets - 1, Math.floor(l / size));
    bins[idx].count += 1;
  }
  return bins;
}

function fmtUptime(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function Metric({ icon: Icon, label, value, sub, tint = 'text-gold' }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
        <Icon className={`h-4 w-4 ${tint}`} /> {label.toUpperCase()}
      </div>
      <div className="mt-2 font-serif-lux text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, tint = '' }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono-lux text-lg font-semibold ${tint}`}>{value}</div>
    </div>
  );
}
