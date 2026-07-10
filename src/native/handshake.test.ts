// Verifies the TypeScript spelling of the web↔native handshake against the
// cross-language contract in protocol/handshake.json. The Kotlin side
// (EmberSettings.kt, AuthTokenStore.kt) checks the same fixture in
// HandshakeContractTest.kt.
import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_KEY,
  MIC_LANGUAGE_KEY,
  REFRESH_TOKEN_KEY,
  SERVER_URL_KEY,
} from './handshake.ts';
import { MIRRORED_SETTING_KEYS } from './settingsMirror.ts';
import { normalizeServerUrl } from '../api/config.ts';
import contract from '../../protocol/handshake.json';

describe('native handshake contract', () => {
  it('pins the shared storage-key names', () => {
    expect(SERVER_URL_KEY).toBe(contract.keys.serverUrl);
    expect(MIC_LANGUAGE_KEY).toBe(contract.keys.micLanguage);
    expect(ACCESS_TOKEN_KEY).toBe(contract.keys.accessToken);
    expect(REFRESH_TOKEN_KEY).toBe(contract.keys.refreshToken);
  });

  it('mirrors exactly the settings the assistant reads', () => {
    expect([...MIRRORED_SETTING_KEYS].sort()).toEqual(
      [contract.keys.serverUrl, contract.keys.micLanguage].sort(),
    );
  });

  it('normalizes server URLs identically to the Kotlin side', () => {
    for (const { input, normalized } of contract.serverUrlNormalization) {
      // null input/result in the fixture map to '' on the TypeScript side.
      expect(normalizeServerUrl(input ?? ''), `input: ${JSON.stringify(input)}`).toBe(
        normalized ?? '',
      );
    }
  });
});
