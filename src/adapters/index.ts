import { bilibiliAdapter } from './bilibili';
import { xiaohongshuAdapter } from './xiaohongshu';
import { baiduAdapter } from './baidu';
import { csdnAdapter } from './csdn';
import { zhihuAdapter } from './zhihu';
import type { SiteAdapter } from './types';

export { bilibiliAdapter, xiaohongshuAdapter, baiduAdapter, csdnAdapter, zhihuAdapter };
export type { ModuleRule, PageKind, SiteAdapter } from './types';

export const ADAPTERS: readonly SiteAdapter[] = [
  bilibiliAdapter,
  xiaohongshuAdapter,
  baiduAdapter,
  csdnAdapter,
  zhihuAdapter,
];

export function adapterForUrl(value: string): SiteAdapter | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return ADAPTERS.find(({ host }) => host === url.hostname) ?? null;
  } catch {
    return null;
  }
}
