import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_DARK_HEX, THEME_LIGHT_HEX } from '../brand.ts';
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
    document.head.insertAdjacentHTML(
      'beforeend',
      `<meta name="theme-color" content="${THEME_DARK_HEX}" />`,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('persists user id updates', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setUserId('alice');
    });

    expect(result.current.userId).toBe('alice');
    expect(storage.getItem('ts-llm.user_id')).toBe('alice');
  });

  it('defaults serverUrl to empty when no stored value', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.serverUrl).toBe('');
  });

  it('persists serverUrl updates (trimmed)', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setServerUrl('  http://192.168.1.10:3000  ');
    });

    expect(result.current.serverUrl).toBe('http://192.168.1.10:3000');
    expect(storage.getItem('ts-llm.server_url')).toBe('http://192.168.1.10:3000');
  });

  it('reads stored serverUrl on init', () => {
    storage.setItem('ts-llm.server_url', 'http://host:3000');

    const { result } = renderHook(() => useSettings());

    expect(result.current.serverUrl).toBe('http://host:3000');
  });

  it('resolves system theme from matchMedia', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      THEME_DARK_HEX,
    );
  });

  it('applies explicit light theme', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(storage.getItem('ts-llm.theme')).toBe('light');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      THEME_LIGHT_HEX,
    );
  });

  it('persists mic language preference', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setMicLanguage('de-DE');
    });

    expect(result.current.micLanguage).toBe('de-DE');
    expect(storage.getItem('ts-llm.mic_language')).toBe('de-DE');
  });

  it('defaults showThinking to false when no stored value', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.showThinking).toBe(false);
  });

  it('persists showThinking updates', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setShowThinking(true);
    });

    expect(result.current.showThinking).toBe(true);
    expect(storage.getItem('ts-llm.show_thinking')).toBe('true');
  });

  it('reads stored showThinking on init', () => {
    storage.setItem('ts-llm.show_thinking', 'true');

    const { result } = renderHook(() => useSettings());

    expect(result.current.showThinking).toBe(true);
  });

  it('defaults showThinking to false for invalid stored values', () => {
    storage.setItem('ts-llm.show_thinking', 'yes');

    const { result } = renderHook(() => useSettings());

    expect(result.current.showThinking).toBe(false);
  });

  it('defaults showToolCalls to true when no stored value', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.showToolCalls).toBe(true);
  });

  it('persists showToolCalls updates', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setShowToolCalls(false);
    });

    expect(result.current.showToolCalls).toBe(false);
    expect(storage.getItem('ts-llm.show_tool_calls')).toBe('false');
  });

  it('reads stored showToolCalls on init', () => {
    storage.setItem('ts-llm.show_tool_calls', 'false');

    const { result } = renderHook(() => useSettings());

    expect(result.current.showToolCalls).toBe(false);
  });

  it('defaults showToolCalls to true for invalid stored values', () => {
    storage.setItem('ts-llm.show_tool_calls', 'yes');

    const { result } = renderHook(() => useSettings());

    expect(result.current.showToolCalls).toBe(true);
  });
});
