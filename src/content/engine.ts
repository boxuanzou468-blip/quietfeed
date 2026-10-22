import type { PageKind, SiteAdapter } from '../adapters';
import { effectiveState, type SiteConfig } from '../core/config';
import type { PageStatus } from '../core/protocol';

export const STYLE_ID = 'quietfeed-page-style';
export const GUIDE_ID = 'quietfeed-search-guide';

/** DOM survives an extension reload even when its isolated-world singleton
 * does not. Only remove the extension's exact node types and identifiers. */
export function removeResidualEffects(doc: Document): void {
  doc
    .querySelectorAll(`style#${STYLE_ID}, aside#${GUIDE_ID}[data-quietfeed-guide]`)
    .forEach((node) => node.remove());
}

/** Protect a matched target, its children, and its ancestors. In particular,
 * a note overlay mounted *inside* a feed must never inherit display:none. */
export function safeSelector(selector: string, adapter: SiteAdapter): string {
  const protectedGroup = `:is(${adapter.protectedSelectors.join(',')})`;
  return `${selector}:not(${protectedGroup}):not(${protectedGroup} *):not(:has(${protectedGroup}))`;
}

function hasMatch(doc: Document, selector: string, adapter: SiteAdapter): boolean {
  try {
    return doc.querySelector(safeSelector(selector, adapter)) !== null;
  } catch {
    // An unsupported selector cannot justify hiding any broader container.
    return false;
  }
}

function pageFor(doc: Document, href: string, adapter: SiteAdapter): PageKind {
  const url = new URL(href);
  if (url.protocol !== 'https:' || url.hostname !== adapter.host) {
    return { key: 'outside', label: '站点范围外（保留原样）', supported: false };
  }
  if (doc.querySelector('#risk-captcha-app, #geetest, .geetest_panel, .captcha-container')) {
    return { key: 'verification', label: '验证页面（保留原样）', supported: false };
  }
  if (/\/login(?:\/|$)/.test(url.pathname)) {
    return { key: 'login', label: 'login · 原站登录页', supported: false };
  }
  return adapter.classify(url);
}

export function inspectPage(
  doc: Document,
  href: string,
  adapter: SiteAdapter,
  config: SiteConfig,
  now = Date.now(),
): PageStatus {
  const page = pageFor(doc, href, adapter);
  return {
    site: adapter.site,
    page: page.label,
    active: effectiveState(config, now) === 'active' && page.supported,
    supported: page.supported,
    modules: adapter.rules.map((rule) => ({
      id: rule.id,
      applicable: page.supported && rule.pages.includes(page.key),
      matched:
        page.supported &&
        rule.pages.includes(page.key) &&
        [...rule.selectors, ...(rule.placeholderSelectors ?? [])].some((selector) =>
          hasMatch(doc, selector, adapter),
        ),
    })),
  };
}

export function buildCss(
  adapter: SiteAdapter,
  page: PageKind,
  config: SiteConfig,
  now = Date.now(),
): string {
  if (!page.supported || effectiveState(config, now) !== 'active') return '';
  return adapter.rules
    .filter((rule) => rule.pages.includes(page.key) && config.hiddenModules[rule.id])
    .flatMap((rule) => [
      ...rule.selectors.map(
        (selector) => `${safeSelector(selector, adapter)}{display:none!important}`,
      ),
      ...(rule.placeholderSelectors ?? []).map(
        (selector) =>
          `${safeSelector(selector, adapter)}::placeholder{color:transparent!important;opacity:0!important}`,
      ),
    ])
    .join('\n');
}

const GUIDE_CSS = `
  :host{all:initial;display:block;box-sizing:border-box;grid-column:1/-1;flex-basis:100%;width:100%;max-width:920px;margin:42px auto 54px;color:#153d37;font:14px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
  section{box-sizing:border-box;padding:38px 30px;text-align:center;border:1px solid #d8e6dd;border-radius:24px;background:#f4f8f2}
  .mark{font-size:12px;letter-spacing:.18em;color:#496b5a}h2{margin:14px 0 10px;font-size:25px;font-weight:600;letter-spacing:-.03em}p{margin:0;color:#587165}
  button{margin-top:22px;border:0;border-radius:999px;background:#244f42;color:#fff;padding:11px 24px;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #b0ce8c;outline-offset:4px}
  @media(prefers-color-scheme:dark){:host{color:#e0eddd}section{background:#1b2b25;border-color:#365043}.mark,p{color:#acc2af}button{background:#c1d9ac;color:#19392c}}
`;

export interface EngineOptions {
  adapter: SiteAdapter;
  document: Document;
  window: Window;
  config: SiteConfig;
  now?: () => number;
  /** Optional URL provider for deterministic route-transition tests. */
  getUrl?: () => string;
}

/** Owns only its style and guide nodes. Original site nodes are never removed. */
export class QuietFeedEngine {
  private readonly adapter: SiteAdapter;
  private readonly doc: Document;
  private readonly win: Window;
  private readonly now: () => number;
  private readonly getUrl: () => string;
  private config: SiteConfig;
  private observer: MutationObserver | null = null;
  private refreshTimer: number | null = null;
  private expiryTimer: number | null = null;
  private style: HTMLStyleElement | null = null;
  private guide: HTMLElement | null = null;
  private destroyed = false;

