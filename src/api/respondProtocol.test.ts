// Verifies the TypeScript spelling of the Respond protocol against the
// cross-language contract in protocol/respond.json. The Kotlin assistant runs
// the same fixtures through its parser (RespondProtocolTest.kt), and
// mock-server.mjs serves them — so a protocol change that skips one side
// fails a test instead of drifting silently.
import { describe, expect, it } from 'vitest';

import { AUTH_PATH_PREFIX } from './auth.ts';
import { RESPOND_PATH } from './client.ts';
import { INTEGRATIONS_PATH } from './integrations.ts';
import { OAUTH_CONNECT_TOKEN_PATH } from './oauth.ts';
import { parseSseFrames } from './sse.ts';
import { TASKS_PATH } from './tasks.ts';
import { isRespondSseEvent, RESPOND_EVENT_TYPES } from './types.ts';
import type { RespondSseEvent } from './types.ts';
import { applyRespondEvent } from '../state/chatStreamReducer.ts';
import type { AssistantMessage } from '../state/types.ts';
import { collectAsync, sseStream } from '../test/helpers.ts';
import contract from '../../protocol/respond.json';

describe('respond protocol contract', () => {
  it('has a canonical sample for exactly the known event types', () => {
    expect(Object.keys(contract.events).sort()).toEqual([...RESPOND_EVENT_TYPES].sort());
  });

  it('accepts every canonical event sample', () => {
    for (const [type, sample] of Object.entries(contract.events)) {
      expect(isRespondSseEvent(sample), `events.${type}`).toBe(true);
    }
  });

  it('pins the endpoint paths', () => {
    expect(contract.endpoints.respond).toBe(RESPOND_PATH);
    expect(contract.endpoints.tasks).toBe(TASKS_PATH);
    expect(contract.endpoints.integrations).toBe(INTEGRATIONS_PATH);
    expect(contract.endpoints.oauthConnectToken).toBe(OAUTH_CONNECT_TOKEN_PATH);
    expect(contract.endpoints.authRegister).toBe(`${AUTH_PATH_PREFIX}/register`);
    expect(contract.endpoints.authLogin).toBe(`${AUTH_PATH_PREFIX}/login`);
    expect(contract.endpoints.authRefresh).toBe(`${AUTH_PATH_PREFIX}/refresh`);
    expect(contract.endpoints.authLogout).toBe(`${AUTH_PATH_PREFIX}/logout`);
  });

  it('parses the canonical wire stream back to the canonical events', async () => {
    const raw = contract.rawStreamLines.join('\n');
    const frames = await collectAsync(parseSseFrames(sseStream([raw])));

    const parsed = frames.map((frame) => JSON.parse(frame.data) as unknown);
    const expected = contract.stream.map(
      (name) => contract.events[name as keyof typeof contract.events],
    );

    expect(parsed).toEqual(expected);
  });

  it('streams the canonical turn through the reducer without loss', () => {
    let message: AssistantMessage = {
      id: 'm1',
      role: 'assistant',
      content: '',
      thinking: '',
      tools: [],
      status: 'streaming',
      createdAt: 0,
    };

    for (const name of contract.stream) {
      const event = contract.events[name as keyof typeof contract.events];
      expect(isRespondSseEvent(event)).toBe(true);
      message = applyRespondEvent(message, event as RespondSseEvent);
    }

    expect(message.content).toBe(contract.events.delta.text);
    expect(message.thinking).toBe(contract.events.thinking_delta.text);
    expect(message.tools).toHaveLength(1);
    expect(message.tools[0].toolName).toBe(contract.events.tool_call.tool_name);
    expect(message.tools[0].status).toBe('done');
    expect(message.status).toBe('complete');
    expect(message.usage).toEqual(contract.events.usage.usage);
  });

  it('carries a request sample the client can send', () => {
    expect(typeof contract.request.message).toBe('string');
    expect(contract.request.message.length).toBeGreaterThan(0);
    expect(typeof contract.request.session_id).toBe('string');
    expect(typeof contract.request.show_thinking).toBe('boolean');
  });

  it('carries the auth refresh exchange the native client re-implements', () => {
    expect(typeof contract.authRefreshRequest.refresh_token).toBe('string');
    expect(typeof contract.authTokensResponse.access_token).toBe('string');
    expect(typeof contract.authTokensResponse.refresh_token).toBe('string');
    expect(contract.authTokensResponse.token_type).toBe('Bearer');
  });
});
