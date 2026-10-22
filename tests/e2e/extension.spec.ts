import { test, expect, openSettings, command, installFixtures } from './extension-fixture';
import { CONFIG_KEY, type AppConfig } from '../../src/core/config';

test('loads the real production extension and lets the user enable, customize, pause, reset and disable', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const home = await context.newPage();
  await home.goto('https://www.bilibili.com/');
  await expect(home.locator('.bili-feed-card')).toHaveCount(2);
  await expect(home.locator('.bili-feed-card').first()).toBeVisible();
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  await expect(options.getByRole('switch', { name: '关闭B站的静流' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(home.locator('.bili-feed-card').first()).toBeHidden();
  await expect(home.locator('.nav-search-input')).toBeVisible();
  await expect(home.getByRole('dialog')).toBeVisible();
  // Simulate closing the synthetic site's login prompt before showing the guide.
  await home.getByRole('dialog').evaluate((element) => element.remove());
  await expect(home.locator('#quietfeed-search-guide')).toBeVisible();
  const panel = options.getByRole('region', { name: 'B站设置' });
  await panel.getByRole('switch', { name: '隐藏首页推荐', exact: true }).click();
  await expect(home.locator('.bili-feed-card').first()).toBeVisible();
  await expect(panel.getByRole('button', { name: '自定义', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await panel.getByRole('button', { name: '放行一下' }).click();
  await expect(home.locator('.recommended-swipe')).toBeVisible();
  await expect(panel.getByRole('button', { name: '提前结束' })).toBeVisible();
  await panel.getByRole('button', { name: '提前结束' }).click();
  await expect(home.locator('.recommended-swipe')).toBeHidden();
  await panel.getByRole('button', { name: '恢复搜索优先' }).click();
  await expect(home.locator('.bili-feed-card').first()).toBeHidden();
  await panel.getByRole('switch', { name: '关闭B站的静流' }).click();
  await expect(home.locator('.bili-feed-card').first()).toBeVisible();
  await expect(home.locator('#quietfeed-page-style')).toHaveCount(0);
  await panel.getByRole('switch', { name: '开启B站的静流' }).click();
  await expect(home.locator('.bili-feed-card').first()).toBeHidden();
  await expect(home.locator('#quietfeed-page-style')).toHaveCount(1);
});

test('keeps site settings independent and synchronizes all tabs of the same site', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  await options.getByRole('switch', { name: '开启小红书的静流' }).click();
  const first = await context.newPage();
  const second = await context.newPage();
  const red = await context.newPage();
  await Promise.all([
    first.goto('https://www.bilibili.com/'),
    second.goto('https://www.bilibili.com/'),
    red.goto('https://www.xiaohongshu.com/explore'),
  ]);
  await expect(first.locator('.bili-feed-card').first()).toBeHidden();
  await expect(second.locator('.bili-feed-card').first()).toBeHidden();
  await expect(red.locator('.feeds-container')).toBeHidden();
  await command(options, { type: 'pause-site', site: 'bilibili' });
  await expect(first.locator('.bili-feed-card').first()).toBeVisible();
  await expect(second.locator('.bili-feed-card').first()).toBeVisible();
  await expect(red.locator('.feeds-container')).toBeHidden();
  await command(options, { type: 'set-enabled', site: 'xiaohongshu', enabled: false });
  await expect(red.locator('.feeds-container')).toBeVisible();
  await command(options, { type: 'resume-site', site: 'bilibili' });
  await expect(first.locator('.bili-feed-card').first()).toBeHidden();
});

test('retains player, playlist, comments, typed search suggestions and nested note overlays', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  await options.getByRole('switch', { name: '开启小红书的静流' }).click();
  const video = await context.newPage();
  await video.goto('https://www.bilibili.com/video/BV1example/');
  await expect(video.locator('#reco_list .rec-list')).toBeHidden();
  await expect(video.locator('#bilibili-player')).toBeVisible();
  await expect(video.locator('#multi_page')).toBeVisible();
  await expect(video.locator('#comment')).toBeVisible();
  const red = await context.newPage();
  await red.goto('https://www.xiaohongshu.com/explore');
  await expect(red.locator('.feeds-container')).toBeHidden();
  await red.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.className = 'note-detail-mask';
    overlay.setAttribute('role', 'dialog');
    overlay.textContent = 'Synthetic note details';
    document.querySelector('.feeds-container')!.append(overlay);
  });
  await expect(red.getByRole('dialog')).toBeVisible();
  await expect(red.locator('#quietfeed-search-guide')).toHaveCount(0);
  await red.locator('.search-input').fill('手动搜索');
  await expect(red.locator('.search-input')).toHaveValue('手动搜索');
});

test('re-evaluates an SPA route without hiding a search result that uses the same DOM class', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启小红书的静流' }).click();
  const page = await context.newPage();
  await page.goto('https://www.xiaohongshu.com/explore');
  await expect(page.locator('.feeds-container')).toBeHidden();
  await page.evaluate(() => history.pushState({}, '', '/search_result?keyword=example'));
  await expect(page.locator('.feeds-container')).toBeVisible();
  await page.evaluate(() => history.pushState({}, '', '/explore'));
  await expect(page.locator('.feeds-container')).toBeHidden();
});

