import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Seo from '@/components/Seo';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Workflow, MessagesSquare, FolderKanban, FileText, Activity as ActivityIcon,
  UserCog, Settings2, BarChart3, LogOut, Download, Loader2, Plus, Trash2, CheckCircle2,
  Search, ArrowRight, ShieldCheck, Share2, CreditCard, Receipt,
} from 'lucide-react';
import ReferralDashboard from '@/components/ReferralDashboard';
import ViralPipeline from '@/components/ViralPipeline';
import PaywallModal from '@/components/PaywallModal';
import { loadUsage, checkGate, upgradeMessage, QUOTA_FEATURES } from '@/lib/featureGate';
import { AlertTriangle } from 'lucide-react';
import { listInvoices, cancelSubscription } from '@/lib/payments';
import { DecoLogo, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import portal from '@/lib/portal';
import pb from '@/lib/pocketbaseClient';
import { getTier, fmtLimit, TIER_ORDER } from '@/lib/tiers';
import { Gauge, Lock, Unlock, Sparkles, ShieldQuestion } from 'lucide-react';
import { useConsent, CONSENT_CATEGORIES } from '@/lib/consent';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'conversations', label: 'Conversations', icon: MessagesSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'assets', label: 'Assets', icon: FileText },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
  { id: 'analytics', label: 'Usage', icon: BarChart3 },
  { id: 'referrals', label: 'Referrals', icon: Share2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'profile', label: 'Profile', icon: UserCog },
  { id: 'preferences', label: 'Preferences', icon: Settings2 },
];

