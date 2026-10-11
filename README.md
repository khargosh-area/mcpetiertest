# TierTestBot v6.1 — Rechecked

## Included
- Minecraft gamertag skin lookup for tier cards (not Discord PFP as the card character).
- Existing `/setup`, `/test`, `/tier`, `/profile`, `/leaderboard`, and `/modes` commands retained from the supplied source.
- Clearer mode icons and boot/login error logs.
- If `sharp` cannot load, the bot falls back to an SVG tier card instead of crashing at import time.

## Deploy Hatch
1. Upload these files to the project root, replacing the old `index.js` and `package.json`.
2. Keep environment variables named exactly `DISCORD_TOKEN` and `CLIENT_ID`.
3. Start command: `npm start`.
4. Redeploy and inspect logs for `[BOOT]`, `[LOGIN ERROR]`, `[CLIENT ERROR]`, or `[UNCAUGHT EXCEPTION]`.

Never paste the bot token into chat or commit it to GitHub. If it was exposed, reset it in Discord Developer Portal.

## Validation
`node --check index.js` and ZIP integrity were checked. Live Discord login cannot be verified without the project's private environment variables.
