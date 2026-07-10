// Mirrors the Respond SSE wire contract in protocol/respond.json. Kept as plain
// TypeScript so the frontend has no runtime schema dependency; the SSE client
// does structural validation via isRespondSseEvent.

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isProviderUsage(value: unknown): value is ProviderUsage {
  return (
    isRecord(value) &&
    isNumber(value.input_tokens) &&
    isNumber(value.output_tokens) &&
    isNumber(value.total_tokens)
  );
}

/**
 * Narrow an arbitrary parsed JSON value to a known SSE event. Unknown event
 * types (e.g. a future `audio` event) are rejected so the client can surface
 * them separately; known types also require their documented fields.
 */
export function isRespondSseEvent(value: unknown): value is RespondSseEvent {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  const type = value.type as RespondSseEventType;
  if (!(type in EVENT_TYPE_EXHAUSTIVE)) {
    return false;
  }

  switch (type) {
    case 'start':
      return (
        isString(value.request_id) &&
        isString(value.user_id) &&
        isString(value.session_id) &&
        isString(value.started_at)
      );
    case 'delta':
    case 'thinking_delta':
      return isString(value.text);
    case 'final':
      return (
        isString(value.request_id) &&
        isString(value.finish_reason) &&
        isString(value.completed_at)
      );
    case 'usage':
      return isString(value.request_id) && isProviderUsage(value.usage);
    case 'tool_call':
      return (
        isString(value.request_id) &&
        isString(value.session_id) &&
        isNumber(value.step) &&
        isString(value.tool_call_id) &&
        isString(value.tool_name) &&
        'input' in value
      );
    case 'tool_result':
      return (
        isString(value.request_id) &&
        isString(value.session_id) &&
        isNumber(value.step) &&
        isString(value.tool_call_id) &&
        isString(value.tool_name) &&
        'output' in value &&
        typeof value.is_error === 'boolean'
      );
    case 'error':
      return isString(value.request_id) && isString(value.code) && isString(value.message);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
