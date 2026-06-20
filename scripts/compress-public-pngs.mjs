// Recompress PNGs in public/ after replacing icon assets. Requires sharp:
//   npm run compress:icons
import { statSync } from 'node:fs';
import { readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

const pngs = (await readdir(publicDir)).filter((name) => name.endsWith('.png'));

for (const name of pngs) {
  const input = join(publicDir, name);
  const temp = `${input}.tmp`;
  const before = statSync(input).size;

  await sharp(input)
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(temp);

  await unlink(input);
  await rename(temp, input);

  const after = statSync(input).size;
  console.log(`${name}: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`);
}
