import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_PATH = path.join(DATA_DIR, 'guilds.json');
const SQLITE_PATH = path.join(DATA_DIR, 'tiertestbot.db');

let useSqlite = false;
let sqliteDb = null;

// Try to use Node's built-in SQLite (Node 22+)
async function initSqlite() {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    await fs.mkdir(DATA_DIR, { recursive: true });
    sqliteDb = new DatabaseSync(SQLITE_PATH);
    // Enable WAL for durability
    sqliteDb.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`);

    // Schema
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS guilds (
        guild_id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Optional normalized tables for future, but we keep JSON blob for compatibility + easy transactions
    // Create tables for normalized data if not exists
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        gamertag TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS results (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        tier TEXT NOT NULL,
        gamertag TEXT,
        note TEXT,
        region TEXT,
        device TEXT,
        tester_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, mode)
      );
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        from_tier TEXT,
        to_tier TEXT NOT NULL,
        tester_id TEXT,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tickets (
        guild_id TEXT NOT NULL,
        channel_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        claimed_by TEXT,
        created_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS queue (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        position INTEGER NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, mode)
      );
    `);
    useSqlite = true;
    // Migrate legacy JSON data once when the SQLite guild table is empty.
    const existingCount = sqliteDb.prepare('SELECT COUNT(*) AS n FROM guilds').get().n;
    if (existingCount === 0) {
      try {
        const legacy = JSON.parse(await fs.readFile(JSON_PATH, 'utf8'));
        const upsert = sqliteDb.prepare('INSERT INTO guilds (guild_id, data) VALUES (?, ?)');
        sqliteDb.exec('BEGIN IMMEDIATE');
        try { for (const [gid, data] of Object.entries(legacy)) upsert.run(gid, JSON.stringify(data)); sqliteDb.exec('COMMIT'); } catch (err) { sqliteDb.exec('ROLLBACK'); throw err; }
        logger.info('Migrated legacy JSON guild data into SQLite', { guilds: Object.keys(legacy).length });
      } catch (e) {
        if (e.code !== 'ENOENT') logger.warn('Legacy JSON migration failed', { error: e.message });
      }
    }
    logger.info('SQLite initialized', { path: SQLITE_PATH });
    return true;
  } catch (e) {
    logger.warn('SQLite init failed, falling back to JSON', { error: e.message });
    return false;
  }
}

// JSON fallback helpers
async function readJsonDb() {
  try { return JSON.parse(await fs.readFile(JSON_PATH, 'utf8')); }
  catch { return {}; }
}
async function writeJsonDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Atomic write: write to temp then rename
  const tmp = JSON_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, JSON_PATH);
}

// Public API: guild-centric JSON blob + normalized tables
export async function initDB() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const ok = await initSqlite();
  if (!ok) {
    // Ensure JSON exists
    try { await fs.access(JSON_PATH); } catch { await writeJsonDb({}); }
    logger.info('JSON DB initialized', { path: JSON_PATH });
  }
  return { useSqlite };
}

export function isSqlite() { return useSqlite; }

export async function readDB() {
  if (useSqlite && sqliteDb) {
    try {
      const rows = sqliteDb.prepare('SELECT guild_id, data FROM guilds').all();
      const out = {};
      for (const r of rows) {
        try { out[r.guild_id] = JSON.parse(r.data); } catch { out[r.guild_id] = {}; }
      }
      return out;
    } catch (e) {
      logger.error('SQLite read failed, falling back to JSON read', { error: e.message });
      return await readJsonDb();
    }
  } else {
    return await readJsonDb();
  }
}

export async function writeDB(db) {
  if (useSqlite && sqliteDb) {
    try {
      const upsert = sqliteDb.prepare('INSERT INTO guilds (guild_id, data) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET data=excluded.data');
      sqliteDb.exec('BEGIN IMMEDIATE');
      try {
        for (const [gid, data] of Object.entries(db)) {
          upsert.run(gid, JSON.stringify(data));
          const regStmt = sqliteDb.prepare('INSERT INTO registrations (guild_id,user_id,gamertag,registered_at) VALUES (?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET gamertag=excluded.gamertag, registered_at=excluded.registered_at');
          for (const [uid, reg] of Object.entries(data.registrations || {})) {
            if (reg?.gamertag) regStmt.run(gid, uid, String(reg.gamertag), reg.registeredAt || new Date().toISOString());
          }
          const resultStmt = sqliteDb.prepare('INSERT INTO results (guild_id,user_id,mode,tier,gamertag,note,region,device,tester_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(guild_id,user_id,mode) DO UPDATE SET tier=excluded.tier,gamertag=excluded.gamertag,note=excluded.note,region=excluded.region,device=excluded.device,tester_id=excluded.tester_id,updated_at=excluded.updated_at');
          for (const [uid, modes] of Object.entries(data.results || {})) {
            for (const [mode, res] of Object.entries(modes || {})) if (res?.tier) resultStmt.run(gid, uid, mode, res.tier, res.gamertag || null, res.note || null, res.region || null, res.device || null, res.tester || null, res.updatedAt || new Date().toISOString());
          }
        }
        sqliteDb.exec('COMMIT');
      } catch (err) { sqliteDb.exec('ROLLBACK'); throw err; }
      return;
    } catch (e) {
      logger.error('SQLite write failed', { error: e.message });
      throw e;
    }
  } else {
    await writeJsonDb(db);
  }
}

