import { SHARED_PROTECTED_SELECTORS, type SiteAdapter } from './types';

export const baiduAdapter: SiteAdapter = {
  site: 'baidu',
  host: 'www.baidu.com',
  classify(url) {
    // Only the observed desktop home page is adapted. Search results, account
    // pages, verification and other Baidu products retain their original layout.
    if (url.pathname === '/') return { key: 'home', label: '首页', supported: true };
    return { key: 'other', label: '保留原样的页面', supported: false };
  },
  protectedSelectors: [
    ...SHARED_PROTECTED_SELECTORS,
    // Protect unexpected search controls inside a hot-list target while the
    // original, external search control stays outside all hiding selectors.
    '#s-hotsearch-wrapper form',
    '#s-hotsearch-wrapper input:not([type="hidden"])',
    '#s-hotsearch-wrapper textarea',
    '#content_left',
    '#content_right',
    '[id^="TANGRAM__PSP_"]',
    '.passport-login-pop',
    '.pass-verify-container',
  ],
  rules: [
    {
      id: 'homeHotSearch',
      pages: ['home'],
      // Keep the observed outer wrapper as the search-guide anchor. Hiding its
      // two known hot-list children avoids concealing an unexpected login node.
      selectors: [
        '#s-hotsearch-wrapper #hotsearch-content-wrapper',
        '#s-hotsearch-wrapper .s-hotsearch-title',
      ],
    },
  ],
  guide: {
    moduleId: 'homeHotSearch',
    pages: ['home'],
    anchors: ['#s-hotsearch-wrapper'],
    // The current desktop home uses a visible textarea outside the legacy
    // virtual form; #kw still exists but is hidden. Keep it only as fallback.
    searchInputs: ['textarea#chat-textarea', '#form #kw'],
  },
};
