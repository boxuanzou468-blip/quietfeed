import { SHARED_PROTECTED_SELECTORS, type SiteAdapter } from './types';

export const xiaohongshuAdapter: SiteAdapter = {
  site: 'xiaohongshu',
  host: 'www.xiaohongshu.com',
  classify(url) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/explore' || path === '/') {
      const channel = url.searchParams.get('channel_id') ?? url.searchParams.get('channel') ?? '';
      if (/(?:^|[._-])follow(?:ing)?$/i.test(channel)) {
        return { key: 'following', label: '关注页（保留原样）', supported: false };
      }
      return { key: 'explore', label: '发现页', supported: true };
    }
    if (/^\/(?:explore|discovery\/item)\/[^/]+$/.test(path)) {
      return { key: 'note', label: '笔记详情（保留原样）', supported: false };
    }
    if (/^\/(?:search_result|search)(?:\/|$)/.test(path)) {
      return { key: 'search', label: '搜索结果（保留原样）', supported: false };
    }
    return { key: 'other', label: '保留原样的页面', supported: false };
  },
  protectedSelectors: [
    ...SHARED_PROTECTED_SELECTORS,
    '.note-detail-mask',
    '#noteContainer',
    '.note-container',
    '.note-detail',
    '.note-scroller',
    '.login-container',
    '.login-modal',
    '.login-mask',
  ],
  rules: [
    {
      id: 'discoveryFeed',
      pages: ['explore'],
      selectors: ['.feeds-page .feeds-container', '.xhs-red-feeds-page .feeds-container'],
    },
    {
      id: 'discoveryTopics',
      pages: ['explore'],
      selectors: [
        '.feeds-page .channel-container',
        '.xhs-red-feeds-page .xhs-red-channel-container',
      ],
    },
    {
      id: 'searchHotWords',
      pages: ['explore'],
      selectors: [
        '.query-note-wrapper .query-note-list.hotspot',
        '.sug-pad .hotspot-tag',
        '.search-input-container .hotspot-tag',
      ],
      // Native sign-in guidance is useful and must remain visible. The other
      // neutral defaults also contain no trending recommendation to suppress.
      placeholderSelectors: [
        '#search-input:not([placeholder*="登录"]):not([placeholder="搜索小红书"]):not([placeholder="搜索"])',
        'header .search-input:not([placeholder*="登录"]):not([placeholder="搜索小红书"]):not([placeholder="搜索"])',
        '.search-box-in-content .search-input:not([placeholder*="登录"]):not([placeholder="搜索小红书"]):not([placeholder="搜索"])',
      ],
    },
  ],
  guide: {
    moduleId: 'discoveryFeed',
    pages: ['explore'],
    anchors: ['.feeds-page .feeds-content', '.feeds-page', '.xhs-red-feeds-page'],
    searchInputs: [
      'header .search-input',
      '.search-box .search-input',
      '.search-box-in-content .search-input',
      '#search-input',
    ],
  },
};
