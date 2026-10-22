import { chromium } from '@playwright/test';
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Real public pages, a new temporary browser profile, no login or CAPTCHA solving.
// This smoke test does not replace authenticated or interactive browser testing.
const project = resolve(import.meta.dirname, '..');
const extensionPath = resolve(project, '.output/chrome-mv3');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\155.0.4283.62\\msedge.exe';
const requested = process.argv.find((arg) => arg.startsWith('--browser='))?.split('=')[1] ?? 'all';
const permissionMode =
  process.argv.find((arg) => arg.startsWith('--permission-mode='))?.split('=')[1] ?? 'native';
const selectedSites = process.argv
  .find((arg) => arg.startsWith('--sites='))
  ?.split('=')[1]
  ?.split(',');
if (!['all', 'chrome', 'edge'].includes(requested))
  throw new Error('Use --browser=all|chrome|edge');
if (!['native', 'developer'].includes(permissionMode))
  throw new Error('Use --permission-mode=native|developer');
const artifactRoot = resolve(
  project,
  'artifacts/live',
  'v0.2.0',
  permissionMode === 'developer' ? 'test-pregrant' : 'native-permission',
  new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'),
);
const definitions = [
  { id: 'bilibili', name: 'B站', url: 'https://www.bilibili.com/' },
  { id: 'xiaohongshu', name: '小红书', url: 'https://www.xiaohongshu.com/explore' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/' },
  { id: 'csdn', name: 'CSDN', url: 'https://www.csdn.net/' },
  { id: 'zhihu', name: '知乎', url: 'https://www.zhihu.com/' },
].filter((site) => !selectedSites || selectedSites.includes(site.id));
if (!definitions.length || selectedSites?.some((id) => !definitions.some((site) => site.id === id)))
  throw new Error('Use --sites=bilibili,xiaohongshu,baidu,csdn,zhihu (any nonempty subset)');

// Bundle the actual adapters in memory, avoiding a separate, drifting selector list.
const compiled = await build({
  configFile: false,
  root: project,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: join(project, 'src/adapters/index.ts'),
      name: 'SmokeAdapters',
      formats: ['iife'],
    },
  },
});
const adapterOutput = (Array.isArray(compiled) ? compiled[0] : compiled).output;
const adapterCode = adapterOutput.find((item) => item.type === 'chunk').code;
const adapterExports = new Function(`${adapterCode};return SmokeAdapters;`)();
const adapters = Object.fromEntries(
  adapterExports.ADAPTERS.map((adapter) => [adapter.site, adapter]),
);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = {
  manifest: sha256(await readFile(join(extensionPath, 'manifest.json'))),
  contentScript: sha256(await readFile(join(extensionPath, 'content-scripts/quietfeed.js'))),
  adapters: sha256(adapterCode),
};
await mkdir(artifactRoot, { recursive: true });

async function extensionCommand(options, command) {
  const response = await options.evaluate(
    (message) => chrome.runtime.sendMessage(message),
    command,
  );
  if (!response?.ok) throw new Error(response?.error ?? 'No extension command response');
  return response.data;
}

async function tabIds(options) {
  return options.evaluate(async () => (await chrome.tabs.query({})).map((tab) => tab.id));
}

async function pageStatus(options, tabId) {
  try {
    const result = await options.evaluate(
      (id) => chrome.tabs.sendMessage(id, { type: 'quietfeed:page-status' }),
      tabId,
    );
    return { received: Boolean(result), value: result ?? null };
  } catch (error) {
    return { received: false, error: String(error.message).slice(0, 500) };
  }
}

