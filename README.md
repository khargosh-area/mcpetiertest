# TierTestBot V8.0 — Premium Minecraft PvP Tier Testing

TierTestBot is a production-ready Discord bot for Minecraft PvP tier testing, tester management, player registration, private testing tickets, official tier results, rankings, and premium Minecraft-themed graphics.

**Version:** 8.0.0
**Node:** >=20 (LTS recommended)
**Library:** discord.js v14

> **Made by Khargosh with ❤️**

> A Discord gateway worker can be configured for continuous operation and automatic recovery, but no host or bot can promise literal 100% uptime. Deploy Hatch maintenance, network failures, Discord outages, and persistent-volume settings remain external dependencies.

---

## Features

- **10 Gamemodes:** Sword, Axe, Mace, UHC, Pot, NethPot, SMP, Crystal, Bedrock, Combo
- **10 Tiers:** HT1, LT1, HT2, LT2, HT3, LT3, HT4, LT4, HT5, LT5 (premium aesthetic: `ᴀxᴇ • ʜᴛ³`)
- **Registration:** `/register gamertag:<name>` with validation, Registered role, nickname, duplicate protection
- **Private Tickets:** Per-gamemode private channels with mode-specific tester permissions, claim/close/reopen, duplicate prevention, persistence
- **Queue:** Persistent queue with join/leave/view, survives restarts
- **Premium Cards:** Minecraft skin (mc-heads.net / visage / crafatar) with tier accent, server name, gamertag, previous tier, tester, region/device/note/date, footer `Made by Khargosh with ❤️`
- **Commands:** `/setup`, `/register`, `/test`, `/tier`, `/profile`, `/history`, `/leaderboard`, `/modes`, `/queue`, `-help`
- **24/7 Reliability:** Auto-reconnect, exponential backoff, health heartbeat, graceful SIGTERM/SIGINT, lockfile, structured logging
- **Persistence:** SQLite via `node:sqlite` (WAL; Node 22.13+ and Node 24) with JSON fallback — survives restarts, no data loss

---

## Quick Start

### 1. Requirements
- Node.js 24 LTS recommended (Node 20.9+ supported; built-in SQLite is used on Node 22.13+ and 24)
- Discord Bot Token + Application Client ID
- Bot invited with scopes `bot` + `applications.commands` and permissions:
  - Manage Roles, Manage Channels, Manage Nicknames, Send Messages, Embed Links, Attach Files, Read Message History, View Channel, Manage Messages

### 2. Install
```bash
git clone <repo>
cd mcpetiertest
npm install
cp .env.example .env
# edit .env with real tokens
npm start
```

### 3. Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `CLIENT_ID` | ✅ | Application Client ID |
| `LOG_LEVEL` | ❌ | `debug` / `info` / `warn` / `error` (default `info`) |

> Never commit `.env`. Never hardcode tokens. Rotate if exposed.

### 4. First Run
1. Invite bot to server
2. Ensure bot role is **above** tier/tester roles in Server Settings → Roles
3. Run `/setup` (Manage Server required) — creates roles/channels/panels safely idempotent
4. Test `/register gamertag:Notch` then `/profile`
5. Test private tickets: use select menu in `➕・join-queue` channel
6. Test `/tier` card generation

---

## Commands

| Command | Options | Description |
|---------|---------|-------------|
| `/setup` | — | Admin: create roles/channels/panels |
| `/register` | `gamertag` | Register Minecraft gamertag, assigns Registered role, sets nickname |
| `/test` | `player`, `mode`, `tier` | Quick tier assignment + role + history |
| `/tier` | `player`, `gamertag`, `rank`, `gm`, `note?`, `region?`, `device?`, `tester?` | Official card, role, high-tier publishing |
| `/profile` | `member` | Full profile: gamertag, registration, tiers by mode, stats |
| `/history` | `member`, `mode?` | Tier change audit log |
| `/leaderboard` | `mode?` | Rankings sorted by tier order (not alphabetical) |
| `/modes` | — | List gamemodes with icons |
| `/queue` | `action?` | View/join/leave queue |
| `-help` | — | Prefix help embed (slash alternative) |

### Tester Ticket Flow
1. Player selects gamemode in ticket panel → bot creates `🎫・<mode>-<name>` under `🎫・TIER TICKETS`
2. Permissions: owner + mode Tester role + bot + admins; @everyone denied
3. Tester clicks **Claim Test** (mode-specific check, atomic, prevents double-claim)
4. Tester runs `/tier` after test → publishes card to `🏆・tier-results` and `🔥・high-tier-result` if HT1/LT1/HT2/LT2
5. Close → locks SendMessages for owner, preserves history; Reopen restores

---

## Deployment — Deploy Hatch

Deploy Hatch expects a Node.js background worker:

- **Runtime:** Node.js 24 (supported range: >=20.9.0)
- **Start command:** `npm start`
- **Env vars:** `DISCORD_TOKEN`, `CLIENT_ID`
- **Storage:** `data/` is persistent — contains `guilds.json` and `tiertestbot.db` (SQLite WAL)
- **Health:** Bot logs `[BOOT]`, `[READY]`, `[HEALTH] Heartbeat`, `[CLIENT ERROR]` — no HTTP server needed