// Safe transaction helper for JSON: read-modify-write with retry
let dbQueue = Promise.resolve();
export async function withDB(fn) {
  // Serialize all read-modify-write operations in this process to avoid lost updates.
  let release;
  const previous = dbQueue;
  dbQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const db = await readDB();
    const result = await fn(db);
    await writeDB(db);
    return result;
  } finally { release(); }
}

// History helpers (also update JSON blob for compatibility)
export async function addHistory(guildId, userId, mode, fromTier, toTier, testerId, note) {
  if (useSqlite && sqliteDb) {
    try {
      sqliteDb.prepare(`INSERT INTO history (guild_id, user_id, mode, from_tier, to_tier, tester_id, note, created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .run(guildId, userId, mode, fromTier, toTier, testerId, note, new Date().toISOString());
    } catch (e) { logger.warn('history insert failed', { error: e.message }); }
  }
  // Also keep in JSON blob for quick profile
}

export async function getHistory(guildId, userId, limit=20) {
  if (useSqlite && sqliteDb) {
    try {
      return sqliteDb.prepare(`SELECT * FROM history WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT ?`).all(guildId, userId, limit);
    } catch { return []; }
  }
  return [];
}

// Registrations
export async function getRegistration(guildId, userId) {
  if (useSqlite && sqliteDb) {
    try {
      const row = sqliteDb.prepare(`SELECT * FROM registrations WHERE guild_id=? AND user_id=?`).get(guildId, userId);
      return row || null;
    } catch { return null; }
  }
  return null;
}
export async function setRegistration(guildId, userId, gamertag) {
  if (useSqlite && sqliteDb) {
    try {
      sqliteDb.prepare(`INSERT INTO registrations (guild_id, user_id, gamertag, registered_at) VALUES (?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET gamertag=excluded.gamertag, registered_at=excluded.registered_at`)
        .run(guildId, userId, gamertag, new Date().toISOString());
    } catch (e) { logger.warn('setRegistration failed', { error: e.message }); }
  }
}

// Tickets persistence
export async function createTicketRecord(guildId, channelId, ownerId, mode) {
  if (useSqlite && sqliteDb) {
    sqliteDb.prepare(`INSERT INTO tickets (guild_id, channel_id, owner_id, mode, status, created_at) VALUES (?,?,?,?,?,?)`)
      .run(guildId, channelId, ownerId, mode, 'open', new Date().toISOString());
  }
}
export async function claimTicketRecord(guildId, channelId, testerId) {
  if (useSqlite && sqliteDb) {
    // Tickets may predate normalized records; UPDATE only if currently unclaimed.
    const update = sqliteDb.prepare(`UPDATE tickets SET claimed_by=?, status=? WHERE guild_id=? AND channel_id=? AND claimed_by IS NULL AND status!='closed'`);
    const result = update.run(testerId, 'claimed', guildId, channelId);
    if (result.changes === 0) {
      const existing = sqliteDb.prepare(`SELECT status, claimed_by FROM tickets WHERE guild_id=? AND channel_id=?`).get(guildId, channelId);
      if (existing?.claimed_by) throw new Error('Already claimed');
      // No normalized row is okay; JSON store remains authoritative.
    }
    return true;
  }
  return true;
}
export async function closeTicketRecord(guildId, channelId) {
  if (useSqlite && sqliteDb) {
    sqliteDb.prepare(`UPDATE tickets SET status=?, closed_at=? WHERE guild_id=? AND channel_id=?`).run('closed', new Date().toISOString(), guildId, channelId);
  }
}
export async function getTicket(guildId, channelId) {
  if (useSqlite && sqliteDb) {
    return sqliteDb.prepare(`SELECT * FROM tickets WHERE guild_id=? AND channel_id=?`).get(guildId, channelId);
  }
  return null;
}

// Health check
export async function verifyAccess() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const testFile = path.join(DATA_DIR, '.health');
    await fs.writeFile(testFile, String(Date.now()));
    await fs.unlink(testFile).catch(()=>{});
    if (useSqlite && sqliteDb) {
      sqliteDb.prepare('SELECT 1').get();
    }
    return true;
  } catch (e) {
    logger.error('DB verify failed', { error: e.message });
    return false;
  }
}
