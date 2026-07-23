import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ShieldCheck, ScrollText, LifeBuoy, ChevronRight, ArrowRight } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';

const CARDS = [
  { icon: LifeBuoy, h: 'Product & support', d: 'Questions about features, billing, or your account.', to: 'mailto:support@wyzrdy.com', cta: 'support@wyzrdy.com' },
  { icon: ScrollText, h: 'Legal inquiries', d: 'Terms, contracts, DPAs, and compliance requests.', to: 'mailto:legal@wyzrdy.com', cta: 'legal@wyzrdy.com' },
  { icon: ShieldCheck, h: 'Privacy & data', d: 'Exercise your GDPR / CCPA data rights.', to: 'mailto:privacy@wyzrdy.com', cta: 'privacy@wyzrdy.com' },
  { icon: Mail, h: 'Security disclosures', d: 'Report a vulnerability responsibly.', to: 'mailto:security@wyzrdy.com', cta: 'security@wyzrdy.com' },
];

export default function Contact() {
  return (
    <div className="min-h-screen">
      <Seo title="Contact & Support — Wyzrdy" description="Reach the Wyzrdy team for product support, legal inquiries, privacy requests, and security disclosures." path="/contact" />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.1]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Contact</span>
        </nav>

        <motion.div {...reveal(0)} className="max-w-2xl">
          <h1 className="font-serif-lux text-4xl font-semibold leading-tight md:text-6xl">Contact &amp; support</h1>
          <p className="mt-5 text-lg text-muted-foreground">We&apos;re here to help. Choose the right team below, or submit a formal data request.</p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c, i) => (
            <motion.a key={c.h} {...reveal(i * 0.05)} href={c.to} className="glass group flex flex-col rounded-2xl p-6 transition-transform hover:-translate-y-1">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-gold"><c.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{c.h}</div>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{c.d}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold">{c.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </motion.a>
          ))}
        </div>

        <motion.div {...reveal(0.1)} className="glass mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-primary/30 p-6">
          <div>
            <div className="font-semibold">Exercise your data rights</div>
            <p className="mt-1 text-sm text-muted-foreground">Access, correct, delete, or port your data under GDPR &amp; CCPA.</p>
          </div>
          <Link to="/data-request" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold">Open request form <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      </Section>

      <SiteFooter />
    </div>
  );
}
