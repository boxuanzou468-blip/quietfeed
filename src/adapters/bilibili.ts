import { SHARED_PROTECTED_SELECTORS, type SiteAdapter } from './types';

export const bilibiliAdapter: SiteAdapter = {
  site: 'bilibili',
  host: 'www.bilibili.com',
  classify(url) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    // The same-origin home page redirects to this observed Simplified Chinese
    // route in Chrome/Edge. Do not generalize arbitrary locale prefixes.
    if (path === '/' || path === '/index.html' || path === '/zh-Hans')
      return { key: 'home', label: '首页', supported: true };
    if (/^\/(?:zh-Hans\/)?video\/(?:BV|av)[a-z\d]+$/i.test(path))
      return { key: 'video', label: '视频播放页', supported: true };
    // Explicitly preserve all other routes. Search, space and dynamics normally
    // live on other hosts, which the extension does not request permission for.
    return { key: 'other', label: '保留原样的页面', supported: false };
  },
  protectedSelectors: [
    ...SHARED_PROTECTED_SELECTORS,
    '#bilibili-player',
    '#bilibili-player-wrap',
    '.bpx-player-container',
    '#comment',
    '#commentapp',
    '.bili-comments',
    '#multi_page',
    '.multi-page-v1',
    '.base-video-sections-v1',
    '.video-sections-content-list',
    '.video-episode-card',
    '.bili-mini-login',
    '.bili-login-dialog',
    '.login-panel-popover',
    '#risk-captcha-app',
  ],
  rules: [
    {
      id: 'homeFeed',
      pages: ['home'],
      selectors: [
        '.recommended-container_floor-aside .feed-card',
        '.recommended-container_floor-aside .bili-feed-card',
        '.recommended-container_floor-aside .bili-video-card',
        '.bili-feed4-layout .bili-video-card',
        '.feed2 .bili-video-card',
        '.recommended-container_floor-aside .roll-btn',
        '.feed2 .feed-roll-btn',
      ],
    },
    {
      id: 'promotions',
      pages: ['home'],
      selectors: [
        '.recommended-container_floor-aside .recommended-swipe',
        '.bili-feed4-layout .recommended-swipe',
        '.bili-header__banner',
        '.recommended-container_floor-aside .bili-video-card.is-ad',
      ],
    },
    {
      id: 'trending',
      pages: ['home', 'video'],
      selectors: [
        'a.channel-icons__item[href^="//www.bilibili.com/v/popular"]',
        'a.left-fixed-channel[href^="//www.bilibili.com/v/popular"]',
        '.bili-header a[href^="https://www.bilibili.com/v/popular"]',
        '.bili-header a[href^="//www.bilibili.com/v/popular"]',
        '.bili-header a[href^="/v/popular"]',
        '.channel-icons a[href^="https://www.bilibili.com/v/popular"]',
        '.channel-icons a[href^="//www.bilibili.com/v/popular"]',
        '.channel-icons a[href^="/v/popular"]',
      ],
    },
    {
      id: 'searchHotWords',
      pages: ['home', 'video'],
      selectors: [
        '.search-panel #trending',
        '.search-panel .trending',
        '.search-panel .trending-container',
        '.nav-search-content .trending',
        '.search-panel .search-hot-list',
      ],
      placeholderSelectors: ['.nav-search-input', '#nav-searchform input'],
    },
    {
      id: 'related',
      pages: ['video'],
      selectors: [
        '#reco_list .rec-list',
        '#reco_list .video-page-card-small',
        '#reco_list .recommend-header',
        '.right-container .recommend-list-v1',
        '.right-container #recommend-list',
        '.right-container .rec-list',
      ],
    },
  ],
  guide: {
    moduleId: 'homeFeed',
    pages: ['home'],
    anchors: ['.recommended-container_floor-aside', '.bili-feed4-layout', '.feed2'],
    searchInputs: ['.nav-search-input', '#nav-searchform input'],
  },
};
