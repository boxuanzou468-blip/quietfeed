import { SHARED_PROTECTED_SELECTORS, type SiteAdapter } from './types';

/** Experimental: recommendation DOM still needs a signed-in, real-site check.
 * Keep exact named modules only; an unknown layout must remain visible. */
export const zhihuAdapter: SiteAdapter = {
  site: 'zhihu',
  host: 'www.zhihu.com',
  classify(url) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') {
      // Preserve explicit alternative tabs even if a navigation still uses '/'.
      for (const parameter of ['tab', 'feed', 'channel']) {
        const value = url.searchParams.get(parameter);
        if (value && value !== 'recommend')
          return { key: 'other', label: '主动选择的内容（保留原样）', supported: false };
      }
      return { key: 'home', label: '首页推荐（试验适配）', supported: true };
    }
    if (/^\/question\/\d+(?:\/answer\/\d+)?$/.test(path))
      return { key: 'question', label: '问题与回答（仅收起侧栏相关推荐）', supported: true };
    // This includes /follow, /hot, /search, /signin, profiles and collections.
    // Columns use zhuanlan.zhihu.com, for which no permission is requested.
    return { key: 'other', label: '保留原样的页面', supported: false };
  },
  protectedSelectors: [
    ...SHARED_PROTECTED_SELECTORS,
    '.SearchMain',
    '.Topstory-follow',
    '.QuestionHeader',
    '.Question-mainColumn',
    '.Comments-container',
    '.CommentsV2',
    '.CommentListV2',
    '.CommentEditorV2',
    '.Profile-main',
    '.Modal-wrapper',
    '.SignFlow',
    '.SignContainer-content',
    '.signQr-container',
    '.Captcha',
    '.Captcha-chineseContainer',
    '.Captcha-englishContainer',
  ],
  rules: [
    {
      id: 'homeFeed',
      pages: ['home'],
      selectors: ['.Topstory-recommend .TopstoryItem'],
    },
    {
      id: 'related',
      pages: ['question'],
      selectors: [
        '.Question-sideColumn .RelatedQuestions',
        '.Question-sideColumn .QuestionRelatedTopic',
      ],
    },
  ],
  guide: {
    moduleId: 'homeFeed',
    pages: ['home'],
    anchors: ['.Topstory-recommend'],
    searchInputs: ['.SearchBar-input', 'input[aria-label="搜索"]'],
  },
};
