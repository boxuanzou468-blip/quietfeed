import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { csdnAdapter } from '../src/adapters/csdn';
import type { SiteConfig } from '../src/core/config';
import { GUIDE_ID, QuietFeedEngine, STYLE_ID } from '../src/content/engine';

let engines: QuietFeedEngine[] = [];
const config = (): SiteConfig => ({
  enabled: true,
  mode: 'search',
  allowUntil: null,
  hiddenModules: { homeFeed: true, sidebarRecommendations: true },
});
function fixture(name = 'home'): void {
  document.open();
  document.write(readFileSync(resolve('tests/fixtures', `csdn-${name}.html`), 'utf8'));
  document.close();
}
function start(href = 'https://www.csdn.net/', current = config(), getUrl = () => href) {
  const engine = new QuietFeedEngine({
    adapter: csdnAdapter,
    document,
    window,
    config: current,
    getUrl,
  });
  engines.push(engine);
  return engine;
}
function hidden(selector: string): boolean {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing fixture node: ${selector}`);
  return getComputedStyle(node).display === 'none';
}

beforeEach(() => fixture());
afterEach(() => {
  engines.forEach((engine) => engine.destroy());
  engines = [];
  vi.useRealTimers();
});

describe('CSDN verified homepage boundaries', () => {
  it('focuses the explicitly named native search inside the protected toolbar', () => {
    start();
    const input = document.querySelector<HTMLInputElement>('#toolbar-search-input')!;
    document
      .getElementById(GUIDE_ID)!
      .shadowRoot!.querySelector<HTMLButtonElement>('button')!
      .click();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('用户输入');
  });

  it('does not focus an inert search control', () => {
    document.getElementById('csdn-toolbar')!.setAttribute('inert', '');
    start();
    document
      .getElementById(GUIDE_ID)!
      .shadowRoot!.querySelector<HTMLButtonElement>('button')!
      .click();
    expect(document.activeElement).not.toBe(document.getElementById('toolbar-search-input'));
  });
  it('only supports the exact HTTPS www homepage', () => {
    for (const href of ['https://www.csdn.net/', 'https://www.csdn.net/?spm=example']) {
      expect(csdnAdapter.classify(new URL(href)).supported).toBe(true);
    }
    for (const href of [
      'http://www.csdn.net/',
      'https://www.csdn.net/?q=typescript',
      'https://www.csdn.net/?keyword=typescript',
      'https://www.csdn.net/nav/python',
      'https://www.csdn.net/article/2026-10-21/example',
      'https://www.csdn.net/follow',
      'https://www.csdn.net/login',
      'https://so.csdn.net/so/search?q=typescript',
      'https://blog.csdn.net/example/article/details/123456789',
      'https://blog.csdn.net/example',
      'https://www.csdn.net.attacker.example/',
    ]) {
      expect(csdnAdapter.classify(new URL(href)).supported).toBe(false);
    }
  });

  it('hides only named homepage modules and keeps search, login and personal navigation', () => {
    const engine = start();
    expect(engine.getStatus().modules.every(({ matched }) => matched)).toBe(true);
    for (const selector of [
      '.home-info-headlines',
      '.home-info > .home-cont-title',
      '.home-info-banner a#banner-box',
      '.home-project',
      '.home-article',
      '.ContentBlock',
      '.broadcast',
      '.member',
    ]) {
      expect(hidden(selector)).toBe(true);
    }
    for (const selector of [
      '#home-content-box',
      '#home_box_right',
      '.calendar',
      '#csdn-toolbar',
      '#toolbar-search-input',
      '#csdn-toolbar-profile-nologin',
      '.layout-sidebar-aside',
      '.home-info',
      '#kp_box_www_swiper',
      '#kp_box_987',
      '[data-fixture-ad]',
      'iframe',
    ]) {
      expect(hidden(selector)).toBe(false);
    }
    expect(document.getElementById(GUIDE_ID)?.parentElement?.id).toBe('home-content-box');
    expect(document.querySelector<HTMLInputElement>('#toolbar-search-input')?.value).toBe(
      '用户输入',
    );
  });

  it('restores either module independently, and disabling removes every owned effect', () => {
    const current = config();
    const engine = start('https://www.csdn.net/', current);
    const original = document.querySelector('.home-article');
    engine.update({ ...current, hiddenModules: { homeFeed: true, sidebarRecommendations: false } });
    expect(hidden('.ContentBlock')).toBe(false);
    expect(hidden('.home-article')).toBe(true);
    engine.update({ ...current, hiddenModules: { homeFeed: false, sidebarRecommendations: true } });
    expect(hidden('.ContentBlock')).toBe(true);
    expect(hidden('.home-article')).toBe(false);
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    engine.update({ ...current, enabled: false });
    expect(hidden('.ContentBlock')).toBe(false);
    expect(hidden('.home-article')).toBe(false);
    expect(document.querySelector('.home-article')).toBe(original);
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it('preserves article text, code, author, table of contents and comments on unverified routes', () => {
    fixture('article');
    const engine = start('https://blog.csdn.net/example/article/details/123456789');
    expect(engine.getStatus().active).toBe(false);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    for (const selector of [
      '#article_content',
      '#content_views',
      'pre',
      'code',
      '#asideProfile',
      '#asidedirectory',
      '#pcCommentBox',
      '.recommend-box',
      '.home-article',
    ]) {
      expect(hidden(selector)).toBe(false);
    }
  });

  it('removes homepage rules when navigating to a search or other route', () => {
    let href = 'https://www.csdn.net/';
    const engine = start(href, config(), () => href);
    expect(hidden('.home-info-headlines')).toBe(true);
    href = 'https://www.csdn.net/?q=typescript';
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(engine.getStatus().supported).toBe(false);
    expect(hidden('.home-info-headlines')).toBe(false);
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    href = 'https://www.csdn.net/';
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(hidden('.home-info-headlines')).toBe(true);
  });

  it('covers late homepage modules without deleting them', async () => {
    document.querySelector('.home-article')?.remove();
    start();
    const late = document.createElement('div');
    late.className = 'home-article';
    late.textContent = '动态加载的精选博客';
    document.getElementById('home-content-box')!.append(late);
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(late.isConnected).toBe(true);
    expect(hidden('.home-article')).toBe(true);
  });

  it('fails open for unknown designs and for matched containers containing protected content', () => {
    document.body.innerHTML = '<div class="unknown-home-feed">新版未知推荐结构</div>';
    const engine = start();
    expect(engine.getStatus().modules.every(({ matched }) => !matched)).toBe(true);
    expect(hidden('.unknown-home-feed')).toBe(false);
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    document.body.innerHTML =
      '<div id="home-content-box"><div class="home-article"><div role="dialog">登录弹窗</div></div><div class="home-project"><pre><code>保留代码</code></pre></div></div>';
    engine.refresh();
    expect(hidden('.home-article')).toBe(false);
    expect(hidden('.home-project')).toBe(false);
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });
});