async function inspectDom(page, adapter, baseline) {
  return page.evaluate(
    ({ rules, protectedSelectors, searchInputs, remember }) => {
      const visible = (element) => {
        if (!element.isConnected) return false;
        const style = getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          element.getClientRects().length > 0
        );
      };
      const protectedGroup = `:is(${protectedSelectors.join(',')})`;
      const safe = (selector) =>
        `${selector}:not(${protectedGroup}):not(${protectedGroup} *):not(:has(${protectedGroup}))`;
      const select = (selector) => {
        try {
          return [...document.querySelectorAll(selector)];
        } catch {
          return [];
        }
      };
      const record = (element) => ({
        connected: element.isConnected,
        visible: visible(element),
        tag: element.tagName,
        className: element.getAttribute('class')?.slice(0, 140) ?? '',
      });
      const placeholder = (element) => ({
        ...record(element),
        text: element.getAttribute('placeholder'),
        color: getComputedStyle(element, '::placeholder').color,
        opacity: getComputedStyle(element, '::placeholder').opacity,
      });
      const key = '__quietfeedLiveSmokeNodes';
      if (remember || !window[key])
        window[key] = { elements: [], placeholders: [], search: [], protected: [] };
      const tracked = window[key];
      const modules = rules.map((rule) => ({
        id: rule.id,
        selectors: rule.selectors.map((selector) => {
          const raw = select(selector);
          const matches = select(safe(selector));
          if (remember)
            matches.slice(0, 12).forEach((element, index) =>
              tracked.elements.push({
                element,
                key: `${rule.id}:${selector}:${index}`,
                baselineVisible: visible(element),
              }),
            );
          return {
            selector,
            rawCount: raw.length,
            safeCount: matches.length,
            visibleCount: matches.filter(visible).length,
            hiddenCount: matches.filter((element) => !visible(element)).length,
          };
        }),
        placeholders: (rule.placeholderSelectors ?? []).map((selector) => {
          const matches = select(safe(selector));
          if (remember)
            matches
              .slice(0, 4)
              .forEach((element, index) =>
                tracked.placeholders.push({ element, key: `${rule.id}:${selector}:${index}` }),
              );
          return {
            selector,
            count: matches.length,
            examples: matches.slice(0, 4).map(placeholder),
          };
        }),
      }));
      if (remember) {
        searchInputs.flatMap(select).forEach((element, index) =>
          tracked.search.push({
            element,
            key: `search:${index}`,
            baselineVisible: visible(element),
          }),
        );
        protectedSelectors
          .flatMap(select)
          .slice(0, 50)
          .forEach((element, index) =>
            tracked.protected.push({
              element,
              key: `protected:${index}`,
              baselineVisible: visible(element),
            }),
          );
      }
      const text = document.body?.innerText ?? '';
      return {
        title: document.title,
        url: location.href,
        textExcerpt: text.slice(0, 900),
        loginTextPresent: /登录|登入|sign in/i.test(text),
        verificationTextPresent:
          /验证码|安全验证|访问验证|访问受限|captcha|verify you are human|access denied/i.test(
            text,
          ),
        verificationElementPresent: Boolean(
          document.querySelector('#risk-captcha-app, #geetest, .geetest_panel, .captcha-container'),
        ),
        style: {
          exists: Boolean(document.getElementById('quietfeed-page-style')),
          length: document.getElementById('quietfeed-page-style')?.textContent?.length ?? 0,
        },
        guidePresent: Boolean(document.getElementById('quietfeed-search-guide')),
        modules,
        searchInputs: searchInputs.map((selector) => ({
          selector,
          matches: select(selector).map(record),
        })),
        protected: protectedSelectors.map((selector) => ({
          selector,
          count: select(selector).length,
          visibleCount: select(selector).filter(visible).length,
        })),
        trackedTargets: tracked.elements.map(({ element, key, baselineVisible }) => ({
          key,
          baselineVisible,
          ...record(element),
        })),
        trackedPlaceholders: tracked.placeholders.map(({ element, key }) => ({
          key,
          ...placeholder(element),
        })),
        trackedSearch: tracked.search.map(({ element, key, baselineVisible }) => ({
          key,
          baselineVisible,
          ...record(element),
        })),
        trackedProtected: tracked.protected.map(({ element, key, baselineVisible }) => ({
          key,
          baselineVisible,
          ...record(element),
        })),
      };
    },
    {
      rules: adapter.rules,
      protectedSelectors: adapter.protectedSelectors,
      searchInputs: adapter.guide.searchInputs,
      remember: baseline,
    },
  );
}

