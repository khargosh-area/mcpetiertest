/**
 * Storage layer for TierTestBot.
 *
 * The bot and the dashboard both talk to the same store so the control panel
 * always shows live data. Three adapters are supported:
 *
 *   postgres  – any Postgres (Neon, Supabase, Vercel Postgres, Railway, ...)
 *               selected automatically when DATABASE_URL / POSTGRES_URL is set.
 *   file      – JSON files on disk, used for local development.
 *   memory    – last-resort fallback, data is lost on restart.
 *
 * The API is intentionally tiny (get / set / del / list / push / update) so the
 * dashboard, the bot and the deployment tooling can share it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_LIST_ITEMS = 500;

/** Keys used across the app. */
export const KEYS = {
  guildsIndex: 'guilds:index',
  guild: id => `guild:${id}`,
  bot: 'system:bot',
  control: 'system:control',
  logs: 'system:logs',
  queue: 'system:queue',
  meta: 'system:meta'
};

export function resolveStoreKind(env = process.env) {
  if (env.DATABASE_URL || env.POSTGRES_URL) return 'postgres';
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return 'kv';
  return 'file';
}

function defaultDataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  if (process.env.VERCEL) return path.join('/tmp', 'tiertestbot');
  return path.join(process.cwd(), 'data');
}

/* ------------------------------------------------------------------ file -- */

function createFileStore(dir) {
  const fileFor = key => path.join(dir, `${encodeURIComponent(key)}.json`);
  let chain = Promise.resolve();
  /** Serialises writes so concurrent guild updates never clobber each other. */
  const lock = fn => {
    const run = chain.then(fn, fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  const readJson = async file => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return null;
    }
  };
  return {
    kind: 'file',
    location: dir,
    ephemeral: Boolean(process.env.VERCEL) && !process.env.DATABASE_URL && !process.env.POSTGRES_URL,
    async get(key) {
      return readJson(fileFor(key));
    },
    async set(key, value) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fileFor(key), JSON.stringify(value, null, 2));
      return value;
    },
    async del(key) {
      await fs.rm(fileFor(key), { force: true });
    },
    async list(key) {
      const value = await readJson(fileFor(key));
      return Array.isArray(value) ? value : [];
    },
    async push(key, item) {
      return lock(async () => {
        const items = (await readJson(fileFor(key))) || [];
        items.push(item);
        while (items.length > MAX_LIST_ITEMS) items.shift();
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fileFor(key), JSON.stringify(items));
        return items.length;
      });
    },
    async update(key, fn) {
      return lock(async () => {
        const current = (await readJson(fileFor(key))) || null;
        const next = await fn(current);
        if (next === undefined) return current;
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fileFor(key), JSON.stringify(next, null, 2));
        return next;
      });
    }
  };
}

/* -------------------------------------------------------------- postgres -- */

