import { browser } from 'wxt/browser';
import {
  CONFIG_KEY,
  normalizeConfig,
  SITE_IDS,
  SITES,
  type AppConfig,
  type SiteId,
} from '../core/config';
import { parseCommand, reduceConfig } from '../core/reducer';
import type { CommandResult, Snapshot } from '../core/protocol';

export type ControllerApi = Pick<
  typeof browser,
  'storage' | 'permissions' | 'scripting' | 'alarms' | 'tabs' | 'runtime'
>;
export const CONTENT_SCRIPT = '/content-scripts/quietfeed.js';
export const alarmName = (site: SiteId) => `quietfeed:resume:${site}`;
export const scriptId = (site: SiteId) => `quietfeed:${site}`;

export function createController(api: ControllerApi = browser, now: () => number = Date.now) {
  let pending: Promise<unknown> = Promise.resolve();
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = pending.then(operation, operation);
    pending = result.catch(() => undefined);
    return result;
  };

  async function load(): Promise<AppConfig> {
    const stored = await api.storage.local.get(CONFIG_KEY);
    return normalizeConfig(stored[CONFIG_KEY], now());
  }

  async function snapshot(config: AppConfig): Promise<Snapshot> {
    const grants = await Promise.all(
      SITE_IDS.map((site) => api.permissions.contains({ origins: SITES[site].origins })),
    );
    return {
      config,
      granted: Object.fromEntries(
        SITE_IDS.map((site, index) => [site, grants[index] ?? false]),
      ) as Snapshot['granted'],
    };
  }

  async function cleanup(site: SiteId) {
    // Tab IDs are available without the broad tabs permission, even after host access is revoked.
    const tabs = await api.tabs.query({});
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined)
        .map((tab) => api.tabs.sendMessage(tab.id!, { type: 'quietfeed:cleanup', site })),
    );
  }

  async function syncSite(site: SiteId, state: Snapshot, inject: boolean) {
    const config = state.config.sites[site];
    const id = scriptId(site);
    const registered = await api.scripting.getRegisteredContentScripts({ ids: [id] });
    if (config.enabled && state.granted[site]) {
      if (!registered.length) {
        await api.scripting.registerContentScripts([
          {
            id,
            matches: SITES[site].origins,
            js: [CONTENT_SCRIPT],
            runAt: 'document_start',
            allFrames: false,
            world: 'ISOLATED',
            persistAcrossSessions: true,
          },
        ]);
        inject = true;
      }
      if (inject) {
        const tabs = await api.tabs.query({ url: SITES[site].origins });
        await Promise.allSettled(
          tabs
            .filter((tab) => tab.id !== undefined)
            .map((tab) =>
              api.scripting.executeScript({ target: { tabId: tab.id! }, files: [CONTENT_SCRIPT] }),
            ),
        );
      }
    } else {
      await cleanup(site);
      if (registered.length) await api.scripting.unregisterContentScripts({ ids: [id] });
    }
    await api.alarms.clear(alarmName(site));
    if (config.enabled && config.allowUntil !== null && config.allowUntil > now()) {
      await api.alarms.create(alarmName(site), { when: config.allowUntil });
    }
  }

  async function reconcile(): Promise<Snapshot> {
    const config = await load();
    const state = await snapshot(config);
    for (const site of SITE_IDS) {
      if (!state.granted[site]) {
        config.sites[site].enabled = false;
        config.sites[site].allowUntil = null;
      }
    }
    await api.storage.local.set({ [CONFIG_KEY]: config });
    // Existing tabs may contain an invalidated context after an extension update.
    // Re-injection is idempotent and reconnects them to this worker/version.
    for (const site of SITE_IDS) await syncSite(site, state, true);
    return state;
  }

  function handle(message: unknown): Promise<CommandResult> {
    return serialize(async () => {
      try {
        const command = parseCommand(message);
        const before = await load();
        if (command.type === 'get-state') return { ok: true, data: await snapshot(before) };
        const state = await snapshot(before);
        if ((command.type === 'set-enabled' && command.enabled) || command.type === 'pause-site') {
          if (!state.granted[command.site]) throw new Error('请先允许静流访问此网站，再启用。');
        }
        const next = reduceConfig(before, command, now());
        await api.storage.local.set({ [CONFIG_KEY]: next });
        const after = { ...state, config: next };
        try {
          await syncSite(command.site, after, command.type === 'set-enabled' && command.enabled);
        } catch {
          await api.storage.local.set({ [CONFIG_KEY]: before });
          await syncSite(command.site, state, false).catch(() => undefined);
          throw new Error('未能应用设置，已恢复之前的设置。请重新加载扩展后重试。');
        }
        return { ok: true, data: after };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '操作失败，请稍后重试。',
        };
      }
    });
  }

  return { handle, reconcile: () => serialize(reconcile) };
}
