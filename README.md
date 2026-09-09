# DEAD DRAW

A third-person zombie casino survival game for 1–4 players. Survive waves together, unlock rooms, and spend fictional chips on twelve casino games and upgrades between rounds. Built with **Three.js + Vite**, with an authoritative **Node.js/WebSocket** multiplayer server.

## Play

**[Play on GitHub Pages](https://thechaoticatmospheres.github.io/dead-draw/)**

Leave the room code blank to host; friends enter that code. The free multiplayer server can take about a minute to wake after inactivity. Audio and controller preferences save in localStorage on each browser/origin. Runs are held in server memory; refreshing returns to the welcome screen, and server restarts end active runs.

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

### Second wing & weapon attachments

The 48 × 64 casino now has 12 rooms and 12 distinct games. Beyond the original six rooms: Sapphire Gallery (500 chips, Casino War), Ivory Club (700, Three Card Poker), Jade Pavilion (950, Sic Bo), Neon Exchange (1,250, Keno), Obsidian Vault (1,600, Hi-Lo), and Eclipse Penthouse (2,100, Let It Ride). North doors and crossways connect the wing. Unlocks apply to the whole crew; later tables offer larger stakes. Gambling still happens only between rounds, with unlimited decision time and unanimous readiness to start the next wave.

Open the Survivor’s Club with **U** to purchase/equip attachments for your current weapon: 1.5× reflex (125), 2.5× scope (275), rifle-only 6× scope (900), extended magazine (250), speed loader (350), and compensator (450). Each requires its listed room. Aim with **RMB / controller LT**, or toggle aim with **V**. Optics use a first-person camera, magnification and reduced aim sensitivity; scopes have a lens mask and reticle. Owned attachments can be switched or removed free between rounds. Reload to fill an extended magazine. Attachments last for the run, like weapons and perks.

New rules and shared payouts: `shared/high-stakes-rules.js`; authoritative hands: `server/high-stakes.js`; table interfaces: `src/high-stakes-ui.js`; attachment data: `shared/attachments.js`. The six original expansion GLBs are reproducible with `node tools/author-expansion-assets.js` and add about 413 KiB. All 24 models remain embedded, self-contained assets served under Vite’s production base path.
