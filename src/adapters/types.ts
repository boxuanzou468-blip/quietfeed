import type { SiteId } from '../core/config';

export interface PageKind {
  /** Human-readable status displayed in the extension. */
  label: string;
  key: string;
  supported: boolean;
}

export interface ModuleRule {
  id: string;
  pages: readonly string[];
  /** Each selector describes a known module, never a whole application root. */
  selectors: readonly string[];
  /** Hide only the native placeholder; text entered by the user stays untouched. */
  placeholderSelectors?: readonly string[];
}

export interface SiteAdapter {
  site: SiteId;
  host: string;
  classify: (url: URL) => PageKind;
  rules: readonly ModuleRule[];
  protectedSelectors: readonly string[];
  guide: {
    moduleId: string;
    pages: readonly string[];
    anchors: readonly string[];
    searchInputs: readonly string[];
  };
}

export const SHARED_PROTECTED_SELECTORS = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  'video[controls]',
  'audio[controls]',
  'iframe',
  '[data-quietfeed-guide]',
] as const;
