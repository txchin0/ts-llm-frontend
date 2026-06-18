import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthConnectedPage } from './OAuthConnectedPage.tsx';

const originalLocation = window.location;

function mockLocation(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search },
  });
}

describe('OAuthConnectedPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLocation('?provider=google');
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('renders success copy for a known provider', () => {
    render(<OAuthConnectedPage />);

    expect(screen.getByRole('heading', { name: 'Connected to Google' })).toBeInTheDocument();
    expect(screen.getByText('Closing this tab…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close tab' })).not.toBeInTheDocument();
  });

  it('calls window.close after the auto-close delay', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);

    render(<OAuthConnectedPage />);

    act(() => {
      vi.advanceTimersByTime(1_800);
    });

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a fallback close button when auto-close does not dismiss the tab', () => {
    vi.spyOn(window, 'close').mockImplementation(() => undefined);

    render(<OAuthConnectedPage />);

    act(() => {
      vi.advanceTimersByTime(2_200);
    });

    expect(screen.getByRole('button', { name: 'Close tab' })).toBeInTheDocument();
  });

  it('renders error state without auto-close', () => {
    mockLocation('?provider=google&error=access_denied');
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);

    render(<OAuthConnectedPage />);

    expect(screen.getByRole('heading', { name: 'Connection failed' })).toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close tab' })).toBeInTheDocument();
    expect(screen.queryByText('Closing this tab…')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('clears timers on unmount', () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);

    const { unmount } = render(<OAuthConnectedPage />);
    unmount();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(closeSpy).not.toHaveBeenCalled();
  });
});
