import 'server-only';
import { getStore, readAllGuildConfigs, readLogEntries, readActionItems } from './store';
import { MODES, TIERS, MODE_ICONS, TIER_COLORS, tierRank } from '@/src/core/config.js';
import type { ActionItem, Application, BotState, GuildConfig, GuildResult, GuildSummary, LogEntry, StorageState } from './types';

const ONLINE_WINDOW_MS = 90_000;

/** Read the heartbeat the bot writes into the shared store. */
export async function getBotState(): Promise<BotState> {
  const store = await getStore();
  const raw = (await store.get('system:bot')) as Record<string, any> | null;
  const heartbeat = raw?.heartbeatAt ?? (raw?.updatedAt ? Date.parse(raw.updatedAt) : 0);
  const online = Boolean(raw) && Date.now() - heartbeat < ONLINE_WINDOW_MS;
  const startedAt = raw?.startedAt ?? null;
  return {
    online,
    status: online ? 'online' : raw?.status === 'connecting' ? 'connecting' : 'offline',
    version: raw?.version ?? '—',
    sessionId: raw?.sessionId ?? null,
    startedAt,
    lastSeen: raw?.updatedAt ?? null,
    uptimeMs: startedAt ? Date.now() - Date.parse(startedAt) : 0,
    user: raw?.user ?? null,
    guildCount: raw?.guildCount ?? raw?.guilds?.length ?? 0,
    latency: raw?.latency ?? 0,
    memory: raw?.memory ?? 0,
    guilds: raw?.guilds ?? []
  };
}

export async function getStorageState(): Promise<StorageState> {
  const store = await getStore();
  return {
    kind: store.kind,
    location: store.location ?? store.kind,
    ephemeral: Boolean((store as { ephemeral?: boolean }).ephemeral)
  };
}

function flattenResults(guilds: Record<string, GuildConfig>): (GuildResult & { guildId: string })[] {
  const rows: (GuildResult & { guildId: string })[] = [];
  for (const guild of Object.values(guilds)) {
    for (const [userId, byMode] of Object.entries(guild.results || {})) {
      for (const [mode, result] of Object.entries(byMode || {})) {
        if (!result?.tier) continue;
        rows.push({ ...result, userId, mode, guildId: guild.id });
      }
    }
  }
  return rows;
}

export interface ModeStat {
  mode: string;
  icon: string;
  total: number;
  tiers: Record<string, number>;
}

export interface Overview {
  bot: BotState;
  storage: StorageState;
  stats: {
    guilds: number;
    players: number;
    results: number;
    applications: number;
    pendingApplications: number;
    queuedPlayers: number;
    modesConfigured: number;
  };
  activity: LogEntry[];
  modeStats: ModeStat[];
  leaderboard: (GuildResult & { guildId: string })[];
  tierSpread: { tier: string; count: number; color: string }[];
  actions: ActionItem[];
}

export async function getOverview(): Promise<Overview> {
  const [bot, storage, guilds, activity, actions] = await Promise.all([
    getBotState(),
    getStorageState(),
    readAllGuildConfigs(),
    readLogEntries(40),
    readActionItems()
  ]);

  const results = flattenResults(guilds);
  const players = new Set(results.map(r => `${r.guildId}:${r.userId}`)).size;
  const applications = Object.values(guilds).reduce((sum, g) => sum + (g.applications?.length || 0), 0);
  const pendingApplications = Object.values(guilds).reduce(
    (sum, g) => sum + (g.applications || []).filter(a => !a.status || a.status === 'pending').length,
    0
  );
  const queuedPlayers = Object.values(guilds).reduce((sum, g) => sum + (g.queue?.length || 0), 0);

  const modeStats: ModeStat[] = MODES.map(mode => {
    const tiers: Record<string, number> = {};
    let total = 0;
    for (const row of results) {
      if (row.mode !== mode) continue;
      total += 1;
      tiers[row.tier] = (tiers[row.tier] || 0) + 1;
    }
    return { mode, icon: MODE_ICONS[mode] || '🎮', total, tiers };
  });

  const tierSpread = TIERS.map(tier => ({
    tier,
    count: results.filter(r => r.tier === tier).length,
    color: TIER_COLORS[tier]
  }));

  const leaderboard = results
    .slice()
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 12);

  return {
    bot,
    storage,
    stats: {
      guilds: Object.keys(guilds).length,
      players,
      results: results.length,
      applications,
      pendingApplications,
      queuedPlayers,
      modesConfigured: Object.values(guilds).filter(g => Object.keys(g.roles || {}).length > 0).length
    },
    activity,
    modeStats,
    leaderboard,
    tierSpread,
    actions: actions.slice(-25).reverse()
  };
}

export async function getGuildSummaries(): Promise<GuildSummary[]> {
  const guilds = await readAllGuildConfigs();
  return Object.values(guilds)
    .map(guild => {
      const results = Object.values(guild.results || {});
      const players = new Set(results.map(r => Object.keys(r || {}))).size;
      const totalResults = results.reduce((sum, byMode) => sum + Object.keys(byMode || {}).length, 0);
      const lastActivity = results
        .flatMap(byMode => Object.values(byMode || {}))
        .map(r => r.updatedAt)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      return {
        id: guild.id,
        name: guild.name || guild.id,
        icon: guild.icon ?? null,
        memberCount: guild.memberCount ?? null,
        modes: Object.keys(guild.roles || {}),
        players,
        results: totalResults,
        pendingApplications: (guild.applications || []).filter(a => !a.status || a.status === 'pending').length,
        queueLength: guild.queue?.length || 0,
        updatedAt: guild.updatedAt ?? null,
        lastActivity
      } satisfies GuildSummary;
    })
    .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
}

export interface GuildDetail {
  guild: GuildConfig;
  leaderboards: { mode: string; icon: string; rows: GuildResult[] }[];
  recent: GuildResult[];
  applications: Application[];
  queue: string[];
  modeTotals: { mode: string; icon: string; total: number }[];
}

export async function getGuildDetail(guildId: string): Promise<GuildDetail | null> {
  const guilds = await readAllGuildConfigs();
  const guild = guilds[guildId];
  if (!guild) return null;

  const results = flattenResults({ [guildId]: guild });
  const leaderboards = MODES.map(mode => ({
    mode,
    icon: MODE_ICONS[mode] || '🎮',
    rows: results
      .filter(r => r.mode === mode)
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  })).filter(entry => entry.rows.length > 0);

  const recent = results
    .slice()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 40);

  const modeTotals = MODES.map(mode => ({
    mode,
    icon: MODE_ICONS[mode] || '🎮',
    total: results.filter(r => r.mode === mode).length
  }));

  return {
    guild,
    leaderboards,
    recent,
    applications: [...(guild.applications || [])].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    ),
    queue: guild.queue || [],
    modeTotals
  };
}
