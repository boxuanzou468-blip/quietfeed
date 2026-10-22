import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zhihuAdapter } from '../src/adapters/zhihu';
import type { SiteConfig } from '../src/core/config';
import { GUIDE_ID, QuietFeedEngine, STYLE_ID } from '../src/content/engine';

function fixture(name: string): void {
  document.open();
  document.write(readFileSync(resolve('tests', 'fixtures', `zhihu-${name}.html`), 'utf8'));
  document.close();
}

function active(): SiteConfig {
  return {
    enabled: true,
    mode: 'search',
    hiddenModules: { homeFeed: true, related: true },
    allowUntil: null,
  };
}

const running: QuietFeedEngine[] = [];
function start(href = 'https://www.zhihu.com/', config = active(), getUrl?: () => string) {
  const engine = new QuietFeedEngine({
    adapter: zhihuAdapter,
    document,
    window,
    config,
    getUrl: getUrl ?? (() => href),
  });
  running.push(engine);
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
  running.forEach((engine) => engine.destroy());
  running.length = 0;
});

describe('experimental Zhihu boundaries', () => {
  it('limits filtering to the homepage and exact question/answer routes', () => {
    for (const path of ['/', '/?utm_id=0', '/question/123', '/question/123/answer/456/']) {
      expect(zhihuAdapter.classify(new URL(`https://www.zhihu.com${path}`)).supported).toBe(true);
    }
    for (const path of [
      '/follow',
      '/hot',
      '/search?type=content&q=example',
      '/people/example',
      '/collections',
      '/collection/123',
      '/notifications',
      '/inbox',
      '/signin?next=%2F',
      '/signup',
      '/account/unhuman',
      '/question/example',
      '/question/123/log',
      '/question/123/answer/456/edit',
      '/?tab=follow',
      '/?feed=hot',
      '/?channel=follow',
    ]) {
      expect(zhihuAdapter.classify(new URL(`https://www.zhihu.com${path}`)).supported).toBe(false);
    }
  });

  it('hides only recommendation cards and restores the original nodes when disabled', () => {
    fixture('home');
    const cards = [...document.querySelectorAll('.TopstoryItem')];
    const engine = start();
    expect(display('.TopstoryItem')).toBe('none');
    for (const selector of [
      '.Topstory-recommend',
      '.Topstory-tabs',
      '.SearchBar-input',
      '.SearchBar-menu',
      '.creator-entry',
    ])
      expect(display(selector)).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).not.toBeNull();
    engine.update({ ...active(), enabled: false });
    expect(display('.TopstoryItem')).not.toBe('none');
    expect([...document.querySelectorAll('.TopstoryItem')]).toEqual(cards);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });

  it('preserves original search focus, typed content and input suggestions', () => {
    fixture('home');
    const input = document.querySelector<HTMLInputElement>('.SearchBar-input')!;
    input.value = '自己输入的搜索内容';
    start();
    document.getElementById(GUIDE_ID)!.shadowRoot!.querySelector('button')!.click();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('自己输入的搜索内容');
    expect(display('.SearchBar-menu')).not.toBe('none');
  });

  it('hides named related modules while preserving question, answers, comments and other sidebar cards', () => {
    fixture('question');
    const engine = start('https://www.zhihu.com/question/123/answer/456');
    expect(display('.RelatedQuestions')).toBe('none');
    expect(display('.QuestionRelatedTopic')).toBe('none');
    for (const selector of [
      '.QuestionHeader',
      '.QuestionRichText',
      '.AnswerItem',
      '.RichContent',
      '.CommentsV2',
      '.CommentEditorV2',
      '.question-stats',
      '.creator-entry',
    ])
      expect(display(selector)).not.toBe('none');
    const config = active();
    config.hiddenModules.related = false;
    engine.update(config);
    expect(display('.RelatedQuestions')).not.toBe('none');
    expect(engine.getStatus().modules.find(({ id }) => id === 'homeFeed')?.applicable).toBe(false);
  });

  it('preserves follow/search routes even when they contain recommendation-like classes', () => {
    fixture('home');
    let href = 'https://www.zhihu.com/';
    const engine = start(href, active(), () => href);
    expect(display('.TopstoryItem')).toBe('none');
    for (const path of ['/follow', '/search?q=example', '/signin?next=%2F']) {
      href = `https://www.zhihu.com${path}`;
      engine.refresh();
      expect(display('.TopstoryItem')).not.toBe('none');
      expect(document.getElementById(STYLE_ID)).toBeNull();
      expect(engine.getStatus()).toMatchObject({ supported: false, active: false });
    }
  });

  it('protects follow results, search results, login, verification and dialogs inside a recommendation card', () => {
    fixture('preserve');
    start();
    expect(display('.ordinary')).toBe('none');
    for (const selector of [
      '.followed',
      '.search-result',
      '.login-card',
      '.captcha-card',
      '.SignFlow',
      '.Captcha',
      '.Modal-wrapper',
    ])
      expect(display(selector)).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
  });

  it('leaves unknown recommendation layouts visible and reports a missing module', () => {
    document.body.innerHTML =
      '<main class="Topstory-mainColumn"><article class="NewRecommendationDesign">未知推荐结构</article></main>';
    const engine = start();
    expect(display('.NewRecommendationDesign')).not.toBe('none');
    expect(document.getElementById(GUIDE_ID)).toBeNull();
    expect(engine.getStatus().modules.find(({ id }) => id === 'homeFeed')).toMatchObject({
      applicable: true,
      matched: false,
    });
  });

  it('keeps columns on their separate origin untouched', () => {
    fixture('question');
    const engine = start('https://zhuanlan.zhihu.com/p/123');
    expect(engine.getStatus()).toMatchObject({ supported: false, active: false });
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(display('.RelatedQuestions')).not.toBe('none');
  });

  it('restores during temporary allowance and hides newly inserted cards when resumed', () => {
    fixture('home');
    const engine = start();
    engine.update({ ...active(), allowUntil: Date.now() + 600_000 });
    expect(display('.TopstoryItem')).not.toBe('none');
    engine.update(active());
    const item = document.createElement('article');
    item.className = 'TopstoryItem newly-loaded';
    document.querySelector('.Topstory-recommend')!.append(item);
    expect(display('.newly-loaded')).toBe('none');
    engine.destroy();
    expect(display('.newly-loaded')).not.toBe('none');
  });
});
