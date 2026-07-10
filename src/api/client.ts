import { authFetch } from './auth.ts';
import { resolveApiUrl } from './config.ts';
import { apiErrorFromResponse } from './errors.ts';
import { parseSseFrames } from './sse.ts';
import {
  isRespondSseEvent,
  type RespondRequest,
  type RespondSseEvent,
} from './types.ts';

export { ApiHttpError } from './errors.ts';

export const RESPOND_PATH = '/v1/respond';

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
