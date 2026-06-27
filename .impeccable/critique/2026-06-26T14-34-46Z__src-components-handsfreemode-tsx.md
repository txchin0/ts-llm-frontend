---
target: hands free mode
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-26T14-34-46Z
slug: src-components-handsfreemode-tsx
---
# Critique: Hands-free mode

**Target:** `src/components/HandsFreeMode.tsx` (+ `MicButton`, `useHandsFree`, Composer entry)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 2.5s silence auto-send has no visible countdown; thinking/tools invisible |
| 2 | Match System / Real World | 3 | Bottom sheet + large mic is familiar; dual mic icons need disambiguation |
| 3 | User Control and Freedom | 3 | Esc, swipe-down, tap-to-send/stop work; no undo after auto-send |
| 4 | Consistency and Standards | 2 | Assistant view strips thinking/tools vs main transcript |
| 5 | Error Prevention | 2 | Pause in speech can trigger unintended auto-send |
| 6 | Recognition Rather Than Recall | 2 | Hands-free entry is icon-only beside regular mic |
| 7 | Flexibility and Efficiency | 3 | Thumb-zone mic + auto-send are efficient once learned |
| 8 | Aesthetic and Minimalist Design | 3 | Focused layout; redundant status line under mic |
| 9 | Error Recovery | 3 | Assistant errors surface; unsupported-browser copy is clear |
| 10 | Help and Documentation | 2 | Empty-state hint only; auto-send behavior never taught |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** Does not read as AI slop. The sheet uses existing OKLCH tokens, a native `<dialog>`, and state-driven mic colors that match the composer. No gradient text, card grids, eyebrows, or decorative glass. It feels like a deliberate product mode, not a pasted template.

**Deterministic scan:** Clean. `detect.mjs` returned zero findings on `HandsFreeMode.tsx` and `MicButton.tsx`.

**Visual overlays:** Browser automation MCP was unavailable in this session, so no live overlay injection. Assessment is from source review and detector CLI only.

## Overall Impression

Hands-free mode is a solid mobile-first shell: full-height sheet, bottom mic dock, swipe dismiss, and reduced-motion fallbacks all align with the product brief. The biggest gap is informational honesty: the mode hides thinking and tool activity that the main transcript shows, and the silence auto-send is invisible until it fires. Fix those and this becomes a mode users trust on the couch, not just one they can open.

## What's Working

1. **Thumb-first mic dock** — Large circular mic (`clamp(5.25rem, 22vw, 7rem)`), safe-area padding, and bottom gradient keep the primary action in Casey's reach zone without competing with the response.
2. **State vocabulary matches the composer** — Ember primary when idle, danger red while listening, neutral stop while streaming mirrors composer mic/send patterns. Users who already voice-dictate in the bar learn hands-free quickly.
3. **Escape hatches are real** — Native dialog with `onCancel`, swipe-to-dismiss with grabber, and explicit dismiss button. Closing aborts listening and clears transcript (`useHandsFree.close`).

## Priority Issues

### [P1] Thinking and tool activity are stripped from the hands-free view
- **Why it matters:** PRODUCT.md principle 2 is "Show the work honestly." `HandsFreeMode` renders only `latest.content` via `Markdown`. The main `Message` component also shows `ThinkingPanel`, `ToolChip`, speaker label, and richer error details. A couch user watching the agent work sees a blank or incomplete picture during tool runs and reasoning.
- **Fix:** Mirror the assistant body from `Message.tsx` (respecting `showThinking` from settings) or embed a compact "working" strip (thinking summary + active tool chips) above the prose in the response region.
- **Suggested command:** `/impeccable polish`

### [P1] Silence auto-send is invisible
- **Why it matters:** After 2.5s of silence (`HANDS_FREE_SILENCE_MS`), the message sends with zero UI feedback. Users who pause mid-thought will be surprised; screen readers get no announcement before send. This is a visibility-of-status failure at the core interaction.
- **Fix:** Show a subtle countdown or "Sending when you pause…" state while the timer is armed; optionally `aria-live` announce when send is imminent. Consider a first-run tooltip or one-line hint under the mic.
- **Suggested command:** `/impeccable clarify`

### [P2] Hands-free entry is icon-only and ambiguous next to the mic
- **Why it matters:** Composer shows `HandsFreeIcon` (radiating waves) beside the standard `MicIcon` with no visible label. Jordan cannot tell "dictate into textarea" from "enter full-screen voice mode" without trial and error.
- **Fix:** Add a visible label on wide viewports (match `IconButton` `showLabel` pattern), or a composer hint on first use. Consider moving hands-free to a more distinct affordance (text button "Voice mode" on mobile).
- **Suggested command:** `/impeccable onboard`

### [P2] User's spoken question never appears in the conversation
- **Why it matters:** Only the latest assistant reply fills the response region. After auto-send, the user cannot see what they asked without exiting to the transcript behind the sheet. Working-memory load increases on interrupt-prone mobile use.
- **Fix:** Append the sent user utterance as a compact user line above the assistant prose (or scroll the sheet to show the last exchange pair).
- **Suggested command:** `/impeccable layout`

### [P2] Full viewport takeover on desktop
- **Why it matters:** The sheet is always `100dvh` with no breakpoint behavior. Alex at a keyboard gets a mobile pattern that hides the full transcript and header unnecessarily.
- **Fix:** On `min-width` ~720px, use a anchored panel or side column instead of full-screen, or keep transcript partially visible.
- **Suggested command:** `/impeccable adapt`

## Persona Red Flags

**Casey (Distracted mobile user):** Mic placement is good, but the hands-free launcher sits in the composer icon row (mid-screen on many phones), not the thumb zone. Auto-send after a pause while interrupted will fire a half-formed question with no warning.

**Sam (Accessibility-dependent user):** Global `:focus-visible` covers controls, but opening hands-free has no `aria-live` announcement. `statusHint` is `aria-hidden` while duplicating button labels visually (acceptable for SR, odd for sighted redundancy). Listening pulse is visual-only; consider `role="status"` on transcript updates.

**Alex (Power user):** No keyboard shortcut to enter hands-free. Esc exits (dialog default), which is good, but there is no documented accelerator. Two mic controls in the composer require memorization.

**Thomas (project persona — technical owner, couch + desk):** Enters hands-free to watch the agent work, but thinking panels and tool chips vanish. The mode optimized for speaking, not for following agent work, which contradicts why this user would use hands-free while away from the keyboard.

## Minor Observations

- `statusHint` duplicates `MicButton`'s visually hidden label for sighted users; collapse to one source of truth.
- `MicButton.module.css` has no explicit `:focus-visible` beyond global styles; circular button outline may clip awkwardly at 50% border-radius.
- Swipe dismiss binds to the entire panel, so scrolling the response near the top can accidentally initiate drag if touch starts high.
- Streaming stop state uses neutral `surface-2` styling; less visually urgent than listening red, which may slow "stop generation" recognition.

## Questions to Consider

- Should hands-free be mobile-only, with the composer mic sufficient on desktop?
- Is auto-send the right default, or should first tap start listening and second tap send (with auto-send as a setting)?
- What is the minimum honest view of agent work: thinking text, tool chips, or a single "Working…" line?
