import React from 'react';
import Seo from '@/components/Seo';
import { motion } from 'framer-motion';
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Gauge, ShieldAlert, Loader2, Zap,
} from 'lucide-react';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import apiServerClient from '@/lib/apiServerClient';
import pb from '@/lib/pocketbaseClient';
import portal from '@/lib/portal';

const POLL_MS = 5 * 60 * 1000; // scheduled agent cadence — every 5 minutes

const STATUS_META = {
  ok: { dot: 'bg-accent', text: 'text-accent', Icon: CheckCircle2, label: 'Operational' },
  error: { dot: 'bg-destructive', text: 'text-destructive', Icon: XCircle, label: 'Down' },
  not_configured: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', Icon: AlertTriangle, label: 'Not configured' },
};

function statusMeta(s) { return STATUS_META[s] || STATUS_META.error; }

export default function Monitor() {
  const { isAuthed } = useAuth();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [lastRun, setLastRun] = React.useState(null);
  const [alerts, setAlerts] = React.useState([]);

  const runCheck = React.useCallback(async () => {
    if (!isAuthed) { setLoading(false); setError('Sign in to run integration health checks.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiServerClient.fetch('/monitor/health', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (res.status === 401) throw new Error('Your session expired — please sign in again.');
      if (!res.ok) throw new Error(`Monitor endpoint failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
      setLastRun(new Date());

      // Alert on failures / degradation
      const failing = json.checks.filter((c) => c.configured && !c.healthy);
      const slow = json.checks.filter((c) => c.healthy && c.responseMs > 4000);
      const nextAlerts = [];
      failing.forEach((c) => nextAlerts.push({ level: 'critical', name: c.label, msg: `${c.detail || 'unreachable'}` }));
      slow.forEach((c) => nextAlerts.push({ level: 'warn', name: c.label, msg: `Slow response ${c.responseMs}ms` }));
      setAlerts(nextAlerts);

      // Log to activity log when signed in
      if (isAuthed) {
        portal.logActivity('health_check', 'monitor', '', {
          overall: json.summary.overall,
          healthy: json.summary.healthy,
          total: json.summary.total,
          errorRate: json.summary.errorRate,
          avgResponseMs: json.summary.avgResponseMs,
          failing: failing.map((c) => c.name),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  React.useEffect(() => {
    runCheck();
    const t = setInterval(runCheck, POLL_MS);
    return () => clearInterval(t);
  }, [runCheck]);

  const summary = data?.summary;
  const overall = summary?.overall || 'operational';
  const overallMeta = {
    operational: { text: 'text-accent', label: 'All systems operational', Icon: CheckCircle2 },
    degraded: { text: 'text-gold', label: 'Degraded performance', Icon: AlertTriangle },
    outage: { text: 'text-destructive', label: 'Major outage', Icon: XCircle },
  }[overall];

  return (
    <div className="min-h-screen">
      <Seo title="Integration Monitor — Wyzrdy Ops" description="Scheduled health checks, response times and error rates across all Wyzrdy API integrations." path="/monitor" noindex />
      <SiteNav />

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" />
        <Section className="relative pb-8 pt-36 lg:pt-44">
          <motion.div {...reveal(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-accent" /> Scheduled monitoring agent · every 5 min
          </motion.div>
          <motion.div {...reveal(0.05)} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif-lux text-4xl font-semibold md:text-6xl">Integration monitor</h1>
              <p className="mt-3 max-w-xl text-muted-foreground">Automated health checks across all 12 API integrations — connectivity, response times and error rates.</p>
            </div>
            <button onClick={runCheck} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Run check now
            </button>
          </motion.div>
          {overallMeta && (
            <motion.div {...reveal(0.1)} className="mt-6 inline-flex items-center gap-2">
              <overallMeta.Icon className={`h-5 w-5 ${overallMeta.text}`} />
              <span className={`font-semibold ${overallMeta.text}`}>{overallMeta.label}</span>
              {lastRun && <span className="text-sm text-muted-foreground">· last run {lastRun.toLocaleTimeString()}</span>}
            </motion.div>
          )}
        </Section>
      </div>

      {error && (
        <Section className="pb-4">
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" /> {error}
          </div>
        </Section>
      )}

      {/* summary cards */}
      {summary && (
        <Section className="grid gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CheckCircle2, label: 'Healthy', value: `${summary.healthy}/${summary.total}`, tint: 'text-accent' },
            { icon: Gauge, label: 'Avg response', value: `${summary.avgResponseMs}ms`, tint: 'text-gold' },
            { icon: AlertTriangle, label: 'Error rate', value: `${summary.errorRate}%`, tint: summary.errorRate > 0 ? 'text-destructive' : 'text-accent' },
            { icon: Zap, label: 'Configured', value: `${summary.configured}/${summary.total}`, tint: 'text-gold' },
          ].map((c, i) => (
            <motion.div key={c.label} {...reveal(i * 0.04)} className="glass rounded-2xl p-5">
              <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-secondary ${c.tint}`}><c.icon className="h-5 w-5" /></div>
              <div className="font-serif-lux text-3xl font-semibold">{c.value}</div>
              <div className="text-sm text-muted-foreground">{c.label}</div>
            </motion.div>
          ))}
        </Section>
      )}

      {/* alerts */}
      {alerts.length > 0 && (
        <Section className="pb-6">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold"><ShieldAlert className="h-4 w-4" /> Active alerts</div>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${a.level === 'critical' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-gold/40 bg-gold/10 text-gold'}`}>
                  {a.level === 'critical' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span className="font-medium">{a.name}</span>
                  <span className="opacity-80">— {a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* integration table */}
      <Section className="pb-28">
        <div className="glass overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.4fr] gap-3 border-b border-border px-5 py-3 text-xs font-medium tracking-widest text-muted-foreground">
            <span>INTEGRATION</span><span>STATUS</span><span className="hidden sm:block">RESPONSE</span><span className="hidden sm:block">DETAIL</span>
          </div>
          {loading && !data && (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Running health checks…
            </div>
          )}
          {data?.checks.map((c) => {
            const m = statusMeta(c.status);
            return (
              <div key={c.name} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1.4fr] items-center gap-3 border-b border-border/60 px-5 py-3.5 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                  <span className="text-sm font-medium">{c.label}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs ${m.text}`}><m.Icon className="h-3.5 w-3.5" /> {m.label}</span>
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Clock className="h-3.5 w-3.5" /> {c.responseMs}ms</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block" title={c.detail}>{c.detail || '—'}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground/70">
          The monitoring agent polls this endpoint every 5 minutes while this dashboard is open. In production, point an external scheduler (Render Cron, GitHub Actions, or an uptime bot) at <span className="font-mono-lux">/hcgi/api/monitor/health</span> for always-on 5-minute checks — this sandbox API hibernates when idle, so it cannot self-schedule.
        </p>
      </Section>

      <SiteFooter />
    </div>
  );
}
