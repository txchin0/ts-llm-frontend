import { ApiHttpError } from './errors.ts';
import { parseSseFrames } from './sse.ts';
import {
  isRespondSseEvent,
  type RespondRequest,
  type RespondSseEvent,
} from './types.ts';

export { ApiHttpError, RespondHttpError } from './errors.ts';

const DEFAULT_BASE_URL = '';
const RESPOND_PATH = '/v1/respond';

export interface RespondUnknownEvent {
  type: 'unknown';
  eventName?: string;
  raw: unknown;
}

export type RespondStreamEvent = RespondSseEvent | RespondUnknownEvent;

export interface RespondStreamOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

/**
 * POST a respond request and stream typed events back. Aborting the provided
 * signal cancels the underlying connection and ends the generator.
 */
export async function* respondStream(
  request: RespondRequest,
  options: RespondStreamOptions = {},
): AsyncGenerator<RespondStreamEvent> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}${RESPOND_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new ApiHttpError(response.status, response.statusText);
  }
  if (!response.body) {
    throw new Error('The agent server returned an empty response body.');
  }

  for await (const frame of parseSseFrames(response.body, options.signal)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame.data);
    } catch {
      yield { type: 'unknown', eventName: frame.eventName, raw: frame.data };
      continue;
    }

    if (isRespondSseEvent(parsed)) {
      yield parsed;
    } else {
      yield { type: 'unknown', eventName: frame.eventName, raw: parsed };
    }
  }
}
