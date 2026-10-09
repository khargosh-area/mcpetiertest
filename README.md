# TierTestBot • Final Aesthetic

Deploy Hatch-ready Discord bot for Minecraft PvP tier testing.

## Commands
- `/setup` — creates tier roles, mode tester roles, channels and interactive panels.
- `/test player mode tier tester` — test assignment and tier role update.
- `/tier player gamertag rank gm tester note region device` — official result, premium Discord-PFP tier card, role update and result posting.
- `/profile member` — full player profile.
- `/leaderboard [mode]` — rankings.
- `/modes` — modes.
- `-help` — help.

There is intentionally no separate `/rank` command.

## Tier card
The official `/tier` card uses the player's **Discord profile picture**, Minecraft gamertag, awarded HT/LT tier, previous tier, gamemode, tester, region, device and note. The card header uses the **actual Discord server name**, and the footer says **Made by Khargosh with ❤️**.

## Queue
The queue panel lets a player choose a gamemode. The bot stores a per-mode queue and creates a private ticket channel for the player. Tickets include Claim Test and Close Ticket controls. A mode-specific tester role can claim the ticket.

## Custom application emoji names
Create these exact names if you want custom emojis. Missing emojis automatically fall back to Unicode:

### Modes
`tt_sword` `tt_axe` `tt_mace` `tt_uhc` `tt_pot` `tt_nethpot` `tt_smp` `tt_crystal` `tt_bedrock` `tt_combo`

### Tier/result
`tt_tier` `tt_ht` `tt_lt` `tt_previous` `tt_tester` `tt_player` `tt_gamertag` `tt_region` `tt_device` `tt_note` `tt_stats`

### Queue/ticket
`tt_queue` `tt_join` `tt_leave` `tt_ticket` `tt_claim` `tt_close` `tt_position`

### Apply
`tt_apply` `tt_application` `tt_accept` `tt_deny`

### Channels/misc
`tt_rules` `tt_kits` `tt_results` `tt_high` `tt_ranking` `tt_punishment` `tt_content`

## Hosting
Start command: `node index.js` or `npm start`.

Required environment variables: `DISCORD_TOKEN`, `CLIENT_ID`.


## Registration and automatic emojis
- `/register gamertag:YourName` sets your **server nickname** to the Minecraft gamertag and assigns the `Registered` role. It cannot change the global Discord username.
- `/setup` attempts to create the built-in `tt_*` custom emoji set. The bot needs **Manage Expressions** and the server must have free emoji slots. Existing emoji names are reused; Unicode fallbacks are used when a custom emoji is unavailable.
- The tier card uses the Discord avatar, gamertag, tier, previous tier, mode, tester, region, device, note, server name, and `Made by Khargosh with ❤️`.
