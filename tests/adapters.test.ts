import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adapterForUrl,
  bilibiliAdapter,
  xiaohongshuAdapter,
  type SiteAdapter,
} from '../src/adapters';
import { defaultSiteConfig, SITES, type SiteConfig } from '../src/core/config';
import {
  buildCss,
  GUIDE_ID,
  inspectPage,
  QuietFeedEngine,
  safeSelector,
  STYLE_ID,
} from '../src/content/engine';
import { createPageMessageHandler } from '../src/content/messages';
import { createContentController, retireContentController } from '../src/content/lifecycle';
import { STATUS_MESSAGE } from '../src/core/protocol';

function fixture(name: string): void {
  const html = readFileSync(resolve('tests', 'fixtures', `${name}.html`), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

function active(adapter: SiteAdapter): SiteConfig {
  return { ...defaultSiteConfig(adapter.site), enabled: true };
}

let running: QuietFeedEngine[] = [];
function start(
  adapter: SiteAdapter,
  href: string,
  config = active(adapter),
  getUrl?: () => string,
): QuietFeedEngine {
  const engine = new QuietFeedEngine({
    adapter,
    document,
    window,
    config,
    getUrl: getUrl ?? (() => href),
  });
  running.push(engine);
  return engine;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(() => {
  running.forEach((engine) => engine.destroy());
  running = [];
  vi.useRealTimers();
});

describe('adapter boundaries', () => {
  it('recognizes the observed Simplified Chinese home redirect and exact video routes', () => {
    for (const path of ['/zh-Hans', '/zh-Hans/', '/zh-Hans?spm_id_from=333']) {
      expect(bilibiliAdapter.classify(new URL(`https://www.bilibili.com${path}`))).toMatchObject({
        key: 'home',
        supported: true,
      });
    }
    for (const path of ['/zh-Hans/video/BV1xx411c7mD/', '/zh-Hans/video/av123?p=2']) {
      expect(bilibiliAdapter.classify(new URL(`https://www.bilibili.com${path}`))).toMatchObject({
        key: 'video',
        supported: true,
      });
    }
    for (const path of [
      '/zh-Hant',
      '/en',
      '/zh-Hans/v/popular/all',
      '/zh-Hans/video/example',
      '/zh-Hans/user/example',
    ]) {
      expect(bilibiliAdapter.classify(new URL(`https://www.bilibili.com${path}`)).supported).toBe(
        false,
      );
    }
  });

  it('filters the observed localized homepage cards without hiding its outer layout', () => {
    document.body.innerHTML =
      '<main class="bili-feed4-layout"><div class="feed2"><article class="bili-video-card">推荐</article></div></main>';
    const engine = start(bilibiliAdapter, 'https://www.bilibili.com/zh-Hans');
    expect(engine.getStatus()).toMatchObject({ active: true, supported: true });
    expect(engine.getStatus().modules.find(({ id }) => id === 'homeFeed')).toMatchObject({
      matched: true,
    });
    expect(getComputedStyle(document.querySelector('.bili-video-card')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('.bili-feed4-layout')!).display).not.toBe(
      'none',
    );
  });

  it('requests only the two exact HTTPS www hosts', () => {
    expect(adapterForUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(bilibiliAdapter);
    expect(adapterForUrl('https://www.xiaohongshu.com/explore')).toBe(xiaohongshuAdapter);
    for (const url of [
      'http://www.bilibili.com/',
      'https://search.bilibili.com/',
      'https://space.bilibili.com/123',
      'https://t.bilibili.com/',
      'https://www.bilibili.com.attacker.example/',
      'not a URL',
    ])
      expect(adapterForUrl(url)).toBeNull();
  });

  it('implements every configured module exactly once', () => {
    for (const adapter of [bilibiliAdapter, xiaohongshuAdapter]) {
      expect(adapter.rules.map(({ id }) => id).sort()).toEqual(
        SITES[adapter.site].modules.map(({ id }) => id).sort(),
      );
    }
  });

  it('preserves explicitly requested destinations', () => {
    const samples = [
      '/search_result?keyword=example',
      '/explore/example',
      '/discovery/item/example',
      '/user/profile/example',
      '/notification',
      '/follow',
      '/explore?channel_id=homefeed.follow',
    ];
    samples.forEach((path) =>
      expect(
        xiaohongshuAdapter.classify(new URL(`https://www.xiaohongshu.com${path}`)).supported,
      ).toBe(false),
    );
    ['/v/popular/all', '/bangumi/play/ep1', '/list/123', '/read/cv1'].forEach((path) => {
      expect(bilibiliAdapter.classify(new URL(`https://www.bilibili.com${path}`)).supported).toBe(
        false,
      );
    });
  });

  it('reports verification pages and a missing module without broad fallback', () => {
    document.body.innerHTML = '<div id="risk-captcha-app"><input placeholder="验证码"></div>';
    const captcha = inspectPage(
      document,
      'https://www.bilibili.com/',
      bilibiliAdapter,
      active(bilibiliAdapter),
    );
    expect(captcha.supported).toBe(false);
    expect(captcha.active).toBe(false);
    expect(
      buildCss(
        bilibiliAdapter,
        { key: 'verification', label: '', supported: false },
        active(bilibiliAdapter),
      ),
    ).toBe('');
    document.body.innerHTML = '<main class="new-feed-design">Unknown site version</main>';
    const unknown = inspectPage(
      document,
      'https://www.bilibili.com/',
      bilibiliAdapter,
      active(bilibiliAdapter),
    );
    expect(unknown.modules.find(({ id }) => id === 'homeFeed')).toMatchObject({
      applicable: true,
      matched: false,
    });
    start(bilibiliAdapter, 'https://www.bilibili.com/');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(getComputedStyle(document.querySelector('main')!).display).not.toBe('none');
  });
});

describe('reversible page filtering', () => {
  it('hides homepage cards and promotion independently, preserving login and suggestions', () => {
    fixture('bilibili-home');
    const config = active(bilibiliAdapter);
    const engine = start(bilibiliAdapter, 'https://www.bilibili.com/', config);
    expect(getComputedStyle(document.querySelector('.feed-card')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('.recommended-swipe')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('.trending')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('.suggestions')!).display).not.toBe('none');
    expect(getComputedStyle(document.querySelector('.bili-mini-login')!).display).not.toBe('none');
    config.hiddenModules.promotions = false;
    engine.update(config);
    expect(getComputedStyle(document.querySelector('.recommended-swipe')!).display).not.toBe(
      'none',
    );
    expect(getComputedStyle(document.querySelector('.feed-card')!).display).toBe('none');
    engine.update({ ...config, enabled: false });
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(getComputedStyle(document.querySelector('.feed-card')!).display).not.toBe('none');
    expect(document.querySelectorAll('.feed-card')).toHaveLength(2);
  });

  it('hides related cards but leaves player, selections and comments', () => {
    fixture('bilibili-video');
    const engine = start(bilibiliAdapter, 'https://www.bilibili.com/video/BV1xx411c7mD/');
    expect(getComputedStyle(document.querySelector('.rec-list')!).display).toBe('none');
    for (const selector of [
      '#bilibili-player',
      '#multi_page',
      '.base-video-sections-v1',
      '#comment',
    ]) {
      expect(getComputedStyle(document.querySelector(selector)!).display).not.toBe('none');
    }
    expect(engine.getStatus().modules.find(({ id }) => id === 'homeFeed')).toMatchObject({
      applicable: false,
      matched: false,
    });
    expect(engine.getStatus().modules.find(({ id }) => id === 'related')).toMatchObject({
      applicable: true,
      matched: true,
    });
  });

  it('preserves search, the independent sidebar, and the full discovery container', () => {
    fixture('xiaohongshu-home');
    start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    expect(getComputedStyle(document.getElementById('exploreFeeds')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('.channel-container')!).display).toBe('none');
    expect(getComputedStyle(document.getElementById('mfContainer')!).display).not.toBe('none');
    expect(getComputedStyle(document.querySelector('aside .channel-list')!).display).not.toBe(
      'none',
    );
    expect(getComputedStyle(document.getElementById('search-input')!).display).not.toBe('none');
    expect(getComputedStyle(document.querySelector('.sug-list')!).display).not.toBe('none');
    const style = document.getElementById(STYLE_ID)!.textContent!;
    expect(style).toContain(':not([placeholder*="登录"])');
    expect(document.getElementById('search-input')!.getAttribute('placeholder')).toBe(
      '登录探索更多内容',
    );
  });

  it('does not hide a feed ancestor that contains a live note or login dialog', () => {
    fixture('xiaohongshu-home');
    const feed = document.getElementById('exploreFeeds')!;
    feed.innerHTML +=
      '<div class="note-detail-mask"><div id="noteContainer"><video controls></video><div class="comments">评论</div></div></div>';
    start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    expect(feed.matches(safeSelector('.feeds-page .feeds-container', xiaohongshuAdapter))).toBe(
      false,
    );
    expect(getComputedStyle(feed).display).not.toBe('none');
    expect(getComputedStyle(document.querySelector('.note-detail-mask')!).display).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    const status = inspectPage(
      document,
      'https://www.xiaohongshu.com/explore',
      xiaohongshuAdapter,
      active(xiaohongshuAdapter),
    );
    expect(status.modules.find(({ id }) => id === 'discoveryFeed')).toMatchObject({
      matched: false,
    });
  });

  it('restores a previously hidden feed when a nested overlay appears dynamically', () => {
    fixture('xiaohongshu-home');
    start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    const feed = document.getElementById('exploreFeeds')!;
    expect(getComputedStyle(feed).display).toBe('none');
    feed.innerHTML += '<div class="note-detail-mask"><div id="noteContainer">笔记详情</div></div>';
    // Native :has handles this without waiting for the MutationObserver.
    expect(getComputedStyle(feed).display).not.toBe('none');
  });

  it('updates routes and restores all effects on a search or detail route', () => {
    fixture('xiaohongshu-home');
    let href = 'https://www.xiaohongshu.com/explore';
    const engine = start(xiaohongshuAdapter, href, active(xiaohongshuAdapter), () => href);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    href = 'https://www.xiaohongshu.com/search_result?keyword=example';
    engine.refresh();
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(engine.getStatus()).toMatchObject({ supported: false, active: false });
    href = 'https://www.xiaohongshu.com/explore';
    engine.refresh();
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });

  it('shows a single guide and focuses the original search input', () => {
    fixture('bilibili-home');
    document.querySelector('.bili-mini-login')!.remove();
    const engine = start(bilibiliAdapter, 'https://www.bilibili.com/');
    engine.refresh();
    engine.refresh();
    expect(document.querySelectorAll(`#${GUIDE_ID}`)).toHaveLength(1);
    const guide = document.getElementById(GUIDE_ID)!;
    guide.shadowRoot!.querySelector('button')!.click();
    expect(document.activeElement).toBe(document.querySelector('.nav-search-input'));
    engine.destroy();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});

describe('pause expiry independent of the background worker', () => {
  it('resumes at the absolute cutoff without a storage update', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    fixture('bilibili-home');
    const config = active(bilibiliAdapter);
    config.allowUntil = Date.now() + 600_000;
    const engine = start(bilibiliAdapter, 'https://www.bilibili.com/', config);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    vi.advanceTimersByTime(599_999);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    vi.advanceTimersByTime(26);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    expect(engine.getStatus().active).toBe(true);
  });

  it('rechecks the wall clock on pageshow after sleeping past expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    fixture('xiaohongshu-home');
    const config = active(xiaohongshuAdapter);
    config.allowUntil = Date.now() + 600_000;
    start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore', config);
    vi.setSystemTime(new Date('2026-10-22T12:11:00Z'));
    window.dispatchEvent(new Event('pageshow'));
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });

  it('destroy cancels all pending work and allows a clean new instance', async () => {
    vi.useFakeTimers();
    fixture('xiaohongshu-home');
    const first = start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    first.destroy();
    document.getElementById('exploreFeeds')!.append(document.createElement('section'));
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
  });
});

describe('content message lifecycle', () => {
  it('cleans page effects before invalidated extension listeners and always clears the singleton', () => {
    fixture('xiaohongshu-home');
    const engine = start(xiaohongshuAdapter, 'https://www.xiaohongshu.com/explore');
    const order: string[] = [];
    let singletonPresent = true;
    const controller = createContentController({
      stopPage() {
        order.push('page');
        engine.destroy();
      },
      removeListeners: [
        () => {
          order.push('invalid-storage');
          throw new Error('Extension context invalidated.');
        },
        () => {
          order.push('runtime');
        },
      ],
      clearSingleton() {
        order.push('singleton');
        singletonPresent = false;
      },
    });
    expect(() => controller.destroy()).not.toThrow();
    expect(order).toEqual(['page', 'invalid-storage', 'runtime', 'singleton']);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(singletonPresent).toBe(false);
    controller.destroy();
    expect(order).toHaveLength(4);
  });

  it('starts clean after a throwing legacy destroy or a lost isolated-world singleton', () => {
    fixture('xiaohongshu-home');
    const staleStyle = document.createElement('style');
    staleStyle.id = STYLE_ID;
    staleStyle.textContent = '#exploreFeeds{display:none!important}';
    document.head.append(staleStyle);
    const staleGuide = document.createElement('aside');
    staleGuide.id = GUIDE_ID;
    staleGuide.setAttribute('data-quietfeed-guide', '');
    document.body.append(staleGuide);
    const originalStyle = document.createElement('style');
    originalStyle.id = 'site-style';
    originalStyle.textContent = '#exploreFeeds{display:block}';
    document.head.append(originalStyle);
    const originalAside = document.createElement('aside');
    originalAside.id = 'site-aside';
    document.body.append(originalAside);
    expect(() =>
      retireContentController({
        destroy() {
          throw new Error('Extension context invalidated.');
        },
      }),
    ).not.toThrow();
    const engine = start(
      xiaohongshuAdapter,
      'https://www.xiaohongshu.com/explore',
      defaultSiteConfig('xiaohongshu'),
    );
    expect(staleStyle.isConnected).toBe(false);
    expect(staleGuide.isConnected).toBe(false);
    expect(originalStyle.isConnected).toBe(true);
    expect(originalAside.isConnected).toBe(true);
    expect(getComputedStyle(document.getElementById('exploreFeeds')!).display).toBe('block');
    engine.update(active(xiaohongshuAdapter));
    expect(document.querySelectorAll(`style#${STYLE_ID}`)).toHaveLength(1);
    engine.destroy();
    expect(getComputedStyle(document.getElementById('exploreFeeds')!).display).toBe('block');
  });

  it('ignores cleanup for the other site and messages from another extension', () => {
    const cleanup = vi.fn();
    const respond = vi.fn();
    const onMessage = createPageMessageHandler({
      site: 'bilibili',
      runtimeId: 'our-extension',
      refresh: vi.fn(),
      getStatus: () =>
        inspectPage(
          document,
          'https://www.bilibili.com/',
          bilibiliAdapter,
          active(bilibiliAdapter),
        ),
      cleanup,
    });
    onMessage({ type: 'quietfeed:cleanup', site: 'xiaohongshu' }, { id: 'our-extension' }, respond);
    onMessage({ type: 'quietfeed:cleanup', site: 'bilibili' }, { id: 'other-extension' }, respond);
    onMessage({ type: 'quietfeed:cleanup' }, { id: 'our-extension' }, respond);
    expect(cleanup).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
    onMessage({ type: 'quietfeed:cleanup', site: 'bilibili' }, { id: 'our-extension' }, respond);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledWith({ ok: true });
  });

  it('refreshes the current route before answering a status request', () => {
    const order: string[] = [];
    const respond = vi.fn();
    const onMessage = createPageMessageHandler({
      site: 'bilibili',
      runtimeId: 'our-extension',
      cleanup: vi.fn(),
      refresh: () => {
        order.push('refresh');
      },
      getStatus: () => {
        order.push('status');
        return inspectPage(
          document,
          'https://www.bilibili.com/',
          bilibiliAdapter,
          active(bilibiliAdapter),
        );
      },
    });
    onMessage({ type: STATUS_MESSAGE }, { id: 'our-extension' }, respond);
    expect(order).toEqual(['refresh', 'status']);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ site: 'bilibili', supported: true }),
    );
  });
});
