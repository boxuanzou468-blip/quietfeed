import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { adapterForUrl } from '../src/adapters';
import { QuietFeedEngine } from '../src/content/engine';
import {
  createContentController,
  retireContentController,
  type ContentController,
} from '../src/content/lifecycle';
import { createPageMessageHandler } from '../src/content/messages';
import { CONFIG_KEY, defaultSiteConfig, normalizeConfig } from '../src/core/config';

declare global {
  interface Window {
    __quietFeedController?: ContentController;
  }
}

export default defineContentScript({
  // Keep `matches` out of this runtime entrypoint: WXT otherwise promotes it
  // to required host_permissions. The background supplies matches only after
  // the user grants the site's optional permission.
  registration: 'runtime',
  runAt: 'document_start',
  main(ctx) {
    const adapter = adapterForUrl(window.location.href);
    if (!adapter) return;
    // Re-enabling a site or injecting into an existing tab is idempotent.
    retireContentController(window.__quietFeedController);
    const engine = new QuietFeedEngine({
      adapter,
      document,
      window,
      config: defaultSiteConfig(adapter.site),
    });
    let stopped = false;
    let revision = 0;

    function apply(value: unknown): void {
      try {
        engine.update(normalizeConfig(value).sites[adapter!.site]);
      } catch {
        // A newer schema cannot safely be interpreted by this script.
        engine.update(defaultSiteConfig(adapter!.site));
      }
    }

    const onStorage: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (areaName !== 'local' || !changes[CONFIG_KEY]) return;
      revision += 1;
      apply(changes[CONFIG_KEY].newValue);
    };
    const onMessage = createPageMessageHandler({
      site: adapter.site,
      runtimeId: browser.runtime.id,
      refresh: engine.refresh,
      getStatus: () => engine.getStatus(),
      cleanup: () => controller.destroy(),
    });
    async function reloadConfig(): Promise<void> {
      if (stopped) return;
      const requestedRevision = ++revision;
      try {
        const values = await browser.storage.local.get(CONFIG_KEY);
        if (!stopped && revision === requestedRevision) apply(values[CONFIG_KEY]);
      } catch {
        controller.destroy();
      }
    }
    const onWake = () => {
      if (!document.hidden) void reloadConfig();
    };
    const controller = createContentController({
      stopPage() {
        stopped = true;
        engine.destroy();
      },
      removeListeners: [
        () => browser.storage.onChanged.removeListener(onStorage),
        () => browser.runtime.onMessage.removeListener(onMessage),
        () => window.removeEventListener('pageshow', onWake),
        () => document.removeEventListener('visibilitychange', onWake),
        () => window.removeEventListener('wxt:locationchange', engine.refresh),
      ],
      clearSingleton() {
        if (window.__quietFeedController === controller) delete window.__quietFeedController;
      },
    });
    window.__quietFeedController = controller;
    browser.storage.onChanged.addListener(onStorage);
    browser.runtime.onMessage.addListener(onMessage);
    window.addEventListener('pageshow', onWake);
    document.addEventListener('visibilitychange', onWake);
    ctx.addEventListener(window, 'wxt:locationchange', engine.refresh);
    ctx.onInvalidated(() => controller.destroy());

    void reloadConfig();
  },
});
