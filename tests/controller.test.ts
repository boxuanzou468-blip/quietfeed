import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_KEY,
  defaultConfig,
  PAUSE_MS,
  SITE_IDS,
  SITES,
  type AppConfig,
  type SiteId,
} from '../src/core/config';
import { parseCommand, reduceConfig } from '../src/core/reducer';
import {
  alarmName,
  createController,
  scriptId,
  type ControllerApi,
} from '../src/background/controller';

vi.mock('wxt/browser', () => ({ browser: {} }));

function mockApi(initial: AppConfig = defaultConfig()) {
  let stored: Record<string, unknown> = { [CONFIG_KEY]: structuredClone(initial) };
  const registrations = new Set<string>();
  const granted = Object.fromEntries(SITE_IDS.map((site) => [site, false])) as Record<
    SiteId,
    boolean
  >;
  const api = {
    storage: {
      local: {
        get: vi.fn(async () => structuredClone(stored)),
        set: vi.fn(async (value: Record<string, unknown>) => {
          stored = { ...stored, ...structuredClone(value) };
        }),
      },
    },
    permissions: {
      contains: vi.fn(async ({ origins }: { origins: string[] }) => {
        const site = SITE_IDS.find((id) => SITES[id].origins.includes(origins[0] ?? ''));
        return site ? granted[site] : false;
      }),
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async ({ ids }: { ids: string[] }) =>
        ids.filter((id) => registrations.has(id)).map((id) => ({ id })),
      ),
      registerContentScripts: vi.fn(async (entries: { id: string }[]) => {
        entries.forEach(({ id }) => registrations.add(id));
      }),
      unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => {
        ids.forEach((id) => registrations.delete(id));
      }),
      executeScript: vi.fn(async () => []),
    },
    alarms: { clear: vi.fn(async () => true), create: vi.fn(async () => undefined) },
    tabs: {
      query: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
      sendMessage: vi.fn(async () => undefined),
    },
    runtime: {},
  };
  return {
    api,
    granted,
    registrations,
    read: () => structuredClone(stored[CONFIG_KEY]) as AppConfig,
  };
}

