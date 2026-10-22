import type { SiteId } from '../core/config';
import { STATUS_MESSAGE, type PageStatus } from '../core/protocol';

interface PageMessageOptions {
  site: SiteId;
  runtimeId: string;
  refresh: () => void;
  getStatus: () => PageStatus;
  cleanup: () => void;
}

/** Cleanup broadcasts reach both sites, so every content script checks its site. */
export function createPageMessageHandler(options: PageMessageOptions) {
  return (message: unknown, sender: { id?: string }, respond: (value: unknown) => void): void => {
    if (sender.id !== options.runtimeId || !message || typeof message !== 'object') return;
    const { type, site } = message as { type?: unknown; site?: unknown };
    if (type === STATUS_MESSAGE) {
      options.refresh();
      respond(options.getStatus());
    } else if (type === 'quietfeed:cleanup' && site === options.site) {
      options.cleanup();
      respond({ ok: true });
    }
  };
}
