import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationSummary } from '../api/integrations.ts';
import { useOAuthIntegrations } from './useOAuthIntegrations.ts';

const getOAuthStatusMock = vi.hoisted(() => vi.fn());
const disconnectOAuthMock = vi.hoisted(() => vi.fn());
const buildOAuthStartUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../api/oauth.ts', () => ({
  getOAuthStatus: getOAuthStatusMock,
  disconnectOAuth: disconnectOAuthMock,
  buildOAuthStartUrl: buildOAuthStartUrlMock,
  toOAuthUserMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Could not complete Google sign-in. Try again.',
}));

vi.mock('./usePollGate.ts', () => ({
  usePollGate: () => true,
}));

const googleIntegration: IntegrationSummary = {
  id: 'google_calendar',
  label: 'Google Calendar',
  default_enabled: false,
  enabled: false,
  oauth: { provider_id: 'google' },
};

describe('useOAuthIntegrations', () => {
  beforeEach(() => {
    buildOAuthStartUrlMock.mockImplementation(
      (providerId: string, userId: string) => `https://oauth.test/${providerId}?user=${userId}`,
    );
    getOAuthStatusMock.mockResolvedValue({
      connected: true,
      granted_scopes: ['calendar'],
      missing_scopes: [],
    });
    disconnectOAuthMock.mockResolvedValue(undefined);
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getOAuthStatusMock.mockReset();
    disconnectOAuthMock.mockReset();
    buildOAuthStartUrlMock.mockReset();
  });

  it('loads provider status when active', async () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
        userId: 'user-1',
        active: true,
        items: [googleIntegration],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getOAuthStatusMock).toHaveBeenCalledWith('google', 'user-1', expect.any(Object));
    expect(result.current.statusByProvider.google).toEqual({
      connected: true,
      granted_scopes: ['calendar'],
      missing_scopes: [],
    });
  });

  it('opens consent when connect is called', () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
        userId: 'user-1',
        active: true,
        items: [googleIntegration],
      }),
    );

    act(() => {
      result.current.connect('google');
    });

    expect(buildOAuthStartUrlMock).toHaveBeenCalledWith('google', 'user-1');
    expect(window.open).toHaveBeenCalledWith(
      'https://oauth.test/google?user=user-1',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('refreshes status after disconnect', async () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
        userId: 'user-1',
        active: true,
        items: [googleIntegration],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    getOAuthStatusMock.mockClear();

    await act(async () => {
      await result.current.disconnect('google');
    });

    expect(disconnectOAuthMock).toHaveBeenCalledWith('google', 'user-1');
    expect(getOAuthStatusMock).toHaveBeenCalled();
  });

  it('opens consent after save when scopes are missing', async () => {
    getOAuthStatusMock.mockResolvedValue({
      connected: false,
      granted_scopes: [],
      missing_scopes: ['calendar.read'],
    });

    const { result } = renderHook(() =>
      useOAuthIntegrations({
        userId: 'user-1',
        active: true,
        items: [googleIntegration],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.afterSave(
        { google_calendar: { enabled: true } },
        [{ ...googleIntegration, enabled: true }],
      );
    });

    expect(window.open).toHaveBeenCalled();
  });
});
