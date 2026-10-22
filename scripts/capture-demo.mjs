import { chromium, expect } from '@playwright/test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Run after `npm run build`: node scripts/capture-demo.mjs
// Uses a disposable profile and the unchanged production extension. Browser
// chrome grants optional host access only in this profile, avoiding automation
// of a native confirmation dialog. This does not validate that native dialog.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = join(project, '.output/chrome-mv3');
const output = join(project, 'docs/assets');
await access(join(extensionPath, 'manifest.json'));
await mkdir(output, { recursive: true });

const cards = [
  ['mountains', '周末，去山野里呼吸一下', '生活提案 · 06:42'],
  ['coffee', '慢下来，做一杯好咖啡', '日常灵感 · 04:28'],
  ['room', '把一个小角落变得舒服', '空间笔记 · 08:16'],
  ['sunset', '收集城市里的日落时刻', '城市漫游 · 05:03'],
  ['plant', '从一盆植物开始照顾生活', '绿色生活 · 07:12'],
  ['books', '今天，学一点点新东西', '学习日常 · 03:55'],
];

// Original, synthetic layout only. No real account, media, or outside images.
// Its production-class names exercise the actual extension adapters, while
// the visible "结构示例" label prevents confusing this with a live-site capture.
const fixture = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QuietFeed 功能演示 · 结构示例</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef1e8;color:#263d35;font:14px/1.5 "Segoe UI","Microsoft YaHei",sans-serif}
.demo-header{height:168px;padding:29px 56px;display:flex;justify-content:space-between;gap:38px;align-items:center}
.eyebrow{font-size:11px;font-weight:650;letter-spacing:3px;color:#57715e}.demo-header h1{font-size:31px;letter-spacing:-1px;margin:10px 0 0;font-weight:600}.demo-header h1 span{color:#6f8976;font-weight:400}
.label{background:#e2e8d8;border:1px solid #d0dac3;padding:7px 14px;border-radius:20px;color:#647554;font-size:12px;white-space:nowrap}.header-right{text-align:right}.header-right p{font-size:11px;color:#8a9582;margin:9px 2px 0}
.browser{margin:0 44px;background:#fffefa;border:1px solid #dce2d4;border-radius:18px;overflow:hidden;box-shadow:0 12px 48px #32422d0a;height:574px}
.browser-top{height:39px;border-bottom:1px solid #e9ecdf;display:flex;align-items:center;gap:6px;padding:0 19px;background:#f7f8f1}.browser-top i{width:7px;height:7px;border-radius:50%;background:#d0d8c4}.browser-top span{margin-left:15px;color:#8b9683;font-size:11px;letter-spacing:.4px}.browser-top b{margin-left:auto;font-size:10px;letter-spacing:1.2px;color:#9aa38e;font-weight:500}
.bili-header{padding:20px 28px 17px;display:flex;align-items:center;gap:25px;border-bottom:1px solid #f0f0e8}.site-brand{font-size:17px;color:#547665;white-space:nowrap;font-weight:650;letter-spacing:1px}.site-brand small{font-size:9px;display:block;color:#adb5a3;letter-spacing:1.8px;font-weight:400}
.search-box{flex:1;max-width:475px;margin:0 auto;display:flex;background:#f1f3eb;border:1px solid #e3e7d9;border-radius:10px;overflow:hidden;height:42px}.nav-search-input{min-width:0;flex:1;border:0;background:transparent;outline:none;font:13px "Microsoft YaHei",sans-serif;padding:0 16px;color:#365241}.search-box button{border:0;background:#e5eadb;padding:0 18px;color:#5d7559;font-size:12px}.nav-side{display:flex;gap:19px;font-size:12px;color:#8b9582}
.search-panel{height:28px;padding:5px 29px;color:#b4baa9;font-size:10px}.search-panel #trending{display:flex;gap:15px}.search-panel strong{font-weight:500;color:#9ca98f}
.bili-feed4-layout{padding:0 28px}.recommended-container_floor-aside{display:grid;grid-template-columns:repeat(4,1fr);gap:17px 16px}
.recommended-swipe{height:150px;grid-column:span 2;border-radius:10px;overflow:hidden;position:relative;background:#dfe8d5;padding:21px 25px;color:#56704c}.recommended-swipe small{font-size:9px;letter-spacing:3px;color:#78916c}.recommended-swipe h2{font-size:22px;margin:8px 0 0;font-weight:500;letter-spacing:1px}.recommended-swipe p{font-size:10px;margin:4px 0;color:#8aa07c}.recommended-swipe:after{content:"";position:absolute;right:8px;bottom:-50px;width:190px;height:190px;background:#bccda9;border-radius:50%;box-shadow:-42px 37px 0 #cddbbd}.recommended-swipe:before{content:"";position:absolute;right:32px;top:24px;width:37px;height:37px;border-radius:50%;background:#f5f2d9}
.feed-card{min-width:0}.art{height:108px;border-radius:9px;position:relative;overflow:hidden;background:#e3e7dd}.feed-card h3{font-size:12px;letter-spacing:.1px;margin:7px 0 2px;font-weight:500}.feed-card p{font-size:9px;color:#a2ab98;margin:0}.art:after,.art:before{content:"";position:absolute}
.mountains{background:#dce7dc}.mountains:before{width:150px;height:130px;transform:rotate(45deg);background:#a7bda6;bottom:-79px;left:20px;border-radius:12px}.mountains:after{width:130px;height:120px;transform:rotate(45deg);background:#bdceb4;bottom:-75px;left:103px;border-radius:10px}
.coffee{background:#e9ddcd}.coffee:before{width:62px;height:62px;background:#f6f0e6;border:12px solid #fbf7ee;box-shadow:0 0 0 2px #d8c9b2;border-radius:50%;left:76px;top:21px}.coffee:after{width:33px;height:33px;background:#8a7053;border-radius:50%;left:90px;top:35px}
.room{background:#e6e3d6}.room:before{width:85px;height:60px;background:#c6c4a4;left:66px;bottom:0;border-radius:9px 9px 0 0}.room:after{width:49px;height:63px;left:22px;top:16px;border:5px solid #d0ccb9;background:#f7f5e9}
.sunset{background:#e8d3c2}.sunset:before{width:47px;height:47px;left:90px;top:20px;background:#f3e9bd;border-radius:50%}.sunset:after{width:320px;height:76px;left:-40px;bottom:-44px;background:#b5b8a0;border-radius:50%}
.plant{background:#dfe8d8}.plant:before{width:51px;height:53px;left:83px;bottom:-3px;background:#c3baa2;border-radius:0 0 14px 14px}.plant:after{width:53px;height:38px;left:67px;top:17px;border-radius:2px 100%;background:#96ae81;box-shadow:26px 14px 0 #b1c39c;transform:rotate(31deg)}
.books{background:#e4e3d9}.books:before{width:47px;height:70px;background:#bdc6ae;left:62px;bottom:0;transform:rotate(-8deg);border-radius:3px}.books:after{width:47px;height:85px;background:#cdbda7;left:111px;bottom:-2px;transform:rotate(8deg);border-radius:3px}
.bottom-note{margin-top:15px;color:#bcc4b1;font-size:9px;letter-spacing:1px;text-align:center}
.demo-footer{height:98px;display:flex;justify-content:space-between;align-items:center;padding:0 56px;gap:20px}.demo-footer strong{font-size:14px;font-weight:500}.demo-footer p{margin:4px 0 0;font-size:11px;color:#8b9780}.step{display:flex;align-items:center;gap:11px}.step-index{display:grid;place-items:center;background:#dfe7d5;color:#6b805b;height:35px;width:35px;border-radius:50%;font-size:11px;flex-shrink:0}.steps{display:flex;gap:7px}.steps i{width:23px;height:3px;background:#d6dec9;border-radius:4px}.steps i.active{background:#6f8e5d}
</style></head><body>
<header class="demo-header"><div><div class="eyebrow">QUIETFEED · SEARCH FIRST</div><h1>少一点推荐，<span>多一点主动。</span></h1></div><div class="header-right"><span class="label">结构示例 · 原创合成页面</span><p>实际扩展驱动 · 非真实网站截图</p></div></header>
<main class="browser"><div class="browser-top"><i></i><i></i><i></i><span>视频站首页 · 结构示例</span><b>LOCAL DEMO</b></div>
<nav class="bili-header"><div class="site-brand">视频日常<small>LAYOUT EXAMPLE</small></div><form class="search-box" id="nav-searchform"><input class="nav-search-input" aria-label="搜索内容" placeholder="大家都在搜：今天看点什么"><button type="button">搜索</button></form><div class="nav-side"><span>我的关注</span><span>收藏</span><span>消息</span></div></nav>
<div class="search-panel"><div id="trending"><strong>热搜榜</strong><span>周末去哪儿</span><span>生活里的小美好</span><span>今天也有新发现</span></div></div>
<section class="bili-feed4-layout"><div class="feed2 recommended-container_floor-aside"><div class="recommended-swipe"><small>RECOMMENDED FOR YOU</small><h2>总有新的内容，<br>等你接着看。</h2><p>这里是一块轮播与推荐区域</p></div>${cards.map(([art, title, meta]) => `<article class="feed-card bili-feed-card bili-video-card"><div class="art ${art}"></div><h3>${title}</h3><p>${meta}</p></article>`).join('')}</div><p class="bottom-note">所有文案与图形均为演示而作，不包含真实用户内容。</p></section></main>
<footer class="demo-footer"><div class="step"><span class="step-index" id="phase-number">01</span><div><strong id="phase-title">未启用：推荐占满首页</strong><p id="phase-caption">页面结构示例，接下来由真实静流扩展进行隐藏。</p></div></div><div class="steps"><i class="active"></i><i></i><i></i><i></i></div></footer>
</body></html>`;

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  reducedMotion: 'reduce',
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

const report = {
  capturedAt: new Date().toISOString(),
  browser: null,
  extensionId: null,
  manifestSha256: createHash('sha256')
    .update(await readFile(join(extensionPath, 'manifest.json')))
    .digest('hex'),
  temporaryIsolatedProfile: true,
  productionManifestUnchanged: true,
  permissions:
    'Test-only optional host pregrant through chrome://extensions. Native permission dialog not validated.',
  assets: {},
};

try {
  report.browser = context.browser()?.version() ?? 'Chromium';
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).hostname;
  report.extensionId = id;
  const manager = await context.newPage();
  await manager.goto('chrome://extensions');
  await manager.evaluate(async (extensionId) => {
    await chrome.developerPrivate.addHostPermission(extensionId, 'https://www.bilibili.com/*');
    await chrome.developerPrivate.addHostPermission(extensionId, 'https://www.xiaohongshu.com/*');
  }, id);
  await manager.getByText('静流 QuietFeed', { exact: true }).waitFor();
  await manager.screenshot({ path: join(output, 'install.png'), fullPage: true });
  report.assets['install.png'] =
    'Real chrome://extensions management page showing the production extension in an isolated profile.';

  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.getByRole('switch', { name: '开启B站的静流', exact: true }).waitFor();
  await options.getByRole('switch', { name: '开启B站的静流', exact: true }).click();
  await expect(options.getByRole('switch', { name: '关闭B站的静流', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await options.getByRole('switch', { name: '开启小红书的静流', exact: true }).click();
  await expect(
    options.getByRole('switch', { name: '关闭小红书的静流', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await options.evaluate(() => document.fonts.ready);
  await options.screenshot({
    path: join(output, 'options.png'),
    fullPage: true,
    animations: 'disabled',
  });
  report.assets['options.png'] =
    'Real v0.2 production options.html at 1440px width with five site cards. Bilibili and Xiaohongshu enabled through real UI after isolated test-only host pregrant; new sites disabled, Zhihu explicitly experimental.';

  // A real toolbar popup is preferred. Some headless Chromium builds do not
  // expose it as a page, so capture the unchanged popup document instead.
  const popupPromise = context.waitForEvent('page', { timeout: 2200 }).catch(() => null);
  const popupOpened = await Promise.race([
    worker.evaluate(async () => {
      try {
        await chrome.action.openPopup();
        return true;
      } catch {
        return false;
      }
    }),
    new Promise((resolve) => setTimeout(() => resolve(false), 2200)),
  ]);
  let popup = popupOpened ? await popupPromise : null;
  if (!popup) {
    popup = await context.newPage();
    await popup.setViewportSize({ width: 400, height: 900 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    report.assets['popup.png'] =
      'Real production popup.html opened as a tab, with its actual unsupported-tab welcome state; no mocked browser APIs or tab URL.';
  } else {
    report.assets['popup.png'] =
      'Real toolbar action popup opened by chrome.action.openPopup(); no mocked browser APIs.';
  }
  await popup.locator('.popup-shell').waitFor();
  await popup.locator('.popup-header .brand').waitFor();
  await popup.locator('.welcome-panel, .site-panel').waitFor();
  await popup.evaluate(() => document.fonts.ready);
  await popup
    .locator('.popup-shell')
    .screenshot({ path: join(output, 'popup.png'), animations: 'disabled' });
  await popup.close();

  // Disable using the actual UI before visiting the fixture, giving the first
  // frame a genuine before state. No storage or extension APIs are replaced.
  await options.getByRole('switch', { name: '关闭B站的静流', exact: true }).click();
  await expect(options.getByRole('switch', { name: '开启B站的静流', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await context.route('https://www.bilibili.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }),
  );
  const demo = await context.newPage();
  await demo.setViewportSize({ width: 1280, height: 840 });
  await demo.goto('https://www.bilibili.com/');
  await demo.evaluate(() => document.fonts.ready);
  const frames = [];
  const frame = async ({ number, title, caption, file }) => {
    await demo.evaluate(
      ({ number, title, caption }) => {
        document.getElementById('phase-number').textContent = String(number).padStart(2, '0');
        document.getElementById('phase-title').textContent = title;
        document.getElementById('phase-caption').textContent = caption;
        document
          .querySelectorAll('.steps i')
          .forEach((item, index) => item.classList.toggle('active', index === number - 1));
      },
      { number, title, caption },
    );
    const bytes = await demo.screenshot({ animations: 'disabled' });
    if (file) await writeFile(join(output, file), bytes);
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    frames.push({ data, width: info.width, height: info.height });
  };

  await expect(demo.locator('.feed-card').first()).toBeVisible();
  await frame({
    number: 1,
    title: '未启用：推荐占满首页',
    caption: '接下来通过真实扩展设置启用，页面内容均为原创结构示例。',
    file: 'demo-before.png',
  });
  await options.getByRole('switch', { name: '开启B站的静流', exact: true }).click();
  await expect(demo.locator('.feed-card').first()).toBeHidden();
  await expect(demo.locator('#quietfeed-search-guide')).toBeVisible();
  await frame({
    number: 2,
    title: '开启静流：推荐收起，搜索保留',
    caption: '首页推荐、轮播和默认热搜由真实扩展规则隐藏。',
    file: 'demo-after.png',
  });

  await demo
    .locator('#quietfeed-search-guide')
    .getByRole('button', { name: '去搜索', exact: true })
    .click();
  await expect(demo.locator('.nav-search-input')).toBeFocused();
  await demo.locator('.nav-search-input').fill('如何种好一盆薄荷');
  await frame({
    number: 2,
    title: '带着目的，主动搜索',
    caption: '原页面的输入框仍然可用，用户输入的文字保持可见。',
  });

  const panel = options.getByRole('region', { name: 'B站设置', exact: true });
  await panel.getByRole('button', { name: '放行一下', exact: true }).click();
  await expect(demo.locator('.feed-card').first()).toBeVisible();
  await expect(demo.locator('#quietfeed-search-guide')).toHaveCount(0);
  await frame({
    number: 3,
    title: '想随便逛一会儿？临时放行',
    caption: '通过真实“放行一下”按钮操作，同一网站放行 10 分钟。',
  });

  await panel.getByRole('button', { name: '提前结束', exact: true }).click();
  await expect(demo.locator('.feed-card').first()).toBeHidden();
  await expect(demo.locator('#quietfeed-search-guide')).toBeVisible();
  await expect(demo.locator('.nav-search-input')).toHaveValue('如何种好一盆薄荷');
  await frame({
    number: 4,
    title: '提前结束，回到自己的节奏',
    caption: '原有隐藏设置恢复，已经输入的搜索内容依然保留。',
  });

  const { width, height } = frames[0];
  await sharp(Buffer.concat(frames.map(({ data }) => data)), {
    raw: { width, height: height * frames.length, channels: 4, pageHeight: height },
  })
    .gif({ loop: 0, delay: [2200, 2500, 2200, 2500, 2500], effort: 7, colours: 192, dither: 0.8 })
    .toFile(join(output, 'demo.gif'));
  const metadata = await sharp(join(output, 'demo.gif'), { animated: true }).metadata();
  if (metadata.pages !== frames.length) throw new Error(`GIF frame mismatch: ${metadata.pages}`);
  report.assets['demo.gif'] =
    'Five-frame original synthetic Bilibili structure demonstration, visibly labeled 结构示例. Real production extension/UI performs enable, search focus, temporary allowance, and resume. Not evidence of live-site compatibility or automatic ten-minute expiry.';
  report.assets['demo-before.png'] =
    'Original synthetic structure demonstration before enabling the extension.';
  report.assets['demo-after.png'] =
    'The same synthetic demonstration after enabling the real production extension.';
  report.demo = {
    width,
    height,
    frames: metadata.pages,
    durationMs: 11900,
    sameNodesRestored: true,
  };
  console.log(JSON.stringify(report, null, 2));
  await writeFile(join(output, 'capture-report.json'), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await context.close();
}
