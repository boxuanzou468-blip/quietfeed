import { ZipArchive } from 'archiver';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const output = join(root, 'artifacts');
await mkdir(output, { recursive: true });
const fixedDate = new Date('2026-10-22T00:00:00.000Z');

async function filesIn(directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  )) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to archive symlink: ${path}`);
    if (entry.isDirectory()) files.push(...(await filesIn(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function zip(name, entries) {
  const destination = join(output, name);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = createWriteStream(destination);
  const done = new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);
  });
  archive.pipe(stream);
  for (const entry of entries) {
    archive.file(entry.path, {
      name: entry.name.replaceAll('\\', '/'),
      date: fixedDate,
      mode: 0o644,
    });
  }
  await archive.finalize();
  await done;
  return destination;
}

const packages = [];
for (const browser of ['chrome', 'edge']) {
  const directory = join(root, `.output/${browser}-mv3`);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== version || manifest.manifest_version !== 3)
    throw new Error('Build version mismatch');
  if (manifest.host_permissions?.length || manifest.content_scripts?.length)
    throw new Error(
      'Website access must remain optional; check runtime content script registration',
    );
  if (
    JSON.stringify(manifest.optional_host_permissions) !==
    JSON.stringify([
      'https://www.bilibili.com/*',
      'https://www.xiaohongshu.com/*',
      'https://www.baidu.com/*',
      'https://www.csdn.net/*',
      'https://www.zhihu.com/*',
    ])
  )
    throw new Error('Unexpected host permissions');
  if (
    manifest.permissions.some(
      (permission) => !['storage', 'scripting', 'alarms', 'activeTab'].includes(permission),
    )
  )
    throw new Error('Unexpected required permission');
  for (const required of [
    'background.js',
    'popup.html',
    'options.html',
    'content-scripts/quietfeed.js',
    'icon/128.png',
  ])
    await stat(join(directory, required));
  packages.push(
    await zip(
      `quietfeed-${version}-${browser}.zip`,
      (await filesIn(directory)).map((path) => ({ path, name: relative(directory, path) })),
    ),
  );
}

const rootFiles = [
  'package.json',
  'package-lock.json',
  'wxt.config.ts',
  'tsconfig.json',
  'vitest.config.ts',
  'playwright.config.ts',
  'eslint.config.js',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'README.md',
  'README.en.md',
  'LICENSE',
  'PRIVACY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
];
const sourceFiles = rootFiles.map((name) => join(root, name));
for (const directory of ['entrypoints', 'src', 'public', 'tests', 'scripts', 'docs', '.github'])
  sourceFiles.push(...(await filesIn(join(root, directory))));
packages.push(
  await zip(
    `quietfeed-${version}-source.zip`,
    sourceFiles.map((path) => ({ path, name: `quietfeed/${relative(root, path)}` })),
  ),
);
const checksums = await Promise.all(
  packages.map(
    async (path) =>
      `${createHash('sha256')
        .update(await readFile(path))
        .digest('hex')}  ${relative(output, path)}`,
  ),
);
await writeFile(join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8');
console.log(
  `Release ${version}: ${packages.length} packages, ${sourceFiles.length} source files; optional-permission manifest checks passed.`,
);
for (const path of packages)
  console.log(`${relative(root, path)} (${(await stat(path)).size} bytes)`);
