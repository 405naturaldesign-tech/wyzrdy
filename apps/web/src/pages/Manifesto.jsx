import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronRight,
  CircleDot,
  Globe2,
  HeartHandshake,
  Leaf,
  Recycle,
  Sparkles,
} from 'lucide-react';
import Seo, { breadcrumbSchema } from '@/components/Seo';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';

const principles = [
  {
    icon: Leaf,
    title: 'Restore what sustains life',
    text: 'Every invention must leave the environment stronger, more diverse, and more capable of sustaining the generations that follow.',
  },
  {
    icon: HeartHandshake,
    title: 'Nurture the nurturers',
    text: 'Those who teach, heal, protect, cultivate, and create must be replenished by the living systems their work strengthens.',
  },
  {
    icon: Recycle,
    title: 'Turn benefit into infrastructure',
    text: 'A benefit received becomes the capacity to create another benefit. Beneficiaries become benefactors, and the cycle compounds.',
  },
  {
    icon: Globe2,
    title: 'Design for all inhabitants',
    text: 'Human prosperity cannot be separated from the prosperity of the ecosystems, communities, and species sharing one world.',
  },
];

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Symbiotic Academy Manifesto',
  description: 'A public vision for regenerative invention, reciprocal abundance, and systems that measure wealth by the benefit they continue creating.',
  author: { '@type': 'Organization', name: 'Wyzrdy' },
  publisher: { '@type': 'Organization', name: 'The Good Idea LLC' },
  mainEntityOfPage: 'https://wyzrdy.com/manifesto',
};

export default function Manifesto() {
  return (
    <div className="min-h-screen">
      <Seo
        title="The Symbiotic Academy Manifesto — Wyzrdy"
        description="A public vision for regenerative invention, reciprocal abundance, and systems that measure wealth by the benefit they continue creating."
        path="/manifesto"
        keywords="regenerative invention, reciprocal abundance, symbiotic systems, environmental benefit, Wyzrdy manifesto"
        jsonLd={[
          articleSchema,
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Manifesto', path: '/manifesto' },
          ]),
        ]}
      />
      <SiteNav />

      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.08]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-accent/5 blur-[120px]" />

      <main className="relative">
        <Section className="pt-32 pb-20 md:pt-44 md:pb-28">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">Manifesto</span>
          </nav>

          <motion.div {...reveal(0)} className="max-w-5xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              <Sparkles className="h-3.5 w-3.5" /> A public declaration
            </div>
            <h1 className="font-serif-lux text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl lg:text-[6.5rem]">
              The Symbiotic<br />Academy Manifesto
            </h1>
            <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
              We envision a regenerative civilization in which imagination becomes invention, invention becomes benefit, and benefit becomes the foundation of shared abundance.
            </p>
          </motion.div>

          <motion.div {...reveal(0.12)} className="mt-14 grid gap-5 border-y border-border py-8 md:grid-cols-[1fr_auto] md:items-center md:gap-12">
            <p className="font-serif-lux text-3xl leading-tight text-foreground md:text-4xl">
              The highest form of wealth is measurable benefit that continues producing benefit after its creator is gone.
            </p>
            <CircleDot className="hidden h-16 w-16 text-gold/70 md:block" strokeWidth={1} />
          </motion.div>
        </Section>

        <Section className="pb-24 md:pb-32">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <motion.div {...reveal(0)}>
              <div className="sticky top-32">
                <div className="font-mono-lux text-xs uppercase tracking-[0.24em] text-gold">The originating vision</div>
                <h2 className="mt-4 font-serif-lux text-4xl font-semibold leading-tight md:text-5xl">A future received through cognitive imagination.</h2>
              </div>
            </motion.div>

            <motion.div {...reveal(0.08)} className="space-y-7 text-lg leading-relaxed text-muted-foreground">
              <p>
                Thought begins as frequency: unseen possibility becoming perception, perception becoming epiphany, and epiphany becoming a future that can be built. The inventor&apos;s duty is to receive that possibility with humility and translate it into structures that brighten life beyond the presently fathomable limits of reality.
              </p>
              <p>
                At the center of this future is the <span className="font-medium text-foreground">Symbiotic Academy</span>: a living system designed to nurture nurturers. It exists so knowledge, care, stewardship, and creative power can replenish themselves instead of being exhausted by the systems they serve.
              </p>
              <p>
                Here, money is not the measure of worth. Extractive monetary architecture gives way to an architecture of reciprocal benefit—benefit to the environment, benefit to people, and benefit returned to the benefactors who make renewal possible.
              </p>
            </motion.div>
          </div>
        </Section>

        <Section className="pb-24 md:pb-32">
          <motion.div {...reveal(0)} className="mb-10 max-w-3xl">
            <div className="font-mono-lux text-xs uppercase tracking-[0.24em] text-gold">Four commitments</div>
            <h2 className="mt-4 font-serif-lux text-4xl font-semibold md:text-5xl">The architecture of reciprocal abundance</h2>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2">
            {principles.map((principle, index) => (
              <motion.article key={principle.title} {...reveal(index * 0.06)} className="glass rounded-2xl p-7 md:p-9">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-gold">
                  <principle.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-7 font-serif-lux text-3xl font-semibold">{principle.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{principle.text}</p>
              </motion.article>
            ))}
          </div>
        </Section>

        <Section className="pb-24 md:pb-32">
          <motion.div {...reveal(0)} className="glass overflow-hidden rounded-3xl border-primary/30">
            <div className="gold-line h-px" />
            <div className="grid gap-10 p-8 md:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:p-16">
              <div>
                <div className="font-mono-lux text-xs uppercase tracking-[0.24em] text-gold">The living cycle</div>
                <p className="mt-5 font-serif-lux text-4xl font-semibold leading-tight md:text-5xl">
                  Those who heal the ecosystem are sustained by it. Those who teach are replenished by those they nurture. Every contribution strengthens the system that made it possible.
                </p>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-primary" /> Benefactors create capacity.</div>
                <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-accent" /> Beneficiaries receive and grow.</div>
                <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-violet-400" /> The nurtured become nurturers.</div>
                <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-foreground" /> The cycle renews itself.</div>
              </div>
            </div>
          </motion.div>
        </Section>

        <Section className="pb-28 text-center md:pb-36">
          <motion.div {...reveal(0)} className="mx-auto max-w-4xl">
            <Globe2 className="mx-auto h-12 w-12 text-gold" strokeWidth={1.25} />
            <h2 className="mt-7 font-serif-lux text-4xl font-semibold leading-tight md:text-6xl">This is not an economy of extraction.</h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              It is a living architecture in which every invention must leave life stronger than it found it—and every benefit must carry within it the power to create another.
            </p>
            <Link to="/easy-breezy" className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground glow-gold transition-transform active:scale-[0.98]">
              Turn the vision into a blueprint <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
