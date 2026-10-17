-- TierTestBot V8.0 Database Schema
-- Supports both SQLite (via node:sqlite) and PostgreSQL (convert types accordingly)

-- Core guild blob for backward compatibility
CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

-- Normalized registrations
CREATE TABLE IF NOT EXISTS registrations (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  gamertag TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Normalized tier results
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

-- Full history audit
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
CREATE INDEX IF NOT EXISTS idx_history_guild_user ON history(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_history_mode ON history(mode);

-- Tickets
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

-- Queue
CREATE TABLE IF NOT EXISTS queue (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  position INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, mode)
);

-- Key-value store for misc persistent state
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
