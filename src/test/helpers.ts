/** Build a ReadableStream of UTF-8 chunks for SSE parser tests. */
export function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

export function createSseResponse(
  frames: string,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  const statusText = init.statusText ?? (ok ? 'OK' : 'Internal Server Error');

  return {
    ok,
    status,
    statusText,
    body: ok ? sseStream([frames]) : null,
  } as Response;
}

/** Drain an async generator into an array. */
export async function collectAsync<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}
