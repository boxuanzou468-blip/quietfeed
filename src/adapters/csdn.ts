import { SHARED_PROTECTED_SELECTORS, type SiteAdapter } from './types';

/** Selectors observed on the public, signed-out desktop home page.
 * Blog article pages are deliberately outside the granted host scope: the
 * verification environment received HTTP 403 and cannot establish safe rules. */
export const csdnAdapter: SiteAdapter = {
  site: 'csdn',
  host: 'www.csdn.net',
  classify(url) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (
      url.protocol === 'https:' &&
      url.hostname === 'www.csdn.net' &&
      path === '/' &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('keyword')
    ) {
      return { key: 'home', label: 'CSDN 首页', supported: true };
    }
    return { key: 'other', label: '保留原样的页面', supported: false };
  },
  protectedSelectors: [
    ...SHARED_PROTECTED_SELECTORS,
    '#csdn-toolbar',
    '.layout-sidebar-aside',
    '#article_content',
    '#content_views',
    'pre',
    'code',
    '#asideProfile',
    '#asidedirectory',
    '#pcCommentBox',
    '#commentBox',
    '.passport-login-container',
    '.passport-login-box',
    '#passportbox',
  ],
  rules: [
    {
      id: 'homeFeed',
      pages: ['home'],
      selectors: [
        '#home-content-box > .home-info > .home-cont-title',
        '#home-content-box > .home-info > .home-info-headlines',
        '#home-content-box > .home-info .home-info-banner a#banner-box',
        '#home-content-box > .home-project',
        '#home-content-box > .home-article',
      ],
    },
    {
      id: 'sidebarRecommendations',
      pages: ['home'],
      selectors: [
        '#home_box_right #www-home-silde > .ContentBlock',
        '#home_box_right #www-home-silde > .broadcast',
        '#home_box_right #www-home-silde > .member',
      ],
    },
  ],
  guide: {
    moduleId: 'homeFeed',
    pages: ['home'],
    anchors: ['#home-content-box'],
    searchInputs: ['#toolbar-search-input'],
  },
};
