# Ember

A chat client for a personal ts-llm agent server. One web app (browser PWA and
Capacitor Android build) plus a fully native Android assistant overlay, all
speaking the same server protocol. Conversations are never stored client-side.

## Language

### Conversation

**Turn**:
One user message and the streamed response it produces, delivered as a Respond
stream.

**Session**:
The server-side conversation scope a turn belongs to; issued by the server on
the first turn and kept only in memory until its TTL.
_Avoid_: conversation history, chat log

**Composer draft**:
The text being written (typed or dictated) but not yet sent.
_Avoid_: input value

**Conversation input**:
Everything between the user's keyboard/voice and sending a turn: the composer
draft, dictation, and hands-free coordination.

**Dictation**:
Speech-to-text that appends into the composer draft. Never auto-sends.
_Avoid_: voice input (ambiguous with hands-free)

**Hands-free**:
The overlay mode where dictation auto-sends after a silence window and the
reply is followed without touching the screen.

**Thinking**:
The model's reasoning text, streamed separately from the answer and rendered
as its own collapsible panel.
_Avoid_: reasoning trace, chain of thought

**Tool activity**:
A tool call and its eventual result, rendered as a chip in the transcript.

### Protocol

**Agent server**:
The user's own ts-llm backend; the only server Ember talks to.
_Avoid_: API, backend (unqualified)

**Respond stream**:
The SSE event sequence (`start` … `final`/`error`) answering one turn.

**Protocol contract**:
The canonical fixtures in `protocol/` that every spelling of the wire protocol
and the native handshake is verified against — the TypeScript client, the
Kotlin assistant, and the mock server are adapters of it.

**Native handshake**:
The storage names and server-URL normalization rules the web app and the
native assistant must agree on to share settings and the token pair.

**Settings mirror**:
The write-through copy of the settings the assistant needs, flowing web →
native only.

**Token pair**:
The access + refresh bearer tokens scoping everything to the signed-in
account; flows both ways across the handshake because either side may rotate
it.

### Native

**Assistant overlay**:
The fully native Android voice UI summoned by the system assistant gesture;
runs without the WebView and speaks the protocol directly.
_Avoid_: widget, assistant app