test('restores an expired pause even before a sleeping worker alarm fires', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  const page = await context.newPage();
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('.bili-feed-card').first()).toBeHidden();
  // Only this isolated test profile is altered to exercise a short deadline.
  await options.evaluate(async (key) => {
    const data = await chrome.storage.local.get(key);
    const config = data[key] as AppConfig;
    config.sites.bilibili.allowUntil = Date.now() + 1000;
    await chrome.storage.local.set(data);
  }, CONFIG_KEY);
  await expect(page.locator('.bili-feed-card').first()).toBeVisible();
  await expect(page.locator('.bili-feed-card').first()).toBeHidden({ timeout: 5000 });
});

test('restores old tabs after a worker restart and cleans them after host access is revoked', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  const page = await context.newPage();
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('.bili-feed-card').first()).toBeHidden();
  const cdp = await context.newCDPSession(options);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await command(options, { type: 'get-state' });
  await expect(page.locator('.bili-feed-card').first()).toBeHidden();
  await expect(page.locator('#quietfeed-page-style')).toHaveCount(1);
  await options.evaluate(() =>
    chrome.permissions.remove({ origins: ['https://www.bilibili.com/*'] }),
  );
  await expect(page.locator('.bili-feed-card').first()).toBeVisible();
  await expect(page.locator('#quietfeed-page-style')).toHaveCount(0);
  const current = await command(options, { type: 'get-state' });
  expect(current.config.sites.bilibili.enabled).toBe(false);
});

test('keeps unknown page structures visible and reports unmatched modules', async ({
  context,
  extensionId,
}) => {
  await context.route('https://www.bilibili.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<h1>Unknown layout</h1><main id="untouched">Important content</main>',
    }),
  );
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  const page = await context.newPage();
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('#untouched')).toBeVisible();
  const status = await options.evaluate(async (targetId) => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.bilibili.com/*' });
    if (!tab?.id) throw new Error('Missing fixture tab');
    return chrome.tabs.sendMessage(tab.id, { type: targetId });
  }, 'quietfeed:page-status');
  expect(status.modules.every((module: { matched: boolean }) => !module.matched)).toBe(true);
  await expect(page.locator('#quietfeed-search-guide')).toHaveCount(0);
});

test('reconnects existing website tabs after the extension itself is reloaded', async ({
  context,
  extensionId,
}) => {
  await installFixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启B站的静流' }).click();
  const page = await context.newPage();
  await page.goto('https://www.bilibili.com/');
  await expect(page.locator('.bili-feed-card')).toHaveCount(2);
  await expect(page.locator('.bili-feed-card').first()).toBeHidden();
  const management = await context.newPage();
  await management.goto('chrome://extensions');
  const restarted = context.waitForEvent('serviceworker', {
    predicate: (worker) => worker.url().includes(extensionId),
  });
  await management.evaluate(async (id) => {
    const api = (
      chrome as unknown as {
        developerPrivate: {
          updateProfileConfiguration(update: { inDeveloperMode: boolean }): Promise<void>;
          reload(
            id: string,
            options: { failQuietly: boolean; populateErrorForUnpacked: boolean },
          ): Promise<unknown>;
        };
      }
    ).developerPrivate;
    await api.updateProfileConfiguration({ inDeveloperMode: true });
    const error = await api.reload(id, { failQuietly: true, populateErrorForUnpacked: true });
    if (error) throw new Error(JSON.stringify(error));
  }, extensionId);
  const reopened = await openSettings(context, extensionId);
  await restarted;
  await expect(reopened.getByRole('switch', { name: '关闭B站的静流' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await reopened.getByRole('switch', { name: '关闭B站的静流' }).click();
  await expect(page.locator('.bili-feed-card').first()).toBeVisible();
  await expect(page.locator('#quietfeed-page-style')).toHaveCount(0);
  await reopened.getByRole('switch', { name: '开启B站的静流' }).click();
  await expect(page.locator('.bili-feed-card').first()).toBeHidden();
  await expect(page.locator('#quietfeed-page-style')).toHaveCount(1);
});
