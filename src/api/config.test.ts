import { afterEach, describe, expect, it, vi } from 'vitest';

import { SERVER_URL_KEY, getApiBaseUrl } from './config.ts';

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

describe('getApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty string when nothing is stored (relative requests)', () => {
    vi.stubGlobal('localStorage', createStorage());

    expect(getApiBaseUrl()).toBe('');
  });

  it('returns the stored URL', () => {
    const storage = createStorage();
    storage.setItem(SERVER_URL_KEY, 'http://192.168.1.10:3000');
    vi.stubGlobal('localStorage', storage);

    expect(getApiBaseUrl()).toBe('http://192.168.1.10:3000');
  });

  it('trims whitespace and strips trailing slashes', () => {
    const storage = createStorage();
    storage.setItem(SERVER_URL_KEY, '  http://host:3000//  ');
    vi.stubGlobal('localStorage', storage);

    expect(getApiBaseUrl()).toBe('http://host:3000');
  });

  it('prepends http:// to a scheme-less host so it is not treated as relative', () => {
    const storage = createStorage();
    storage.setItem(SERVER_URL_KEY, '192.168.1.10:3000');
    vi.stubGlobal('localStorage', storage);

    expect(getApiBaseUrl()).toBe('http://192.168.1.10:3000');
  });

  it('leaves an https URL scheme intact', () => {
    const storage = createStorage();
    storage.setItem(SERVER_URL_KEY, 'https://host:3000');
    vi.stubGlobal('localStorage', storage);

    expect(getApiBaseUrl()).toBe('https://host:3000');
  });

  it('falls back to empty string when storage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('storage unavailable');
      },
    });

    expect(getApiBaseUrl()).toBe('');
  });
});
