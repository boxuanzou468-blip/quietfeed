import { describe, expect, it } from 'vitest';
import {
  CONFIG_VERSION,
  PAUSE_MS,
  SITE_IDS,
  SITES,
  defaultConfig,
  defaultSiteConfig,
  effectiveState,
  isSiteId,
  normalizeConfig,
  remainingSeconds,
  siteFromUrl,
} from '../src/core/config';

const NOW = 1_800_000_000_000;

describe('private-by-default configuration', () => {
  it('leaves every site disabled without an active allowance', () => {
    const config = defaultConfig();
    expect(config.version).toBe(CONFIG_VERSION);
    for (const site of SITE_IDS) {
      expect(config.sites[site]).toMatchObject({
        enabled: false,
        mode: 'search',
        allowUntil: null,
      });
      expect(config.sites[site].hiddenModules).toEqual(
        Object.fromEntries(SITES[site].modules.map(({ id }) => [id, true])),
      );
    }
  });

  it('does not share mutable defaults between calls or sites', () => {
    const first = defaultConfig();
    first.sites.bilibili.enabled = true;
    first.sites.bilibili.hiddenModules.searchHotWords = false;
    expect(defaultConfig().sites.bilibili.enabled).toBe(false);
    expect(defaultConfig().sites.bilibili.hiddenModules.searchHotWords).toBe(true);
    expect(first.sites.xiaohongshu.hiddenModules.searchHotWords).toBe(true);
  });
});

describe('configuration normalization', () => {
  it('adds disabled sites to an old two-site config while preserving selections and absolute deadlines', () => {
    const legacy = {
      version: 1,
      sites: {
        bilibili: {
          enabled: true,
          mode: 'custom',
          hiddenModules: { related: false },
          allowUntil: NOW + 123_000,
        },
        xiaohongshu: { enabled: true, hiddenModules: { discoveryTopics: false } },
      },
    };
    const result = normalizeConfig(legacy, NOW);
    expect(result.sites.bilibili).toMatchObject(legacy.sites.bilibili);
    expect(result.sites.xiaohongshu).toMatchObject(legacy.sites.xiaohongshu);
    for (const site of ['baidu', 'csdn', 'zhihu'] as const) {
      expect(result.sites[site]).toEqual(defaultSiteConfig(site));
    }
  });
  it.each([undefined, null, [], 'invalid', 123])('recovers malformed input %j safely', (input) => {
    expect(normalizeConfig(input, NOW)).toEqual(defaultConfig());
  });

  it('accepts explicit booleans and discards unknown modules without mutating input', () => {
    const input = {
      version: 1,
      sites: {
        bilibili: {
          enabled: true,
          mode: 'custom',
          hiddenModules: {
            homeFeed: false,
            related: false,
            searchHotWords: 'false',
            unknown: true,
          },
          allowUntil: NOW + PAUSE_MS,
        },
      },
    };
    const original = structuredClone(input);
    const result = normalizeConfig(input, NOW);
    expect(result.sites.bilibili).toMatchObject({
      enabled: true,
      mode: 'custom',
      hiddenModules: { homeFeed: false, related: false, searchHotWords: true },
      allowUntil: NOW + PAUSE_MS,
    });
    expect(result.sites.bilibili.hiddenModules).not.toHaveProperty('unknown');
    expect(result.sites.xiaohongshu).toEqual(defaultSiteConfig('xiaohongshu'));
    result.sites.bilibili.hiddenModules.homeFeed = true;
    expect(input).toEqual(original);
  });

  it('does not enable a site from truthy strings or accept an unknown mode', () => {
    const result = normalizeConfig(
      {
        sites: {
          bilibili: { enabled: 'true', mode: 'anything', hiddenModules: [] },
          xiaohongshu: { enabled: 1, hiddenModules: null },
        },
      },
      NOW,
    );
    expect(result).toEqual(defaultConfig());
  });

  it('preserves independent selections and timers for each site', () => {
    const result = normalizeConfig(
      {
        sites: {
          bilibili: {
            enabled: true,
            hiddenModules: { searchHotWords: false },
            allowUntil: NOW + 5000,
          },
          xiaohongshu: { enabled: false, mode: 'custom', hiddenModules: { searchHotWords: true } },
        },
      },
      NOW,
    );
    expect(result.sites.bilibili.enabled).toBe(true);
    expect(result.sites.bilibili.hiddenModules.searchHotWords).toBe(false);
    expect(result.sites.bilibili.allowUntil).toBe(NOW + 5000);
    expect(result.sites.xiaohongshu).toMatchObject({
      enabled: false,
      mode: 'custom',
      hiddenModules: { searchHotWords: true },
      allowUntil: null,
    });
  });

  it.each([NOW - 1, NOW, Number.NaN, Number.POSITIVE_INFINITY, 'later', null])(
    'clears an expired or invalid allowance %j',
    (allowUntil) => {
      const result = normalizeConfig({ sites: { bilibili: { enabled: true, allowUntil } } }, NOW);
      expect(result.sites.bilibili.allowUntil).toBeNull();
      expect(effectiveState(result.sites.bilibili, NOW)).toBe('active');
    },
  );

  it('rejects a future version without changing the original configuration', () => {
    const input = { version: CONFIG_VERSION + 1, sites: { bilibili: { enabled: true } } };
    const original = structuredClone(input);
    expect(() => normalizeConfig(input, NOW)).toThrow('原有设置未被覆盖');
    expect(input).toEqual(original);
  });
});

