import {
  Target, Users, Compass, Boxes, Palette, FileText,
  Megaphone, ListChecks, Calculator, Flag,
} from 'lucide-react';

// Canonical Business Launch Blueprint sections. Each is individually
// addressable at /blueprint/:slug and can trigger a Wyzrdy workflow.
export const BLUEPRINT_SECTIONS = [
  {
    slug: 'offer-definition',
    label: 'Offer definition',
    icon: Target,
    tagline: 'What you sell and why it wins',
    summary: 'Shape a sharp, compelling offer with a clear promise, deliverables, and pricing that the market is ready to pay for.',
    points: [
      'Core promise and transformation',
      'Deliverables, format, and scope',
      'Pricing model and anchor price',
      'Risk reversal and guarantee',
    ],
    workflow: { name: 'Offer definition workflow', type: 'wyzrdy' },
    cta: { label: 'Refine in ForgeSEO', to: '/forgeseo' },
  },
  {
    slug: 'audience-profile',
    label: 'Audience profile',
    icon: Users,
    tagline: 'Exactly who you serve',
    summary: 'Define the ideal customer, their pains, desires, budget, and where they already spend attention.',
    points: [
      'Primary persona and demographics',
      'Pains, desires, and objections',
      'Buying triggers and budget',
      'Channels where they gather',
    ],
    workflow: { name: 'Audience research workflow', type: 'wyzrdy' },
    cta: { label: 'Find customers in Easy Breezy', to: '/easy-breezy' },
  },
  {
    slug: 'market-position',
    label: 'Market position',
    icon: Compass,
    tagline: 'Where you stand vs. everyone else',
    summary: 'Stake out a defensible position with a distinct point of view and a category you can own.',
    points: [
      'Competitive landscape map',
      'Differentiators and moat',
      'Positioning statement',
      'Category and narrative',
    ],
    workflow: { name: 'Positioning workflow', type: 'wyzrdy' },
    cta: { label: 'Scan opportunities in ForgeSEO', to: '/forgeseo' },
  },
  {
    slug: 'business-model',
    label: 'Business model',
    icon: Boxes,
    tagline: 'How the money moves',
    summary: 'Map revenue streams, cost structure, and the engine that turns effort into recurring profit.',
    points: [
      'Revenue streams and mix',
      'Cost structure and margins',
      'Delivery and fulfillment',
      'Growth loops',
    ],
    workflow: { name: 'Business model workflow', type: 'wyzrdy' },
    cta: { label: 'Build the system in Wyzrdy', to: '/' },
  },
  {
    slug: 'brand-direction',
    label: 'Brand direction',
    icon: Palette,
    tagline: 'How it looks and feels',
    summary: 'Set the voice, visual direction, and brand story so every touchpoint feels unmistakably you.',
    points: [
      'Brand voice and tone',
      'Visual direction and palette',
      'Naming and messaging pillars',
      'Story and manifesto',
    ],
    workflow: { name: 'Brand direction workflow', type: 'wyzrdy' },
    cta: { label: 'Continue in Wyzrdy', to: '/' },
  },
  {
    slug: 'landing-page-copy',
    label: 'Landing-page copy',
    icon: FileText,
    tagline: 'Words that convert',
    summary: 'Generate conversion-ready copy — headline, subhead, proof, and calls to action you can publish today.',
    points: [
      'Hero headline and subhead',
      'Benefits and proof blocks',
      'Objection handling',
      'Primary and secondary CTA',
    ],
    workflow: { name: 'Landing page copy workflow', type: 'forgeseo' },
    cta: { label: 'Forge content in ForgeSEO', to: '/forgeseo' },
  },
  {
    slug: 'outreach-campaign',
    label: 'Outreach campaign',
    icon: Megaphone,
    tagline: 'Reach your first buyers',
    summary: 'Design a first campaign — channels, sequences, and messaging — to reach your earliest customers.',
    points: [
      'Channel plan and cadence',
      'Outreach sequences',
      'Message angles and hooks',
      'Follow-up and nurture',
    ],
    workflow: { name: 'Outreach campaign workflow', type: 'wyzrdy' },
    cta: { label: 'Launch in Wyzrdy', to: '/' },
  },
  {
    slug: 'task-plan',
    label: 'Task plan',
    icon: ListChecks,
    tagline: 'The path to launch',
    summary: 'Turn strategy into an ordered task plan with milestones, owners, and dependencies.',
    points: [
      'Milestones and phases',
      'Ordered task backlog',
      'Dependencies and blockers',
      'First 7-day sprint',
    ],
    workflow: { name: 'Task plan workflow', type: 'wyzrdy' },
    cta: { label: 'Track in your dashboard', to: '/dashboard' },
  },
  {
    slug: 'financial-assumptions',
    label: 'Financial assumptions',
    icon: Calculator,
    tagline: 'Grounded numbers',
    summary: 'Model realistic revenue, costs, and break-even so your plan is credible and fundable.',
    points: [
      'Revenue projections',
      'Cost and expense model',
      'Break-even and runway',
      'Key unit economics',
    ],
    workflow: { name: 'Financial model workflow', type: 'wyzrdy' },
    cta: { label: 'Build the system in Wyzrdy', to: '/' },
  },
  {
    slug: 'next-action',
    label: 'Next action',
    icon: Flag,
    tagline: 'Do this now',
    summary: 'The single highest-leverage action to take today to move your launch forward.',
    points: [
      'Highest-leverage next step',
      'Why it matters now',
      'Definition of done',
      'What it unlocks next',
    ],
    workflow: { name: 'Next action workflow', type: 'wyzrdy' },
    cta: { label: 'Open your dashboard', to: '/dashboard' },
  },
];

