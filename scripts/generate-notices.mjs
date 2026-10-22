import { copyFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'public');
await mkdir(destination, { recursive: true });
await copyFile(join(root, 'LICENSE'), join(destination, 'LICENSE.txt'));
const notices = ['QuietFeed — bundled runtime notices\n'];
for (const name of ['react', 'react-dom', 'scheduler']) {
  const packageRoot = join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  notices.push(`${name} ${pkg.version}\n${await readFile(join(packageRoot, 'LICENSE'), 'utf8')}`);
}
const wxtLicense = (await readFile(join(root, 'LICENSE'), 'utf8')).replace(
  'Copyright (c) 2026 QuietFeed contributors',
  'Copyright (c) 2023 Aaron',
);
notices.push(
  `WXT and @wxt-dev/browser runtime utilities\nSource: https://github.com/wxt-dev/wxt\nLicense: https://github.com/wxt-dev/wxt/blob/main/LICENSE\n\n${wxtLicense}`,
);
await writeFile(
  join(destination, 'THIRD_PARTY_NOTICES.txt'),
  `${notices.join('\n\n---\n\n')}\n`,
  'utf8',
);