describe('temporary allowance state', () => {
  it('uses a ten-minute allowance duration', () => {
    expect(PAUSE_MS).toBe(600_000);
  });

  it('lets disabled status take precedence over a future allowance', () => {
    const config = { ...defaultSiteConfig('bilibili'), allowUntil: NOW + PAUSE_MS };
    expect(effectiveState(config, NOW)).toBe('disabled');
    expect(remainingSeconds(config, NOW)).toBe(0);
  });

  it('uses the absolute deadline and expires exactly at that deadline', () => {
    const config = { ...defaultSiteConfig('bilibili'), enabled: true, allowUntil: NOW + PAUSE_MS };
    expect(effectiveState(config, NOW)).toBe('paused');
    expect(remainingSeconds(config, NOW)).toBe(600);
    expect(remainingSeconds(config, NOW + 1500)).toBe(599);
    expect(remainingSeconds(config, NOW + PAUSE_MS - 1)).toBe(1);
    expect(effectiveState(config, NOW + PAUSE_MS)).toBe('active');
    expect(remainingSeconds(config, NOW + PAUSE_MS)).toBe(0);
    expect(remainingSeconds(config, NOW + PAUSE_MS + 1000)).toBe(0);
  });

  it('does not invent a countdown when no allowance is set', () => {
    const config = { ...defaultSiteConfig('xiaohongshu'), enabled: true };
    expect(effectiveState(config, NOW)).toBe('active');
    expect(remainingSeconds(config, NOW)).toBe(0);
  });
});

describe('exact site identity', () => {
  it.each([
    'https://www.bilibili.com/',
    'https://search.bilibili.com/all?keyword=test',
    'https://space.bilibili.com/123',
    'https://t.bilibili.com/',
  ])('recognizes the supported Bilibili hostname in %s', (url) => {
    expect(siteFromUrl(url)).toBe('bilibili');
  });

  it('recognizes Xiaohongshu and normalizes hostname casing', () => {
    expect(siteFromUrl('https://www.xiaohongshu.com/explore')).toBe('xiaohongshu');
    expect(siteFromUrl('https://WWW.BILIBILI.COM/video/example')).toBe('bilibili');
  });

  it.each([
    undefined,
    '',
    'not a url',
    'http://www.bilibili.com/',
    'ftp://www.xiaohongshu.com/',
    'https://bilibili.com/',
    'https://m.bilibili.com/',
    'https://m.xiaohongshu.com/',
    'https://www.bilibili.com.evil.example/',
    'https://www.xiaohongshu.com.evil.example/',
    'https://www.bilibili.com@evil.example/',
    'https://evil.example/?next=https://www.xiaohongshu.com/',
  ])('rejects unsupported or deceptive URL %s', (url) => {
    expect(siteFromUrl(url)).toBeNull();
  });

  it.each(SITE_IDS)('accepts the configured site identifier %s', (site) => {
    expect(isSiteId(site)).toBe(true);
  });

  it.each([
    ['https://www.baidu.com/', 'baidu'],
    ['https://www.baidu.com/s?wd=example', 'baidu'],
    ['https://www.csdn.net/', 'csdn'],
    ['https://www.zhihu.com/question/123', 'zhihu'],
  ])('recognizes exact supported new hostname %s', (url, site) => {
    expect(siteFromUrl(url)).toBe(site);
  });

  it.each([
    'https://www.baidu.com.evil.example/',
    'https://www.csdn.net@evil.example/',
    'https://zhuanlan.zhihu.com/p/123',
    'https://blog.csdn.net/example/article/details/123',
    'https://m.baidu.com/',
    'http://www.zhihu.com/',
    'https://wappass.baidu.com/',
  ])('does not expand new host access to unsupported pages or hosts %s', (url) => {
    expect(siteFromUrl(url)).toBeNull();
  });

  it.each(['BILIBILI', 'bilibili.com', 'unknown', '', null, undefined, 1, {}])(
    'rejects invalid site identifier %j',
    (site) => {
      expect(isSiteId(site)).toBe(false);
    },
  );
});
