---
name: frontend
description: >
  Frontend craft and anti-slop heuristics for Horizons monorepo-v2 (React + Vite + Tailwind + shadcn/ui).
  Use when creating or substantially changing UI surfaces, styling, typography, motion, or component implementation.
---

# Frontend Guidelines

How to **implement** UI so it feels polished — typography rhythm, color discipline, motion, anti-patterns, and component craft.

> **Guardrails, not a recipe.** These rules prevent AI slop; they do not compose the page. If a rule here is pushing the design toward a predictable SaaS / dashboard / template look, **preserve the user's visual direction** and break the rule thoughtfully. The few non-negotiables are accessibility, contrast, mobile usability, and performance.

## 0. Horizons stack and priority

Applies to **React 18 + Vite + Tailwind v3 + shadcn/ui** in `apps/web`. No Next.js Server Components.

**Conflict resolution (highest wins):**

1. User's explicit request
2. **`apps/web/src/index.css`** — runtime theme tokens (CSS variables consumed by Tailwind/shadcn)
3. This file — craft execution and anti-slop patterns

Define palette, typography, and radius in `index.css` (and `tailwind.config.js`) before using them in JSX/Tailwind. Do not reference token names in class strings unless they are materialized as CSS variables.

**Surface type first.** Before applying any rule here, decide whether the surface is a **website** (marketing, brand, local business, portfolio, editorial — §2a) or an **app** (dashboard, tool, authenticated product — §2b). The two have different shadcn defaults and different taste defaults.

**Visual medium:** Choose photography, illustration, typography, UI/product imagery, pattern, texture, or motion from the prompt's visual thesis. Use **`get_relevant_images`** when real photography strengthens the concept. No Unsplash hotlinks when imagery is appropriate.

---

## 1. Baseline dials

Infer these dials from the prompt, audience, content appetite, and conversion path. **There is no universal default.** Name the intended direction before applying spacing, motion, or layout intensity.

* **DESIGN_VARIANCE:** 1 = symmetric / restrained, 10 = highly asymmetric / expressive
* **MOTION_INTENSITY:** 1 = static / quiet, 10 = cinematic / interaction-led
* **VISUAL_DENSITY:** 1 = airy / sparse, 10 = dense / information-rich

---

## 2. Stack conventions

