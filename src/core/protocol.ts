import type { AppConfig, Mode, SiteId } from './config';

export type Command =
  | { type: 'get-state' }
  | { type: 'set-enabled'; site: SiteId; enabled: boolean }
  | { type: 'set-mode'; site: SiteId; mode: Mode }
  | { type: 'set-module'; site: SiteId; moduleId: string; hidden: boolean }
  | { type: 'reset-site'; site: SiteId }
  | { type: 'pause-site'; site: SiteId }
  | { type: 'resume-site'; site: SiteId };

export interface Snapshot {
  config: AppConfig;
  granted: Record<SiteId, boolean>;
}

export type CommandResult = { ok: true; data: Snapshot } | { ok: false; error: string };

export interface PageStatus {
  site: SiteId;
  page: string;
  active: boolean;
  supported: boolean;
  modules: { id: string; applicable: boolean; matched: boolean }[];
}

export const STATUS_MESSAGE = 'quietfeed:page-status';
