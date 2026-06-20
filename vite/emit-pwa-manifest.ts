import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

import { pwaManifest } from '../src/brand';

const manifestPath = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../public/manifest.webmanifest',
);

/** Writes `public/manifest.webmanifest` from `src/brand.ts` on dev/build start. */
export function emitPwaManifestPlugin(): Plugin {
  return {
    name: 'emit-pwa-manifest',
    config() {
      writeFileSync(manifestPath, `${JSON.stringify(pwaManifest, null, 2)}\n`);
    },
  };
}
