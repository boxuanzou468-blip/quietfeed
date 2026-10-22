import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { SITE_IDS, SITES, siteFromUrl, siteOwnsHost, type SiteId } from '../../src/core/config';
import { STATUS_MESSAGE, type PageStatus } from '../../src/core/protocol';
import { Brand, ErrorNotice, Icon, Loading, SiteMark, SitePanel } from '../../src/ui/components';
import { useAppState } from '../../src/ui/hooks';
import '../../src/ui/styles.css';

function Popup() {
  const state = useAppState();
  const [site, setSite] = useState<SiteId | null>(null);
  const [tabId, setTabId] = useState<number | undefined>();
  const [tabReady, setTabReady] = useState(false);
  const [pageInScope, setPageInScope] = useState(false);
  const [pageStatus, setPageStatus] = useState<PageStatus | null>(null);
  const [pageChecked, setPageChecked] = useState(false);
  const refreshTab = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const currentSite = siteFromUrl(tab?.url);
      setSite(currentSite);
      setPageInScope(
        Boolean(currentSite && tab?.url && siteOwnsHost(currentSite, new URL(tab.url).hostname)),
      );
      setTabId(tab?.id);
    } catch {
      setSite(null);
      setPageInScope(false);
    } finally {
      setTabReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshTab();
  }, [refreshTab]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible') void refreshTab();
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [refreshTab]);
  useEffect(() => {
    let disposed = false;
    setPageStatus(null);
    setPageChecked(false);
    if (
      tabId === undefined ||
      !pageInScope ||
      !site ||
      !state.snapshot?.config.sites[site].enabled ||
      !state.snapshot.granted[site]
    )
      return;
    const check = async () => {
      try {
        const status: PageStatus | undefined = await browser.tabs.sendMessage(tabId, {
          type: STATUS_MESSAGE,
        });
        if (!disposed && status?.site === site) setPageStatus(status);
      } catch {
        // Restricted and not-yet-injected pages are a normal state, not a success.
      } finally {
        if (!disposed) setPageChecked(true);
      }
    };
    void check();
    const timer = window.setTimeout(() => void check(), 450);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [site, tabId, pageInScope, state.snapshot]);

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <Brand compact />
        <button
          type="button"
          className="icon-button settings-link"
          aria-label="打开所有设置"
          title="所有设置"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          <Icon name="settings" size={19} />
        </button>
      </header>
      <ErrorNotice state={state} />
      {!state.snapshot || !tabReady ? (
        <Loading
          retry={() => {
            void state.refresh();
            void refreshTab();
          }}
        />
      ) : site ? (
        <SitePanel
          site={site}
          state={state}
          pageStatus={pageStatus}
          pageChecked={pageChecked}
          pageInScope={pageInScope}
          compact
        />
      ) : (
        <div className="welcome-panel">
          <div className="welcome-art">
            <span />
            <span />
            <Icon name="leaf" size={43} />
          </div>
          <span className="eyebrow">少一点推荐，多一点主动</span>
          <h1>
            带着目的，
            <br />
            打开一个网站。
          </h1>
          <p>静流帮你收起信息流，把搜索和选择留给你。先去一个支持的网站试试。</p>
          <div className="site-launch-list">
            {SITE_IDS.map((id) => (
              <a key={id} href={SITES[id].homeUrl} target="_blank" rel="noreferrer">
                <SiteMark site={id} />
                <div>
                  <strong>{SITES[id].shortName}</strong>
                  <span>
                    {state.snapshot?.config.sites[id].enabled && state.snapshot.granted[id]
                      ? '静流已开启'
                      : '打开后可按站启用'}
                  </span>
                </div>
                <Icon name="arrow" size={17} />
              </a>
            ))}
          </div>
        </div>
      )}
      <footer className="popup-footer">
        <span>
          <Icon name="shield" size={12} />
          本地运行 · 按站授权
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          所有设置
          <Icon name="arrow" size={12} />
        </button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