async function createPostgresStore(connectionString) {
  const { Pool } = await import('pg');
  const isLocal = /@localhost:|@127\.0\.0\.1:/.test(connectionString);
  const sslDisabled = /sslmode=disable/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX || 4),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ...(sslDisabled || isLocal ? {} : { ssl: { rejectUnauthorized: false } })
  });
  pool.on('error', error => console.error('[STORE] postgres pool error:', error.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tt_kv (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tt_list (
      key text PRIMARY KEY,
      items jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  return {
    kind: 'postgres',
    location: connectionString.replace(/\/\/[^@]*@/, '//***@'),
    ephemeral: false,
    async get(key) {
      const { rows } = await pool.query('SELECT value FROM tt_kv WHERE key = $1', [key]);
      return rows.length ? rows[0].value : null;
    },
    async set(key, value) {
      await pool.query(
        `INSERT INTO tt_kv (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
      return value;
    },
    async del(key) {
      await pool.query('DELETE FROM tt_kv WHERE key = $1', [key]);
    },
    async list(key) {
      const { rows } = await pool.query('SELECT items FROM tt_list WHERE key = $1', [key]);
      return rows.length ? rows[0].items : [];
    },
    async push(key, item) {
      const { rows } = await pool.query(
        `INSERT INTO tt_list (key, items, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET
           items = (SELECT jsonb_agg(value) FROM (
             SELECT value FROM (
               SELECT jsonb_array_elements(tt_list.items) || $2::jsonb AS value
               FROM tt_list WHERE tt_list.key = $1
             ) merged
             ORDER BY 1
           ) kept LIMIT $3) WHERE kept.value IS NOT NULL),
           updated_at = now()
         RETURNING jsonb_array_length(items) AS count`,
        [key, JSON.stringify([item]), MAX_LIST_ITEMS]
      );
      return rows[0]?.count ?? 0;
    },
    async update(key, fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT value FROM tt_kv WHERE key = $1 FOR UPDATE', [key]);
        const current = rows.length ? rows[0].value : null;
        const next = await fn(current);
        if (next === undefined) {
          await client.query('COMMIT');
          return current;
        }
        await client.query(
          `INSERT INTO tt_kv (key, value, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(next)]
        );
        await client.query('COMMIT');
        return next;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

/* ------------------------------------------------------------------ kv --- */

async function createKvStore(url, token) {
  const base = url.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (path, init) => {
    const res = await fetch(`${base}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`kv ${path} -> ${res.status}`);
    return res.json();
  };
  return {
    kind: 'kv',
    location: base,
    ephemeral: false,
    async get(key) {
      try {
        const data = await call(`/get/${encodeURIComponent(key)}`);
        return data.result ? JSON.parse(data.result) : null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await call(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(value) });
      return value;
    },
    async del(key) {
      await call(`/del/${encodeURIComponent(key)}`, { method: 'POST' });
    },
    async list(key) {
      try {
        const data = await call(`/lrange/${encodeURIComponent(key)}/0/${MAX_LIST_ITEMS - 1}`);
        return (data.result || []).map(item => (typeof item === 'string' ? JSON.parse(item) : item));
      } catch {
        return [];
      }
    },
    async push(key, item) {
      const items = await this.list(key);
      items.push(item);
      while (items.length > MAX_LIST_ITEMS) items.shift();
      await call(`/set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items) });
      return items.length;
    },
    async update(key, fn) {
      const current = await this.get(key);
      const next = await fn(current);
      if (next === undefined) return current;
      await this.set(key, next);
      return next;
    }
  };
}

/* ---------------------------------------------------------------- memory -- */

function createMemoryStore() {
  const kv = new Map();
  const lists = new Map();
  return {
    kind: 'memory',
    location: 'in-process memory',
    ephemeral: true,
    async get(key) {
      return kv.has(key) ? kv.get(key) : null;
    },
    async set(key, value) {
      kv.set(key, value);
      return value;
    },
    async del(key) {
      kv.delete(key);
    },
    async list(key) {
      return lists.get(key) || [];
    },
    async push(key, item) {
      const items = lists.get(key) || [];
      items.push(item);
      while (items.length > MAX_LIST_ITEMS) items.shift();
      lists.set(key, items);
      return items.length;
    },
    async update(key, fn) {
      const current = kv.has(key) ? kv.get(key) : null;
      const next = await fn(current);
      if (next === undefined) return current;
      kv.set(key, next);
      return next;
    }
  };
}

/* ----------------------------------------------------------------- api --- */

let cached = null;

export async function getStore() {
  if (cached) return cached;
  const kind = resolveStoreKind();
  try {
    if (kind === 'postgres') {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      cached = await createPostgresStore(url);
    } else if (kind === 'kv') {
      cached = await createKvStore(process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN);
    } else {
      cached = createFileStore(defaultDataDir());
    }
  } catch (error) {
    console.error('[STORE] failed to initialise', kind, 'store:', error.message);
    cached = createMemoryStore();
  }
  return cached;
}

/** Test helper — lets the dashboard force a specific adapter. */
export function __setStore(store) {
  cached = store;
  return cached;
}

/* -------------------------------------------------------------- helpers -- */

/** Append a structured log line to the shared ring buffer. */
export async function logEvent(store, level, scope, message, meta) {
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    level,
    scope,
    message: String(message ?? '').slice(0, 2000),
    ...(meta ? { meta } : {})
  };
  try {
    await store.push(KEYS.logs, entry);
  } catch (error) {
    console.error('[STORE] log write failed:', error.message);
  }
  return entry;
}

/** Read the tail of the shared log buffer. */
export async function readLogs(store, { limit = 200, since } = {}) {
  const items = await store.list(KEYS.logs);
  const filtered = since ? items.filter(item => item.ts > since) : items;
  return filtered.slice(-limit);
}

/** Guild ids known to the bot (index maintained by the bot + dashboard). */
export async function listGuildIds(store) {
  const index = await store.list(KEYS.guildsIndex);
  return index.map(entry => (typeof entry === 'string' ? entry : entry?.id)).filter(Boolean);
}

export async function readGuild(store, guildId) {
  return store.get(KEYS.guild(guildId));
}

export async function writeGuild(store, guildId, config) {
  const next = { ...config, id: guildId, updatedAt: new Date().toISOString() };
  await store.set(KEYS.guild(guildId), next);
  const index = await store.list(KEYS.guildsIndex);
  if (!index.some(entry => (typeof entry === 'string' ? entry : entry?.id) === guildId)) {
    index.push({ id: guildId, at: next.updatedAt });
    await store.set(KEYS.guildsIndex, index);
  }
  return next;
}

/** Read every guild configuration keyed by guild id. */
export async function readAllGuilds(store) {
  const ids = await listGuildIds(store);
  const out = {};
  for (const id of ids) {
    const guild = await store.get(KEYS.guild(id));
    if (guild) out[id] = guild;
  }
  return out;
}

/* ---------------------------------------------------------------- queue -- */

/** Queue a dashboard action for the bot to execute. */
export async function enqueueAction(store, action) {
  const item = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...action
  };
  await store.push(KEYS.queue, item);
  return item;
}

export async function listActions(store, { status } = {}) {
  const items = await store.list(KEYS.queue);
  return status ? items.filter(item => item.status === status) : items;
}

/** Atomically mark an action as running. */
export async function claimAction(store, id) {
  return store.update(KEYS.queue, items => {
    const list = Array.isArray(items) ? items : [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return list;
    list[index] = { ...list[index], status: 'running', claimedAt: new Date().toISOString() };
    return list;
  });
}

export async function completeAction(store, id, result) {
  return store.update(KEYS.queue, items => {
    const list = Array.isArray(items) ? items : [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return list;
    list[index] = {
      ...list[index],
      status: result?.ok === false ? 'error' : 'done',
      result,
      finishedAt: new Date().toISOString()
    };
    return list;
  });
}