const TIER_QUOTA = { individual: 500, business: 5000, agency: 20000, enterprise: 100000 };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const { user, isAuthed, logout } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const validTabs = TABS.map((t) => t.id);
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const [tab, setTab] = React.useState(initialTab);

  React.useEffect(() => {
    const q = searchParams.get('tab');
    if (q && validTabs.includes(q)) setTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  React.useEffect(() => { if (!isAuthed) nav('/login', { replace: true }); }, [isAuthed, nav]);
  if (!isAuthed || !user) return null;

  return (
    <div className="min-h-screen">
      <Seo title="Dashboard — Wyzrdy" description="Your Wyzrdy dashboard: workflows, conversations, projects, SEO audits and usage." path="/dashboard" noindex />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.15]" />
      <div className="relative mx-auto flex max-w-[90rem] flex-col gap-6 px-4 py-6 md:flex-row md:px-8 md:py-8">
        {/* Sidebar */}
        <aside className="md:w-64 md:shrink-0">
          <Link to="/" className="mb-6 inline-flex"><DecoLogo sub="AI OPERATING SYSTEM" /></Link>
          <div className="glass rounded-2xl p-3">
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 font-semibold text-gold">
                {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user.name || 'Member'}</div>
                <div className="truncate text-xs capitalize text-muted-foreground">{user.subscription_tier || 'individual'} plan</div>
              </div>
            </div>
            <nav className="grid grid-cols-3 gap-1 md:grid-cols-1">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <t.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{t.label}</span>
                </button>
              ))}
              <button onClick={() => { logout(); nav('/'); }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <motion.div key={tab} {...reveal(0)}>
            {tab === 'overview' && <Overview user={user} go={setTab} />}
            {tab === 'workflows' && <Workflows />}
            {tab === 'conversations' && <Conversations />}
            {tab === 'projects' && <Projects />}
            {tab === 'assets' && <Assets />}
            {tab === 'activity' && <ActivityLog />}
            {tab === 'analytics' && <Analytics user={user} />}
            {tab === 'referrals' && <Referrals user={user} />}
            {tab === 'billing' && <Billing user={user} />}
            {tab === 'profile' && <Profile />}
            {tab === 'preferences' && <Preferences />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function Panel({ title, desc, children, action }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-lux text-3xl font-semibold md:text-4xl">{title}</h1>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function useLoader(fn, deps = []) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(() => {
    setLoading(true);
    fn().then((d) => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload, setData };
}

function Spinner() {
  return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

function Empty({ icon: Icon, text, cta }) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-secondary text-muted-foreground"><Icon className="h-6 w-6" /></div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ user, go }) {
  const { data, loading } = useLoader(() => portal.analytics());
  const quota = TIER_QUOTA[user.subscription_tier || 'individual'];
  const cards = [
    { k: 'workflows', label: 'Workflows', icon: Workflow, tab: 'workflows' },
    { k: 'conversations', label: 'Conversations', icon: MessagesSquare, tab: 'conversations' },
    { k: 'projects', label: 'Projects', icon: FolderKanban, tab: 'projects' },
    { k: 'assets', label: 'Assets', icon: FileText, tab: 'assets' },
  ];
  return (
    <Panel title={`Welcome back, ${user.name || 'Member'}`} desc="Your revenue command center at a glance.">
      {loading ? <Spinner /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <button key={c.k} onClick={() => go(c.tab)} className="glass rounded-2xl p-5 text-left transition-transform hover:-translate-y-1">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-gold"><c.icon className="h-5 w-5" /></div>
                <div className="font-serif-lux text-3xl font-semibold">{data?.[c.k] ?? 0}</div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="glass rounded-2xl p-6">
              <div className="text-xs tracking-widest text-muted-foreground">API USAGE THIS PERIOD</div>
              <div className="mt-2 font-serif-lux text-3xl font-semibold">{data?.activity ?? 0}<span className="text-base text-muted-foreground"> / {quota}</span></div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-gold" style={{ width: `${Math.min(100, ((data?.activity ?? 0) / quota) * 100)}%` }} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{Math.max(0, quota - (data?.activity ?? 0))} credits remaining on your {user.subscription_tier || 'individual'} plan</div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-xs tracking-widest text-muted-foreground">JUMP BACK IN</div>
              <div className="mt-3 space-y-2">
                <Link to="/" className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm hover:bg-secondary">Build a system in Wyzrdy <ArrowRight className="h-4 w-4 text-gold" /></Link>
                <Link to="/easy-breezy" className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm hover:bg-secondary">Create a blueprint in Easy Breezy <ArrowRight className="h-4 w-4 text-gold" /></Link>
                <Link to="/performance" className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm hover:bg-secondary">Open the Performance Lab <ArrowRight className="h-4 w-4 text-gold" /></Link>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <TierUsage user={user} data={data} />
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---------------- Workflows ---------------- */
const STATUS_TINT = {
  draft: 'text-muted-foreground border-border',
  'in-progress': 'text-gold border-primary/40',
  completed: 'text-accent border-accent/40',
  archived: 'text-muted-foreground border-border',
  active: 'text-gold border-primary/40',
  paused: 'text-muted-foreground border-border',
};

function Workflows() {
  const { user } = useAuth();
  const { data, loading, reload } = useLoader(() => portal.listWorkflows());
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [usage, setUsage] = React.useState(null);
  const [paywall, setPaywall] = React.useState(false);

  const refreshUsage = React.useCallback(() => {
    loadUsage(user).then(setUsage).catch(() => setUsage(null));
  }, [user]);
  React.useEffect(() => { refreshUsage(); }, [refreshUsage, data]);

  const gate = usage ? checkGate(usage, 'workflows') : null;

  const create = async () => {
    if (gate && !gate.allowed) { setPaywall(true); return; }
    await portal.createWorkflow({ name: 'Untitled workflow', type: 'wyzrdy', status: 'draft', workflow_data: {} });
    reload();
  };
  const advance = async (w) => {
    const order = ['draft', 'in-progress', 'completed'];
    const next = order[Math.min(order.length - 1, order.indexOf(w.status) + 1)];
    await portal.updateWorkflow(w.id, { status: next });
    reload();
  };
  const del = async (id) => { await portal.deleteWorkflow(id); reload(); };

  const rows = (data || []).filter((w) =>
    (status === 'all' || w.status === status) && w.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel title="Workflows" desc="Objectives, plans and execution across the ecosystem."
      action={<button onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"><Plus className="h-4 w-4" /> New workflow</button>}>
      <QuotaBanner usage={usage} feature="workflows" onUpgrade={() => setPaywall(true)} />
      <FilterBar q={q} setQ={setQ} value={status} setValue={setStatus} options={['all', 'draft', 'in-progress', 'completed', 'archived']} />
      <PaywallModal open={paywall} onClose={() => setPaywall(false)} feature="workflows" currentTierId={user.subscription_tier || 'individual'} used={gate?.used} limit={gate?.limit} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty icon={Workflow} text="No workflows yet. Create one or build a system on the Wyzrdy page." /> : (
        <div className="space-y-2">
          {rows.map((w) => (
            <div key={w.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{w.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{w.type} · v{w.version || 1} · updated {fmtDate(w.updated)}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${STATUS_TINT[w.status] || ''}`}>{w.status}</span>
              {w.status !== 'completed' && w.status !== 'archived' && (
                <button onClick={() => advance(w)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">Advance</button>
              )}
              <button onClick={() => del(w.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Conversations ---------------- */
function Conversations() {
  const { data, loading } = useLoader(() => portal.listConversations());
  const [open, setOpen] = React.useState(null);
  const [msgs, setMsgs] = React.useState(null);

  const view = async (c) => {
    setOpen(c); setMsgs(null);
    setMsgs(await portal.getMessages(c.id));
  };

  return (
    <Panel title="Conversations" desc="Your Easy Breezy sessions and questions.">
      {loading ? <Spinner /> : (data || []).length === 0 ? <Empty icon={MessagesSquare} text="No conversations yet. Start one on the Easy Breezy page." /> : (
        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2">
            {(data || []).map((c) => (
              <button key={c.id} onClick={() => view(c)} className={`glass block w-full rounded-2xl p-4 text-left transition-colors ${open?.id === c.id ? 'border-primary/50' : ''}`}>
                <div className="truncate font-medium">{c.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.type}{c.intent ? ` · ${c.intent}` : ''} · {fmtDate(c.updated)}</div>
              </button>
            ))}
          </div>
          <div className="glass rounded-2xl p-5">
            {!open ? <p className="py-12 text-center text-sm text-muted-foreground">Select a conversation to read the thread.</p> : msgs === null ? <Spinner /> : (
              <div className="space-y-3">
                <div className="text-xs tracking-widest text-muted-foreground">{open.title.toUpperCase()}</div>
                {msgs.length === 0 ? <p className="text-sm text-muted-foreground">No messages recorded.</p> : msgs.map((m) => (
                  <div key={m.id} className={`rounded-xl px-3 py-2.5 text-sm ${m.role === 'user' ? 'bg-secondary/50' : 'border border-accent/30 bg-accent/5'}`}>
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{m.role}</div>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Projects ---------------- */
function Projects() {
  const { data, loading, reload } = useLoader(() => portal.listProjects());
  const del = async (id) => { await portal.deleteProject(id); reload(); };
  return (
    <Panel title="Projects" desc="Every initiative across Wyzrdy, Easy Breezy and ForgeSEO.">
      {loading ? <Spinner /> : (data || []).length === 0 ? <Empty icon={FolderKanban} text="No projects yet. They appear here when you run scans or blueprints." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data || []).map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-gold"><FolderKanban className="h-5 w-5" /></div>
                <button onClick={() => del(p.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 truncate font-medium">{p.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{p.type} · {fmtDate(p.created)}</div>
              <span className={`mt-3 inline-block rounded-full border px-2.5 py-1 text-xs capitalize ${STATUS_TINT[p.status] || ''}`}>{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Assets ---------------- */
function Assets() {
  const { data, loading } = useLoader(() => portal.listAssets());
  const [type, setType] = React.useState('all');
  const rows = (data || []).filter((a) => type === 'all' || a.type === type);
  return (
    <Panel title="Assets" desc="Generated blueprints, audits, content and schemas.">
      <FilterBar value={type} setValue={setType} options={['all', 'blueprint', 'audit', 'content', 'schema', 'report', 'export']} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty icon={FileText} text="No assets yet. Generated documents will collect here." /> : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-accent"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                <div className="text-xs capitalize text-muted-foreground">{a.type} · {fmtDate(a.created)}</div>
              </div>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">Open</a>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Activity ---------------- */
function ActivityLog() {
  const [page, setPage] = React.useState(1);
  const { data, loading } = useLoader(() => portal.listActivity(page, 25), [page]);
  return (
    <Panel title="Activity" desc="A log of your actions across the ecosystem.">
      {loading ? <Spinner /> : !data || data.items.length === 0 ? <Empty icon={ActivityIcon} text="No activity recorded yet." /> : (
        <>
          <div className="glass divide-y divide-border rounded-2xl">
            {data.items.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                  {a.resource_type && <span className="ml-2 text-xs text-muted-foreground">{a.resource_type}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(a.created).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Prev</button>
              <span className="text-muted-foreground">Page {page} / {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------------- Analytics ---------------- */
function Analytics({ user }) {
  const { data, loading } = useLoader(() => portal.analytics());
  const [exporting, setExporting] = React.useState(false);
  const quota = TIER_QUOTA[user.subscription_tier || 'individual'];

  const doExport = async () => {
    setExporting(true);
    try {
      const payload = await portal.exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `wyzrdy-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  return (
    <Panel title="Usage & Analytics" desc="Track your API calls, credits and activity."
      action={<button onClick={doExport} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-secondary disabled:opacity-60">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export my data</button>}>
      {loading ? <Spinner /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Total API calls', value: data?.activity ?? 0 },
              { label: 'Credits used', value: data?.activity ?? 0 },
              { label: 'Credits remaining', value: Math.max(0, quota - (data?.activity ?? 0)) },
            ].map((m) => (
              <div key={m.label} className="glass rounded-2xl p-6">
                <div className="text-xs tracking-widest text-muted-foreground">{m.label.toUpperCase()}</div>
                <div className="mt-2 font-serif-lux text-4xl font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
          <div className="glass mt-4 rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-accent" /> {user.subscription_tier || 'individual'} plan — {quota.toLocaleString()} credits / period</div>
            <div className="space-y-3">
              {[
                { label: 'Workflows', v: data?.workflows ?? 0 },
                { label: 'Conversations', v: data?.conversations ?? 0 },
                { label: 'Projects', v: data?.projects ?? 0 },
                { label: 'Assets', v: data?.assets ?? 0 },
              ].map((r) => {
                const max = Math.max(1, data?.workflows ?? 0, data?.conversations ?? 0, data?.projects ?? 0, data?.assets ?? 0);
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">{r.label}</span><span className="font-mono-lux">{r.v}</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-accent to-gold" style={{ width: `${(r.v / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ---------------- Profile ---------------- */
function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = React.useState({
    name: user.name || '', bio: user.bio || '', company: user.company || '',
    website: user.website || '',
  });
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    try { await updateProfile(form); setSaved(true); } finally { setBusy(false); }
  };

  return (
    <Panel title="Profile" desc="Manage your account details.">
      <div className="glass max-w-2xl space-y-4 rounded-2xl p-6">
        <Row label="Email"><input disabled value={user.email} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground" /></Row>
        <Row label="Name"><Input value={form.name} onChange={set('name')} /></Row>
        <Row label="Company"><Input value={form.company} onChange={set('company')} placeholder="Company (optional)" /></Row>
        <Row label="Website"><Input value={form.website} onChange={set('website')} placeholder="https://" /></Row>
        <Row label="Bio"><textarea value={form.bio} onChange={set('bio')} rows={3} className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="A short bio" /></Row>
        <Row label="Plan">
          <div className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm capitalize text-muted-foreground">{user.subscription_tier || 'individual'} — managed by billing</div>
        </Row>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-70">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes</button>
          {saved && <span className="inline-flex items-center gap-1.5 text-sm text-accent"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Preferences ---------------- */
function Preferences() {
  const { user, updateProfile } = useAuth();
  const prefs = user.preferences || {};
  const [form, setForm] = React.useState({
    theme: prefs.theme || 'dark',
    notifications: prefs.notifications !== false,
    productUpdates: prefs.productUpdates !== false,
    privacy: prefs.privacy || 'private',
  });
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const { logout } = useAuth();
  const nav = useNavigate();

  const save = async () => {
    setBusy(true);
    try { await updateProfile({ preferences: form }); setSaved(true); } finally { setBusy(false); }
  };
  const toggle = (k) => { setForm((f) => ({ ...f, [k]: !f[k] })); setSaved(false); };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account and all data permanently? This cannot be undone.')) return;
    setDeleting(true);
    try { await pb.collection('users').delete(user.id); logout(); nav('/'); }
    catch { setDeleting(false); }
  };

  return (
    <Panel title="Preferences" desc="Notifications, privacy and account controls.">
      <div className="glass max-w-2xl space-y-1 rounded-2xl p-6">
        <Toggle label="Email notifications" desc="Product notifications and workflow alerts" on={form.notifications} onClick={() => toggle('notifications')} />
        <Toggle label="Product updates" desc="Occasional news about new features" on={form.productUpdates} onClick={() => toggle('productUpdates')} />
        <Row label="Privacy">
          <select value={form.privacy} onChange={(e) => { setForm((f) => ({ ...f, privacy: e.target.value })); setSaved(false); }} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="private" className="bg-card">Private — only me</option>
            <option value="team" className="bg-card">Team — shared with workspace</option>
          </select>
        </Row>
        <div className="flex items-center gap-3 pt-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-70">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save preferences</button>
          {saved && <span className="inline-flex items-center gap-1.5 text-sm text-accent"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </div>
      <ConsentPreferences />
      <div className="glass mt-4 max-w-2xl rounded-2xl border-destructive/30 p-6">
        <div className="font-semibold text-destructive">Danger zone</div>
        <p className="mt-1 text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
        <button onClick={deleteAccount} disabled={deleting} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/50 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete account</button>
      </div>
    </Panel>
  );
}

/* ---------------- Consent preferences ---------------- */
function ConsentPreferences() {
  const { prefs, save, decidedAt } = useConsent();
  const [draft, setDraft] = React.useState(prefs);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => setDraft(prefs), [prefs]);
  const dirty = CONSENT_CATEGORIES.some((c) => !c.locked && !!draft[c.id] !== !!prefs[c.id]);
  return (
    <div className="glass mt-4 max-w-2xl rounded-2xl p-6">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldQuestion className="h-4 w-4 text-gold" /> Privacy &amp; consent</div>
      <p className="text-xs text-muted-foreground">Control optional cookies and data uses. Changes are logged for compliance.{decidedAt ? ` Last updated ${fmtDate(decidedAt)}.` : ''}</p>
      <div className="mt-4 space-y-1">
        {CONSENT_CATEGORIES.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">{c.label}{c.locked && <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Always on</span>}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </div>
            <button type="button" disabled={c.locked} aria-pressed={c.locked ? true : !!draft[c.id]} aria-label={`Toggle ${c.label}`}
              onClick={() => { setDraft((d) => ({ ...d, [c.id]: !d[c.id] })); setSaved(false); }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${(c.locked || draft[c.id]) ? 'bg-primary' : 'bg-secondary'} ${c.locked ? 'opacity-60' : ''}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${(c.locked || draft[c.id]) ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={() => { save(draft); setSaved(true); }} disabled={!dirty} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold disabled:opacity-50">Save consent</button>
        {saved && <span className="inline-flex items-center gap-1.5 text-sm text-accent"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        <Link to="/data-request" className="ml-auto text-xs text-gold hover:underline">Request my data</Link>
      </div>
    </div>
  );
}

/* ---------------- Tier usage ---------------- */
function UsageBar({ label, used, limit }) {
  const unlimited = limit == null;
  const pct = unlimited ? 6 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const near = !unlimited && pct >= 80;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono-lux">{used} / {fmtLimit(limit)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${near ? 'bg-destructive' : 'bg-gradient-to-r from-accent to-gold'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TierUsage({ user, data }) {
  const tierId = user.subscription_tier || 'individual';
  const tier = getTier(tierId);
  const nextId = TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tierId) + 1)];
  const canUpgrade = nextId !== tierId;
  const featureList = [
    { key: 'advancedBlueprints', label: 'Advanced blueprints' },
    { key: 'advancedAnalytics', label: 'Advanced analytics' },
    { key: 'customBranding', label: 'Custom branding' },
    { key: 'whiteLabel', label: 'White-label' },
    { key: 'apiAccess', label: 'API access + webhooks' },
    { key: 'prioritySupport', label: 'Priority support' },
  ];
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-gold" />
          <span className="text-xs tracking-widest text-muted-foreground">PLAN & USAGE —</span>
          <span className="rounded-full border border-primary/40 px-2.5 py-1 text-xs font-semibold capitalize text-gold">{tier.name}</span>
        </div>
        <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">Compare plans <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <UsageBar label="Workflows this month" used={data?.workflows ?? 0} limit={tier.limits.workflowsPerMonth} />
          <UsageBar label="Audits / assets" used={data?.assets ?? 0} limit={tier.limits.auditsPerMonth} />
          <UsageBar label="API calls (day)" used={data?.activity ?? 0} limit={tier.limits.reqPerDay} />
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {featureList.map((f) => {
            const on = tier.features[f.key];
            return (
              <div key={f.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${on ? 'border-accent/30 text-foreground' : 'border-border text-muted-foreground'}`}>
                {on ? <Unlock className="h-3.5 w-3.5 text-accent" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
                {f.label}
              </div>
            );
          })}
        </div>
      </div>

      {canUpgrade && (
        <Link to="/pricing" className="mt-5 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm transition-colors hover:bg-primary/15">
          <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" /> Upgrade to <span className="font-semibold capitalize text-gold">{getTier(nextId).name}</span> for higher limits and more features</span>
          <ArrowRight className="h-4 w-4 text-gold" />
        </Link>
      )}
    </div>
  );
}

/* ---------------- Referrals ---------------- */
function Referrals({ user }) {
  return (
    <div className="space-y-6">
      <Panel title="Viral Pipeline" desc="Refer friends to the $7.77/mo Viral Entry Tier — unlock $2.22/mo at 2 friends, a free year at 10, and up to 5 years free.">
        <ViralPipeline />
      </Panel>
      <Panel title="Referrals" desc="Share Wyzrdy, track your link and watch conversions roll in.">
        <ReferralDashboard userId={user.id} />
      </Panel>
    </div>
  );
}

/* ---------------- Billing ---------------- */
function Billing({ user }) {
  const nav = useNavigate();
  const [invoices, setInvoices] = React.useState(null);
  const [canceling, setCanceling] = React.useState(false);
  const isPilot = user.pilot_member || user.lifetime_free_status;

  React.useEffect(() => {
    listInvoices().then((r) => setInvoices(r.items || [])).catch(() => setInvoices([]));
  }, []);

  const cancel = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until the period ends.')) return;
    setCanceling(true);
    try { await cancelSubscription(); } finally { setCanceling(false); }
  };

  return (
    <Panel title="Billing" desc="Manage your plan, payment methods and invoices."
      action={<button onClick={() => nav('/checkout')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"><CreditCard className="h-4 w-4" /> {isPilot ? 'Explore plans' : 'Change plan'}</button>}>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="text-xs tracking-widest text-muted-foreground">CURRENT PLAN</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-serif-lux text-3xl font-semibold capitalize">{user.subscription_tier || 'individual'}</span>
            {isPilot && <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent">Founding Access — First Year</span>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground capitalize">{user.billing_cycle || 'monthly'} billing · status: {user.subscription_status || (isPilot ? 'active' : 'none')}</div>
          {isPilot ? (
            <p className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">You hold Founding Access {user.pilot_number ? `(pass #${user.pilot_number})` : ''} — one year of access to the Wyzrdy Individual plan for your one-time $11.69 payment. One year of access applies to the Individual plan; metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. Standard subscription pricing applies after the first 12 months.</p>
          ) : (
            <button onClick={cancel} disabled={canceling} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/50 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">{canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cancel subscription</button>
          )}
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2 text-xs tracking-widest text-muted-foreground"><Receipt className="h-4 w-4 text-gold" /> INVOICES</div>
          {invoices === null ? <Spinner /> : invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet. They appear here after your first payment.</p>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-mono-lux text-xs">{inv.number}</span>
                  <span className="capitalize">{inv.tier}</span>
                  <span className="font-mono-lux">{inv.currency} {inv.amount}</span>
                  <span className="text-xs text-accent capitalize">{inv.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- Quota banner (upgrade prompt) ---------------- */
function QuotaBanner({ usage, feature, onUpgrade }) {
  if (!usage) return null;
  const g = checkGate(usage, feature);
  if (g.unlimited || g.state === 'ok') return null;
  const f = QUOTA_FEATURES[feature] || { label: feature };
  const blocked = g.state === 'blocked';
  const critical = g.state === 'critical';
  const tone = blocked
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : critical
      ? 'border-primary/50 bg-primary/10 text-gold'
      : 'border-accent/40 bg-accent/5 text-accent';
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-foreground">
        {blocked
          ? `You've reached your ${f.label} limit (${g.used}/${g.limit}) this month.`
          : `You've used ${g.used} of ${g.limit} ${f.label} (${g.pct ?? Math.round((g.used / g.limit) * 100)}%).`}{' '}
        <span className="text-muted-foreground">{upgradeMessage(feature, usage.tier?.id || 'individual')}</span>
      </span>
      <button onClick={onUpgrade}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
        Upgrade <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ---------------- shared small bits ---------------- */
function Row({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
      {children}
    </label>
  );
}
function Input(props) {
  return <input {...props} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-primary" />;
}
function Toggle({ label, desc, on, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-secondary'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}
function FilterBar({ q, setQ, value, setValue, options }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {setQ && (
        <div className="glass flex items-center gap-2 rounded-xl px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-40 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50" />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => setValue(o)} className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${value === o ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}
