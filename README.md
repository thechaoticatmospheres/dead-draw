# DEAD DRAW

A third-person zombie casino survival game for 1–4 players. Survive waves together, unlock rooms, and spend fictional chips on six casino games and upgrades between rounds. Built with **Three.js + Vite**, with an authoritative **Node.js/WebSocket** multiplayer server.

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
