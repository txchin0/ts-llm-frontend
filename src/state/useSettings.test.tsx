import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettings } from './useSettings.ts';

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('useSettings', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('persists user id updates', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setUserId('alice');
    });

    expect(result.current.userId).toBe('alice');
    expect(storage.getItem('ts-llm.user_id')).toBe('alice');
  });

  it('resolves system theme from matchMedia', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies explicit light theme', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(storage.getItem('ts-llm.theme')).toBe('light');
  });

  it('persists mic language preference', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setMicLanguage('de-DE');
    });

    expect(result.current.micLanguage).toBe('de-DE');
    expect(storage.getItem('ts-llm.mic_language')).toBe('de-DE');
  });
});
