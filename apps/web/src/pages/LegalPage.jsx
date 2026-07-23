import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ChevronRight, ScrollText } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { LEGAL_META } from '@/lib/legalContent';

function Breadcrumbs({ title }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <Link to="/privacy" className="transition-colors hover:text-foreground">Legal</Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-foreground">{title}</span>
    </nav>
  );
}

function matches(section, q) {
  if (!q) return true;
  const hay = (section.h + ' ' + section.body.map((b) => (typeof b === 'string' ? b : (b.list || []).join(' '))).join(' ')).toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function LegalPage({ page }) {
  const [q, setQ] = React.useState('');
  const visible = page.sections.filter((s) => matches(s, q));

  return (
    <div className="min-h-screen">
      <Seo title={`${page.title} — Wyzrdy`} description={page.intro.slice(0, 160)} path={`/${page.slug}`} />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.1]" />

      <Section className="relative pt-32 pb-20 md:pt-40">
        <Breadcrumbs title={page.title} />
        <motion.div {...reveal(0)} className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5 text-gold" /> Legal &amp; Compliance
          </div>
          <h1 className="font-serif-lux text-4xl font-semibold leading-tight md:text-6xl">{page.title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">Effective {LEGAL_META.effective} · {LEGAL_META.entity}</p>
          <p className="mt-5 text-lg text-muted-foreground">{page.intro}</p>
        </motion.div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* Table of contents */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass rounded-2xl p-4">
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search this policy"
                  aria-label={`Search ${page.title}`}
                  className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </label>
              <nav aria-label="On this page" className="space-y-0.5">
                {page.sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {s.h}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div className="min-w-0">
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections match “{q}”.</p>
            ) : (
              <div className="space-y-10">
                {visible.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <h2 className="font-serif-lux text-2xl font-semibold text-foreground">{s.h}</h2>
                    <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                      {s.body.map((b, i) =>
                        typeof b === 'string' ? (
                          <p key={i}>{b}</p>
                        ) : (
                          <ul key={i} className="space-y-2 pl-1">
                            {b.list.map((li, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                                <span>{li}</span>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
              <Link to="/cookies" className="text-muted-foreground hover:text-foreground">Cookies</Link>
              <Link to="/security" className="text-muted-foreground hover:text-foreground">Security</Link>
              <Link to="/accessibility" className="text-muted-foreground hover:text-foreground">Accessibility</Link>
              <Link to="/data-request" className="text-gold hover:underline">Submit a data request</Link>
            </div>
          </div>
        </div>
      </Section>

      <SiteFooter />
    </div>
  );
}
