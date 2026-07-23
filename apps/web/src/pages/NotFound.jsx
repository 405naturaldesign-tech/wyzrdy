import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { motion } from 'framer-motion';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/easy-breezy', label: 'Easy Breezy' },
  { to: '/forgeseo', label: 'ForgeSEO' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/contact', label: 'Contact' },
];

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <Seo title="Page not found — Wyzrdy" description="The page you were looking for does not exist." path="/404" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />
      <Section className="relative flex min-h-[70vh] items-center pt-32 pb-24">
        <motion.div {...reveal(0)} className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-gold">
            <Compass className="h-7 w-7" />
          </div>
          <div className="font-serif-lux text-6xl font-semibold text-gold">404</div>
          <h1 className="mt-2 font-serif-lux text-3xl font-semibold">This page took a wrong turn</h1>
          <p className="mt-2 text-muted-foreground">The link may be broken or the page may have moved. Try one of these instead:</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">
                {l.label} <ArrowRight className="h-3.5 w-3.5 text-gold" />
              </Link>
            ))}
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
