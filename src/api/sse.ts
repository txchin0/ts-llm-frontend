export interface SseFrame {
  eventName?: string;
  data: string;
}

/**
 * Parse a byte stream of `text/event-stream` into individual SSE frames.
 * Frames are separated by a blank line; `event:` and (possibly multiple)
 * `data:` lines are accumulated per the EventSource spec.
 */
export async function* parseSseFrames(
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
      while ((separatorIndex = findFrameBoundary(buffer)) !== -1) {
        const rawFrame = buffer.slice(0, separatorIndex);
        const boundaryLength = frameBoundaryLength(buffer, separatorIndex);
        buffer = buffer.slice(separatorIndex + boundaryLength);

        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
      }
    }

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
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { eventName, data: dataLines.join('\n') };
}
