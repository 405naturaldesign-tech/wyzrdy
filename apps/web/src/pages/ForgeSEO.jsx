import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Youtube, MapPin, Code2, FileText, Megaphone, Download, BarChart3, KeyRound, Radar,
} from 'lucide-react';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import Seo, { softwareAppSchema, breadcrumbSchema, faqSchema } from '@/components/Seo';
import ForgeSeoHero from '@/components/ForgeSeoHero';

const NAV = ['Audit', 'Strategy', 'Keywords', 'Content Forge', 'Video SEO', 'Local SEO', 'Schema', 'Campaigns', 'Exports', 'Analytics', 'Settings'];

const FAQS = [
  { q: 'Is the SEO opportunity scan really free?', a: 'Yes. Run your first opportunity scan free — no credit card required. You only need an account so we can save your audit and priorities.' },
  { q: 'What can ForgeSEO analyze?', a: 'A website URL, a video/YouTube topic, a product description, a transcript, or a local business name. Each produces a tailored evidence-based audit.' },
  { q: 'How is this different from generic AI text?', a: 'ForgeSEO returns a scored, structured audit — opportunity score, keyword clusters, conversion weaknesses, content gaps, technical SEO checks and ranked priorities — not an unstructured paragraph.' },
  { q: 'Does it use my live website content?', a: 'For URLs, ForgeSEO fetches and analyzes the live page content so recommendations reflect what is actually on your site.' },
];

export default function ForgeSEO() {
  const modules = [
    { icon: Radar, t: 'Audit', d: 'Evidence-based site & content diagnostics.' },
    { icon: KeyRound, t: 'Keywords', d: 'Keyword-cluster generator with intent mapping.' },
    { icon: FileText, t: 'Content Forge', d: 'Repurpose and generate ranking content.' },
    { icon: Youtube, t: 'Video SEO', d: 'YouTube SEO titles, tags and chapters.' },
    { icon: MapPin, t: 'Local SEO', d: 'Local business SEO audit and fixes.' },
    { icon: Code2, t: 'Schema', d: 'Schema generator for rich results.' },
    { icon: Megaphone, t: 'Campaigns', d: 'Run and manage search-and-conversion campaigns.' },
    { icon: Download, t: 'Exports', d: 'White-label reports and asset exports.' },
  ];
  return (
    <div className="min-h-screen">
      <Seo
        title="ForgeSEO — AI SEO Tool & Free Opportunity Scan"
        description="ForgeSEO is an AI SEO tool with a free SEO opportunity scan, YouTube SEO generator, local business SEO audit, keyword-cluster generator, schema generator and content repurposing."
        path="/forgeseo"
        keywords="AI SEO tool, free SEO opportunity scan, YouTube SEO generator, local business SEO audit, keyword-cluster generator, AI landing-page optimizer, schema generator, content repurposing platform"
        jsonLd={[
          softwareAppSchema({ name: 'ForgeSEO', description: 'AI SEO tool: free opportunity scan, keyword clusters, conversion and content audits.', url: '/forgeseo' }),
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'ForgeSEO', path: '/forgeseo' }]),
          faqSchema(FAQS),
        ]}
      />
      <SiteNav />
      <ForgeSeoHero />

      <div className="relative overflow-hidden border-y border-border py-3">
        <div className="marquee-track flex w-max gap-10 whitespace-nowrap px-6 text-sm text-muted-foreground/70">
          {[...Array(2)].flatMap((_, k) => NAV.map((n) => (
            <span key={`${k}-${n}`} className="inline-flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-[hsl(var(--violet))]" />{n}</span>
          )))}
        </div>
      </div>

      <Section className="py-20 md:py-28">
        <motion.div {...reveal()} className="max-w-2xl">
          <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">A precise workspace for search & conversion</h2>
          <p className="mt-4 text-muted-foreground">Eleven surfaces — Audit, Strategy, Keywords, Content Forge, Video SEO, Local SEO, Schema, Campaigns, Exports, Analytics and Settings.</p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m, i) => (
            <motion.div key={m.t} {...reveal(i * 0.04)} className="glass rounded-2xl p-5 transition-transform hover:-translate-y-1">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-[hsl(var(--violet))]"><m.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{m.t}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="pb-20 md:pb-28">
        <motion.div {...reveal()} className="max-w-2xl">
          <h2 className="font-serif-lux text-4xl font-semibold md:text-5xl">Frequently asked questions</h2>
          <p className="mt-4 text-muted-foreground">Everything you need to know before your first free SEO opportunity scan.</p>
        </motion.div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {FAQS.map((f, i) => (
            <motion.div key={f.q} {...reveal(i * 0.04)} className="glass rounded-2xl p-5">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="pb-28">
        <motion.div {...reveal()} className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-serif-lux text-4xl font-semibold md:text-5xl">See the opportunities you're missing</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Run a free scan, then hand off into the full audit workspace and the Wyzrdy ecosystem.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground glow-gold">Run Free Opportunity Scan</a>
              <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold hover:bg-secondary"><BarChart3 className="h-4 w-4" /> Explore Wyzrdy</Link>
            </div>
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
