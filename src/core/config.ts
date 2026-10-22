export const SITE_IDS = ['bilibili', 'xiaohongshu', 'baidu', 'csdn', 'zhihu'] as const;
export type SiteId = (typeof SITE_IDS)[number];
export type Mode = 'search' | 'custom';

export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
}

export interface SiteDefinition {
  id: SiteId;
  name: string;
  shortName: string;
  domain: string;
  origins: string[];
  homeUrl: string;
  description: string;
  experimentalNote?: string;
  modules: ModuleDefinition[];
}

export const SITES: Record<SiteId, SiteDefinition> = {
  bilibili: {
    id: 'bilibili',
    name: '哔哩哔哩',
    shortName: 'B站',
    domain: 'www.bilibili.com',
    origins: ['https://www.bilibili.com/*'],
    homeUrl: 'https://www.bilibili.com/',
    description: '想看的，自己搜。',
    modules: [
      { id: 'homeFeed', label: '首页推荐', description: '隐藏首页自动推荐的视频列表' },
      { id: 'promotions', label: '轮播与推广', description: '隐藏首页轮播、横幅与推广区域' },
      {
        id: 'trending',
        label: '热门与排行入口',
        description: '收起主动浏览之外的热门、排行榜入口',
      },
      {
        id: 'searchHotWords',
        label: '默认热搜',
        description: '隐藏搜索热榜，保留输入后的联想建议',
      },
      {
        id: 'related',
        label: '播放页相关推荐',
        description: '保留播放器、选集和评论，收起相关推荐',
      },
    ],
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    shortName: '小红书',
    domain: 'www.xiaohongshu.com',
    origins: ['https://www.xiaohongshu.com/*'],
    homeUrl: 'https://www.xiaohongshu.com/explore',
    description: '带着问题来，带着答案走。',
    modules: [
      {
        id: 'discoveryFeed',
        label: '发现页推荐',
        description: '隐藏发现页推荐流，保留搜索与笔记详情',
      },
      { id: 'discoveryTopics', label: '分类推荐导航', description: '收起发现页的分类推荐标签' },
      { id: 'searchHotWords', label: '默认热搜', description: '隐藏默认热词，保留正常搜索联想' },
    ],
  },
  baidu: {
    id: 'baidu',
    name: '百度',
    shortName: '百度',
    domain: 'www.baidu.com',
    origins: ['https://www.baidu.com/*'],
    homeUrl: 'https://www.baidu.com/',
    description: '直接搜索，少看热榜。',
    modules: [
      {
        id: 'homeHotSearch',
        label: '首页热搜',
        description: '收起首页热搜标题和榜单，保留搜索框与搜索结果',
      },
    ],
  },
  csdn: {
    id: 'csdn',
    name: 'CSDN',
    shortName: 'CSDN',
    domain: 'www.csdn.net',
    origins: ['https://www.csdn.net/*'],
    homeUrl: 'https://www.csdn.net/',
    description: '带着技术问题来，主动找内容。',
    modules: [
      {
        id: 'homeFeed',
        label: '首页内容推荐',
        description: '收起资讯、开源项目和精选博客推荐，保留搜索和左侧导航',
      },
      {
        id: 'sidebarRecommendations',
        label: '首页侧栏推荐',
        description: '收起社区、直播和课程推荐，保留活动日历和其他内容',
      },
    ],
  },
  zhihu: {
    id: 'zhihu',
    name: '知乎',
    shortName: '知乎',
    domain: 'www.zhihu.com',
    origins: ['https://www.zhihu.com/*'],
    homeUrl: 'https://www.zhihu.com/',
    description: '问题由你来提，内容由你来选。',
    experimentalNote: '试验适配 · 推荐区和问题页待登录实测。登录页、关注页和搜索保留原样。',
    modules: [
      { id: 'homeFeed', label: '首页推荐', description: '仅收起首页推荐流，保留关注、搜索和登录' },
      {
        id: 'related',
        label: '问题相关推荐',
        description: '仅收起问题页的相关推荐，保留问题正文与回答',
      },
    ],
  },
};

export const CONFIG_KEY = 'quietfeed:config';
export const CONFIG_VERSION = 1;
export const PAUSE_MS = 10 * 60 * 1000;

export interface SiteConfig {
  enabled: boolean;
  mode: Mode;
  hiddenModules: Record<string, boolean>;
  allowUntil: number | null;
}

export interface AppConfig {
  version: 1;
  sites: Record<SiteId, SiteConfig>;
}

export function defaultSiteConfig(site: SiteId): SiteConfig {
  return {
    enabled: false,
    mode: 'search',
    hiddenModules: Object.fromEntries(SITES[site].modules.map(({ id }) => [id, true])),
    allowUntil: null,
  };
}

export function defaultConfig(): AppConfig {
  return {
    version: CONFIG_VERSION,
    sites: Object.fromEntries(SITE_IDS.map((site) => [site, defaultSiteConfig(site)])) as Record<
      SiteId,
      SiteConfig
    >,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeConfig(value: unknown, now = Date.now()): AppConfig {
  const raw = record(value);
  if (typeof raw.version === 'number' && raw.version > CONFIG_VERSION) {
    throw new Error('配置来自较新版本，请升级静流后再使用。原有设置未被覆盖。');
  }
  const result = defaultConfig();
  for (const site of SITE_IDS) {
    const current = record(record(raw.sites)[site]);
    const modules = record(current.hiddenModules);
    result.sites[site] = {
      enabled: current.enabled === true,
      mode: current.mode === 'custom' ? 'custom' : 'search',
      hiddenModules: Object.fromEntries(
        SITES[site].modules.map(({ id }) => [
          id,
          typeof modules[id] === 'boolean' ? modules[id] : true,
        ]),
      ),
      allowUntil:
        typeof current.allowUntil === 'number' &&
        Number.isFinite(current.allowUntil) &&
        current.allowUntil > now
          ? current.allowUntil
          : null,
    };
  }
  return result;
}

export function isSiteId(value: unknown): value is SiteId {
  return typeof value === 'string' && SITE_IDS.includes(value as SiteId);
}

export function siteFromUrl(url: string | undefined): SiteId | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (
      ['www.bilibili.com', 'search.bilibili.com', 'space.bilibili.com', 't.bilibili.com'].includes(
        parsed.hostname,
      )
    )
      return 'bilibili';
    return SITE_IDS.find((site) => siteOwnsHost(site, parsed.hostname)) ?? null;
  } catch {
    return null;
  }
}

/** Exact hosts only. Do not turn a website grant into wildcard subdomain access. */
export function siteOwnsHost(site: SiteId, hostname: string): boolean {
  return SITES[site].origins.some((origin) => new URL(origin).hostname === hostname);
}

export function effectiveState(
  config: SiteConfig,
  now = Date.now(),
): 'disabled' | 'paused' | 'active' {
  if (!config.enabled) return 'disabled';
  return config.allowUntil !== null && config.allowUntil > now ? 'paused' : 'active';
}

export function remainingSeconds(config: SiteConfig, now = Date.now()): number {
  return config.enabled && config.allowUntil
    ? Math.max(0, Math.ceil((config.allowUntil - now) / 1000))
    : 0;
}
