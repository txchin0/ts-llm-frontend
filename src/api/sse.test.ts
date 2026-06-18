import { describe, expect, it } from 'vitest';

import { parseSseFrames } from './sse.ts';
import { collectAsync, sseStream } from '../test/helpers.ts';

async function collectFrames(input: string | string[]): Promise<Array<{ eventName?: string; data: string }>> {
  const chunks = Array.isArray(input) ? input : [input];
  return collectAsync(parseSseFrames(sseStream(chunks)));
}

describe('parseSseFrames', () => {
  it('parses LF-delimited frames', async () => {
    const frames = await collectFrames('data: {"type":"delta","text":"hi"}\n\n');

    expect(frames).toEqual([{ data: '{"type":"delta","text":"hi"}' }]);
  });

  it('parses CRLF-delimited frames', async () => {
    const frames = await collectFrames('data: one\r\n\r\n');

    expect(frames).toEqual([{ data: 'one' }]);
  });

  it('joins multi-line data fields', async () => {
    const frames = await collectFrames('data: line1\ndata: line2\n\n');

    expect(frames).toEqual([{ data: 'line1\nline2' }]);
  });

  it('skips SSE comment lines', async () => {
    const frames = await collectFrames(': keep-alive\n\ndata: ok\n\n');

    expect(frames).toEqual([{ data: 'ok' }]);
  });

  it('captures event names', async () => {
    const frames = await collectFrames('event: custom\ndata: payload\n\n');

    expect(frames).toEqual([{ eventName: 'custom', data: 'payload' }]);
  });

  it('skips empty frames', async () => {
    const frames = await collectFrames('\n\ndata: only\n\n');

    expect(frames).toEqual([{ data: 'only' }]);
  });

  it('flushes a trailing frame without a blank line terminator', async () => {
    const frames = await collectFrames('data: trailing');

    expect(frames).toEqual([{ data: 'trailing' }]);
  });

  it('handles chunked delivery across reads', async () => {
    const frames = await collectFrames(['data: hel', 'lo\n\n']);

    expect(frames).toEqual([{ data: 'hello' }]);
  });
});
