import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Command, CommandResult } from '../../src/core/protocol';
import { SITE_IDS, SITES } from '../../src/core/config';

const edgeExecutable = process.env.QUIETFEED_EDGE_EXECUTABLE;

export const test = base.extend<{ extensionId: string; preauthorize: boolean }>({
  preauthorize: [true, { option: true }],
  context: async ({ browserName: _browserName }, use) => {
    const extension = resolve(edgeExecutable ? '.output/edge-mv3' : '.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      ...(edgeExecutable ? { executablePath: edgeExecutable } : { channel: 'chromium' as const }),
      headless: true,
      viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context, preauthorize }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).hostname;
    if (preauthorize) {
      // Only the disposable test profile is granted access. Browser chrome's native
      // optional-permission prompt cannot be accepted by Playwright headless.
      // The shipped manifest/code are unchanged; native prompt acceptance is manual QA.
      const management = await context.newPage();
      await management.goto(edgeExecutable ? 'edge://extensions' : 'chrome://extensions');
      await management.evaluate(
        async ({ extensionId, origins }) => {
          const api = (
            chrome as unknown as {
              developerPrivate: { addHostPermission(id: string, host: string): Promise<void> };
            }
          ).developerPrivate;
          for (const origin of origins) await api.addHostPermission(extensionId, origin);
        },
        { extensionId: id, origins: SITE_IDS.flatMap((site) => SITES[site].origins) },
      );
      await management.close();
    }
    await use(id);
  },
});

export { expect } from '@playwright/test';

export async function openSettings(context: BrowserContext, id: string) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.getByRole('heading', { name: '你的网站，你来决定' }).waitFor();
  await page.getByRole('region', { name: 'B站设置' }).waitFor();
  return page;
}

export async function command(page: Page, message: Command) {
  const result = (await page.evaluate(
    (input) => chrome.runtime.sendMessage(input),
    message,
  )) as CommandResult;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function installFixtures(context: BrowserContext) {
  const fixtures = await Promise.all(
    ['bilibili-home.html', 'bilibili-video.html', 'xiaohongshu-home.html'].map((name) =>
      readFile(resolve('tests/fixtures', name), 'utf8'),
    ),
  );
  await context.route('https://www.bilibili.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: route.request().url().includes('/video/') ? fixtures[1] : fixtures[0],
    }),
  );
  await context.route('https://www.xiaohongshu.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixtures[2] }),
  );
}
