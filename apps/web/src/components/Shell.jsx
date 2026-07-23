import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, ArrowUpRight, LayoutDashboard, Twitter, Linkedin, Github } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const products = [
  { to: '/', name: 'Wyzrdy', tag: 'Revenue Command' },
  { to: '/easy-breezy', name: 'Easy Breezy', tag: 'Guided Builder' },
  { to: '/forgeseo', name: 'ForgeSEO', tag: 'Conversion Engine' },
];

export function DecoLogo({ label = 'WYZRDY', sub = 'REVENUE COMMAND CENTER', className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id="glg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="hsl(41 70% 66%)" />
              <stop offset="1" stopColor="hsl(41 60% 46%)" />
            </linearGradient>
          </defs>
          <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="url(#glg)" strokeWidth="2.5" />
          <polygon points="50,16 79,33 79,67 50,84 21,67 21,33" fill="none" stroke="url(#glg)" strokeWidth="1" opacity="0.5" />
          {/* discreet QR-style embedded matrix */}
          <g fill="url(#glg)">
            {[...Array(5)].map((_, r) =>
              [...Array(5)].map((_, c) => (
                ((r * 7 + c * 3 + 1) % 3 === 0) ? (
                  <rect key={`${r}-${c}`} x={38 + c * 5} y={38 + r * 5} width="3.6" height="3.6" rx="0.6" />
                ) : null
              ))
            )}
          </g>
        </svg>
      </div>
      <div className="leading-none">
        <div className="font-deco text-xl tracking-[0.25em] text-gold">{label}</div>
        <div className="mt-1 text-[9px] tracking-[0.35em] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

export function SiteNav() {
  const loc = useLocation();
  const { isAuthed, user } = useAuth();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between px-5 py-3.5 md:px-8">
        <Link to="/" className="glass rounded-full px-3 py-2 md:px-4">
          <DecoLogo sub="AI OPERATING SYSTEM" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex glass rounded-full px-2 py-1.5">
          {products.map((p) => {
            const active = loc.pathname === p.to;
            return (
              <Link key={p.to} to={p.to}
                className={`group relative rounded-full px-4 py-2 text-sm transition-colors ${active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {active && <motion.span layoutId="navpill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className="relative z-10 font-medium">{p.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link to="/pricing" className={`text-sm transition-colors ${loc.pathname === '/pricing' ? 'text-gold' : 'text-muted-foreground hover:text-foreground'}`}>Pricing</Link>
          {isAuthed && (
            <Link to="/artifacts" className={`text-sm transition-colors ${loc.pathname === '/artifacts' ? 'text-gold' : 'text-muted-foreground hover:text-foreground'}`}>Artifacts</Link>
          )}
          {isAuthed ? (
            <Link to="/dashboard" className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] glow-gold">
              <LayoutDashboard className="h-4 w-4" /> {user?.name?.split(' ')[0] || 'Dashboard'}
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
              <Link to="/signup" className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] glow-gold">
                Claim Founding Access — $11.69 <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </>
          )}
        </div>
        <button onClick={() => setOpen((v) => !v)} className="glass rounded-full p-3 lg:hidden" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass mx-4 rounded-2xl p-3 lg:hidden">
          {products.map((p) => (
            <Link key={p.to} to={p.to} className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-secondary">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.tag}</span>
            </Link>
          ))}
          <Link to="/pricing" className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-secondary">
            <span className="font-medium">Pricing</span>
            <span className="text-xs text-muted-foreground">Plans & tiers</span>
          </Link>
          <Link to="/contact" className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-secondary">
            <span className="font-medium">Contact</span>
            <span className="text-xs text-muted-foreground">Support & legal</span>
          </Link>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/security" className="hover:text-foreground">Security</Link>
          </div>
          {isAuthed ? (
            <Link to="/dashboard" className="mt-2 block w-full rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground">Dashboard</Link>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/login" className="rounded-xl border border-border py-3 text-center font-semibold">Sign in</Link>
              <Link to="/signup" className="rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground">Claim Founding Access — $11.69</Link>
            </div>
          )}
        </motion.div>
      )}
    </header>
  );
}

const FOOTER_COLS = [
  { h: 'Product', items: [
    { t: 'Wyzrdy', to: '/' }, { t: 'Easy Breezy', to: '/easy-breezy' }, { t: 'ForgeSEO', to: '/forgeseo' },
    { t: 'Pricing', to: '/pricing' }, { t: 'Performance', to: '/performance' }, { t: 'System status', to: '/monitor' },
    { t: 'Artifact Vault', to: '/artifacts' },
  ] },
  { h: 'Company', items: [
    { t: 'Contact & support', to: '/contact' }, { t: 'Security & compliance', to: '/security' },
    { t: 'Accessibility', to: '/accessibility' }, { t: 'Data processing (DPA)', to: '/dpa' },
  ] },
  { h: 'Legal', items: [
    { t: 'Privacy Policy', to: '/privacy' }, { t: 'Terms of Service', to: '/terms' },
    { t: 'Cookie Policy', to: '/cookies' }, { t: 'Data request', to: '/data-request' },
  ] },
];

const SOCIALS = [
  { icon: Twitter, label: 'Twitter / X', href: 'https://twitter.com/intent/tweet?text=Wyzrdy' },
  { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/company/wyzrdy' },
  { icon: Github, label: 'GitHub', href: 'https://github.com' },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-card/40">
      <div className="mx-auto max-w-[90rem] px-5 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <DecoLogo sub="AI OPERATING SYSTEM" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              One irreplaceable asset. Three engines to plan, build, optimize and grow real revenue systems.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-gold">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.h}>
              <div className="mb-4 text-sm font-semibold text-gold">{col.h}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.items.map((i) => (
                  <li key={i.t}>
                    <Link to={i.to} className="transition-colors hover:text-foreground">{i.t}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} The Good Idea LLC AI business operating system.</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link to="/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> GDPR &amp; CCPA aligned</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Section({ id, className = '', children }) {
  return <section id={id} className={`relative mx-auto w-full max-w-[80rem] px-5 md:px-8 ${className}`}>{children}</section>;
}

export function reveal(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  };
}
