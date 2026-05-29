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
  user_id: string;
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

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set<RespondSseEventType>([
  'start',
  'delta',
  'thinking_delta',
  'final',
  'usage',
  'tool_call',
  'tool_result',
  'error',
]);

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