describe('serialized background controller', () => {
  let time: number;
  beforeEach(() => {
    time = 1_800_000_000_000;
  });

  it('maps every site grant independently rather than reusing another site’s permission', async () => {
    const mock = mockApi();
    mock.granted.baidu = true;
    mock.granted.csdn = true;
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    const result = await controller.handle({ type: 'get-state' });
    expect(result).toMatchObject({
      ok: true,
      data: {
        granted: {
          bilibili: false,
          xiaohongshu: false,
          baidu: true,
          csdn: true,
          zhihu: false,
        },
      },
    });
    const denied = await controller.handle({ type: 'set-enabled', site: 'zhihu', enabled: true });
    expect(denied.ok).toBe(false);
    expect((await controller.handle({ type: 'set-enabled', site: 'csdn', enabled: true })).ok).toBe(
      true,
    );
    expect(mock.api.scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ id: scriptId('csdn'), matches: ['https://www.csdn.net/*'] }),
    ]);
  });

  it('does not enable a site without host permission', async () => {
    const mock = mockApi();
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    const result = await controller.handle({
      type: 'set-enabled',
      site: 'bilibili',
      enabled: true,
    });
    expect(result.ok).toBe(false);
    expect(mock.read().sites.bilibili.enabled).toBe(false);
    expect(mock.api.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  it('registers at document_start and activates already open tabs after authorization', async () => {
    const mock = mockApi();
    mock.granted.bilibili = true;
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    expect(
      (await controller.handle({ type: 'set-enabled', site: 'bilibili', enabled: true })).ok,
    ).toBe(true);
    expect(mock.api.scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: scriptId('bilibili'),
        runAt: 'document_start',
        world: 'ISOLATED',
        allFrames: false,
      }),
    ]);
    expect(mock.api.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(mock.read().sites.xiaohongshu.enabled).toBe(false);
  });

  it('serializes simultaneous changes instead of losing a tab’s update', async () => {
    const mock = mockApi();
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    await Promise.all([
      controller.handle({
        type: 'set-module',
        site: 'bilibili',
        moduleId: 'related',
        hidden: false,
      }),
      controller.handle({
        type: 'set-module',
        site: 'xiaohongshu',
        moduleId: 'discoveryTopics',
        hidden: false,
      }),
    ]);
    expect(mock.read().sites.bilibili.hiddenModules.related).toBe(false);
    expect(mock.read().sites.xiaohongshu.hiddenModules.discoveryTopics).toBe(false);
  });

  it('recovers an absolute pause deadline across worker restarts and expires on startup', async () => {
    const config = defaultConfig();
    config.sites.bilibili.enabled = true;
    const mock = mockApi(config);
    mock.granted.bilibili = true;
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    await controller.handle({ type: 'pause-site', site: 'bilibili' });
    expect(mock.read().sites.bilibili.allowUntil).toBe(time + PAUSE_MS);
    const restarted = createController(mock.api as unknown as ControllerApi, () => time);
    time += 60_000;
    await restarted.reconcile();
    expect(mock.api.alarms.create).toHaveBeenLastCalledWith(alarmName('bilibili'), {
      when: time - 60_000 + PAUSE_MS,
    });
    time += PAUSE_MS;
    await restarted.reconcile();
    expect(mock.read().sites.bilibili.allowUntil).toBeNull();
    expect(mock.read().sites.bilibili.enabled).toBe(true);
  });

  it('cleans all open tabs when permission is revoked, not only tabs whose URL can still be read', async () => {
    const config = defaultConfig();
    config.sites.bilibili.enabled = true;
    const mock = mockApi(config);
    mock.registrations.add(scriptId('bilibili'));
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    await controller.reconcile();
    expect(mock.read().sites.bilibili.enabled).toBe(false);
    expect(mock.registrations.has(scriptId('bilibili'))).toBe(false);
    expect(mock.api.tabs.query).toHaveBeenCalledWith({});
    expect(mock.api.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'quietfeed:cleanup',
      site: 'bilibili',
    });
  });

  it('rolls back settings when content script registration fails', async () => {
    const mock = mockApi();
    mock.granted.bilibili = true;
    mock.api.scripting.registerContentScripts.mockRejectedValueOnce(
      new Error('Registration error'),
    );
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    expect(
      (await controller.handle({ type: 'set-enabled', site: 'bilibili', enabled: true })).ok,
    ).toBe(false);
    expect(mock.read().sites.bilibili.enabled).toBe(false);
  });

  it('rejects unknown sites and module keys without changing storage', async () => {
    const mock = mockApi();
    const controller = createController(mock.api as unknown as ControllerApi, () => time);
    expect(
      (
        await controller.handle({
          type: 'set-module',
          site: 'bilibili',
          moduleId: '__proto__',
          hidden: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (await controller.handle({ type: 'set-enabled', site: 'example.com', enabled: true })).ok,
    ).toBe(false);
    expect(mock.api.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('settings operations', () => {
  it('reset retains authorization intent and ends a pause while restoring search-first', () => {
    const config = defaultConfig();
    Object.assign(config.sites.bilibili, {
      enabled: true,
      mode: 'custom',
      allowUntil: Date.now() + 50_000,
    });
    config.sites.bilibili.hiddenModules.related = false;
    const result = reduceConfig(config, parseCommand({ type: 'reset-site', site: 'bilibili' }));
    expect(result.sites.bilibili).toMatchObject({
      enabled: true,
      mode: 'search',
      allowUntil: null,
    });
    expect(Object.values(result.sites.bilibili.hiddenModules).every(Boolean)).toBe(true);
    expect(config.sites.bilibili.hiddenModules.related).toBe(false);
  });

  it('disable clears the pause but retains custom choices for the next enable', () => {
    const config = defaultConfig();
    Object.assign(config.sites.bilibili, {
      enabled: true,
      mode: 'custom',
      allowUntil: Date.now() + 50_000,
    });
    config.sites.bilibili.hiddenModules.related = false;
    const result = reduceConfig(config, { type: 'set-enabled', site: 'bilibili', enabled: false });
    expect(result.sites.bilibili).toMatchObject({
      enabled: false,
      mode: 'custom',
      allowUntil: null,
      hiddenModules: { related: false },
    });
  });
});
