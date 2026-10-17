import 'server-only';
import { getStore as coreGetStore, KEYS, readLogs, listGuildIds, readGuild, writeGuild, readAllGuilds, enqueueAction, listActions, claimAction, completeAction } from '@/src/core/store.js';
import type { ActionItem, GuildConfig, LogEntry } from './types';

export const storeKeys = KEYS;
export { readLogs, listGuildIds, readGuild, writeGuild, readAllGuilds, enqueueAction, listActions, claimAction, completeAction };

export async function getStore() {
  return coreGetStore();
}

export async function readGuildConfig(guildId: string): Promise<GuildConfig | null> {
  const store = await getStore();
  const guild = await readGuild(store, guildId);
  return (guild as GuildConfig | null) ?? null;
}

export async function readAllGuildConfigs(): Promise<Record<string, GuildConfig>> {
  const store = await getStore();
  return (await readAllGuilds(store)) as Record<string, GuildConfig>;
}

export async function readLogEntries(limit = 200, since?: string): Promise<LogEntry[]> {
  const store = await getStore();
  return (await readLogs(store, { limit, since } as { limit?: number; since?: string })) as LogEntry[];
}

export async function readActionItems(): Promise<ActionItem[]> {
  const store = await getStore();
  return (await listActions(store)) as ActionItem[];
}
