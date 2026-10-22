import { effectiveState, remainingSeconds, SITES, type SiteId } from '../core/config';
import type { PageStatus } from '../core/protocol';
import type { AppState } from './hooks';
import { useNow } from './hooks';

export function Icon({
  name,
  size = 18,
}: {
  name:
    | 'leaf'
    | 'arrow'
    | 'settings'
    | 'search'
    | 'sliders'
    | 'clock'
    | 'shield'
    | 'check'
    | 'close'
    | 'reset';
  size?: number;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    leaf: (
      <>
        <path d="M20 4c-1 8-5 15-12 14C1 17 3 7 10 6c4-.5 7-1 10-2Z" />
        <path d="M5 21c2-6 5-9 10-12" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    settings: (
      <>
        <path d="m9 4 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3 2 .2Z" />
        <circle cx="12" cy="11.5" r="3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h7m4 0h5M4 17h2m4 0h10" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    reset: (
      <>
        <path d="M4 5v5h5M4.5 10a8 8 0 1 1 .8 7" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <span className="brand-mark">
        <Icon name="leaf" size={compact ? 20 : 25} />
      </span>
      <span className="brand-name">
        静流<span className="brand-english">QuietFeed</span>
      </span>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      className="toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

export function ErrorNotice({ state }: { state: AppState }) {
  if (!state.error) return null;
  return (
    <div className="error-notice" role="alert">
      <span>{state.error}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="关闭提示"
        onClick={state.dismissError}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}

export function Loading({ retry }: { retry: () => void }) {
  return (
    <div className="loading-state">
      <span className="loading-dot" />
      <p>正在读取你的设置…</p>
      <button className="text-button" type="button" onClick={retry}>
        重新读取
      </button>
    </div>
  );
}

export function SiteMark({ site }: { site: SiteId }) {
  return (
    <span className={`site-mark ${site}`}>
      {site === 'bilibili' ? (
        <svg
          aria-hidden="true"
          width="26"
          height="24"
          viewBox="0 0 28 26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="6" width="22" height="16" rx="4" />
          <path d="m9 2 4 4m6-4-4 4M9 12v4m10-4v4m-8 3h6" />
        </svg>
      ) : (
        <span className="site-glyph">
          {{ xiaohongshu: '红', baidu: '百', csdn: 'C', zhihu: '知' }[site]}
        </span>
      )}
    </span>
  );
}

export function SitePanel({
  site,
  state,
  pageStatus,
  pageChecked = false,
  pageInScope = true,
  compact = false,
}: {
  site: SiteId;
  state: AppState;
  pageStatus?: PageStatus | null;
  pageChecked?: boolean;
  pageInScope?: boolean;
  compact?: boolean;
}) {
  const now = useNow();
  if (!state.snapshot) return null;
  const definition = SITES[site];
  const config = state.snapshot.config.sites[site];
  const granted = state.snapshot.granted[site];
  const status = effectiveState(config, now);
  const enabled = config.enabled && granted;
  const paused = enabled && status === 'paused';
  const seconds = remainingSeconds(config, now);
  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const badge = !enabled ? '未启用' : paused ? '临时放行' : '专注已开启';
  const moduleCount = definition.modules.filter(({ id }) => config.hiddenModules[id]).length;

  return (
    <section
      id={`site-${site}`}
      className={`site-panel${compact ? ' site-panel-compact' : ''}`}
      aria-label={`${definition.shortName}设置`}
    >
      <div className="site-heading">
        <SiteMark site={site} />
        <div className="site-title">
          <h2>{definition.shortName}</h2>
          <span>{definition.domain}</span>
        </div>
        <span className={`status-badge ${enabled ? (paused ? 'paused' : 'enabled') : ''}`}>
          <i />
          {badge}
        </span>
      </div>
      {definition.experimentalNote && (
        <p className="site-experimental-note">{definition.experimentalNote}</p>
      )}
      <div className="site-enable">
        <div>
          <strong>在{definition.shortName}使用静流</strong>
          <p>{enabled ? '随时关闭，页面立即恢复。' : '开启时，只申请这个网站的权限。'}</p>
        </div>
        <Toggle
          checked={enabled}
          disabled={state.busy}
          label={`${enabled ? '关闭' : '开启'}${definition.shortName}的静流`}
          onChange={() => void state.setEnabled(site, !enabled)}
        />
      </div>

      <div className="section-label">
        <span>浏览方式</span>
        <span>按网站独立保存</span>
      </div>
      <div className="mode-picker" role="group" aria-label="浏览方式">
        <button
          type="button"
          className={config.mode === 'search' ? 'selected' : ''}
          disabled={state.busy}
          aria-pressed={config.mode === 'search'}
          onClick={() => void state.run({ type: 'set-mode', site, mode: 'search' })}
        >
          <Icon name="search" size={16} />
          搜索优先
        </button>
        <button
          type="button"
          className={config.mode === 'custom' ? 'selected' : ''}
          disabled={state.busy}
          aria-pressed={config.mode === 'custom'}
          onClick={() => void state.run({ type: 'set-mode', site, mode: 'custom' })}
        >
          <Icon name="sliders" size={16} />
          自定义
        </button>
      </div>
      <p className="mode-description">
        {config.mode === 'search'
          ? '收起全部内置推荐区域，保留搜索与主动浏览。'
          : '选择想收起的区域，其余按原站显示。'}
      </p>

      <div className="section-label modules-heading">
        <span>隐藏这些内容</span>
        <span>
          {moduleCount} / {definition.modules.length} 项
        </span>
      </div>
      <div className="module-list">
        {definition.modules.map((module) => {
          const match = pageStatus?.modules.find(({ id }) => id === module.id);
          return (
            <div className="module-row" key={module.id}>
              <div>
                <span className="module-name">{module.label}</span>
                {!compact && <p>{module.description}</p>}
                {enabled && status === 'active' && match?.applicable && !match.matched && (
                  <span className="module-unmatched">此页暂未匹配</span>
                )}
              </div>
              <Toggle
                checked={config.hiddenModules[module.id] === true}
                disabled={state.busy}
                label={`隐藏${module.label}`}
                onChange={() =>
                  void state.run({
                    type: 'set-module',
                    site,
                    moduleId: module.id,
                    hidden: !config.hiddenModules[module.id],
                  })
                }
              />
            </div>
          );
        })}
      </div>

      <div className={`pause-block${paused ? ' is-paused' : ''}`}>
        <div className="pause-copy">
          <Icon name="clock" size={18} />
          <div>
            <strong>{paused ? `还有 ${countdown}` : '想随便逛一会儿？'}</strong>
            <span>{paused ? '到时自动恢复这份隐藏设置' : '临时放行 10 分钟，到时自动恢复'}</span>
          </div>
        </div>
        <button
          className="pause-button"
          type="button"
          disabled={state.busy || !enabled}
          onClick={() => void state.run({ type: paused ? 'resume-site' : 'pause-site', site })}
        >
          {paused ? '提前结束' : '放行一下'}
        </button>
      </div>
      {compact && (
        <PageFeedback
          enabled={enabled}
          paused={paused}
          status={pageStatus}
          checked={pageChecked}
          inScope={pageInScope}
        />
      )}
      {!compact && (
        <div className="site-card-footer">
          <a href={definition.homeUrl} target="_blank" rel="noreferrer">
            打开{definition.shortName}
            <Icon name="arrow" size={14} />
          </a>
          <button
            className="text-button reset-button"
            disabled={state.busy}
            type="button"
            onClick={() => void state.run({ type: 'reset-site', site })}
            title="恢复搜索优先、隐藏全部内置模块，并结束临时放行"
          >
            <Icon name="reset" size={13} />
            恢复搜索优先
          </button>
        </div>
      )}
    </section>
  );
}

function PageFeedback({
  enabled,
  paused,
  status,
  checked,
  inScope,
}: {
  enabled: boolean;
  paused: boolean;
  status?: PageStatus | null;
  checked: boolean;
  inScope: boolean;
}) {
  if (!enabled)
    return (
      <div className="page-feedback">
        <span className="feedback-dot" />
        设置已保存，开启后应用到此站点。
      </div>
    );
  if (paused)
    return (
      <div className="page-feedback">
        <span className="feedback-dot amber" />
        当前网站暂时显示原始内容。
      </div>
    );
  if (!inScope)
    return (
      <div className="page-feedback">
        <span className="feedback-dot" />
        此页面保留原样，静流仅处理已适配页面。
      </div>
    );
  if (status?.page.toLowerCase().includes('login'))
    return (
      <div className="page-feedback">
        <Icon name="shield" size={14} />
        请在原网站完成登录，静流不会代为登录。
      </div>
    );
  if (!status)
    return (
      <div className="page-feedback">
        <span className="feedback-dot" />
        {checked ? '页面尚未回应，刷新网页后可重新检查。' : '正在检查当前页面…'}
      </div>
    );
  if (!status.supported)
    return (
      <div className="page-feedback">
        <span className="feedback-dot" />
        此页面暂不处理，内容保留原样。
      </div>
    );
  const applicable = status.modules.filter((module) => module.applicable);
  const matched = applicable.filter((module) => module.matched).length;
  if (!status.active)
    return (
      <div className="page-feedback">
        <span className="feedback-dot" />
        当前页面未应用隐藏规则。
      </div>
    );
  return (
    <div className="page-feedback">
      <span className="feedback-dot green" />
      {applicable.length
        ? `当前页已匹配 ${matched} / ${applicable.length} 个适用区域`
        : '此页没有需要隐藏的区域，保留正常使用。'}
    </div>
  );
}
