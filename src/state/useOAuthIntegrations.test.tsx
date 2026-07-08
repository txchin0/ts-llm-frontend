import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationSummary } from '../api/integrations.ts';
import { useOAuthIntegrations } from './useOAuthIntegrations.ts';

const getOAuthStatusMock = vi.hoisted(() => vi.fn());
const disconnectOAuthMock = vi.hoisted(() => vi.fn());
const buildOAuthStartUrlMock = vi.hoisted(() => vi.fn());
const createOAuthConnectTokenMock = vi.hoisted(() => vi.fn());

vi.mock('../api/oauth.ts', () => ({
  getOAuthStatus: getOAuthStatusMock,
  disconnectOAuth: disconnectOAuthMock,
  buildOAuthStartUrl: buildOAuthStartUrlMock,
  createOAuthConnectToken: createOAuthConnectTokenMock,
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
      (providerId: string, connectToken: string) =>
        `https://oauth.test/${providerId}?token=${connectToken}`,
    );
    createOAuthConnectTokenMock.mockResolvedValue('oct_test_token');
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
    createOAuthConnectTokenMock.mockReset();
  });

  it('loads provider status when active', async () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
        active: true,
        items: [googleIntegration],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getOAuthStatusMock).toHaveBeenCalledWith('google', expect.any(Object));
    expect(result.current.statusByProvider.google).toEqual({
      connected: true,
      granted_scopes: ['calendar'],
      missing_scopes: [],
    });
  });

  it('mints a connect token and opens consent when connect is called', async () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
        active: true,
        items: [googleIntegration],
      }),
    );

    act(() => {
      result.current.connect('google');
    });

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        'https://oauth.test/google?token=oct_test_token',
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(createOAuthConnectTokenMock).toHaveBeenCalled();
    expect(buildOAuthStartUrlMock).toHaveBeenCalledWith('google', 'oct_test_token');
  });

  it('surfaces connect-token failures instead of opening a window', async () => {
    createOAuthConnectTokenMock.mockRejectedValueOnce(new Error('signed out'));

    const { result } = renderHook(() =>
      useOAuthIntegrations({
        active: true,
        items: [googleIntegration],
      }),
    );

    act(() => {
      result.current.connect('google');
    });

    await waitFor(() => {
      expect(result.current.error).toBe('signed out');
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('refreshes status after disconnect', async () => {
    const { result } = renderHook(() =>
      useOAuthIntegrations({
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

    expect(disconnectOAuthMock).toHaveBeenCalledWith('google');
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

    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
    });
  });
});
