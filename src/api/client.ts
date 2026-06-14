import { ApiHttpError } from './errors.ts';
import {
  isRespondSseEvent,
  type RespondRequest,
  type RespondSseEvent,
} from './types.ts';

export { ApiHttpError, RespondHttpError } from './errors.ts';

/**
 * Default origin for the agent server. Empty string means "same origin", which
 * is what the Vite dev proxy and the production reverse proxy both provide.
 * Override with VITE_TS_LLM_TARGET only matters at the proxy layer, not here.
 */
const DEFAULT_BASE_URL = '';
const RESPOND_PATH = '/v1/respond';

/**
 * An event the server sent that the frontend does not (yet) understand, such as
 * a future audio/TTS frame. Surfaced rather than dropped so new server features
 * can be wired in without changing the transport.
 */
export interface RespondUnknownEvent {
  type: 'unknown';
  /** The SSE `event:` name, if present. */
  eventName?: string;
  /** The parsed JSON payload (or the raw string if it was not JSON). */
  raw: unknown;
}

export type RespondStreamEvent = RespondSseEvent | RespondUnknownEvent;

export interface RespondStreamOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

interface SseFrame {
  eventName?: string;
  data: string;
}

/**
 * Parse a byte stream of `text/event-stream` into individual SSE frames.
 * Frames are separated by a blank line; `event:` and (possibly multiple)
 * `data:` lines are accumulated per the EventSource spec.
 */
async function* parseSseFrames(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      // Frames end with a blank line: \n\n or \r\n\r\n.
      while ((separatorIndex = findFrameBoundary(buffer)) !== -1) {
        const rawFrame = buffer.slice(0, separatorIndex);
        const boundaryLength = frameBoundaryLength(buffer, separatorIndex);
        buffer = buffer.slice(separatorIndex + boundaryLength);

        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
      }
    }

    // Flush any trailing frame that did not end with a blank line.
    const trailing = parseFrame(buffer);
    if (trailing) yield trailing;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function findFrameBoundary(buffer: string): number {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function frameBoundaryLength(buffer: string, index: number): number {
  return buffer.startsWith('\r\n\r\n', index) ? 4 : 2;
}

function parseFrame(rawFrame: string): SseFrame | null {
  const trimmed = rawFrame.replace(/^\s+|\s+$/g, '');
  if (trimmed.length === 0) return null;

  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of rawFrame.split(/\r?\n/)) {
    if (line.startsWith(':')) continue; // SSE comment / keep-alive
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { eventName, data: dataLines.join('\n') };
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
