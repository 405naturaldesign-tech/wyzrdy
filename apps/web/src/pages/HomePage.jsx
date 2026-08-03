import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Seo, { orgSchema, softwareAppSchema, faqSchema } from '@/components/Seo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ArrowRight, Play, ShieldCheck, TrendingUp, Zap, Layers,
  Boxes, PlugZap, BarChart3, MessageSquare, Hammer, Gauge, CheckCircle2, Loader2, Radar, Compass, ChevronDown,
  Flame, Star, Clock, Lock, Users,
} from 'lucide-react';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import WorkflowDialog from '@/components/WorkflowDialog';
import ForgeSeoHero from '@/components/ForgeSeoHero';
import ShareButtons from '@/components/ShareButtons';
import PilotCounter from '@/components/PilotCounter';
import { FOUNDING, FOUNDING_MEMBER, foundingMemberRemainingLabel } from '@/lib/founding';

const WORKFLOW = [
  { icon: MessageSquare, label: 'Interpret objective', tint: 'text-gold' },
  { icon: Hammer, label: 'Forge the system', tint: 'text-accent' },
  { icon: Gauge, label: 'Optimize funnels', tint: 'text-gold' },
  { icon: TrendingUp, label: 'Launch & grow', tint: 'text-accent' },
];

function WorkflowPreview({ active }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest text-muted-foreground">LIVE BUILD PREVIEW</span>
        <span className="flex items-center gap-1.5 text-xs text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />running</span>
      </div>
      <div className="space-y-2.5">
        {WORKFLOW.map((s, i) => {
          const done = i < active;
          const live = i === active;
          return (
            <motion.div key={s.label}
              animate={{ opacity: i <= active ? 1 : 0.35, x: 0 }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${live ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/40'}`}>
              <div className={`grid h-8 w-8 place-items-center rounded-lg bg-background ${s.tint}`}>
                {done ? <CheckCircle2 className="h-4 w-4 text-accent" /> : live ? <Loader2 className="h-4 w-4 animate-spin" /> : <s.icon className="h-4 w-4" />}
              </div>
              <span className="flex-1 text-sm">{s.label}</span>
              <span className="font-mono-lux text-[10px] text-muted-foreground">{done ? 'done' : live ? '···' : 'queued'}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function WyzrdyBuildSection() {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [objective, setObjective] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);

  // Ambient preview animation for the idle panel.
  React.useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % (WORKFLOW.length + 1)), 1400);
    return () => clearInterval(t);
  }, []);

  const build = () => {
    if (!objective.trim()) { setObjective(example); return; }
    if (!isAuthed) { navigate('/signup'); return; }
    setOpen(true);
  };
  const example = 'Launch a $10k/mo consulting offer with automated outreach';

  return (
    <div className="relative overflow-hidden">
      <AnimatePresence>
        {open && <WorkflowDialog objective={objective.trim() || example} isAuthed={isAuthed} onClose={() => setOpen(false)} />}
      </AnimatePresence>
      <div className="absolute inset-0 bg-grid opacity-[0.25]" />
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
      <Section className="relative grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div {...reveal(0)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> Wyzrdy — the unified AI revenue command center
          </motion.div>
          <motion.h2 {...reveal(0.05)} className="text-balance font-serif-lux text-4xl font-semibold leading-[1.05] md:text-6xl">
            Turn an idea into an <span className="text-gold">operating revenue system</span>
          </motion.h2>
          <motion.p {...reveal(0.12)} className="mt-6 max-w-xl text-lg text-muted-foreground">
            Wyzrdy plans, builds, optimizes, and organizes the work to launch and grow — one operating layer across strategy, content, funnels and execution.
          </motion.p>

          <motion.div {...reveal(0.18)} className="mt-8">
            <label htmlFor="obj" className="mb-2 block text-xs font-medium tracking-widest text-muted-foreground">YOUR OBJECTIVE</label>
            <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
              <input id="obj" value={objective} onChange={(e) => setObjective(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && build()}
                placeholder={example}
                className="w-full flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60" />
              <button onClick={build}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] glow-gold">
                Build My System <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={build} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <Play className="h-4 w-4 text-accent" /> See It Work
              </button>
              <button onClick={() => setObjective(example)} className="text-xs text-muted-foreground/70 underline-offset-4 hover:underline">Try an example</button>
            </div>
          </motion.div>

          <motion.div {...reveal(0.21)} className="mt-8">
            <Link to={isAuthed ? '/checkout/founding' : '/login?next=/checkout/founding'} className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-gold transition-transform active:scale-[0.97]">
              Claim Founding Access — $11.69 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{FOUNDING.headline}</p>
            <div className="mt-4"><PilotCounter compact /></div>
          </motion.div>

          <motion.div {...reveal(0.24)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> SOC-grade data handling</span>
            <span className="inline-flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gold" /> Avg. 3.4× faster to launch</span>
            <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /> 12k+ systems shipped</span>
          </motion.div>
        </div>

        <motion.div {...reveal(0.1)} className="relative">
          <WorkflowPreview active={active} />
          <button onClick={build} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4 text-left transition-colors hover:bg-primary/10">
            <div>
              <div className="flex items-center gap-2 font-semibold text-gold"><Zap className="h-4 w-4" /> Run the live build</div>
              <p className="mt-1 text-sm text-muted-foreground">Watch Wyzrdy reason through all 5 stages in real time.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gold" />
          </button>
        </motion.div>
      </Section>
    </div>
  );
}

// ────────────────────────────────────────────
// Founding Member Launch — $2 First Month
// ────────────────────────────────────────────
function FoundingMemberCountdown() {
  const [count, setCount] = React.useState(null);
  React.useEffect(() => {
    fetch('/hcgi/api/founding/count')
      .then((r) => r.json())
      .then((d) => setCount({ claimed: d.completed_purchases || 0, remaining: d.remaining, cap: d.total_cap }))
      .catch(() => setCount({ claimed: 0, remaining: FOUNDING_MEMBER.cap, cap: FOUNDING_MEMBER.cap }));
  }, []);
  const claimed = count?.claimed ?? 0;
  const cap = count?.cap ?? FOUNDING_MEMBER.cap;
  const pct = Math.min(100, (claimed / cap) * 100);
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 font-medium">
          <Flame className="h-4 w-4 text-destructive" />
          <span className="text-destructive font-bold">{claimed.toLocaleString()}</span> founders claimed
        </span>
        <span className="text-muted-foreground">
          {(cap - claimed).toLocaleString()} spots remain
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-destructive via-orange-400 to-gold"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function FoundingMemberHero() {
  const { isAuthed } = useAuth();
  return (
    <div className="relative overflow-hidden border-y-2 border-destructive/20 bg-gradient-to-b from-destructive/5 via-transparent to-transparent">
      <div className="absolute inset-0 bg-grid opacity-[0.15]" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-destructive/5 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[140px]" />

      <Section className="relative py-16 md:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: Urgency + Value */}
          <div>
            <motion.div {...reveal(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5">
              <Flame className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-bold tracking-wide text-destructive">FOUNDING MEMBER LAUNCH — ACT NOW</span>
            </motion.div>

            <motion.h2 {...reveal(0.05)} className="font-serif-lux text-4xl font-semibold leading-[1.05] md:text-5xl">
              Founding Member:<br />
              <span className="text-gold">$2 First Month,</span>{' '}
              <span className="underline decoration-destructive/50 decoration-4 underline-offset-4">Lock In Forever</span>
            </motion.h2>

            <motion.p {...reveal(0.1)} className="mt-4 max-w-xl text-lg text-muted-foreground">
              {FOUNDING_MEMBER.headline}
            </motion.p>

            <motion.div {...reveal(0.14)} className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-accent" /> Rate locked for life</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-destructive" /> Only {FOUNDING_MEMBER.cap.toLocaleString()} spots</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-gold" /> Cancel anytime</span>
            </motion.div>

            <motion.div {...reveal(0.18)} className="mt-6 max-w-sm">
              <FoundingMemberCountdown />
            </motion.div>

            <motion.div {...reveal(0.22)} className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthed ? '/checkout/founding-member' : '/login?next=/checkout/founding-member'}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.97]"
              >
                {FOUNDING_MEMBER.cta} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/pricing" className="rounded-full border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Compare plans
              </Link>
            </motion.div>

            <motion.p {...reveal(0.25)} className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold text-destructive">⚠</span> If you cancel, the $2/mo rate is gone forever. Standard pricing applies on re-subscription.
            </motion.p>
          </div>

          {/* Right: Pricing card + Social proof */}
          <motion.div {...reveal(0.12)} className="flex flex-col gap-4">
            {/* Pricing Card */}
            <div className="glass rounded-2xl p-6 border-2 border-primary/40 glow-gold text-center">
              <div className="text-xs font-semibold tracking-widest text-gold uppercase">Founding Member Price</div>
              <div className="mt-3 font-serif-lux">
                <span className="text-6xl font-bold text-gold">$2</span>
                <span className="text-lg text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="line-through">$29/mo</span> — lock in your founding rate forever
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
                {[
                  'Full Individual plan',
                  'All AI features',
                  'Unlimited projects',
                  'Founding Member badge',
                ].map((f) => (
                  <div key={f} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{f}
                  </div>
                ))}
              </div>
              <Link
                to={isAuthed ? '/checkout/founding-member' : '/login?next=/checkout/founding-member'}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.97]"
              >
                Lock In $2/mo Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Social Proof */}
            <div className="grid gap-3 sm:grid-cols-3">
              {FOUNDING_MEMBER.socialProof.map((t, i) => (
                <div key={i} className="glass rounded-xl p-4 text-center">
                  <div className="flex justify-center gap-0.5 mb-1.5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3 w-3 fill-gold text-gold" />
                    ))}
                  </div>
                  <p className="text-xs italic text-muted-foreground leading-relaxed">"{t.quote}"</p>
                  <p className="mt-2 text-[11px]">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-muted-foreground"> — {t.role}</span>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  );
}

const NAV_MODULES = [
  { icon: MessageSquare, name: 'Ask', d: 'Conversational strategy grounded in your data.', to: '/easy-breezy', cta: 'Open Ask', actions: ['Ask a strategy question', 'Ground answers in your data', 'Turn a reply into a workflow'] },
  { icon: Hammer, name: 'Forge', d: 'Generate offers, pages, funnels and campaigns.', to: '/#build', cta: 'Start forging', actions: ['Generate offers & landing copy', 'Build funnels and campaigns', 'Run the live 5-stage build'] },
  { icon: Gauge, name: 'Optimize', d: 'Continuous funnel & conversion tuning.', to: '/forgeseo', cta: 'Optimize now', actions: ['Run an opportunity scan', 'Tune conversion weak points', 'Track priority fixes'] },
  { icon: Layers, name: 'Projects', d: 'Every initiative organized and tracked.', to: '/dashboard?tab=projects', cta: 'View projects', actions: ['Browse every initiative', 'Track status and progress', 'Open project details'] },
  { icon: Boxes, name: 'Assets', d: 'A living library of everything you ship.', to: '/dashboard?tab=assets', cta: 'Open assets', actions: ['Blueprints, audits & content', 'Filter by asset type', 'Export or download'] },
  { icon: PlugZap, name: 'Integrations', d: 'Connect your stack in a few clicks.', to: '/dashboard?tab=preferences', cta: 'Manage integrations', actions: ['Connect Google, Slack & more', 'Manage connected accounts', 'Control sync & permissions'] },
  { icon: BarChart3, name: 'Analytics', d: 'Unified revenue and performance signal.', to: '/dashboard?tab=analytics', cta: 'See analytics', actions: ['Usage, credits & activity', 'Revenue and performance signal', 'Export your data'] },
  { icon: ShieldCheck, name: 'Account', d: 'Roles, workspaces and billing in one place.', to: '/dashboard?tab=profile', cta: 'Go to account', actions: ['Profile & workspace settings', 'Billing and plan', 'Privacy & consent controls'] },
];

function NavModuleCard({ m, delay }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const go = () => {
    if (m.to.startsWith('/#')) { navigate('/'); document.getElementById(m.to.slice(2))?.scrollIntoView({ behavior: 'smooth' }); }
    else navigate(m.to);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
    if (e.key === 'Escape') setOpen(false);
  };
  return (
    <motion.div {...reveal(delay)}
      role="button" tabIndex={0} aria-expanded={open} aria-label={`${m.name}: ${m.d}`}
      onClick={() => setOpen((v) => !v)} onKeyDown={onKeyDown}
      className={`group glass cursor-pointer rounded-2xl p-5 outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] ${open ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-gold transition-colors group-hover:bg-primary group-hover:text-primary-foreground ${open ? 'bg-primary text-primary-foreground' : ''}`}><m.icon className="h-5 w-5" /></div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180 text-gold' : ''}`} />
      </div>
      <div className="font-semibold">{m.name}</div>
      <p className="mt-1.5 text-sm text-muted-foreground">{m.d}</p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {m.actions.map((a) => (
                <li key={a} className="flex items-start gap-2 text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{a}</li>
              ))}
            </ul>
            <button onClick={(e) => { e.stopPropagation(); go(); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] glow-gold">
              {m.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const PRODUCTS = [
  {
    icon: Radar,
    tag: 'SEARCH & CONVERSION',
    name: 'ForgeSEO',
    tint: 'text-[hsl(var(--violet))]',
    desc: 'Evidence-based opportunity scans, keyword clusters and content forging that turn search traffic into qualified leads.',
    benefits: ['Free opportunity scan in under a minute', 'Scored priorities, not unstructured AI text', 'Feeds qualified users into the Wyzrdy ecosystem'],
    to: '/forgeseo',
    cta: 'Run a free scan',
  },
  {
    icon: Compass,
    tag: 'GUIDED ENTRY',
    name: 'Easy Breezy',
    tint: 'text-accent',
    desc: 'A warm, guided builder that converts an idea into a full Business Launch Blueprint — then flows straight into Wyzrdy.',
    benefits: ['Conversational intent picker, no blank page', 'Personalized launch blueprint in minutes', 'One-click hand-off into Wyzrdy workflows'],
    to: '/easy-breezy',
    cta: 'Explore Easy Breezy',
  },
  {
    icon: Sparkles,
    tag: 'OPERATING LAYER',
    name: 'Wyzrdy',
    tint: 'text-gold',
    desc: 'The command center that plans, builds, optimizes, and organizes the work to launch and grow a real revenue system.',
    benefits: ['One brain across strategy, content and funnels', 'Live 5-stage build you can watch run', 'Every asset tracked in one project library'],
    to: '#build',
    cta: 'See Wyzrdy build',
  },
];

const PLANS = [
  { name: 'Individual', monthly: 22.22, monthlyLabel: '$22.22', yearlyLabel: '$133.32', pts: ['1 workspace', 'Core AI usage', 'Templates library'] },
  { name: 'Business', monthly: 77.77, monthlyLabel: '$77.77', yearlyLabel: '$466.62', pts: ['5 seats', 'Advanced automation', 'Priority AI usage'], featured: true },
  { name: 'Agency', monthly: 333.33, monthlyLabel: '$333.33', yearlyLabel: '$1,999.98', pts: ['Client workspaces', 'White-label', 'Implementation hours'] },
  { name: 'Enterprise', monthly: null, monthlyLabel: 'Custom', yearlyLabel: 'Custom', pts: ['Licensing', 'SSO & audit', 'Dedicated success'] },
];

function PricingTeaser() {
  const [billing, setBilling] = React.useState('monthly');
  return (
    <Section className="py-20 md:py-28">
      <motion.div {...reveal()} className="mb-8 max-w-2xl">
        <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">Pricing that scales with the system</h2>
        <p className="mt-4 text-muted-foreground">Individual subscriptions, business plans, agency workspaces, premium templates, implementation services and enterprise licensing.</p>
      </motion.div>

      <div className="mb-10 inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-1">
        {['monthly', 'yearly'].map((mode) => (
          <button key={mode} onClick={() => setBilling(mode)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${billing === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {mode === 'monthly' ? 'Monthly' : 'Yearly'}
            {mode === 'yearly' && <span className="ml-1.5 text-xs font-semibold text-gold">save 50%</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {PLANS.map((p, i) => {
          const isYearly = billing === 'yearly';
          const priceLabel = p.monthly == null ? p.monthlyLabel : (isYearly ? p.yearlyLabel : p.monthlyLabel);
          const cadence = p.monthly == null ? '' : (isYearly ? '/yr' : '/mo');
          return (
            <motion.div key={p.name} {...reveal(i * 0.05)}
              className={`relative rounded-3xl p-6 ${p.featured ? 'glass glow-gold border-primary/40' : 'glass'}`}>
              {p.featured && <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wide text-primary-foreground">MOST POPULAR</div>}
              <div className="text-sm text-muted-foreground">{p.name}</div>
              <div className="mt-2 font-serif-lux text-4xl font-semibold">{priceLabel}<span className="text-base font-normal text-muted-foreground">{cadence}</span></div>
              {isYearly && p.monthly != null && (
                <div className="mt-1 text-xs text-accent">50% off — billed annually</div>
              )}
              <ul className="mt-5 space-y-2.5 text-sm">
                {p.pts.map((pt) => <li key={pt} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-accent" />{pt}</li>)}
              </ul>
              <button className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-transform active:scale-[0.98] ${p.featured ? 'bg-primary text-primary-foreground glow-gold' : 'border border-border hover:bg-secondary'}`}>Choose {p.name}</button>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function HomeShare() {
  const { user } = useAuth();
  return <ShareButtons userId={user?.id || ''} title="Share Wyzrdy" context="home" />;
}

export default function HomePage() {
  const { isAuthed } = useAuth();
  return (
    <div className="min-h-screen">
      <Seo
        title="Wyzrdy — Founding Access $11.69 for Your First Year | AI Business Operating System"
        description="First 20,000 verified purchasers get one year of Wyzrdy Individual plan access for $11.69. The AI workflow builder and business operating system for automation, content and growth."
        path="/"
        type="website"
        keywords="AI business automation, business operating system, automated content creation, small-business AI tools, AI productivity platform, AI workflow builder"
        jsonLd={[
          orgSchema,
          softwareAppSchema({ name: 'Wyzrdy', description: 'AI business operating system that plans, builds, optimizes and grows real revenue systems.', url: '/' }),
          faqSchema([
            { q: 'What is Wyzrdy?', a: 'Wyzrdy is a unified AI business operating system that turns an objective into a working revenue system across strategy, content, funnels and execution.' },
            { q: 'How does Founding Access work?', a: 'One-time founding access for your first year: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. Once the limit is reached, this offer is gone. One year of access applies to the Individual plan; metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. After 12 months, standard subscription pricing applies.' },
            { q: 'What can I build with Wyzrdy?', a: 'Business plans, offers, landing-page copy, outreach campaigns, SEO audits, keyword clusters and full multi-stage revenue systems.' },
          ]),
        ]}
      />
      <SiteNav />
      <ForgeSeoHero />
      <FoundingMemberHero />

      {/* logo ribbon */}
      <div className="relative overflow-hidden border-y border-border py-4">
        <div className="marquee-track flex w-max gap-12 whitespace-nowrap px-6 text-sm font-medium text-muted-foreground/70">
          {[...Array(2)].flatMap((_, k) => ['AI Workflow Builder', 'Business Automation', 'Operating System', 'Content Creation', 'Small-business AI', 'Productivity Platform'].map((t) => (
            <span key={`${k}-${t}`} className="inline-flex items-center gap-3"><span className="h-1 w-1 rounded-full bg-gold" />{t}</span>
          )))}
        </div>
      </div>

      {/* three products */}
      <Section className="py-20 md:py-28">
        <motion.div {...reveal()} className="max-w-2xl">
          <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">One ecosystem, <span className="text-gold">three ways in</span></h2>
          <p className="mt-4 text-muted-foreground">Start wherever fits — a search opportunity, a guided idea, or a straight objective. Every path lands in the same operating layer.</p>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <motion.div key={p.name} {...reveal(i * 0.06)} className="glass flex flex-col overflow-hidden rounded-3xl p-7">
              <div className={`mb-5 grid h-11 w-11 place-items-center rounded-xl bg-secondary ${p.tint}`}><p.icon className="h-5 w-5" /></div>
              <div className="text-xs tracking-widest text-muted-foreground">{p.tag}</div>
              <h3 className="mt-2 font-serif-lux text-2xl font-semibold">{p.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-muted-foreground"><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${p.tint}`} />{b}</li>
                ))}
              </ul>
              {p.to.startsWith('#') ? (
                <a href={p.to} onClick={(e) => { e.preventDefault(); document.getElementById(p.to.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-6 inline-flex items-center gap-1.5 font-medium text-gold hover:underline">{p.cta} <ArrowRight className="h-4 w-4" /></a>
              ) : (
                <Link to={p.to} className="mt-6 inline-flex items-center gap-1.5 font-medium text-gold hover:underline">{p.cta} <ArrowRight className="h-4 w-4" /></Link>
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      <div id="build">
        <WyzrdyBuildSection />
      </div>

      <Section className="py-20 md:py-28">
        <motion.div {...reveal()} className="max-w-2xl">
          <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">One operating layer, <span className="text-gold">nine surfaces</span></h2>
          <p className="mt-4 text-muted-foreground">Every module shares one brain, one asset library and one analytics spine — reusing the strongest patterns from FlowForge and Easy Breezy.</p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_MODULES.map((m, i) => (
            <NavModuleCard key={m.name} m={m} delay={i * 0.04} />
          ))}
        </div>
      </Section>

      <PricingTeaser />

      <Section className="pb-28">
        <motion.div {...reveal()} className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-serif-lux text-4xl font-semibold md:text-5xl">Build the system that runs your revenue</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{FOUNDING.headline}</p>
            <div className="mx-auto mt-6 max-w-md"><PilotCounter /></div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={isAuthed ? '/checkout/founding' : '/login?next=/checkout/founding'} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground glow-gold">{FOUNDING.cta}</Link>
              <Link to="/forgeseo" className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-secondary">See It Work</Link>
            </div>
          </div>
        </motion.div>
      </Section>

      <Section className="pb-28">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-serif-lux text-3xl font-semibold md:text-4xl">Spread the word, earn your spot</h2>
          <p className="mt-2 text-sm text-muted-foreground">The first 20,000 verified purchasers secure Founding Access for $11.69 — one year on the Wyzrdy Individual plan. Share Wyzrdy with your network.</p>
          <div className="mt-6 text-left"><HomeShare /></div>
        </div>
      </Section>

      <SiteFooter />
    </div>
  );
}