// Tailored expandable detail for specific deliverables (user-highlighted offer
// definition items get rich, concrete panels). Everything else falls back to a
// structured generator so every deliverable has an info dropdown.
const DELIVERABLE_DETAILS = {
  'Core promise and transformation': {
    overview: 'The single before/after transformation your buyer pays for — stated so plainly a stranger instantly understands the outcome.',
    examples: [
      '“Go from scattered spreadsheets to a live revenue dashboard in 14 days.”',
      '“Book 10 qualified sales calls a month without running ads.”',
    ],
    proof: ['Case study with a named before/after metric', 'A short testimonial tied to the transformation', 'A screenshot or artifact of the end state'],
  },
  'Deliverables, format, and scope': {
    overview: 'Exactly what the buyer receives, in what format, and where scope stops — removing ambiguity that stalls purchases.',
    specifications: ['Deliverable list with quantities', 'Format (call, doc, dashboard, template)', 'Turnaround / delivery timeline', 'Explicit out-of-scope boundaries'],
    timeline: 'Typical: kickoff (day 0), first milestone (day 3-5), delivery (day 10-14).',
  },
  'Pricing model and anchor price': {
    overview: 'The pricing structure and the anchor number that frames value before any discount conversation.',
    tiers: ['Starter — core outcome only', 'Core — outcome + support (anchor)', 'Premium — outcome + done-for-you'],
    justification: 'Price against the cost of the problem (lost revenue, time, risk), not against competitors’ line items.',
  },
  'Risk reversal and guarantee': {
    overview: 'How you remove the buyer’s perceived risk so the decision feels safe.',
    terms: ['Clear guarantee window (e.g. 14 days)', 'Refund conditions in plain language', 'What the buyer must do to qualify'],
    mitigation: 'Pair the guarantee with an onboarding step that ensures the buyer reaches first value quickly.',
  },
};

function fallbackDetail(section, point) {
  return {
    overview: `${point} for the ${section.label.toLowerCase()} of your plan — a concrete, buyer-facing output, not a placeholder.`,
    'what good looks like': [
      `Specific to your offer and audience, not generic`,
      `Directly usable — copy, publish, or execute it`,
      `Measurable so you can tell if it worked`,
    ],
    'how to produce it': [
      `Draft a first version from your idea`,
      `Refine it with the ${section.workflow.type} workflow`,
      `Save it as an asset and iterate`,
    ],
  };
}

export function deliverableDetail(section, point) {
  return DELIVERABLE_DETAILS[point] || fallbackDetail(section, point);
}

const bySlug = Object.fromEntries(BLUEPRINT_SECTIONS.map((s) => [s.slug, s]));
const byLabel = Object.fromEntries(BLUEPRINT_SECTIONS.map((s) => [s.label, s]));

export const getSection = (slug) => bySlug[slug] || null;
export const getSectionByLabel = (label) => byLabel[label] || null;
export const slugForLabel = (label) => byLabel[label]?.slug || null;

export function adjacentSections(slug) {
  const i = BLUEPRINT_SECTIONS.findIndex((s) => s.slug === slug);
  return {
    prev: i > 0 ? BLUEPRINT_SECTIONS[i - 1] : null,
    next: i >= 0 && i < BLUEPRINT_SECTIONS.length - 1 ? BLUEPRINT_SECTIONS[i + 1] : null,
    index: i,
  };
}