  constructor(options: EngineOptions) {
    this.adapter = options.adapter;
    this.doc = options.document;
    this.win = options.window;
    this.config = options.config;
    this.now = options.now ?? Date.now;
    this.getUrl = options.getUrl ?? (() => this.win.location.href);
    removeResidualEffects(this.doc);
    this.observer = new MutationObserver((records) => {
      // Ignore our own insertions, avoiding an observer/update feedback loop.
      const externalMutation = records.some((record) => {
        const target = record.target;
        if (target === this.style || target === this.guide || this.guide?.contains(target))
          return false;
        return [...record.addedNodes, ...record.removedNodes].some(
          (node) => node !== this.style && node !== this.guide,
        );
      });
      if (externalMutation) this.scheduleRefresh();
    });
    // Child-list changes catch lazy content and page transitions. CSS handles
    // class changes itself; observing attributes would follow video animations.
    this.observer.observe(this.doc, { childList: true, subtree: true });
    this.win.addEventListener('popstate', this.refresh);
    this.win.addEventListener('hashchange', this.refresh);
    this.win.addEventListener('pageshow', this.refresh);
    this.doc.addEventListener('visibilitychange', this.refresh);
    this.refresh();
  }

  update(config: SiteConfig): void {
    this.config = config;
    this.refresh();
  }

  getStatus(): PageStatus {
    return inspectPage(this.doc, this.getUrl(), this.adapter, this.config, this.now());
  }

  /** Also called by WXT's history-mode navigation event. */
  refresh = (): void => {
    if (this.destroyed) return;
    const page = pageFor(this.doc, this.getUrl(), this.adapter);
    const css = buildCss(this.adapter, page, this.config, this.now());
    if (!css) {
      this.style?.remove();
      this.style = null;
      this.removeGuide();
    } else {
      if (!this.style?.isConnected) {
        this.style = this.doc.createElement('style');
        this.style.id = STYLE_ID;
        this.style.setAttribute('data-quietfeed-owned', 'style');
        (this.doc.head ?? this.doc.documentElement)?.append(this.style);
      }
      if (this.style.textContent !== css) this.style.textContent = css;
      this.syncGuide(page);
    }
    this.scheduleExpiry();
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = null;
    if (this.refreshTimer !== null) this.win.clearTimeout(this.refreshTimer);
    if (this.expiryTimer !== null) this.win.clearTimeout(this.expiryTimer);
    this.refreshTimer = null;
    this.expiryTimer = null;
    this.win.removeEventListener('popstate', this.refresh);
    this.win.removeEventListener('hashchange', this.refresh);
    this.win.removeEventListener('pageshow', this.refresh);
    this.doc.removeEventListener('visibilitychange', this.refresh);
    this.style?.remove();
    this.style = null;
    this.removeGuide();
  }

  private scheduleRefresh(): void {
    if (this.destroyed || this.refreshTimer !== null) return;
    this.refreshTimer = this.win.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, 150);
  }

  private scheduleExpiry(): void {
    if (this.expiryTimer !== null) this.win.clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    if (
      this.config.enabled &&
      this.config.allowUntil !== null &&
      this.config.allowUntil > this.now()
    ) {
      const delay = Math.min(this.config.allowUntil - this.now() + 25, 2_147_483_647);
      this.expiryTimer = this.win.setTimeout(this.refresh, delay);
    }
  }

  private syncGuide(page: PageKind): void {
    const { guide } = this.adapter;
    const module = this.adapter.rules.find(({ id }) => id === guide.moduleId);
    const shouldShow =
      this.config.hiddenModules[guide.moduleId] &&
      guide.pages.includes(page.key) &&
      module?.selectors.some((selector) => hasMatch(this.doc, selector, this.adapter));
    const anchor = shouldShow
      ? guide.anchors.map((selector) => this.doc.querySelector<HTMLElement>(selector)).find(Boolean)
      : null;
    if (!anchor || anchor.closest(this.adapter.protectedSelectors.join(','))) {
      this.removeGuide();
      return;
    }
    // Never place a guide in a modal, or keep it behind a note overlay.
    if (
      this.doc.querySelector(
        '.note-detail-mask, #noteContainer, [aria-modal="true"], [role="dialog"]',
      )
    ) {
      this.removeGuide();
      return;
    }
    if (this.guide?.isConnected && this.guide.parentElement === anchor) return;
    this.removeGuide();
    const host = this.doc.createElement('aside');
    host.id = GUIDE_ID;
    host.setAttribute('data-quietfeed-guide', '');
    host.setAttribute('aria-label', '静流搜索引导');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = GUIDE_CSS;
    const section = this.doc.createElement('section');
    const mark = this.doc.createElement('span');
    mark.className = 'mark';
    mark.textContent = '静流 QUIETFEED';
    const title = this.doc.createElement('h2');
    title.textContent = '这次，你想找什么？';
    const text = this.doc.createElement('p');
    text.textContent = '推荐已收起。用原来的搜索框，寻找你真正想看的内容。';
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = '去搜索';
    button.addEventListener('click', () => {
      const input = guide.searchInputs
        .map((selector) => this.doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector))
        // Content protection keeps toolbars visible; it must not prevent focus
        // of their explicitly named native search input. Modal/inert controls
        // still must never receive focus from the page's guide.
        .find(
          (element) =>
            element &&
            !element.disabled &&
            element.type !== 'hidden' &&
            element.checkVisibility?.({ checkVisibilityCSS: true, checkOpacity: true }) !== false &&
            !element.closest('[role="dialog"], [aria-modal="true"], [inert]'),
        );
      input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      input?.focus();
    });
    section.append(mark, title, text, button);
    shadow.append(style, section);
    this.guide = host;
    anchor.prepend(host);
  }

  private removeGuide(): void {
    this.guide?.remove();
    this.guide = null;
  }
}