function compareStages(stages) {
  const enabled = stages.find((stage) => stage.name === 'enabled');
  const paused = stages.find((stage) => stage.name === 'paused');
  const resumed = stages.find((stage) => stage.name === 'resumed');
  const disabled = stages.find((stage) => stage.name === 'disabled');
  const linked = (stage, collection, key) =>
    stage?.dom?.[collection]?.find((node) => node.key === key);
  const proven = (enabled?.dom.trackedTargets ?? []).filter((node) => {
    const p = linked(paused, 'trackedTargets', node.key);
    const r = linked(resumed, 'trackedTargets', node.key);
    const d = linked(disabled, 'trackedTargets', node.key);
    return (
      node.baselineVisible &&
      node.connected &&
      !node.visible &&
      p?.connected &&
      p.visible &&
      r?.connected &&
      !r.visible &&
      d?.connected &&
      d.visible
    );
  });
  const placeholdersProven = (enabled?.dom.trackedPlaceholders ?? []).filter((node) => {
    const p = linked(paused, 'trackedPlaceholders', node.key);
    const r = linked(resumed, 'trackedPlaceholders', node.key);
    const d = linked(disabled, 'trackedPlaceholders', node.key);
    return (
      node.connected &&
      node.opacity === '0' &&
      p?.connected &&
      p.opacity !== '0' &&
      r?.connected &&
      r.opacity === '0' &&
      d?.connected &&
      d.opacity !== '0'
    );
  });
  const preserved = (collection) =>
    (enabled?.dom[collection] ?? [])
      .filter((node) => node.baselineVisible)
      .map((node) => {
        const observations = [enabled, paused, resumed, disabled].map((stage) => ({
          stage: stage.name,
          node: linked(stage, collection, node.key),
        }));
        const connected = observations.filter(({ node }) => node?.connected);
        return {
          key: node.key,
          remainedVisibleInAllConnectedStages:
            connected.length > 0 && connected.every(({ node }) => node.visible),
          allStagesObservedOnSameNode: connected.length === observations.length,
          notObservedStages: observations
            .filter(({ node }) => !node?.connected)
            .map(({ stage }) => stage),
        };
      });
  return {
    extensionStatusObserved: enabled?.status.received === true,
    realElementHideRestoreCycleVerified: proven.length > 0,
    provenElementKeys: proven.map((node) => node.key),
    realPlaceholderHideRestoreCycleVerified: placeholdersProven.length > 0,
    provenPlaceholderKeys: placeholdersProven.map((node) => node.key),
    searchPreservation: preserved('trackedSearch'),
    protectedPreservation: preserved('trackedProtected'),
    interpretation:
      proven.length || placeholdersProven.length
        ? 'Only the listed same-node transitions are verified. This does not verify every module or authenticated behavior.'
        : 'No real target completed a hide/restore cycle. Selector presence, script loading, and configuration changes alone are not an effect pass.',
  };
}

