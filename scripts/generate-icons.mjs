import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../public/icon/', import.meta.url);
await mkdir(directory, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="#183e35"/><path d="M31 47h66M31 64h48M31 81h29" stroke="#ecf2df" stroke-width="9" stroke-linecap="round"/><circle cx="94" cy="83" r="8" fill="#b9d785"/></svg>`;
await writeFile(new URL('source.svg', directory), svg);
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`${size}.png`, directory)));
}
