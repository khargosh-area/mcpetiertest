export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: unknown;
}

export interface BotUser {
  id: string;
  tag: string;
  username: string;
  avatar: string | null;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  modes: string[];
  players: number;
  results: number;
  pendingApplications: number;
  queueLength: number;
  updatedAt: string | null;
  lastActivity: string | null;
}

export interface GuildResult {
  userId: string;
  tier: string;
  mode: string;
  guildId?: string;
  gamertag?: string;
  note?: string;
  region?: string;
  device?: string;
  tester?: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  gamertag: string;
  mode: string;
  note: string;
  status?: string;
  createdAt: string;
  handledAt?: string;
}

export interface GuildConfig {
  id: string;
  name?: string;
  icon?: string | null;
  memberCount?: number | null;
  roles: Record<string, Record<string, string>>;
  testerRoles?: Record<string, string>;
  channels?: Record<string, string>;
  resultsChannel?: string;
  highResultsChannel?: string;
  results: Record<string, Record<string, GuildResult>>;
  queue?: string[];
  applications?: Application[];
  updatedAt?: string;
}

export interface BotState {
  online: boolean;
  status: string;
  version: string;
  sessionId: string | null;
  startedAt: string | null;
  lastSeen: string | null;
  uptimeMs: number;
  user: BotUser | null;
  guildCount: number;
  latency: number;
  memory: number;
  guilds: { id: string; name: string; memberCount: number | null; icon: string | null }[];
}

export interface StorageState {
  kind: string;
  location: string;
  ephemeral: boolean;
}

export interface ActionItem {
  id: string;
  type: string;
  guildId?: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  result?: { ok?: boolean; message?: string; error?: string };
  payload?: Record<string, unknown>;
  requestedBy?: string;
}