* **Dependencies:** Check `apps/web/package.json` before importing. Install missing packages in `apps/web`. Do not add GSAP/Three.js unless the user asks.
* **Motion:** Use CSS for simple transitions and `framer-motion` when the motion dial and interaction complexity justify it. Baseline (always): durations < 300ms for interaction feedback and consistent across like actions; ease-out for entering/settling, ease-in(-out) for exits — never linear; one focal motion at a time (don't animate many things at once); honor `prefers-reduced-motion`. For reveals, staggered lists, interaction-led heroes, or any motion-heavy task, read `references/ANIMATION.md` (the 12 principles mapped to UI).
* **Styling:** Define theme values as CSS variables in `index.css` first, then use Tailwind semantic utilities (`bg-background`, `text-foreground`, `bg-primary`, …) backed by `tailwind.config.js`. Avoid hardcoded Tailwind palette names for app chrome.
* **Icons:** `lucide-react` (installed); consistent `strokeWidth`.
* **No emojis** in code, markup, or alt text.

### 2a. Website-first surfaces (marketing, brand, portfolio, local business, editorial)

* **Custom composition first.** Build hero, story, gallery, and CTA sections as semantic HTML + Tailwind, themed from the user's brief. Do not assemble them from `Card` + `Button` shadcn defaults.
* Use shadcn **sparingly** — and only for primitives that earn their accessibility (`Dialog`, `Popover`, `Sheet`, `DropdownMenu`, `Tabs` when truly needed, form primitives, `Toast`).
* Lean on **imagery, typography personality, spacing rhythm, and editorial layout** — the things that make the page feel like *this brand* and not a settings panel.
* Allow more freedom with section silhouettes, oversized type, asymmetric grids, full-bleed photography, and material textures.

### 2b. App-first surfaces (dashboards, authenticated tools, internal apps)

* shadcn primitives are **welcome** here — `Card`, `Button`, `Tabs`, `Sheet`, `DropdownMenu`, `Command`, `Table`, `Form` map naturally to dense, interactive UI.
* Prioritize **clarity, density, keyboard accessibility, scannable tables, and form ergonomics** over editorial atmosphere.
* Still theme away from defaults — no raw shadcn out of the box.

### 2c. shadcn usage policy (applies to both)

* shadcn/ui is **optional**, not the default visual language.
* Use it for **complex accessible primitives**: dialogs, popovers, dropdowns, sheets, selects, command palettes, toasts, tooltips, form controls, and tabs when needed.
* **Never** ship raw shadcn `Card`, `Button`, `Tabs`, `NavigationMenu`, or `Accordion` styling without matching the brief's surface, radius, typography, and spacing — at minimum override the surface color, radius, padding, and font.
* **Smell test:** if a marketing page starts to look like a settings panel or a Vercel dashboard clone, stop assembling shadcn blocks and switch to custom semantic HTML + Tailwind for the affected sections.
* For purely presentational marketing surfaces (hero, story, gallery, manifesto, testimonial wall), use custom composition when visual identity matters — shadcn's strengths are interaction primitives, not brand expression.

---

## 3. Page composition (website-first surfaces)

Skip for app-first surfaces (dashboards, authenticated tools) — they follow product layout, not landing-page rules. Section count, hero type, and section patterns come from the brief, not from a default landing template.

**Section count = content appetite.** Ask what the visitor must feel, understand, trust, and do before converting. A campaign poster may earn 3 sections; a high-trust local business may earn 7; a niche atelier may lead with 2 full-bleed story sections. **Category alone does NOT dictate section count.**

**Name the scroll story in one phrase** before writing JSX — proof-first, story-first, gallery-first, booking-first, manifesto-first, product-first, or a sharper brief-specific story. Order sections from that story, not from `Hero → Features → Testimonials → CTA`. If the order would work unchanged for a different business, pick a sharper one.

**Flow ingredients (combine, split, or omit — none mandatory):** hero / entry point, offer / services, story / concept, proof / trust, gallery / portfolio / product, pricing / logistics / FAQ, contact / booking. A hero can carry trust + CTA; a gallery can also be proof; contact can live in the footer for minimal pages.

**Hero type — name it before JSX.** No default. Choices: campaign poster, full-bleed story image, work-first portfolio, manifesto opening, interactive/motion-led, utility lead-gen (book/call dominant), split copy + media. If the hero would work unchanged for a different brief, pick a sharper one. One clear headline and one primary CTA must be reachable above the fold.

**Section pattern diversity.** No single pattern dominates a 4+ section page. Adjacent sections must differ in at least one major structural dimension: rail width, media role, density, silhouette, or proof format. **Card-grid budget: at most one per landing** unless the page is primarily a catalog / menu / directory. Story, proof, offer-detail, and contact shapes use other patterns — editorial spread, masonry, zig-zag, timeline, quote broadsheet, service menu board, sticky split, before/after theater, metric band, etc.

**Header silhouette** is a choice, not `Logo | Nav | CTA` by default. Pick by navigation strategy: action-first (book/call dominant), browse-first (catalogs / work), brand-first (editorial masthead), immersive-first (overlay-on-hero), tool-first (sidebar + top bar). For local-business briefs, surface the primary contact action prominently — including on mobile.

**Firm layout guardrails:**
- Above-the-fold heroes: `min-h-[100dvh]` (not `h-screen`).
- Asymmetric desktop layouts collapse to single column below `md`; no horizontal scroll on mobile.
- Touch targets ≥ 44px on mobile primary actions.
- Marketing landings ship a footer with business name, key links, contact, and copyright year — visually one step quieter than the body.
- No universal container — rail width per section: narrow editorial ~56rem, standard ~72rem, wide ~90rem. Full-bleed sections constrain only their text overlay, not the section itself.

**Empty vs crowded.** Empty? Enrich existing sections with imagery, proof, specificity, hierarchy — don't add filler sections. Crowded? Merge ingredients, reduce repeated cards, push secondary FAQ / proof lower. User-listed sections are required but not automatically complete; inferred additions must earn their place.

---

## 4. Design engineering (bias correction)

**Typography**

* **Mood dominance:** When a prompt contains both a broad category and an intensity/mood cue, the intensity/mood cue controls the visual thesis. Do not soften a strong modifier into the category's safest mainstream look unless the user asks for that softer interpretation.
* **Typography personality must match user intent:** Choose display and body fonts from the prompt's mood, audience, pace, and content. Do not use a genre-to-font recipe. The selected display/body pairing must be explainable from the brief, and it must not collapse distinctive prompts into neutral defaults.
* **Banned as autopilot for evocative prompts:** Defaulting headline + body to neutral sans stacks when the prompt asks for a distinctive world.
* Wire fonts (`@import` Google Fonts / `@font-face` in CSS) before shipping UI.
* Display sizing, tracking, and line-height must be derived from the brief — not copied from a previous project's class string.
* Body measure (max readable width) and line-height come from the density dial and content type.
* When the brief calls for "quiet body + loud display," implement both — do not squash everything into one family.

**Color**

* Define colors as **CSS variables in `index.css`**, not referenced by ad-hoc names in JSX.
* Do **not** invent Tailwind/CSS token names (e.g. `bg-surface`, `text-muted`, `var(--text)`) unless those variables are defined in `index.css` and exposed by `tailwind.config.js`.
* Fallback: one accent role; avoid default indigo/purple SaaS gradients and neon glows.
* One warm-or-cool gray family per project.

**Materiality**

* Cards only when elevation communicates hierarchy; tint shadows to background hue.
* High density (`VISUAL_DENSITY > 7`): prefer `border-t`, `divide-y`, whitespace over boxing every metric.

**Shape & buttons**

* Corner radius must match the brief — not a habit. Do not default all buttons to pill or square; let mood drive the choice (soft for playful/local, crisp for industrial/editorial, moderate for tools).
* shadcn components inherit radius from Tailwind's `--radius` token — set it in `index.css` with the rest of the theme, or override with explicit `rounded-*` when a surface needs a different feel.
* **Accidental sharpness is a bug:** square corners from missing theme setup are not the same as an intentional crisp thesis.

**Interaction states**

* Implement loading (skeletons), empty, and error states — not happy-path only.
* `:active` tactile feedback: subtle `scale-[0.98]` or `-translate-y-px`.

**Forms**

* Label above input; error below; `gap-2` between label and field.

---

## 5. Creative implementation (proportional to motion)

* **Liquid glass:** inner border + subtle inset shadow when glassmorphism fits the brief.
* **Magnetic / perpetual loops:** only when `MOTION_INTENSITY > 6`; isolate in small components.
* **Stagger:** CSS `animation-delay` first; Framer stagger when motion dial justifies it.

---

## 6. Performance guardrails

* Grain/noise on fixed `pointer-events-none` overlays only — not scrolling containers.
* Animate `transform` and `opacity` only — not `top`/`left`/`width`/`height`.
* Restrain arbitrary `z-index`; reserve for nav, modals, overlays.

---

## 7. Dial reference

### DESIGN_VARIANCE

* **1–3:** Symmetrical grids, centered blocks.
* **4–7:** Overlap, mixed aspect ratios, offset headers.
* **8–10:** Asymmetric grids, large empty zones — **must** collapse to single column on mobile.

### MOTION_INTENSITY

* **1–3:** Hover/active CSS only.
* **4–7:** CSS transitions, load-in delays.
* **8–10:** Framer scroll/reveal — no raw `window` scroll listeners.

### VISUAL_DENSITY

* **1–3:** Large section gaps, gallery pacing.
* **4–7:** Standard app spacing.
* **8–10:** Compact; `font-mono` for numbers; minimal card chrome.

---

## 8. AI tells (forbidden unless requested)

### Visual

* Neon outer glows; pure `#000000`; oversaturated accents; gradient-filled headlines; custom cursors.
* **Unmapped token names** in JSX/Tailwind (e.g. `bg-surface`, `text-muted`, `var(--accent)`) that are not defined in `index.css` — sync to CSS variables first.
* **Unthemed shadcn defaults** — including accidental square corners from missing theme tokens; not the same as an intentional crisp thesis.

### Typography

* Generic font soup; uncontrolled oversized H1s; decorative serifs on dense dashboards without brief justification.
* **Neutral-geometric stacking** (`DM Sans` + `DM Sans`) or Inter-only headings when prompts contain **explicit style subculture cues** (**gothic, alt, noir, ornate, spooky, vamp, witch**, etc.).

### Layout craft

* Generic **3 equal feature cards** in a row — choose a section pattern from the content shape and brief-specific visual thesis.

### Content

* "John Doe", "Acme", "Nexus", "APEX"; clichés ("Elevate", "Seamless", "Unleash"); fake `99.99%` stats.

### Assets

* Broken stock URLs — use **`get_relevant_images`** or intentional neutral placeholders.
* **shadcn/ui never in generic default** — customize to the brief's radii, colors, typography, and padding (see §2c). For marketing surfaces, custom composition should carry visual identity when shadcn primitives do not.

---

## 9. Pre-flight check (craft review)

**Scope:** Tokens on screen — contrast, type execution, imagery sourcing, theme/shadcn customization, motion budget, thesis legibility. Also verify page structure: H1/nav/footer, bleed, grids, section appetite, header silhouette.

Run as a **post-generation review**. The first group are firm; the second are review heuristics — break them when the visual thesis demands it.

### Firm

- [ ] Empty, loading, error states implemented for any interactive surface
- [ ] Contrast and readability preserved for text, labels, placeholders, disabled states
- [ ] **`get_relevant_images`** used where photography is expected
- [ ] Every semantic color/radius utility used in JSX is backed by a CSS variable in `index.css`
- [ ] No raw shadcn defaults (Card/Button/Tabs/NavigationMenu) shipped without theme customization

### Review heuristics

- [ ] **Visible visual direction** — tokens on screen read as **one intended world**, not SaaS veneer?
- [ ] Fonts + display/body sizing, tracking, and line-height driven by the brief's density/mood (**no autopilot stacks** against explicit style cues)
- [ ] **`MOTION_INTENSITY`** dial aligns with the brief — no gratuitous cinematic motion when the surface should feel minimal
- [ ] **§2a–§2c** (website vs app, shadcn policy) honored — primitives only where they earn accessibility; marketing avoids settings-panel stacking
- [ ] **§3** (page composition) honored on website-first surfaces — scroll story named, hero type chosen, adjacent sections differ, card-grid budget respected
- [ ] Any rule threatened to erase the user's world toward a predictable dashboard/SaaS look was **broken on purpose**, with direction preserved
