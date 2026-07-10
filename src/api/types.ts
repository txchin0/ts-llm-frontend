// Mirrors the wire contract exported by the ts-llm server in
// src/contracts/respond.ts. Kept as plain TypeScript so the frontend has no
// runtime schema dependency; the SSE client does light structural validation.

export type ProviderFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'unknown';

export interface ProviderUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface RespondRequest {
  /** Omitted on the first turn; the server issues one in the `start` event. */
  session_id?: string;
  message: string;
  /** Opt in to reasoning `thinking_delta` events. */
  show_thinking?: boolean;
}

export interface RespondStartEvent {
  type: 'start';
  request_id: string;
  user_id: string;
  session_id: string;
  started_at: string;
}

export interface RespondDeltaEvent {
  type: 'delta';
  text: string;
}

export interface RespondThinkingDeltaEvent {
  type: 'thinking_delta';
  text: string;
}

export interface RespondFinalEvent {
  type: 'final';
  request_id: string;
  finish_reason: ProviderFinishReason;
  completed_at: string;
}

export interface RespondUsageEvent {
  type: 'usage';
  request_id: string;
  usage: ProviderUsage;
}

export interface RespondToolCallEvent {
  type: 'tool_call';
  request_id: string;
  session_id: string;
  step: number;
  tool_call_id: string;
  tool_name: string;
  input: unknown;
}

export interface RespondToolResultEvent {
  type: 'tool_result';
  request_id: string;
  session_id: string;
  step: number;
  tool_call_id: string;
  tool_name: string;
  output: unknown;
  is_error: boolean;
  error_code?: string;
  error_message?: string;
}

export interface RespondErrorEvent {
  type: 'error';
  request_id: string;
  code: string;
  message: string;
}

export type RespondSseEvent =
  | RespondStartEvent
  | RespondDeltaEvent
  | RespondThinkingDeltaEvent
  | RespondFinalEvent
  | RespondUsageEvent
  | RespondToolCallEvent
  | RespondToolResultEvent
  | RespondErrorEvent;

export type RespondSseEventType = RespondSseEvent['type'];

// Mapped-object form so the compiler enforces exhaustiveness in both
// directions: extending the union or removing a member breaks this line
// until the list (and, via respondProtocol.test.ts, the protocol contract
// in protocol/respond.json) is updated to match.
const EVENT_TYPE_EXHAUSTIVE: { [K in RespondSseEventType]: true } = {
  start: true,
  delta: true,
  thinking_delta: true,
  final: true,
  usage: true,
  tool_call: true,
  tool_result: true,
  error: true,
};

export const RESPOND_EVENT_TYPES = Object.keys(
  EVENT_TYPE_EXHAUSTIVE,
) as readonly RespondSseEventType[];

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set(RESPOND_EVENT_TYPES);

/**
 * Narrow an arbitrary parsed JSON value to a known SSE event. Unknown event
 * types (e.g. a future `audio` event) are intentionally rejected here so the
 * client can surface them separately rather than mis-handling them.
 */
export function isRespondSseEvent(value: unknown): value is RespondSseEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && KNOWN_EVENT_TYPES.has(type);
}
