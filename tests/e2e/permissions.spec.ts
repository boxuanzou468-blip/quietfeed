import { test, expect, openSettings } from './extension-fixture';
import { SITE_IDS, SITES } from '../../src/core/config';

test.use({ preauthorize: false });

test('a fresh production install has no website access and cannot enable an ungranted site', async ({
  context,
  extensionId,
}) => {
  const options = await openSettings(context, extensionId);
  const permissions = await options.evaluate(() => chrome.permissions.getAll());
  expect(permissions.origins ?? []).toEqual([]);
  const manifest = await options.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.optional_host_permissions).toEqual(
    SITE_IDS.flatMap((site) => SITES[site].origins),
  );
  for (const site of SITE_IDS) {
    await expect(
      options.getByRole('switch', { name: `开启${SITES[site].shortName}的静流` }),
    ).toHaveAttribute('aria-checked', 'false');
  }
  const denied = await options.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'set-enabled', site: 'bilibili', enabled: true }),
  );
  expect(denied.ok).toBe(false);
  await expect(options.getByRole('switch', { name: '开启B站的静流' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});
