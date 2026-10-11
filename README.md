# TierTestBot v6 — Fixed startup + Minecraft skin cards

Discord.js v14 bot for Minecraft PvP tier testing. This build keeps the Minecraft gamertag skin on the result card (via mc-heads.net), not the Discord profile picture.

## Commands
- `/setup` — creates/updates the tier roles, mode tester roles, channels and panels.
- `/test player mode tier tester` — updates the role and posts a test result.
- `/tier player gamertag rank gm tester note region device` — official result card with Minecraft skin, previous tier, tester, region, device and note.
- `/register gamertag` — sets the server nickname to the Minecraft gamertag and gives the `Registered` role.
- `/profile member` — view tier profile.
- `/leaderboard [mode]` — view tier rankings.
- `/modes` — list supported modes.
- `-help` — help message.

## Deploy Hatch setup
1. Upload the files from this folder to your service.
2. Set the start command to `npm start`.
3. Add `DISCORD_TOKEN` and `CLIENT_ID` in the service's **Environment Variables** panel. Do not put real secrets in this ZIP or commit them to GitHub.
4. Redeploy. If startup exits, the log now prints a clearer `[CONFIG ERROR]`, `[DISCORD LOGIN FAILED]`, or runtime error.
5. Invite the bot with `bot` and `applications.commands` scopes. Give it Manage Roles, Manage Channels, Manage Nicknames, Send Messages, Embed Links, Attach Files, and Read Message History. Put the bot's highest role above the roles it manages.
6. Run `/setup` in your Discord server.

## Notes
- Node.js 20+ is recommended.
- Minecraft skin image needs outbound access to `mc-heads.net`; if unavailable, the card shows a skin-unavailable fallback.
- `/setup` requires Manage Server. Ensure the hosting service persists the `data/` directory if you want results/registration records to survive redeploys.
- Never share your bot token. If it was exposed, reset it in the Discord Developer Portal.
