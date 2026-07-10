// Verifies the TypeScript spelling of the Respond protocol against
// protocol/respond.json and protocol/endpoints.json. The Kotlin assistant runs
// the same fixtures (RespondProtocolTest.kt); mock-server.mjs serves them.
import { describe, expect, it } from 'vitest';

import {
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_PATH_PREFIX,
  AUTH_REFRESH_PATH,
  AUTH_REGISTER_PATH,
  INTEGRATIONS_PATH,
  OAUTH_CONNECT_TOKEN_PATH,
  OAUTH_DISCONNECT_PATH,
  OAUTH_PROVIDER_SAMPLE,
  OAUTH_START_PATH,
  OAUTH_STATUS_PATH,
  RESPOND_PATH,
  TASKS_PATH,
} from './endpoints.ts';
import { parseSseFrames } from './sse.ts';
import { isRespondSseEvent, RESPOND_EVENT_TYPES } from './types.ts';
import type { RespondSseEvent } from './types.ts';
import { applyRespondEvent } from '../state/chatStreamReducer.ts';
import type { AssistantMessage } from '../state/types.ts';
import { collectAsync, sseStream } from '../test/helpers.ts';
import endpoints from '../../protocol/endpoints.json';
import contract from '../../protocol/respond.json';

describe('respond protocol contract', () => {
  it('has a canonical sample for exactly the known event types', () => {
    expect(Object.keys(contract.events).sort()).toEqual([...RESPOND_EVENT_TYPES].sort());
  });

  it('accepts every canonical event sample with required fields', () => {
    for (const [type, sample] of Object.entries(contract.events)) {
      expect(isRespondSseEvent(sample), `events.${type}`).toBe(true);
    }
    // Type alone is not enough — shape must match the contract.
    expect(isRespondSseEvent({ type: 'delta' })).toBe(false);
    expect(isRespondSseEvent({ type: 'start' })).toBe(false);
  });

  it('derives runtime path constants from endpoints.json', () => {
    expect(RESPOND_PATH).toBe(endpoints.respond);
    expect(TASKS_PATH).toBe(endpoints.tasks);
    expect(INTEGRATIONS_PATH).toBe(endpoints.integrations);
    expect(OAUTH_CONNECT_TOKEN_PATH).toBe(endpoints.oauthConnectToken);
    expect(OAUTH_STATUS_PATH).toBe(endpoints.oauthStatus);
    expect(OAUTH_START_PATH).toBe(endpoints.oauthStart);
    expect(OAUTH_DISCONNECT_PATH).toBe(endpoints.oauthDisconnect);
    expect(AUTH_REGISTER_PATH).toBe(endpoints.authRegister);
    expect(AUTH_LOGIN_PATH).toBe(endpoints.authLogin);
    expect(AUTH_REFRESH_PATH).toBe(endpoints.authRefresh);
    expect(AUTH_LOGOUT_PATH).toBe(endpoints.authLogout);
    expect(AUTH_PATH_PREFIX).toBe('/v1/auth');
    expect(OAUTH_PROVIDER_SAMPLE).toBe(endpoints.oauthProviderSample);
    expect(OAUTH_PROVIDER_SAMPLE.length).toBeGreaterThan(0);
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

  it('carries the auth refresh exchange TokenAuthenticator sends and reads', () => {
    expect(Object.keys(endpoints.authRefreshRequest)).toEqual(['refresh_token']);
    expect(endpoints.authRefreshRequest.refresh_token.length).toBeGreaterThan(0);

    expect(endpoints.authTokensResponse).toMatchObject({
      user_id: expect.any(String),
      token_type: 'Bearer',
      access_token: expect.any(String),
      expires_in: expect.any(Number),
      refresh_token: expect.any(String),
    });
    expect(Object.keys(endpoints.authTokensResponse).sort()).toEqual(
      ['access_token', 'expires_in', 'refresh_token', 'token_type', 'user_id'].sort(),
    );
    expect(endpoints.authTokensResponse.access_token.length).toBeGreaterThan(0);
    expect(endpoints.authTokensResponse.refresh_token.length).toBeGreaterThan(0);
  });
});
