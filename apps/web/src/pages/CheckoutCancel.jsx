import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import Seo from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen">
      <Seo title="Checkout canceled — Wyzrdy" description="Your checkout was canceled." path="/checkout/cancel" noindex />
      <SiteNav />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />

      <Section className="relative pt-32 pb-24 md:pt-40">
        <motion.div {...reveal(0)} className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-serif-lux text-3xl font-semibold">Checkout canceled</h1>
          <p className="mt-3 text-muted-foreground">
            No payment was taken and your founding pass reservation will be released automatically.
            You can try again anytime while passes remain.
          </p>
          <div className="mt-6 grid max-w-xs mx-auto gap-2">
            <Link to="/checkout/founding" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-gold">
              <RotateCcw className="h-4 w-4" /> Try again
            </Link>
            <Link to="/pricing" className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary">
              Compare plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </Section>
      <SiteFooter />
    </div>
  );
}
