# Motion & Animation Craft

Deep reference for motion work. Extends §2 (Motion), §5 (Creative
implementation), §6 (Performance), and the `MOTION_INTENSITY` dial in
`design/SKILL.md` — read this when a task is motion-heavy (reveals,
transitions, micro-interactions, interaction-led heroes). For light
hover/active polish, the SKILL baseline is enough.

Stack: React 18 + Tailwind v3 + `framer-motion` (only when the motion dial
and interaction complexity justify it — otherwise CSS transitions). Animate
`transform` and `opacity` only. Always gate non-essential motion behind
`@media (prefers-reduced-motion: reduce)`.

> **The sweet spot is just enough motion, of the right kind, at the right
> moment.** The two failure modes are sterile (no life) and flashy
> (distracting). Aim between them; let `MOTION_INTENSITY` set the volume.

The 12 classical principles, mapped to web UI:

1. **Squash & stretch** — deform to convey weight/responsiveness (a button
   dipping on press, a sheet settling). Moderation only; overdone reads
   cartoonish. Usually a 2–4% `scale` on `:active`, not literal squashing.
2. **Anticipation** — a small pre-cue before a change (an icon wiggling
   before a count updates, a control nudging before it opens). Reserve for
   moments where the hint genuinely helps; keep it quick. Don't anticipate
   every minor interaction.
3. **Staging** — direct attention; never animate many things at the exact
   same time or the eye has nowhere to land. Sequence: backdrop fades →
   panel slides → primary control highlights. **One focal motion at a time.**
4. **Pose to pose** — define keyframes and let CSS/`framer-motion`
   interpolate; don't hand-tune every frame. Match frequency: animate the
   parts users hit constantly (menus, tooltips) less, not more.
5. **Follow-through & overlapping action** — staggered start/stop so motion
   cascades naturally (list items entering with small relative delays).
   CSS `animation-delay` first; `framer-motion` `staggerChildren` when the
   dial justifies it. Keep per-item delay small (~30–60ms) so the group
   never feels sluggish.
6. **Slow in & slow out (easing)** — natural motion accelerates and
   decelerates; never linear for UI. **ease-out** for elements settling in /
   snappy feedback (the common case); **ease-in / ease-in-out** for elements
   leaving or large traversals. Pick curves deliberately (see easing.dev).
7. **Arcs** — curved paths read more organic than straight lines, but arcs
   are hard to justify in dense UI. Save them for bringing content forward
   on expressive/landing surfaces, not for routine state changes.
8. **Secondary action** — a supporting flourish that reinforces the primary
   one without competing (a checkmark that ticks after submit). Adds delight
   and clarity at feedback moments; must stay subordinate to the main action.
9. **Timing (durations)** — speed decides snappy vs. sluggish. **Keep most
   interactions under 300ms**; ~150ms feels right for tooltips/toggles, 200–
   300ms for panels/page transitions. Be consistent: the same kind of action
   gets the same duration across the product.
10. **Exaggeration** — amplify beyond realism to make the user *feel* or
    *notice* something (an error field shaking, a celebratory pop). Sparingly,
    at high-signal moments: onboarding, empty states, confirmations, errors.
11. **Solid drawing** — keep depth believable: consistent layering, shadows
    tinted to background hue (see SKILL §4 Materiality), and credible
    `perspective` on any 3D rotation — never snap flat mid-transform.
12. **Appeal** — the sum. The best UI motion is nearly invisible; users feel
    smoothness without noticing it. Cohesion and restraint across all of the
    above is what makes a product feel delightful to return to.

## Quick checklist for motion-heavy work

- [ ] Durations < 300ms for interaction feedback; consistent across like actions
- [ ] ease-out for entering/settling, ease-in(-out) for exits/large moves — never linear
- [ ] `transform`/`opacity` only; no animating layout properties
- [ ] One focal motion at a time (staging); groups stagger with small delays
- [ ] `prefers-reduced-motion` honored for all non-essential motion
- [ ] Exaggeration/anticipation reserved for high-signal moments, not routine UI
- [ ] Motion volume matches `MOTION_INTENSITY` — no cinematic reveals on a quiet surface
