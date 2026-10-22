import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { CONFIG_KEY, SITES, type SiteId } from '../core/config';
import { sendCommand } from '../core/client';
import type { Command, Snapshot } from '../core/protocol';

export function useAppState() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await sendCommand({ type: 'get-state' });
      if (current === revision.current) setSnapshot(next);
    } catch (cause) {
      if (current === revision.current) setError(message(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const changed = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && CONFIG_KEY in changes) void refresh();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const permissionsChanged = () => void refresh();
    browser.storage.onChanged.addListener(changed);
    browser.permissions.onAdded.addListener(permissionsChanged);
    browser.permissions.onRemoved.addListener(permissionsChanged);
    document.addEventListener('visibilitychange', visible);
    return () => {
      browser.storage.onChanged.removeListener(changed);
      browser.permissions.onAdded.removeListener(permissionsChanged);
      browser.permissions.onRemoved.removeListener(permissionsChanged);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);

  const run = useCallback(async (command: Command) => {
    setBusy(true);
    setError('');
    try {
      ++revision.current;
      setSnapshot(await sendCommand(command));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  const setEnabled = useCallback(async (site: SiteId, enabled: boolean) => {
    setBusy(true);
    setError('');
    try {
      // Request directly from the click handler, before any awaited operation.
      if (enabled && !(await browser.permissions.request({ origins: SITES[site].origins }))) {
        throw new Error(
          `未获得${SITES[site].shortName}的访问权限。允许访问后，静流才能隐藏页面区域。`,
        );
      }
      ++revision.current;
      setSnapshot(await sendCommand({ type: 'set-enabled', site, enabled }));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  return { snapshot, error, busy, refresh, run, setEnabled, dismissError: () => setError('') };
}

export type AppState = ReturnType<typeof useAppState>;

export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : '操作未完成，请稍后重试。';
}