async function runBrowser(name) {
  const directory = join(artifactRoot, name);
  await mkdir(directory, { recursive: true });
  const report = {
    browser: name,
    startedAt: new Date().toISOString(),
    isolatedTemporaryProfile: true,
    authenticated: false,
    permissionMode,
    nativePermissionDialogManuallyVerified: false,
    fingerprint,
    launchSucceeded: false,
    extensionLoaded: false,
    errors: [],
    sites: [],
  };
  const save = () =>
    writeFile(join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  let context;
  try {
    if (name === 'edge') await access(edgePath);
    console.log(`[${name}] launching an isolated temporary profile`);
    context = await chromium.launchPersistentContext('', {
      ...(name === 'edge' ? { executablePath: edgePath } : { channel: 'chromium' }),
      headless: true,
      viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    report.launchSucceeded = true;
    report.version = context.browser()?.version() ?? null;
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null));
    if (!worker) {
      report.limitation =
        'Browser started, but no extension service worker appeared within 10 seconds using the standard isolated side-load command. Test stopped; no security-policy workaround attempted.';
      return report;
    }
    report.extensionLoaded = true;
    report.extensionId = new URL(worker.url()).hostname;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${report.extensionId}/options.html`);
    await options.getByRole('switch', { name: '开启B站的静流', exact: true }).waitFor();
    await options.screenshot({ path: join(directory, 'options-initial.png'), fullPage: true });
    if (permissionMode === 'developer') {
      const manager = await context.newPage();
      await manager.goto(name === 'edge' ? 'edge://extensions' : 'chrome://extensions');
      await manager.evaluate(
        async ({ id, hosts }) => {
          for (const host of hosts) await chrome.developerPrivate.addHostPermission(id, host);
        },
        {
          id: report.extensionId,
          hosts: definitions.map((site) => `${new URL(site.url).origin}/*`),
        },
      );
      await manager.close();
      report.testPregrant = {
        method: `${name === 'edge' ? 'edge' : 'chrome'}://extensions chrome.developerPrivate.addHostPermission(extensionId, host)`,
        appliesOnlyToIsolatedTemporaryProfile: true,
        productionManifestUnchanged: true,
        permissions: await options.evaluate(() => chrome.permissions.getAll()),
        note: 'This prepares real optional host grants for automated content-effect testing; it does not test the native permission confirmation dialog.',
      };
    }
    let nativeApprovalPending = false;
    for (const definition of definitions) {
      console.log(`[${name}/${definition.id}] opening the actual public website`);
      const existingIds = await tabIds(options);
      const page = await context.newPage();
      const live = { ...definition, errors: [], navigation: {}, stages: [] };
      report.sites.push(live);
      const logError = (type, message) => {
        if (live.errors.length < 80) live.errors.push({ type, message: message.slice(0, 700) });
      };
      page.on('pageerror', (error) => logError('pageerror', error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') logError('console', message.text());
      });
      page.on('requestfailed', (request) => {
        try {
          const url = new URL(request.url());
          logError(
            'requestfailed',
            `${url.origin}${url.pathname}: ${request.failure()?.errorText}`,
          );
        } catch {
          /* non-URL request */
        }
      });
      const newIds = (await tabIds(options)).filter((id) => !existingIds.includes(id));
      if (newIds.length !== 1)
        throw new Error(
          `Could not uniquely identify the new live tab (${newIds.length} candidates)`,
        );
      const tabId = newIds[0];
      try {
        const response = await page.goto(definition.url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        live.navigation.status = response?.status() ?? null;
      } catch (error) {
        live.navigation.error = error.message.slice(0, 700);
      }
      await page.waitForTimeout(5500);
      const capture = async (stageName, baseline = false) => {
        let stage;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const statusObservationUrl = page.url();
            stage = {
              name: stageName,
              at: new Date().toISOString(),
              snapshot: await extensionCommand(options, { type: 'get-state' }),
              status: await pageStatus(options, tabId),
              statusObservationUrl,
              dom: await inspectDom(page, adapters[definition.id], baseline),
              observationRetriedAfterSiteNavigation: attempt > 0,
            };
            break;
          } catch (error) {
            if (attempt !== 0 || !/context was destroyed|navigation/i.test(error.message))
              throw error;
            // A site redirect can race a read-only evaluate. Wait for that same
            // navigation; do not reload the site or attempt to evade its checks.
            await page
              .waitForLoadState('domcontentloaded', { timeout: 5000 })
              .catch(() => undefined);
            await page.waitForTimeout(400);
          }
        }
        if (stageName === 'enabled' && stage.dom.guidePresent) {
          try {
            await page
              .locator('#quietfeed-search-guide')
              .getByRole('button', { name: '去搜索' })
              .click({ timeout: 3000 });
            stage.guideSearchFocusVerified = await page.evaluate(
              (selectors) =>
                selectors.some((selector) => document.activeElement?.matches(selector)),
              adapters[definition.id].guide.searchInputs,
            );
          } catch (error) {
            stage.guideSearchFocusVerified = false;
            stage.guideFocusError = error.message.slice(0, 400);
          }
        }
        try {
          await page.screenshot({
            path: join(directory, `${definition.id}-${stageName}.png`),
            fullPage: false,
          });
        } catch (error) {
          stage.screenshotError = error.message.slice(0, 500);
        }
        stage.screenshot = `${definition.id}-${stageName}.png`;
        live.stages.push(stage);
        await save();
        console.log(
          `[${name}/${definition.id}] ${stageName}: status=${stage.status.value?.page ?? 'no content response'}, style=${stage.dom.style.exists}, matched=${stage.status.value?.modules?.filter((module) => module.matched).length ?? 0}`,
        );
      };
      await capture('baseline', true);
      if (nativeApprovalPending) {
        live.limitation =
          'Dependent enable/pause tests skipped because a previous native optional-permission confirmation remained pending in this headless session.';
        await page.close();
        await save();
        continue;
      }
      await options.bringToFront();
      await options
        .getByRole('switch', { name: `开启${definition.name}的静流`, exact: true })
        .click();
      await page.waitForTimeout(1300);
      const configured = await extensionCommand(options, { type: 'get-state' });
      if (!configured.config.sites[definition.id].enabled || !configured.granted[definition.id]) {
        const alerts = await options.getByRole('alert').allTextContents();
        nativeApprovalPending = permissionMode === 'native' && !alerts.length;
        live.limitation = nativeApprovalPending
          ? 'The real optional host-permission request remained pending because this headless test cannot operate the native confirmation UI. This is an automation limitation, not an extension UI failure.'
          : `Enable did not complete: ${alerts.join(' ')}`;
        await capture(nativeApprovalPending ? 'native-permission-pending' : 'enable-failed');
        await page.close();
        continue;
      }
      await capture('enabled');
      const panel = options.getByRole('region', { name: `${definition.name}设置`, exact: true });
      await panel.getByRole('button', { name: '放行一下', exact: true }).click();
      await page.waitForTimeout(550);
      await capture('paused');
      await panel.getByRole('button', { name: '提前结束', exact: true }).click();
      await page.waitForTimeout(550);
      await capture('resumed');
      await options
        .getByRole('switch', { name: `关闭${definition.name}的静流`, exact: true })
        .click();
      await page.waitForTimeout(550);
      await capture('disabled');
      live.summary = compareStages(live.stages);
      if (permissionMode === 'developer') {
        await options
          .getByRole('switch', { name: `开启${definition.name}的静流`, exact: true })
          .click();
        await page.waitForTimeout(400);
        await capture('reenabled-before-revoke');
        live.permissionRemoved = await options.evaluate(
          (origin) => chrome.permissions.remove({ origins: [origin] }),
          `${new URL(definition.url).origin}/*`,
        );
        await page.waitForTimeout(700);
        await capture('revoked');
        const revoked = live.stages.at(-1);
        live.revocationVerified =
          live.permissionRemoved &&
          !revoked.snapshot.granted[definition.id] &&
          !revoked.snapshot.config.sites[definition.id].enabled &&
          !revoked.dom.style.exists &&
          !revoked.dom.guidePresent;
      }
      await page.close();
      await save();
    }
    report.finalSnapshot = await extensionCommand(options, { type: 'get-state' });
    report.permissions = await options.evaluate(() => chrome.permissions.getAll());
    return report;
  } catch (error) {
    report.errors.push({ message: error.message, stack: error.stack?.slice(0, 2000) });
    return report;
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
    await context?.close().catch(() => undefined);
  }
}

