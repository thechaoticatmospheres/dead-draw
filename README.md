# DEAD DRAW

A third-person zombie casino survival game for 1–4 players. Survive waves together, unlock rooms, and spend fictional chips on twelve casino games and upgrades between rounds. Built with **Three.js + Vite**, with an authoritative **Node.js/WebSocket** multiplayer server.

## Play

**[Play on GitHub Pages](https://thechaoticatmospheres.github.io/dead-draw/)**

Leave the room code blank to host; friends enter that code. The free multiplayer server can take about a minute to wake after inactivity. **Resume saved run** reconnects your survivor after a refresh. Safe intermissions save encrypted checkpoints in this browser, including equipment, chips, rooms and campaign progress. Career, audio and controller preferences also persist locally. Finish active casino hands before leaving to obtain a new checkpoint.

## Develop locally

Use Node.js 22.12+ (22 LTS) and npm:

```sh
npm ci
npm run dev
```

Open <http://localhost:5188>. This starts Vite and the local multiplayer server together. Changes reload automatically.

```sh
npm test
npm run build
npm run check:build
npm run preview
```

`npm run preview` serves only compiled files on port 4173. Set `VITE_GAME_SERVER_URL` in `.env.local` to a running multiplayer server when testing this separate static preview. For a Pages-style local test, also set `BASE_PATH=/dead-draw/` and open `http://localhost:4173/dead-draw/`. `.env.example` lists the public build settings; never put secrets in `VITE_` variables.

## Deployment

GitHub Pages uses **GitHub Actions**. Every push to `main` runs `npm ci`, tests, a production build, asset checks, and deployment of `dist/`. Pull requests run the same checks without deploying. Review changes in pull requests before merging to `main`.

- **Settings → Pages → Source:** GitHub Actions.
- **Settings → Secrets and variables → Actions → Variables:** `GAME_SERVER_URL` is the public HTTPS address of the multiplayer server, with no credentials.
- The deployed multiplayer server is `https://dead-draw-server.onrender.com`; its readiness endpoint is [`/health`](https://dead-draw-server.onrender.com/health).
- `actions/configure-pages` supplies the base path, so builds work under `/REPOSITORY-NAME/` as well as custom domains. GLB assets use Vite’s base URL.
- `render.yaml` defines one **free Render web service** for multiplayer, deploying `main` after CI checks pass. `ALLOWED_ORIGINS` must include the Pages origin (no path). `SERVER_ONLY=true` serves only `/health` and `/game`; it does not publish source files.
- Keep Render's generated `CHECKPOINT_SECRET` stable across deployments. It authenticates checkpoint files and belongs only on the server. Local development generates a key in ignored `.cache/`. A new key invalidates earlier saves. For a public-repository Render service without an installed GitHub integration, use **Manual Deploy → Deploy latest commit** after Pages checks pass; Pages itself updates automatically.
- If the repository owner changes, update the play link and Render’s allowed origin. If the server address changes, update `GAME_SERVER_URL` and rerun the Actions workflow.

No computer, temporary tunnel, or ChatGPT preview is required to keep the deployed game available. Free-host limits and inactivity startup delays still apply.

## Important files

| Path                                         | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `index.html`, `src/main.js`                  | Entry point, UI and controls                          |
| `src/render/`                                | Three.js world, characters and asset loading          |
| `src/*casino*.js`, `src/club-ui.js`          | Casino and upgrade interfaces                         |
| `src/audio*.js`, `src/soundscape.js`         | Sound synthesis, settings and event timing            |
| `server/`                                    | Multiplayer simulation, combat and casino authority   |
| `shared/`                                    | Map, weapons and shared game rules                    |
| `public/assets/`                             | Shipped GLBs and asset licenses                       |
| `assets/source/`, `tools/author-*.js`        | Editable asset sources and generation tools           |
| `tests/`                                     | Automated rules, audio, deployment and browser checks |
| `.github/workflows/pages.yml`, `render.yaml` | Deployment configuration                              |

See [gameplay and controls](docs/GAMEPLAY.md) and [asset credits](public/assets/CREDITS.md). Chips are fictional; there are no payments or real-money gambling.

### Crew & campaign update

- **T / D-pad left:** objectives, pings, ammo requests/sharing, door contributions, entrance repairs and paid traps. **C / LT + left-stick click:** emergency shove. **Z:** location ping. Downed survivors watch teammates; **[ / ]**, **Y/RB** cycle the camera.
- Every survivor has a private hand at every machine. All four players can use the same table simultaneously.
- Restore power, collect two boss keys, recover the vault code, challenge the House, and vote to extract—or continue endless waves. Intermissions last 90 seconds, then the next wave starts automatically.
- Slot themes, bank-or-free-spin features, animated dealers/chips, room cover, traps, predicted movement, career challenges, cosmetic armbands and mastery charms add depth without permanent combat advantages.
- `server/game.js`, `server/intermissions.js`, `server/campaign.js`, `server/checkpoints.js` own multiplayer rules. `src/crew-ui.js`, `src/profile.js`, `src/prediction.js` own their browser interfaces.
- Run `node tools/balance-report.js` for exact Keno returns and solo/co-op room-unlock projections. See [balance notes](docs/BALANCE.md).

### Second wing & weapon attachments

The 48 × 64 casino now has 12 rooms and 12 distinct games. Beyond the original six rooms: Sapphire Gallery (500 chips, Casino War), Ivory Club (700, Three Card Poker), Jade Pavilion (950, Sic Bo), Neon Exchange (1,250, Keno), Obsidian Vault (1,600, Hi-Lo), and Eclipse Penthouse (2,100, Let It Ride). North doors and crossways connect the wing. Unlocks apply to the whole crew; later tables offer larger stakes. Gambling still happens only between rounds, with 90-second breaks and automatic settlement at the bell.

Open the Survivor’s Club with **U** to purchase/equip attachments for your current weapon: 1.5× reflex (125), 2.5× scope (275), rifle-only 6× scope (900), extended magazine (250), speed loader (350), and compensator (450). Each requires its listed room. Aim with **RMB / controller LT**, or toggle aim with **V**. Optics use a first-person camera, magnification and reduced aim sensitivity; scopes have a lens mask and reticle. Owned attachments can be switched or removed free between rounds. Reload to fill an extended magazine. Attachments last for the run, like weapons and perks.

New rules and shared payouts: `shared/high-stakes-rules.js`; authoritative hands: `server/high-stakes.js`; table interfaces: `src/high-stakes-ui.js`; attachment data: `shared/attachments.js`. The six original expansion GLBs are reproducible with `node tools/author-expansion-assets.js` and add about 413 KiB. All 30 models remain embedded, self-contained assets served under Vite’s production base path.

### Music & Survivor’s Club cashier

Visit the **Golden Hour Jukebox** in the starting Palm Atrium. Click it or approach and press **E / controller A** to select any of five songs, skip, or pause/resume the shared room playlist. Your music volume is personal and saved locally. Music automatically continues through the playlist, softens in combat, and respects master volume, mute and window focus.

Across the Atrium, the glass-fronted **Survivor’s Club cashier** has a teller, chip trays and a lit sign. Click the booth or press **E / A** nearby to open the Club between rounds. **U / D-pad right** and the labeled HUD button also give quick access.

Music: `public/assets/music/`, `shared/services.js`, `server/jukebox.js`, `src/music.js`, `src/jukebox-ui.js`. Physical props: `src/render/services.js`; rebuild original jukebox/cashier GLBs with `node tools/author-service-assets.js`.

### Casino enemy roster & direct power interaction

Approach the Sapphire power terminal and press **E / controller A** to restore power directly for 150 chips between rounds. The nearby prompt displays the price and changes to ONLINE after activation; the Crew menu remains available as an alternative.

Four original articulated enemies join the existing roster: **Dead Dealers** with a craps rake, chips and cards; **Casino Security** with a uniform, cap, badge and baton; older **Last Call Regulars** in rolling wheelchairs; and bottle-carrying **Drunken Crawlers**. Dealers/crawlers appear from wave 1, wheelchair enemies from wave 2, and tougher security from wave 4. Security has a warned heavy strike and a larger chip reward. Seated and crawling enemies have matching low head/body hitboxes.

Generate the four GLBs with `node tools/author-enemies.js`. Animation lives in `src/render/casino-enemies.js`; shared stats, roster and hit volumes in `shared/expansion.js`; combat remains authoritative on the server.

### Friends playtest update (0.7)

- Private concurrent casino games, 90-second breaks, visible countdown and final-ten-second audio. Pending hands settle once at the bell; new wagers close at seven seconds.
- Space jumps, Shift rolls, and ordinary movement runs at the former sprint speed. Controller: B rolls; LS click or D-pad down jumps (LT + LS still shoves). Downed teammates remain visibly on the floor with a revive label.
- Seven original weapon types: Velvet Saber and Pit Boss Crossbow also drop from natural blackjack and flush-or-better poker. RPG, flamethrower, minigun, piercing railgun and chain-lightning Tesla weapon are wheel-exclusive.
- The Grand Prize Wheel starts in the atrium, relocates among unlocked rooms after three completed spins, and awards only weapons or rare supplies. Spins cost 500 chips, rising by 100 to a 1,500 cap; multiple survivors can spin independently.
- Mascot Meltdown waves feature angry jackpot geese every fourth wave, except fifth-wave bosses. Clear them for 75 bonus chips and extra ammunition.
- Eleven Club perks, higher comp prices, and new healing, ammo, protection, income and damage ranks.

New systems: `shared/arsenal.js`, `server/arsenal.js`, `server/prize-wheel.js`, `src/prize-wheel-ui.js`, `src/render/arsenal-props.js`, `src/render/prize-wheel.js`. Procedural models ship inside the normal build without extra downloads. The real-socket integration test includes a full 90-second countdown.

### Auto Reload (0.7.1)

Buy Auto Reload for **6 comps** in the starting-room Survivor’s Club. Empty weapons reload automatically using reserve ammo and normal reload time; Quick Hands and Speed Loader bonuses apply. The perk lasts for the run and is included in checkpoints.

### Performance update (0.7.2)

Nearby campaign controls, repairs, door purchases/contributions and ammo sharing are accessible with **E / controller A**; T remains optional for crew/career information. Hold **E or F** to revive. During intermission, **N** (or the Ready Up button) toggles your ready vote. All connected, standing survivors ready skips the remaining wait; finish active casino hands first. Otherwise the 90-second deadline still starts the wave automatically.

Static prop batching, reusable combat effects, compact multiplayer snapshots, cached navigation, change-only HUD/audio bookkeeping and losslessly compressed models reduce repeated work without changing gameplay or graphics settings. Older clients and existing saves remain compatible. See [implementation and measurements](docs/PERFORMANCE-UPDATE.md).

Run `node tools/performance-report.js` for repeatable synthetic measurements. Add `?profile=1` to a local game URL for bounded CPU/GPU and resource diagnostics on the canvas. Normal deployment still tests and builds every push to main, then updates GitHub Pages; deploy the same commit to the existing Render service for server changes.
