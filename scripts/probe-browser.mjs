import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${resolve('.output/chrome-mv3')}`,
    `--load-extension=${resolve('.output/chrome-mv3')}`,
  ],
});
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).hostname;
  const management = await context.newPage();
  await management.goto('chrome://extensions');
  console.log(
    'pregrant',
    await management.evaluate(
      async ({ id }) => {
        try {
          await chrome.developerPrivate.addHostPermission(id, 'https://www.bilibili.com/*');
          return 'granted';
        } catch (error) {
          return String(error);
        }
      },
      { id },
    ),
  );
  await management.close();
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.getByRole('switch', { name: '开启B站的静流' }).waitFor();
  await page.screenshot({ path: 'artifacts/options-initial.png', fullPage: true });
  await page.getByRole('switch', { name: '开启B站的静流' }).click();
  await page.waitForTimeout(1800);
  console.log(
    JSON.stringify({
      id,
      switches: await page.getByRole('switch').evaluateAll((items) =>
        items.map((e) => ({
          label: e.getAttribute('aria-label'),
          checked: e.getAttribute('aria-checked'),
        })),
      ),
      errors: await page.getByRole('alert').allTextContents(),
      permissions: await worker.evaluate(async () => chrome.permissions.getAll()),
    }),
  );
} finally {
  await context.close();
}
