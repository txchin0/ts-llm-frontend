import { authFetch } from './auth.ts';
import { resolveApiUrl } from './config.ts';
import { RESPOND_PATH } from './endpoints.ts';
import { apiErrorFromResponse } from './errors.ts';
import { parseSseFrames } from './sse.ts';
import {
  isRespondSseEvent,
  RESPOND_EVENT_TYPES,
  type RespondRequest,
  type RespondSseEvent,
  type RespondSseEventType,
} from './types.ts';

export { ApiHttpError } from './errors.ts';
export { RESPOND_PATH } from './endpoints.ts';

/**
 * Wire corruption or vocabulary the client cannot accept: unparseable JSON,
 * unknown event types, or known types missing required fields. Mirrors
 * Android's RespondParseResult.Malformed — not an intentional skip.
 */
export interface RespondMalformedEvent {
  type: 'malformed';
  detail: string;
  eventName?: string;
  raw: unknown;
}

export type RespondStreamEvent = RespondSseEvent | RespondMalformedEvent;

export interface RespondStreamOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

const KNOWN_EVENT_TYPES = new Set<string>(RESPOND_EVENT_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Classify a parsed SSE JSON payload into a typed event or a malformed outcome. */
export function classifyRespondPayload(
  parsed: unknown,
  eventName?: string,
): RespondStreamEvent {
  if (isRespondSseEvent(parsed)) {
    return parsed;
  }

  if (isRecord(parsed) && typeof parsed.type === 'string') {
    if (KNOWN_EVENT_TYPES.has(parsed.type)) {
      return {
        type: 'malformed',
        detail: `incomplete ${parsed.type as RespondSseEventType} event`,
        eventName,
        raw: parsed,
      };
    }
    return {
      type: 'malformed',
      detail: `unknown event type: ${parsed.type || '(missing)'}`,
      eventName,
      raw: parsed,
    };
  }

  return {
    type: 'malformed',
    detail: 'not a respond event object',
    eventName,
    raw: parsed,
  };
}

/**
 * POST a respond request and stream typed events back. Aborting the provided
 * signal cancels the underlying connection and ends the generator.
 */
export async function* respondStream(
  request: RespondRequest,
  options: RespondStreamOptions = {},
): AsyncGenerator<RespondStreamEvent> {
  const response = await authFetch(resolveApiUrl(RESPOND_PATH, options.baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }
  if (!response.body) {
    throw new Error('The agent server returned an empty response body.');
  }

  for await (const frame of parseSseFrames(response.body, options.signal)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame.data);
    } catch {
      yield {
        type: 'malformed',
        detail: 'unparseable JSON',
        eventName: frame.eventName,
        raw: frame.data,
      };
      continue;
    }

    yield classifyRespondPayload(parsed, frame.eventName);
  }
}
