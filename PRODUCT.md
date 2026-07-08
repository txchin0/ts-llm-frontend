# Product

## Register

product

## Users

A single technical owner running their own ts-llm agent server, using this web app as the primary way to talk to that agent. They move between a desktop (at a keyboard, often multitasking) and a phone (one-handed, on the couch or away from the desk). They already trust the agent; they want a fast, legible way to ask it things, watch it think and act, and occasionally dictate instead of type. The job: send a request, follow the response (including reasoning and tool use) as it streams, and move on, without ceremony and without a history they have to manage.

## Product Purpose

A focused chat client for the ts-llm `POST /v1/respond` SSE API. It exists to make a personal agent feel immediate and present on any device: stream normal output and reasoning distinctly, surface tool activity, scope everything to the signed-in account (`user_id` + password, with access/refresh tokens), and offer hands-free voice input. It deliberately keeps no conversation history; each session lives only in memory and in the server for its TTL. Success is the interface disappearing into the exchange: the user reads, talks, and acts without fighting chrome, waiting on choreography, or worrying about stored data.

## Brand Personality

Warm, characterful, calm-competent. The voice is plain and direct, never corporate or hype. It should feel like a well-made desk tool with a bit of soul: confident typography, a single warm ember of color, generous quiet around the conversation. Three words: warm, deliberate, unfussy.

## Anti-references

- Not a generic ChatGPT / Claude clone (no anonymous gray bubbles, no default system-font sameness).
- Not purple-gradient-on-white AI slop.
- Not heavy corporate SaaS: no hero metrics, no oversized feature cards, no stock illustration.
- Not cluttered: no dense toolbars, no chrome competing with the conversation.

## Design Principles

1. The conversation is the product. Everything else is quiet until needed.
2. Show the work honestly. Normal output, reasoning, and tool calls each read as what they are, never blurred together.
3. Warmth in the brand, not the surface. One ember accent and the type carry the personality; backgrounds stay calm and neutral.
4. Equally good with thumb or keyboard. Touch targets, safe areas, and reachable controls are first-class, not an afterthought.
5. Forget by default. No stored conversations; trust is earned by keeping nothing.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: body text >= 4.5:1, large/bold text and UI affordances >= 3:1, visible focus on every interactive element.
- Full keyboard operability; never hover-only functionality.
- Honor `prefers-reduced-motion` with crossfade/instant fallbacks for every animation.
- Honor `prefers-color-scheme` for the default theme; both light and dark are fully supported.
- Voice input is an enhancement, with a clear non-voice path when the Web Speech API is unavailable.
