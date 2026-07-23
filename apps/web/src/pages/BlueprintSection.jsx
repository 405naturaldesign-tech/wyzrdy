import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Seo, { breadcrumbSchema } from '@/components/Seo';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Zap, Sparkles, ChevronDown, Copy, Pencil, Check, FileJson, FileText, Printer } from 'lucide-react';
import { SiteNav, SiteFooter, Section, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import portal from '@/lib/portal';
import { getSection, adjacentSections, BLUEPRINT_SECTIONS, deliverableDetail } from '@/lib/blueprint';
import { copyText, downloadJSON, downloadMarkdown, toMarkdown, printHTML, fileName } from '@/lib/deliverable';

function detailToLines(detail) {
  const out = [];
  Object.entries(detail).forEach(([k, v]) => {
    out.push({ heading: k, body: v });
  });
  return out;
}

function Deliverable({ section, point }) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(point);
  const [copied, setCopied] = React.useState(false);
  const detail = deliverableDetail(section, point);
  const lines = detailToLines(detail);

  const asText = () => `${text}\n\n` + lines.map((l) => `${l.heading}:\n` + (Array.isArray(l.body) ? l.body.map((b) => `- ${b}`).join('\n') : l.body)).join('\n\n');
  const doCopy = async () => { if (await copyText(asText())) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const doMd = () => downloadMarkdown(fileName(text, 'md'), toMarkdown(text, detail));
  const doJson = () => downloadJSON(fileName(text, 'json'), { deliverable: text, ...detail });
  const doPrint = () => {
    const html = lines.map((l) => `<h3>${l.heading}</h3>` + (Array.isArray(l.body) ? `<ul>${l.body.map((b) => `<li>${b}</li>`).join('')}</ul>` : `<p>${l.body}</p>`)).join('');
    printHTML(text, `<h1>${text}</h1>${html}`);
  };

  return (
    <div className={`rounded-xl border transition-colors ${open ? 'border-primary/40 bg-primary/[0.03]' : 'border-border bg-secondary/40'}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="mt-0.5 shrink-0 text-accent"><CheckCircle2 className="h-4 w-4" /></button>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          {editing ? (
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              className="w-full rounded-lg border border-primary/50 bg-background px-2 py-1 text-sm outline-none" />
          ) : (
            <span className="text-sm">{text}</span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setEditing((e) => !e)} title="Edit" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">{editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}</button>
          <button onClick={doCopy} title="Copy" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">{copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}</button>
          <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          {lines.map((l) => (
            <div key={l.heading}>
              <div className="text-[11px] font-medium uppercase tracking-widest text-gold">{l.heading}</div>
              {Array.isArray(l.body) ? (
                <ul className="mt-1 space-y-1">
                  {l.body.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{b}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{l.body}</p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={doJson} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileJson className="h-3.5 w-3.5" /> JSON</button>
            <button onClick={doMd} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileText className="h-3.5 w-3.5" /> Markdown</button>
            <button onClick={doPrint} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><Printer className="h-3.5 w-3.5" /> PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlueprintSection() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const section = getSection(slug);
  const [triggering, setTriggering] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (!section) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <Section className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
          <h1 className="font-serif-lux text-4xl font-semibold">Section not found</h1>
          <p className="text-muted-foreground">That blueprint section does not exist.</p>
          <Link to="/easy-breezy" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-gold">Back to Easy Breezy</Link>
        </Section>
        <SiteFooter />
      </div>
    );
  }

  const { prev, next, index } = adjacentSections(slug);
  const Icon = section.icon;

  const triggerWorkflow = async () => {
    if (!isAuthed) { navigate('/signup'); return; }
    if (triggering) return;
    setTriggering(true);
    try {
      const wf = await portal.createWorkflow({
        name: section.workflow.name,
        type: section.workflow.type,
        status: 'in-progress',
        objective: section.summary,
        workflow_data: { section: section.slug, steps: section.points },
      });
      await portal.logActivity('triggered_workflow', 'blueprint_section', section.slug, { name: section.workflow.name });
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 900);
      return wf;
    } catch (_) {
      setTriggering(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Seo
        title={`${section.label} — Business Launch Blueprint | Easy Breezy`}
        description={section.summary}
        path={`/blueprint/${section.slug}`}
        jsonLd={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Easy Breezy', path: '/easy-breezy' }, { name: section.label, path: `/blueprint/${section.slug}` }])}
      />
      <SiteNav />

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-accent/15 blur-[130px]" />
        <Section className="relative pb-12 pt-36 lg:pt-44">
          <motion.nav {...reveal(0)} aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/easy-breezy" className="transition-colors hover:text-foreground">Easy Breezy</Link>
            <span>/</span>
            <Link to="/easy-breezy" className="transition-colors hover:text-foreground">Blueprint</Link>
            <span>/</span>
            <span className="text-foreground">{section.label}</span>
          </motion.nav>
          <motion.div {...reveal(0.05)} className="mt-6 flex items-start gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-secondary text-gold"><Icon className="h-7 w-7" /></div>
            <div>
              <div className="text-xs font-medium tracking-widest text-accent">SECTION {String(index + 1).padStart(2, '0')} / 10 · {section.tagline.toUpperCase()}</div>
              <h1 className="mt-1 font-serif-lux text-4xl font-semibold md:text-6xl">{section.label}</h1>
            </div>
          </motion.div>
          <motion.p {...reveal(0.1)} className="mt-6 max-w-2xl text-lg text-muted-foreground">{section.summary}</motion.p>
        </Section>
      </div>

      <Section className="grid gap-6 pb-8 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div {...reveal(0.05)} className="glass rounded-3xl p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gold"><Sparkles className="h-4 w-4" /> What this section produces</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => downloadJSON(fileName(section.label, 'json'), { section: section.label, summary: section.summary, deliverables: section.points.map((p) => ({ label: p, ...deliverableDetail(section, p) })) })} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileJson className="h-3.5 w-3.5" /> JSON</button>
              <button onClick={() => downloadMarkdown(fileName(section.label, 'md'), toMarkdown(section.label, section.points.map((p) => ({ label: p, detail: JSON.stringify(deliverableDetail(section, p)) }))))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><FileText className="h-3.5 w-3.5" /> Markdown</button>
              <button onClick={() => printHTML(section.label, `<h1>${section.label}</h1><p>${section.summary}</p>` + section.points.map((p) => { const d = deliverableDetail(section, p); return `<h2>${p}</h2>` + Object.entries(d).map(([k, v]) => `<h3>${k}</h3>` + (Array.isArray(v) ? `<ul>${v.map((x) => `<li>${x}</li>`).join('')}</ul>` : `<p>${v}</p>`)).join(''); }).join(''))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"><Printer className="h-3.5 w-3.5" /> Print</button>
            </div>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Expand each deliverable for details, examples and proof. Edit, copy or export any item.</p>
          <div className="space-y-2.5">
            {section.points.map((p) => <Deliverable key={p} section={section} point={p} />)}
          </div>
        </motion.div>

        <motion.div {...reveal(0.1)} className="glass flex flex-col rounded-3xl p-7">
          <div className="text-xs tracking-widest text-muted-foreground">TAKE ACTION</div>
          <h2 className="mt-2 font-serif-lux text-2xl font-semibold">Trigger this workflow</h2>
          <p className="mt-2 text-sm text-muted-foreground">Spin up a live {section.workflow.type} workflow for {section.label.toLowerCase()} and track it in your dashboard.</p>
          <button onClick={triggerWorkflow} disabled={triggering || done}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-70 glow-gold">
            {done ? <><CheckCircle2 className="h-4 w-4" /> Workflow created</> : triggering ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating</> : <><Zap className="h-4 w-4" /> {isAuthed ? 'Trigger workflow' : 'Sign up to trigger'}</>}
          </button>
          <Link to={section.cta.to} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-secondary">
            {section.cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </Section>

      {/* all sections quick nav */}
      <Section className="pb-8">
        <div className="flex flex-wrap gap-2">
          {BLUEPRINT_SECTIONS.map((s) => (
            <Link key={s.slug} to={`/blueprint/${s.slug}`}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${s.slug === slug ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {s.label}
            </Link>
          ))}
        </div>
      </Section>

      <Section className="flex flex-col gap-3 pb-28 sm:flex-row sm:justify-between">
        {prev ? (
          <Link to={`/blueprint/${prev.slug}`} className="glass group flex flex-1 items-center gap-3 rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            <div><div className="text-xs text-muted-foreground">Previous</div><div className="font-semibold">{prev.label}</div></div>
          </Link>
        ) : <div className="flex-1" />}
        {next ? (
          <Link to={`/blueprint/${next.slug}`} className="glass group flex flex-1 items-center justify-end gap-3 rounded-2xl p-5 text-right transition-transform hover:-translate-y-0.5">
            <div><div className="text-xs text-muted-foreground">Next</div><div className="font-semibold">{next.label}</div></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ) : <div className="flex-1" />}
      </Section>

      <SiteFooter />
    </div>
  );
}
