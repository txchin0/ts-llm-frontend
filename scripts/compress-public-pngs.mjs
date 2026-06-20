// Recompress PNGs in public/ after replacing icon assets. Requires sharp:
//   npx --yes -p sharp node scripts/compress-public-pngs.mjs
import { readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const publicDir = new URL('../public', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const pngs = (await readdir(publicDir)).filter((name) => name.endsWith('.png'));

for (const name of pngs) {
  const input = join(publicDir, name);
  const temp = `${input}.tmp`;
  const before = (await import('node:fs')).statSync(input).size;

  await sharp(input)
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(temp);

  await unlink(input);
  await rename(temp, input);

  const after = (await import('node:fs')).statSync(input).size;
  console.log(`${name}: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`);
}
