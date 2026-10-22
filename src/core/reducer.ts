import { defaultSiteConfig, isSiteId, PAUSE_MS, SITES, type AppConfig } from './config';
import type { Command } from './protocol';

export function parseCommand(value: unknown): Command {
  if (!value || typeof value !== 'object') throw new Error('无法识别的操作。');
  const message = value as Record<string, unknown>;
  if (message.type === 'get-state') return { type: 'get-state' };
  if (!isSiteId(message.site)) throw new Error('此网站尚不受支持。');
  const site = message.site;
  switch (message.type) {
    case 'set-enabled':
      if (typeof message.enabled === 'boolean')
        return { type: message.type, site, enabled: message.enabled };
      break;
    case 'set-mode':
      if (message.mode === 'search' || message.mode === 'custom')
        return { type: message.type, site, mode: message.mode };
      break;
    case 'set-module':
      if (
        typeof message.moduleId === 'string' &&
        SITES[site].modules.some(({ id }) => id === message.moduleId) &&
        typeof message.hidden === 'boolean'
      ) {
        return { type: message.type, site, moduleId: message.moduleId, hidden: message.hidden };
      }
      break;
    case 'reset-site':
    case 'pause-site':
    case 'resume-site':
      return { type: message.type, site };
  }
  throw new Error('操作参数无效，请重新打开静流后重试。');
}

export function reduceConfig(config: AppConfig, command: Command, now = Date.now()): AppConfig {
  const next = structuredClone(config);
  if (command.type === 'get-state') return next;
  const site = next.sites[command.site];
  switch (command.type) {
    case 'set-enabled':
      site.enabled = command.enabled;
      if (!command.enabled) site.allowUntil = null;
      break;
    case 'set-mode':
      site.mode = command.mode;
      if (command.mode === 'search')
        site.hiddenModules = defaultSiteConfig(command.site).hiddenModules;
      break;
    case 'set-module':
      site.hiddenModules[command.moduleId] = command.hidden;
      site.mode = 'custom';
      break;
    case 'reset-site':
      next.sites[command.site] = { ...defaultSiteConfig(command.site), enabled: site.enabled };
      break;
    case 'pause-site':
      if (!site.enabled) throw new Error('请先启用此网站，再临时放行。');
      site.allowUntil = now + PAUSE_MS;
      break;
    case 'resume-site':
      site.allowUntil = null;
      break;
  }
  return next;
}
