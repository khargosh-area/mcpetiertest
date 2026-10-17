# TierTestBot — v6.2 with a Deploy Hatch style control panel

A Minecraft PvP tier-testing Discord bot **plus** a web control panel that looks and
works like Deploy Hatch: live status, guilds, leaderboards, a streaming log console,
one-click bot control and a guided Vercel deployment.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Discord bot (src/core)     │        │  Control panel (Next.js)     │
│  slash commands • cards     │◀──────▶│  overview • guilds • logs    │
│  roles • queue • results     │  shared│  commands • deploy • settings│
└──────────────┬──────────────┘  store └──────────────┬───────────────┘
               │                                      │
               └──────────►  Postgres / file store ◄──┘
```

Both halves read and write the **same store**, so the panel always shows live data
and the bot picks up dashboard actions within a couple of seconds.

---

## What's included

| Area | Details |
| --- | --- |
| **Bot** | `/setup` `/test` `/tier` `/profile` `/leaderboard` `/modes`, 10 gamemodes × 10 tiers, premium tier cards (sharp → PNG, SVG fallback), Minecraft skin lookup, test queue, tier-test applications. |
| **Control panel** | Overview, per-guild leaderboards + queue + applications, live log console (SSE), slash-command reference, tier-card designer, settings, deployment guide. |
| **Bot control** | Start / stop / restart the bot from the UI, queue tier assignments, approve or reject applications, re-sync roles and channels. |
| **Storage** | Postgres (Neon / Supabase / Vercel Postgres / Railway) or local JSON files — one shared source of truth. |
| **Security** | Password-protected panel (HttpOnly signed cookie), secrets never rendered, environment checklist shows presence only. |
| **Deploy** | `vercel.json`, zero-config Next.js build, background bot runner, keep-alive endpoint, cron snippet. |

---

## Repository layout

```
index.js                  local bot entry (npm start)
src/core/
  config.js               modes, tiers, roles, cosmetics, command catalogue
  store.js                storage adapters (postgres | kv | file) + queue + logs
  cards.js                premium tier-card renderer (sharp / SVG)
  embeds.js               channel panels and buttons
  bot.js                  discord.js client, commands, action queue, heartbeat
  main.js                 session runner used by the bot and the Vercel runner
app/                      Next.js dashboard (App Router)
  (dashboard)/            overview, guilds, logs, commands, card, deploy, settings
  api/                    bot runner, keepalive, control, actions, logs, card
components/               sidebar, topbar, console, forms, icons
lib/                      auth, store access, dashboard aggregation, Vercel client
middleware.ts             password gate for every page and API route
scripts/seed-demo.js      fills the local store with demo data
```

---

## Run it locally

```bash
npm install
cp .env.example .env      # add DISCORD_TOKEN + CLIENT_ID
npm start                 # start the bot (terminal 1)
npm run dev               # start the dashboard on :3000 (terminal 2)
```

Prefer to look around first? Seed demo data — no Discord token needed:

```bash
node scripts/seed-demo.js
npm run dev
# http://localhost:3000
rm -rf data                # remove the demo data afterwards
```

The bot and the dashboard share `./data` in local development, so everything lines up.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token — Developer Portal → Bot → Reset Token |
| `CLIENT_ID` | yes | Application ID — Developer Portal → General Information |
| `DASHBOARD_PASSWORD` | recommended | Password for the panel. Without it the panel is open (read-only) |
| `SESSION_SECRET` | recommended | Signs session cookies — `openssl rand -hex 32` |
| `DATABASE_URL` | recommended | Any Postgres connection string. Makes data persistent and shared |
| `POSTGRES_URL` | alternative | Used when `DATABASE_URL` is absent (Vercel Postgres) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | alternative | Upstash Redis storage |
| `VERCEL_TOKEN` | optional | Enables live deployment status on the Deploy page |
| `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | optional | Scopes the deployment status query |
| `DATA_DIR` | optional | Where the file store writes (default `./data`, `/tmp/tiertestbot` on Vercel) |

> Never commit `.env` — it is git-ignored. If a token leaks, reset it in the
> Discord Developer Portal immediately.

---

## Deploy to Vercel

```bash
git push origin arena/9e856443-mcpetiertest

vercel link
vercel env add DISCORD_TOKEN production
vercel env add CLIENT_ID production
vercel env add DASHBOARD_PASSWORD production
vercel env add DATABASE_URL production
vercel --prod
```

Or import the repo at [vercel.com/new](https://vercel.com/new) — the build settings
live in the repo (`next.config.mjs` + `vercel.json`), so nothing else is required.

### Keeping the bot online

A Discord bot needs a persistent connection, while Vercel functions are capped at
300s (Hobby) / 800s (Pro). The bot therefore runs in a **session window** inside a
background function and is relaunched by a keep-alive request:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/bot` | Start a session now (also the "Start bot" button) |
| `GET /api/bot/keepalive` | Start a session **only if** the bot is offline — point a cron at it |
| `POST /api/bot/control` | `{ "action": "stop" \| "restart" }` |
| `GET /api/status` | Health check / JSON snapshot |

Add a cron to `vercel.json` (Pro plans allow minute-level schedules):

```json
{ "crons": [{ "path": "/api/bot/keepalive", "schedule": "* * * * *" }] }
```

On Hobby, Vercel runs crons once per day — point an external uptime pinger
(UptimeRobot, cron-job.org) at `/api/bot/keepalive` instead, or run the bot on an
always-on host with `npm start`. Both instances share the same database, so the
panel stays accurate either way.

---

## API reference

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/status` | Full dashboard snapshot (bot, stats, leaderboard, activity) |
| `GET` | `/api/logs?since=&limit=` | Buffered log entries |
| `GET` | `/api/logs/stream` | Server-sent events stream of the log buffer |
| `GET` | `/api/card?...` | Renders a tier card (PNG) |
| `GET` | `/api/export` | Full JSON export of guilds and logs |
| `GET` | `/api/deploy/status` | Vercel deployment status (needs `VERCEL_TOKEN`) |
| `POST` | `/api/action` | Queues `assignTier`, `syncSetup`, `postPanels`, `approveApplication`, `rejectApplication` |
| `POST` | `/api/bot` | Starts a bot session |
| `POST` | `/api/bot/control` | Stops or restarts the running session |
| `POST` | `/api/auth/login` / `/api/auth/logout` | Panel sessions |

---

## Notes

* `npm run check` runs `node --check` plus `tsc --noEmit`.
* The bot degrades gracefully: no `sharp` → SVG cards, no database → local files,
  no `DATABASE_URL` on Vercel → temporary storage (the panel warns about it).
* Storage adapters are selected automatically: `DATABASE_URL`/`POSTGRES_URL` →
  Postgres, `KV_REST_API_*` → Upstash, otherwise files.
