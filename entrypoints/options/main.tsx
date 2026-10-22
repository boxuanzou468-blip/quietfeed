import React from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { SITE_IDS, SITES } from '../../src/core/config';
import { Brand, ErrorNotice, Icon, Loading, SitePanel } from '../../src/ui/components';
import { useAppState } from '../../src/ui/hooks';
import '../../src/ui/styles.css';

function Options() {
  const state = useAppState();
  return (
    <div className="options-shell">
      <header className="options-header">
        <Brand />
        <span className="version-label">设置 / v{browser.runtime.getManifest().version}</span>
      </header>
      <main>
        <section className="options-hero">
          <div>
            <span className="eyebrow">YOUR ATTENTION, YOUR CHOICE</span>
            <h1>
              把注意力，
              <br />
              留给自己。
            </h1>
            <p>
              搜索你想看的，收起不请自来的。
              <br />
              每个网站，都可以有自己的节奏。
            </p>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="illustration-window">
              <div className="illustration-dots">
                <i />
                <i />
                <i />
              </div>
              <div className="illustration-search">
                <Icon name="search" size={17} />
                <span>今天，想找点什么？</span>
              </div>
              <div className="illustration-empty">
                <Icon name="leaf" size={42} />
                <span>留一点空白。</span>
              </div>
            </div>
            <span className="illustration-note">a little less, a little clearer.</span>
          </div>
        </section>
        <div className="options-section-heading">
          <div>
            <h2>你的网站，你来决定</h2>
            <p>开关开启表示隐藏该项。设置自动保存，已打开的页面同步生效。</p>
          </div>
          <span className="local-tag">
            <Icon name="shield" size={14} />
            仅保存在这台浏览器
          </span>
        </div>
        <nav className="site-shortcuts" aria-label="选择网站">
          {SITE_IDS.map((site) => (
            <a key={site} href={`#site-${site}`}>
              {SITES[site].shortName}
            </a>
          ))}
        </nav>
        <ErrorNotice state={state} />
        {!state.snapshot ? (
          <Loading retry={() => void state.refresh()} />
        ) : (
          <div className="sites-grid">
            {SITE_IDS.map((site) => (
              <SitePanel key={site} site={site} state={state} />
            ))}
          </div>
        )}
        <section className="explanation-strip">
          <div>
            <Icon name="shield" size={21} />
            <h3>权限，由你开启</h3>
            <p>只在你启用的网站运行。关闭后立即恢复原样，浏览器授权仍保留，可在扩展管理中撤销。</p>
          </div>
          <div>
            <Icon name="search" size={21} />
            <h3>正常使用，照旧</h3>
            <p>保留搜索、详情、评论和原站登录。登录请在原网站完成；未适配页面保留原样。</p>
          </div>
          <div>
            <Icon name="clock" size={21} />
            <h3>偶尔放空，也可以</h3>
            <p>临时放行持续 10 分钟，同站标签页一起生效。关闭浏览器或电脑休眠，不会重新计时。</p>
          </div>
        </section>
      </main>
      <footer className="options-footer">
        <Brand compact />
        <p>少一点无尽滚动，多一点自己的时间。</p>
        <span>QuietFeed · 开源 · 本地运行</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
