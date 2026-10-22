import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { baiduAdapter } from '../src/adapters/baidu';
import type { SiteConfig } from '../src/core/config';
import { GUIDE_ID, QuietFeedEngine, STYLE_ID } from '../src/content/engine';

const active = (): SiteConfig => ({
  enabled: true,
  mode: 'search',
  hiddenModules: { homeHotSearch: true },
  allowUntil: null,
});

const engines: QuietFeedEngine[] = [];

function fixture(name: 'home' | 'search'): void {
  document.open();
  document.write(readFileSync(resolve('tests/fixtures', `baidu-${name}.html`), 'utf8'));
  document.close();
}

function start(href = 'https://www.baidu.com/', getUrl?: () => string): QuietFeedEngine {
  const engine = new QuietFeedEngine({
    adapter: baiduAdapter,
    document,
    window,
    config: active(),
    getUrl: getUrl ?? (() => href),
  });
  engines.push(engine);
  return engine;
}

function display(selector: string): string {
  return getComputedStyle(document.querySelector(selector)!).display;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(() => {
  engines.splice(0).forEach((engine) => engine.destroy());
});

describe('Baidu homepage boundaries', () => {
  it('adapts only the observed home route', () => {
    expect(baiduAdapter.classify(new URL('https://www.baidu.com/')).supported).toBe(true);
    for (const path of ['/s?wd=TypeScript', '/login', '/passport', '/imgsearch', '/unknown']) {
      expect(baiduAdapter.classify(new URL(`https://www.baidu.com${path}`)).supported).toBe(false);
    }
  });

  it('hides the home hot list and title, preserving native search and typed suggestions', () => {
    fixture('home');
    const engine = start();
    expect(display('#hotsearch-content-wrapper')).toBe('none');
    expect(display('.s-hotsearch-title')).toBe('none');
    for (const selector of ['#chat-textarea', '.bdsug', '.login-entry', '#s-hotsearch-wrapper']) {
      expect(display(selector)).not.toBe('none');
    }
    // The observed legacy search form is natively hidden, not removed by us.
    expect(display('#form')).toBe('none');
    expect(engine.getStatus().modules).toEqual([
      { id: 'homeHotSearch', applicable: true, matched: true },
    ]);
    const guide = document.getElementById(GUIDE_ID)!;
    expect(guide.parentElement?.id).toBe('s-hotsearch-wrapper');
    const input = document.querySelector<HTMLTextAreaElement>('#chat-textarea')!;
    input.value = 'TypeScript';
    guide.shadowRoot!.querySelector('button')!.click();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('TypeScript');
    expect(input.placeholder).toBe('合成默认热词');
  });

  it('retains focus support for the older input-only home layout', () => {
    fixture('home');
    document.querySelector('.chat-input-wrapper')!.remove();
    document.querySelector<HTMLElement>('#form')!.style.removeProperty('display');
    start();
    document.getElementById(GUIDE_ID)!.shadowRoot!.querySelector('button')!.click();
    expect(document.activeElement?.id).toBe('kw');
  });

  it('fully restores modules and removes its guide when switched off', () => {
    fixture('home');
    const engine = start();
    const hotList = document.getElementById('hotsearch-content-wrapper');
    engine.update({ ...active(), enabled: false });
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    expect(display('.s-hotsearch-title')).not.toBe('none');
    expect(document.getElementById('hotsearch-content-wrapper')).toBe(hotList);
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it('restores a single module independently', () => {
    fixture('home');
    const engine = start();
    engine.update({ ...active(), mode: 'custom', hiddenModules: { homeHotSearch: false } });
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });

  it('does not hide login or verification nested inside a known hot-list target', () => {
    fixture('home');
    document.getElementById('hotsearch-content-wrapper')!.innerHTML +=
      '<li><div id="TANGRAM__PSP_1__"><input aria-label="验证码"></div></li>';
    start();
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    expect(display('#TANGRAM__PSP_1__')).not.toBe('none');
  });

  it('keeps an unexpected search form inside a hot-list target visible', () => {
    fixture('home');
    document.getElementById('hotsearch-content-wrapper')!.innerHTML +=
      '<li><form class="unexpected-search"><input name="wd"></form></li>';
    start();
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    expect(display('.unexpected-search')).not.toBe('none');
  });

  it('keeps search results, sidebars, forms and login dialogs intact', () => {
    fixture('search');
    const engine = start('https://www.baidu.com/s?wd=TypeScript');
    expect(engine.getStatus()).toMatchObject({ supported: false, active: false });
    for (const selector of [
      '#content_left',
      '.result',
      '#content_right',
      '#form',
      '#kw',
      '[role="dialog"]',
      '#hotsearch-content-wrapper',
    ]) {
      expect(display(selector)).not.toBe('none');
    }
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });

  it('restores home effects immediately on a result route transition', () => {
    fixture('home');
    let href = 'https://www.baidu.com/';
    const engine = start(href, () => href);
    href = 'https://www.baidu.com/s?wd=TypeScript';
    engine.refresh();
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    href = 'https://www.baidu.com/';
    engine.refresh();
    expect(display('#hotsearch-content-wrapper')).toBe('none');
  });

  it('does not invent a replacement selector when the module is absent', () => {
    document.body.innerHTML = '<form id="form"><input id="kw"></form><main>新版本页面</main>';
    const engine = start();
    expect(engine.getStatus().modules[0]).toMatchObject({ applicable: true, matched: false });
    expect(display('main')).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });

  it('keeps another host and an explicit verification page unchanged', () => {
    fixture('home');
    const outside = start('https://wappass.baidu.com/static/captcha/tuxing_v2.html');
    expect(outside.getStatus().supported).toBe(false);
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
    outside.destroy();
    document.body.innerHTML += '<div class="captcha-container"><input aria-label="验证码"></div>';
    const verification = start();
    expect(verification.getStatus()).toMatchObject({ supported: false, active: false });
    expect(display('.captcha-container')).not.toBe('none');
    expect(display('#hotsearch-content-wrapper')).not.toBe('none');
  });
});
