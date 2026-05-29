# Design

A warm, calm chat client. One ember of orange carries the personality against
near-neutral surfaces; characterful-but-readable type does the rest. Light and
dark share a single semantic token set, switched by `[data-theme]` on the root.

## Theme

Register: product. Strategy: Restrained (neutral surfaces + a single brand
color used for actions, the streaming pulse, and emphasis), with one Committed
warm moment (the brand ember in the wordmark and primary action).

Default follows `prefers-color-scheme`. Both themes are first-class.

## Color

OKLCH only. The brand hue is anchored at ~47-55 (warm burnt orange, from the
impeccable seed `oklch(0.40 0.103 50)`). Warmth lives in the brand + type, not
the body background, to avoid the "warm-cream-bg" AI attractor.

### Light (`[data-theme='light']`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `oklch(1 0 0)` | App background (pure white) |
| `--surface` | `oklch(0.975 0.004 60)` | Panels, composer, raised areas |
| `--surface-2` | `oklch(0.955 0.005 60)` | Insets, code/thinking blocks |
| `--border` | `oklch(0.90 0.006 60)` | Hairlines, dividers |
| `--border-strong` | `oklch(0.84 0.008 60)` | Emphasized borders |
| `--ink` | `oklch(0.23 0.018 50)` | Body text (>= 7:1 on `--bg`) |
| `--muted` | `oklch(0.50 0.016 50)` | Secondary text (>= 4.5:1) |
| `--primary` | `oklch(0.57 0.155 47)` | Primary action / brand fill |
| `--primary-hover` | `oklch(0.52 0.155 47)` | Primary hover/active |
| `--primary-ink` | `oklch(0.47 0.13 45)` | Brand-as-text / links (>= 4.5:1) |
| `--on-primary` | `oklch(0.99 0.005 60)` | Text on `--primary` fill |
| `--accent` | `oklch(0.55 0.10 220)` | Teal counterpoint: info, session pill |
| `--accent-ink` | `oklch(0.46 0.10 225)` | Accent-as-text |
| `--success` | `oklch(0.52 0.13 150)` | Tool success |
| `--danger` | `oklch(0.55 0.19 25)` | Errors |
| `--warning` | `oklch(0.66 0.13 70)` | Warnings |

### Dark (`[data-theme='dark']`)

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `oklch(0.165 0.006 55)` | Warm charcoal near-black |
| `--surface` | `oklch(0.205 0.008 55)` | Panels, composer |
| `--surface-2` | `oklch(0.235 0.009 55)` | Insets, code/thinking blocks |
| `--border` | `oklch(0.30 0.01 55)` | Hairlines |
| `--border-strong` | `oklch(0.37 0.012 55)` | Emphasized borders |
| `--ink` | `oklch(0.93 0.012 70)` | Body text (warm near-white) |
| `--muted` | `oklch(0.70 0.012 60)` | Secondary text |
| `--primary` | `oklch(0.60 0.16 50)` | Primary action / brand fill |
| `--primary-hover` | `oklch(0.66 0.16 50)` | Primary hover/active |
| `--primary-ink` | `oklch(0.80 0.12 60)` | Brand-as-text / links |
| `--on-primary` | `oklch(0.98 0.008 60)` | Text on `--primary` fill |
| `--accent` | `oklch(0.70 0.10 220)` | Teal counterpoint |
| `--accent-ink` | `oklch(0.80 0.09 220)` | Accent-as-text |
| `--success` | `oklch(0.70 0.13 150)` | Tool success |
| `--danger` | `oklch(0.68 0.17 25)` | Errors |
| `--warning` | `oklch(0.80 0.13 75)` | Warnings |

Text-on-fill rule: the orange `--primary` is a saturated mid-luminance color, so
filled buttons/pills use near-white `--on-primary`, never dark text.

## Typography

Three families, contrast-paired (serif display + grotesque body + mono):

- Display (`--font-display`): `"Fraunces Variable"`, serif. Wordmark and the
  empty-state headline only. Optical sizing on, soft. Not used for UI labels.
- UI / body (`--font-sans`): `"Hanken Grotesk Variable"`, humanist grotesque.
  Carries labels, buttons, body, user messages, assistant prose.
- Mono (`--font-mono`): `"JetBrains Mono Variable"`. Reasoning ("thinking")
  text, tool names/payloads, and code.

Fixed rem scale (no fluid clamp in product UI), ratio ~1.2:

| Token | Size | Use |
| --- | --- | --- |
| `--text-xs` | 0.78rem | Meta, pills, captions |
| `--text-sm` | 0.875rem | Secondary UI, mono blocks |
| `--text-base` | 1rem | Body / messages |
| `--text-lg` | 1.2rem | Section/message emphasis |
| `--text-xl` | 1.45rem | Empty-state subhead |
| `--text-2xl` | 1.85rem | Empty-state headline (display) |

Weights: 400 body, 500 medium (labels/buttons), 600 semibold (headings).
Body measure capped at ~70ch. Headings use `text-wrap: balance`; prose uses
`text-wrap: pretty`.

## Spacing, Radii, Elevation

- Spacing scale (rem): `--space-1` .25, `--space-2` .5, `--space-3` .75,
  `--space-4` 1, `--space-5` 1.5, `--space-6` 2, `--space-8` 3.
- Radii: `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 18px,
  `--radius-pill` 999px.
- Elevation: low-contrast, warm-tinted shadows only on the composer and popovers
  (`--shadow-1`, `--shadow-2`). Cards are avoided; the transcript is open.
- Z-index scale: `--z-base` 0, `--z-sticky` 10, `--z-overlay` 100,
  `--z-modal` 200, `--z-toast` 300.

## Motion

- Durations: `--dur-fast` 120ms, `--dur` 180ms, `--dur-slow` 240ms.
- Easing: `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`. No bounce/elastic.
- Motion conveys state only: message entrance (short fade + 4px rise), the
  streaming caret/ember pulse, thinking-panel expand/collapse, control hovers.
- No orchestrated page-load sequence; the app loads straight into the task.
- `@media (prefers-reduced-motion: reduce)`: replace transforms with opacity
  crossfades or remove transitions; the caret pulse becomes static.

## Components

- App shell: sticky slim header, scrollable transcript (max ~70ch column,
  centered), sticky composer pinned to the bottom with safe-area padding.
- Header: serif wordmark + small session/status pill; icon controls for theme,
  thinking visibility, new chat, and the user-id button.
- Message (user): right-aligned, ember-tinted surface bubble, sans.
- Message (assistant): left-aligned, open (no bubble), markdown prose; a
  collapsible mono "Thinking" panel above the answer; compact tool chips with
  expandable payloads; a streaming ember caret while in progress; inline error
  block on failure.
- Composer: auto-grow textarea, mic toggle (Web Speech), send/stop button that
  swaps by streaming state. Full-width, large touch targets.
- Dialogs: native `<dialog>` for the user-id editor (escapes overflow/stacking).

## States (definition of done)

Every interactive control ships default / hover / focus-visible / active /
disabled. The transcript ships: empty (a warm display-type welcome that teaches
the input), streaming, complete, tool-running, error, aborted, and long-content
(scroll, wrap, no overflow) states.
