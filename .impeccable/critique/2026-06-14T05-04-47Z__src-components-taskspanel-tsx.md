---
target: floating task bar
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-06-14T05-04-47Z
slug: src-components-taskspanel-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Status dots, badge count, and polling footer communicate queue state well |
| 2 | Match System / Real World | 3 | "Background tasks" and plain status labels read naturally |
| 3 | User Control and Freedom | 3 | Toggle + Escape to collapse; retry on fetch error |
| 4 | Consistency and Standards | 2 | Fixed overlay stacks above sticky header chrome instead of respecting it |
| 5 | Error Prevention | 3 | Error state with retry; no destructive actions |
| 6 | Recognition Rather Than Recall | 3 | Labeled chip with icon; expanded panel repeats the title |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcut to open tasks; chip sits far from power-user reach |
| 8 | Aesthetic and Minimalist Design | 2 | Overlap with header reads as a positioning bug, not intentional chrome |
| 9 | Error Recovery | 3 | Inline alert + "Try again" |
| 10 | Help and Documentation | 2 | Footer explains polling; no help for what "queued" work means in practice |
| **Total** | | **26/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: This does not read as generic AI slop. The chip uses existing tokens, ember accent on the icon, and teal badge count. It fits Ember's warm tool aesthetic. What breaks trust is spatial: the bar looks accidentally placed, overlapping the header and sitting mid-column instead of anchored to the viewport edge. That reads as implementation drift, not design intent.

**Deterministic scan**: CLI `detect.mjs` on `TasksPanel.tsx` / `TasksPanel.module.css` returned **0 findings**. No gradient text, side stripes, or cream-bg violations.

**Visual overlays**: `detect.js` injected successfully on the live dev page (`localhost:5174`), but produced **0 overlay markers** (SPA context; no DOM-level anti-pattern hits). Browser measurement confirmed the layout bugs below.

## Overall Impression

The tasks feature is thoughtfully built (skeleton loading, relative times, accessible toggle, reduced-motion fallbacks). The floating desktop treatment undermines it: on a 1920px viewport the chip starts **17px inside the header band** and sits **608px from the right edge**, aligned to the chat column rather than the screen. Your instinct is correct; this is a layout bug, not a polish nit.

## What's Working

1. **Chip affordance**: Icon + "Tasks" label + optional badge + chevron is scannable. `aria-expanded`, `aria-controls`, and descriptive `aria-label` are solid.
2. **Panel content**: Skeleton rows, empty copy, status dots with running pulse, and error retry follow product-state conventions from DESIGN.md.
3. **Mobile-first fallback**: Below 640px the panel stays in document flow above the composer, which keeps it thumb-reachable instead of fighting the header.

## Priority Issues

### [P1] Header overlap on desktop
- **Why it matters**: The chip covers the bottom ~17px of the sticky header and paints at `z-index: 100` while the header is `10`. Header controls (Thinking, theme, user) compete with a floating element in the same visual band. Users may mis-click or perceive the app as broken.
- **Fix**: Position below the header, not through it. Replace the hard-coded `3.25rem` top offset with a measured header height (CSS variable set on the header, or `top: calc(env(safe-area-inset-top) + var(--header-height) + var(--space-2))`). Consider lowering z-index to sit just above transcript content but **below or equal to** header sticky layer unless the expanded sheet must cover the page.
- **Suggested command**: `/impeccable layout`

### [P1] Not anchored far enough right
- **Why it matters**: `right: max(var(--space-4), calc((100vw - var(--measure)) / 2 + var(--space-4)))` pins the chip to the **chat column's right edge**. On wide screens it floats in the upper-middle-right (measured: 608px inset on 1920px), not the corner where floating utilities usually live. It visually collides with header controls instead of occupying dead margin space.
- **Fix**: Anchor to the viewport: `right: max(var(--space-4), env(safe-area-inset-right))` (optionally cap width). If column alignment is desired when expanded, keep the sheet aligned but let the collapsed chip hug the viewport edge.
- **Suggested command**: `/impeccable layout`

### [P2] Display font in panel title
- **Why it matters**: `.title` uses `--font-display` (Fraunces). Product register reserves display type for wordmark/empty state; panel headings should use `--font-sans` for consistency with the rest of the tool UI.
- **Fix**: Switch `.title` to sans at `--text-lg` / weight 600.
- **Suggested command**: `/impeccable typeset`

### [P2] Stacking context complexity
- **Why it matters**: `TasksPanel` lives inside `.main` (`z-index: 10`, `overflow: hidden`) while using `position: fixed`. Fixed positioning escapes overflow but inherits stacking quirks. Rendering the panel as a sibling of `Header` (portal or shell slot) would simplify layering and make header clearance explicit.
- **Fix**: Move floating tasks chrome to app shell level or use a portal; reserve header-adjacent airspace in one place.
- **Suggested command**: `/impeccable layout` or `/impeccable distill`

### [P3] Expanded sheet competes with transcript focus
- **Why it matters**: When open, the sheet drops above the chip in the same corner. Acceptable for a utility drawer, but combined with wrong top/right anchoring it feels like a second header.
- **Fix**: After fixing anchor, consider max-width ~18rem for the collapsed chip and align expanded sheet flush to viewport corner.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Alex (Power User)**: On desktop the Tasks chip sits over the header control row at z-index 100. Click targets for Thinking/theme/user share vertical space with the chip. No keyboard accelerator to toggle tasks.

**Casey (Mobile / thumb)**: Mobile inline placement is good. On tablet widths just above 640px the layout switches to fixed overlap without additional breakpoint tuning.

**Thomas (ts-llm owner, multitasking)**: Wants glanceable queue status while chatting. Overlap makes the utility feel bolted on; mid-column placement wastes the wide margin where a status pill could sit quietly.

## Minor Observations

- `--measure`-aligned `right` math is clever for column rhythm but wrong affordance for a floating utility.
- Full `22rem` chip width on desktop is wider than needed for "Tasks" + badge; a compact pill would reduce header collision risk even after offset fix.
- `App.module.css` gives `.main` the same z-index as the header; worth auditing when fixing overlay stacking.

## Questions to Consider

- Should the collapsed chip live in the header row (inline with controls) instead of floating, with only the expanded sheet as an overlay?
- On wide screens, is the goal column-aligned utilities or viewport-corner utilities?
- When tasks are empty, should the chip hide entirely to honor "quiet until needed"?