function summarize(report) {
  return {
    browser: report.browser,
    permissionMode: report.permissionMode,
    startedAt: report.startedAt,
    fingerprint: report.fingerprint,
    version: report.version,
    launchSucceeded: report.launchSucceeded,
    extensionLoaded: report.extensionLoaded,
    limitation: report.limitation,
    errors: report.errors,
    sites: report.sites.map((site) => ({
      id: site.id,
      navigation: site.navigation,
      summary: site.summary,
      revocationVerified: site.revocationVerified,
      limitation: site.limitation,
    })),
  };
}

const reports = [];
for (const browser of requested === 'all' ? ['chrome', 'edge'] : [requested]) {
  reports.push(summarize(await runBrowser(browser)));
}
// A single-browser rerun retains the other browser only when its production
// build fingerprint is identical; older builds are never silently combined.
for (const browser of ['chrome', 'edge']) {
  if (reports.some((report) => report.browser === browser)) continue;
  try {
    const previous = JSON.parse(await readFile(join(artifactRoot, browser, 'report.json'), 'utf8'));
    if (JSON.stringify(previous.fingerprint) === JSON.stringify(fingerprint))
      reports.push(summarize(previous));
  } catch {
    /* No matching prior evidence. */
  }
}
reports.sort((a, b) => a.browser.localeCompare(b.browser));
await writeFile(join(artifactRoot, 'summary.json'), `${JSON.stringify(reports, null, 2)}\n`);
console.log(JSON.stringify(reports, null, 2));
