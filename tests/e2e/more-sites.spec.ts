import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { test, expect, openSettings, command } from './extension-fixture';

async function fixtures(context: BrowserContext) {
  const html = async (name: string) => readFile(resolve('tests/fixtures', name), 'utf8');
  const [baiduHome, baiduSearch, csdn, zhihu, question] = await Promise.all([
    html('baidu-home.html'),
    html('baidu-search.html'),
    html('csdn-home.html'),
    html('zhihu-home.html'),
    html('zhihu-question.html'),
  ]);
  await context.route('https://www.baidu.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: new URL(route.request().url()).pathname === '/s' ? baiduSearch : baiduHome,
    }),
  );
  await context.route('https://www.csdn.net/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: csdn }),
  );
  await context.route('https://www.zhihu.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: new URL(route.request().url()).pathname.startsWith('/question/') ? question : zhihu,
    }),
  );
}

test('Baidu keeps native search and results, synchronizes tabs, and restores the exact hot list', async ({
  context,
  extensionId,
}) => {
  await fixtures(context);
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto('https://www.baidu.com/'), second.goto('https://www.baidu.com/')]);
  await expect(first.locator('#hotsearch-content-wrapper')).toBeVisible();
  const options = await openSettings(context, extensionId);
  const panel = options.getByRole('region', { name: '百度设置' });
  await panel.getByRole('switch', { name: '开启百度的静流' }).click();
  await expect(first.locator('#hotsearch-content-wrapper')).toBeHidden();
  await expect(second.locator('#hotsearch-content-wrapper')).toBeHidden();
  await expect(first.locator('#chat-textarea')).toBeVisible();
  await first.locator('#quietfeed-search-guide').getByRole('button', { name: '去搜索' }).click();
  await expect(first.locator('#chat-textarea')).toBeFocused();
  await first.locator('#chat-textarea').fill('TypeScript');
  await expect(first.locator('#chat-textarea')).toHaveValue('TypeScript');
  await expect(first.locator('.bdsug')).toBeVisible();
  await panel.getByRole('button', { name: '放行一下' }).click();
  await expect(first.locator('#hotsearch-content-wrapper')).toBeVisible();
  await expect(second.locator('#hotsearch-content-wrapper')).toBeVisible();
  await panel.getByRole('button', { name: '提前结束' }).click();
  await expect(first.locator('#hotsearch-content-wrapper')).toBeHidden();
  await second.goto('https://www.baidu.com/s?wd=TypeScript');
  await expect(second.locator('#content_left')).toBeVisible();
  await expect(second.locator('#quietfeed-page-style')).toHaveCount(0);
  await panel.getByRole('switch', { name: '关闭百度的静流' }).click();
  await expect(first.locator('#hotsearch-content-wrapper')).toBeVisible();
  await expect(first.locator('#quietfeed-page-style')).toHaveCount(0);
  await expect(first.locator('#chat-textarea')).toHaveValue('TypeScript');
});

test('CSDN modules restore individually while search, navigation and calendar remain usable', async ({
  context,
  extensionId,
}) => {
  await fixtures(context);
  const home = await context.newPage();
  await home.goto('https://www.csdn.net/');
  const options = await openSettings(context, extensionId);
  const panel = options.getByRole('region', { name: 'CSDN设置' });
  await panel.getByRole('switch', { name: '开启CSDN的静流' }).click();
  await expect(home.locator('.home-project')).toBeHidden();
  await expect(home.locator('.home-article')).toBeHidden();
  await expect(home.locator('#www-home-silde > .member')).toBeHidden();
  await expect(home.locator('#toolbar-search-input')).toBeVisible();
  await home.locator('#quietfeed-search-guide').getByRole('button', { name: '去搜索' }).click();
  await expect(home.locator('#toolbar-search-input')).toBeFocused();
  await expect(home.locator('.layout-sidebar-aside')).toBeVisible();
  await expect(home.locator('.calendar')).toBeVisible();
  await panel.getByRole('switch', { name: '隐藏首页内容推荐', exact: true }).click();
  await expect(home.locator('.home-project')).toBeVisible();
  await expect(home.locator('#www-home-silde > .member')).toBeHidden();
  await panel.getByRole('button', { name: '放行一下' }).click();
  await expect(home.locator('#www-home-silde > .member')).toBeVisible();
  await panel.getByRole('button', { name: '提前结束' }).click();
  await expect(home.locator('#www-home-silde > .member')).toBeHidden();
  await home.goto('https://www.csdn.net/follow');
  await expect(home.locator('.home-project')).toBeVisible();
  await expect(home.locator('#quietfeed-page-style')).toHaveCount(0);
});

test('experimental Zhihu adapts named recommendation targets, retaining follow routes and answers', async ({
  context,
  extensionId,
}) => {
  await fixtures(context);
  const options = await openSettings(context, extensionId);
  const panel = options.getByRole('region', { name: '知乎设置' });
  await expect(panel.getByText(/试验适配/)).toBeVisible();
  await panel.getByRole('switch', { name: '开启知乎的静流' }).click();
  const home = await context.newPage();
  await home.goto('https://www.zhihu.com/');
  await expect(home.locator('.TopstoryItem').first()).toBeHidden();
  await expect(home.locator('.SearchBar-input')).toBeVisible();
  await home.goto('https://www.zhihu.com/follow');
  await expect(home.locator('.TopstoryItem').first()).toBeVisible();
  await expect(home.locator('#quietfeed-page-style')).toHaveCount(0);
  await home.goto('https://www.zhihu.com/question/123/answer/456');
  await expect(home.locator('.RelatedQuestions')).toBeHidden();
  for (const selector of [
    '.QuestionHeader',
    '.AnswerItem',
    '.CommentsV2',
    '.question-stats',
    '.creator-entry',
  ]) {
    await expect(home.locator(selector)).toBeVisible();
  }
  await panel.getByRole('switch', { name: '关闭知乎的静流' }).click();
  await expect(home.locator('.RelatedQuestions')).toBeVisible();
  await expect(home.locator('#quietfeed-page-style')).toHaveCount(0);
});

test('new site grants and permission removal remain independent', async ({
  context,
  extensionId,
}) => {
  await fixtures(context);
  const options = await openSettings(context, extensionId);
  await options.getByRole('switch', { name: '开启百度的静流' }).click();
  await options.getByRole('switch', { name: '开启CSDN的静流' }).click();
  const baidu = await context.newPage();
  const csdn = await context.newPage();
  await Promise.all([baidu.goto('https://www.baidu.com/'), csdn.goto('https://www.csdn.net/')]);
  await expect(baidu.locator('#hotsearch-content-wrapper')).toBeHidden();
  await expect(csdn.locator('.home-project')).toBeHidden();
  await options.evaluate(() => chrome.permissions.remove({ origins: ['https://www.baidu.com/*'] }));
  await expect(baidu.locator('#hotsearch-content-wrapper')).toBeVisible();
  await expect(baidu.locator('#quietfeed-page-style')).toHaveCount(0);
  await expect(csdn.locator('.home-project')).toBeHidden();
  const snapshot = await command(options, { type: 'get-state' });
  expect(snapshot.granted.baidu).toBe(false);
  expect(snapshot.config.sites.baidu.enabled).toBe(false);
  expect(snapshot.config.sites.csdn.enabled).toBe(true);
  expect(snapshot.config.sites.zhihu.enabled).toBe(false);
});