```bash
# Deploy Hatch steps
1. Push repo to Hatch
2. Set env vars in dashboard
3. Set start command: npm start
4. Deploy — watch logs for [BOOT] → [READY]
```

**Do not** use fake uptime HTTP pings. Discord gateway is persistent.

---

## Minecraft Skin Cards

- Skin fetched from `mc-heads.net` → fallback `visage.surgeplay.com` → `crafatar.com`
- Timeouts 6–8s, handles 404/invalid name gracefully
- SVG → PNG via `sharp` (native). If sharp unavailable, serves SVG directly — never crashes
- Card includes: server name, skin render, gamertag, large tier (`ʜᴛ³`), mode icon, previous tier, tester, region/device/note/date, border accent, footer `Made by Khargosh with ❤️`
- Escapes XML, limits field lengths

---

## Tester Permissions Matrix

| Gamemode | Tester Role | Ticket Access |
|----------|-------------|---------------|
| Sword | Sword Tester | Sword tickets only |
| Axe | Axe Tester | Axe tickets only |
| Mace | Mace Tester | Mace tickets only |
| ... | ... | ... |
| Admin | Administrator / Manage Server | All tickets |

- Unrelated members denied `ViewChannel` (private)
- Ticket creator never gains tester permissions
- Missing tester role → ticket creation blocked with `/setup` instruction

---

## Database

**Primary:** SQLite via `node:sqlite` (Node 22.13+ / 24) — `data/tiertestbot.db` with WAL, normalized tables + JSON blob for compatibility
**Fallback:** `data/guilds.json` (atomic temp-rename writes)

Schema in `database/schema.sql`:
- `guilds`, `registrations`, `results`, `history`, `tickets`, `queue`, `kv_store`

Restart test:
```bash
# Write then read after “restart” (new process loads file)
node -e "import('./src/db.js').then(async m=>{await m.initDB(); const db=await m.readDB(); console.log(Object.keys(db))})"
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing DISCORD_TOKEN` | Env not set | Set in `.env` / Hatch dashboard, exact names |
| `Login failed` | Invalid token | Reset token in Developer Portal |
| `Missing permissions` | Bot role low | Move bot role above tier roles; grant Manage Roles/Channels |
| `Tier role missing` | Setup not run | `/setup` |
| `Tester role missing` | Setup not run | `/setup` |
| `Application readiness failed` | Crash on boot | Check logs for `[LOGIN ERROR]` / `[UNCAUGHT EXCEPTION]` — usually bad env |
| `Background worker stopped` | Exit code 1 | Check `[BOOT]` logs; ensure `data/` writable |
| Card is SVG not PNG | Sharp failed | `npm install --include=optional sharp` — embed fallback still works |
| Duplicate ticket error | Already open | Close old ticket or wait for tester |
| Queue lost after restart | Storage not persistent | Ensure Hatch marks `data/` persistent or use external DB |

**Logs to watch:**
```
[BOOT] TierTestBot V8.0 starting...
[BOOT] Environment validated
[BOOT] Database init: SQLite ...
[BOOT] Loaded persistent data for X guild(s)
[BOOT] Discord login initiated.
[READY] TierTestBot V8.0 online...
[HEALTH] Heartbeat — uptime 120s ...
```

---

## Required Discord Permissions & Intents

**Bot Invite Permissions:** Manage Roles, Manage Channels, Manage Nicknames, Send Messages, Embed Links, Attach Files, Read Message History, View Channel, Manage Messages, Use Application Commands

**Intents:** Guilds, GuildMembers, GuildMessages, MessageContent (for `-help`). Enable the privileged **Server Members Intent** and **Message Content Intent** in the Discord Developer Portal. `GuildMembers` is needed for registration role/nickname and member access checks.

---

## Testing Checklist

1. Syntax: `npm run check`
2. Install clean: `rm -rf node_modules && npm install`
3. Startup validation: `npm start` with dummy env should log `Missing DISCORD_TOKEN` and exit 1 (no crash)
4. DB: create dummy guild entry, restart, verify persists
5. Commands: `/setup` creates no duplicates on second run
6. Register: `/register` validates `^[a-zA-Z0-9_]{3,16}$`, assigns role, nickname, updates on re-run
7. Ticket perms: Sword tester cannot see Axe ticket (check channel overwrites)
8. Duplicate ticket blocked; simultaneous claim second fails with “Already claimed”
9. Queue: join/leave, restart, verify `data/guilds.json` retains order
10. Tier history: `/tier` preserves previous, history logs, only removes same-mode roles
11. Card fallback: disconnect network, `/tier` still sends embed
12. Error handling: invalid gamertag, missing role, hierarchy error — user-friendly messages, no process exit

**Tests actually run for this package:** `npm ci`, `npm run check`, `npm test` (28 assertions across validation, Discord command payloads, actual mode-specific tester authorization helpers, simultaneous ticket claim race, SQLite persistence/concurrent writes, and image fallback), and `npm audit --omit=dev` (0 vulnerabilities). Startup with missing variables was checked and exits with the expected configuration error.

**Not run:** live Discord gateway login, role/channel permission integration against a test server, skin-service network success, and Deploy Hatch stabilization require real Discord credentials/server or the target host. The sandbox cannot verify those; no live verification is claimed.

---

## Versioning

- v8.0.0 — Complete V8.0 implementation (2026-10-17)

---

## License

MIT — Private project for Khargosh.
