# Performance audit — Dead Draw 0.7.1

**Date:** September 10, 2026 (America/Phoenix). **Reviewed commit:** `3ef031173fcef7fe185cff935f7e1fe65f511cd4`.

**Historical audit of 0.7.1.** This document records the original findings before implementation. See [the 0.7.2 performance update](PERFORMANCE-UPDATE.md) for implemented solutions, measurements and deferred conditional investigations.

The largest opportunities are reducing rendering submissions and repeated multiplayer data. Smaller, safer improvements include updating unchanged HUD elements less often and eliminating repeated game-over save operations. The local simulation measurements do **not** justify an engine rewrite or changes to gameplay.

All proposals must preserve room layouts, enemy counts and behavior, weapon timing, casino odds and outcomes, visuals, music, controls, the 30 Hz authoritative simulation, and existing saves. Priority below means recommended optimization order, not a claim that a feature is broken.

## Evidence and limits

- Inspected the live production welcome screen and the current source. Used the existing loopback-only `tests/expansion-fixture.js` for starting-room and casino-enemy scenes. Captured screenshots and inspected the built-in renderer counters. No warnings or errors appeared in the inspected browser logs.
- Did not join or modify the live multiplayer game, overwrite its browser save, change the user's settings, push commits, or redeploy.
- The renderer counters reset each frame and include **shadow and post-processing work**, not just visible objects. These are representative frame samples, not FPS or GPU timing measurements. The welcome camera moves, so its counts vary.
- Node measurements used an Intel Core i7-14700KF, Windows, Node v22.19.0. Each case warmed for 300 simulation steps, then measured 1,200 steps at `dt = 1/30`. Players were stationary and invulnerable. Combat cases maintained the normal enemy cap, with no player gunfire; enemy attack hazards could occur. These are synthetic local measurements, **not Render free-tier capacity measurements**.
- No browser CPU flame chart, GPU timer trace, network-throttled cold-load test, or long-duration GPU-memory soak was captured. Those remain acceptance checks for the relevant proposals. No percentage speedup is promised.
- Machine-readable results: [2026-09-10-performance.json](audits/2026-09-10-performance.json). Audit scripts were temporary files in ignored `.cache/`; the log and measurements are the only repository additions.

### Rendering samples

| Scene | Draw calls/frame | Triangles/frame | Context |
| --- | ---: | ---: | --- |
| Public welcome screen | 2,617 | 788,026 | Production build, floor overview, screenshot at 1280 × 720 |
| Starting-room intermission | 1,267 | 97,580 | One survivor, only atrium unlocked |
| Casino-enemy fixture | 1,535 | 580,856 | Four casino enemies, all rooms unlocked; paused simulation |

The last fixture uses a sentinel pending count of 999. Its HUD's “1003 guests” means four rendered enemies plus that sentinel; it is **not** a test with 1,003 enemy models.

### Simulation and network baseline

Snapshot sizes include the whole public room plus the recipient's private game data. Bandwidth is calculated at the configured 30 broadcasts/second and excludes WebSocket/TLS framing, retransmissions and checkpoints. It is an estimate from actual serialized fixtures, not a measured Internet transfer rate.

| Fixture | Enemies | Update p95 | Encode all recipients p95 | Average snapshot/client | Estimated payload/client | Room outbound payload |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Solo, starting break | 0 | 0.012 ms | 0.011 ms | 1.31 kB | 39 kB/s | 0.31 Mbit/s |
| Four, fully stocked break | 0 | 0.029 ms | 0.142 ms | 9.11 kB | 273 kB/s | 8.74 Mbit/s |
| Solo, wave 10 | 32 | 0.404 ms | 0.061 ms | 8.82 kB | 265 kB/s | 2.12 Mbit/s |
| Four, fully stocked wave 20 | 36 | 0.392 ms | 0.295 ms | 17.42 kB | 523 kB/s | 16.72 Mbit/s |

“Fully stocked” deliberately means all rooms, all weapons and maximum perks on every survivor. It illustrates inventory-related growth, not a typical new run. The two combat layouts differ, so their timings are not a controlled comparison of solo versus co-op difficulty. One client's JSON parsing was below 0.080 ms at p95 in these Node tests; browser parsing on slower devices still needs measurement.

Sealing a fully stocked four-player checkpoint took **0.134 ms at p95** and produced a **1,304-byte token**. Checkpoint compression is not a measured priority on this machine.

### Asset baseline

- Main production JavaScript: **776,246 bytes**; local gzip estimate **216,481 bytes**. CSS: **49,986 bytes**; local gzip estimate **12,343 bytes**. This build has one main JS bundle.
- 30 GLBs total **5,931,024 bytes**. All 30 must finish loading before the Enter button becomes usable.
- The chandelier contains **49 mesh primitives using only two materials** and is placed in all **12 rooms**: 588 mesh occurrences before visibility/shadow passes.
- Five MP3s total **18,006,420 bytes**. They are selected through one HTML audio element; the code does not preload all five into decoded audio buffers. This total must not be described as the initial page download.
- A live HEAD response for `chandelier.glb` advertised `Cache-Control: max-age=600`, byte ranges, and no `Content-Encoding`. Its local gzip size is 24,242 bytes versus 56,884 bytes raw. This one response is not evidence about every CDN response.
- Only **36,012 bytes** of identical embedded images were duplicated across the inspected GLBs. Cross-file texture deduplication is a low-value target compared with draw calls.

## Proposed optimization backlog

### PERF-01 — Batch repeated static prop pieces

**Priority: P1 · Expected benefit: high rendering potential · Effort: medium · Evidence: measured draw counts + asset inspection.**

**Where:** `src/render/environment.js:33,194,253`, `src/render/assets.js:98`, `public/assets/models/chandelier.glb`.

The building shell already merges by material, but installed props, 17 door assemblies, and ceiling trims remain separate meshes. The chandelier's 49 primitives are the clearest starting point. Extra scene submissions can cost CPU/GPU time even with a moderate polygon count.

**Proposed solution:** merge each rigid prop's compatible geometry by material in its own coordinate space, then instance repeated copies where useful. Batch each shutter separately from its frame so it can still move. Keep animated wheels, named interaction nodes, transparent glass and different render/shadow settings separate. Preserve geometry, normals, UVs, colors and transforms exactly. Existing batching is a starting point, not a reason to merge the entire casino into one mesh.

**Acceptance:** capture before/after frames from the same cameras and render settings, including door opening, cashier glass, table animations and shadows. Compare draw calls and CPU/GPU frame time. Reject any lost detail, sorting change, interaction failure, or new culling pop-in.

### PERF-02 — Pool and batch particles, tracers and dropped chips

**Priority: P1 · Expected benefit: smoother heavy combat · Effort: medium · Evidence: confirmed allocation pattern; combat frame-time gain unmeasured.**

**Where:** `src/render/world.js:204–287,435–456,509–551`.

Each particle creates its own box geometry, material and mesh. Each shot creates a tracer geometry/material; death creates 20 particles and an explosion creates 55. They are disposed shortly afterward. Dropped currency also creates a new cylinder and material per chip. Miniguns, flamethrowers, explosions and several players amplify both submission count and allocation churn.

**Proposed solution:** reusable cube/chip geometry, pooled effect records and reusable line buffers. Use instanced cubes/chips or equivalent batches with individual transforms, colors and fade values. Do not replace cubes with visually different points, reduce particle counts, cap visible effects, or change trajectories/lifetimes. Preserve transparent depth behavior and sorting; grow pools safely during peaks.

**Acceptance:** repeat four-player automatic fire, flame effects, clustered explosions and large chip collections. Compare visual recordings, p95/p99 frame time, allocations and graphics-resource counts over several waves. Reused instances must not flash at old positions or retain old colors.

### PERF-03 — Stop retransmitting unchanged room and inventory data

**Priority: P1 · Expected benefit: substantial bandwidth reduction as inventories grow · Effort: medium–large · Evidence: serialized-size measurements.**

**Where:** `server/index.js:188–225`, `server/game.js:965`, `src/main.js:349–392`.

Each recipient receives a newly serialized full snapshot at roughly 30 Hz. This includes whole inventories, perks, progression, history, campaign data and static enemy stats. The stocked combat sample's final snapshot included roughly 8.3 kB of player data and 7.2 kB of enemy data; many fields did not change between ticks.

**Proposed solution:** explicitly version the network schema. Keep motion/combat updates at their existing cadence, while sending unchanged fields once and later only when revised. Construct common room data once per broadcast; attach recipient-specific casino data separately. Begin with plain JSON and exact numeric values. Keep authoritative full snapshots for join/reconnect/resynchronization. Consider binary encoding or compression only after measuring the simpler change on the actual host.

**Acceptance:** four players can simultaneously use the same table without leaking private cards or unrevealed results. Verify ammo, perks, countdown, enemy spawns/deaths, late joins, refresh/resume and old/new client compatibility. Sequence transient effects and results so backpressure/coalescing cannot lose them. Measure bytes/second, host CPU and latency. Do not change the simulation rate, input rate, payout rules or position precision to claim savings.

### PERF-04 — Update UI and storage only when their displayed data changes

**Priority: P2 · Expected benefit: modest main-thread savings, easy cleanup · Effort: small · Evidence: confirmed repeated work.**

**Where:** `src/main.js:382–391,498–574`, `src/crew-ui.js:55–85`, `src/profile.js:37`.

Every state message updates many unchanged HUD fields. The chips element uses `innerHTML`; an open map rebuilds its entire room list. Once a run is over, each state message calls `saveSession()` again after deleting the already-absent checkpoint. `CrewUI.update()` repeatedly calls `recordRun()` (which reads localStorage even when already recorded) and rebuilds/appends the same summary.

**Proposed solution:** cache DOM references and last displayed values. Only write fields when their rendered text/style changes. Cache map markup against room unlocks and the player's room. Perform save deletion, summary creation and career recording once per run/phase transition, while retaining legitimate checkpoint and settings saves. Casino, Club and Crew menus already have fingerprint guards; improve their inputs where justified rather than rebuilding those systems.

**Acceptance:** all HUD values still update when they should, including countdown seconds, reload tenths, comps and revive progress. Preserve focus, scrolling, controller menu navigation, career idempotence and refresh/resume. Confirm storage writes occur on actual save changes, not continuously on the game-over screen.

### PERF-05 — Reuse hot-loop objects and clean up actor-owned GPU resources

**Priority: P2 · Expected benefit: fewer allocations and safer long sessions · Effort: medium · Evidence: code review; memory growth requires a soak test.**

**Where:** `src/render/assets.js:38–60,153–247`, `src/render/world.js:299–505,531–541`.

Actor animation repeatedly creates vectors/quaternions and forces bone/world-matrix updates. Each enemy also filters/sorts a fresh player array even though snapshots normally already contain its yaw. Weapon attachments are serialized every render frame to detect changes. In addition, shared actor roots skip general disposal: survivor-specific outline/badge/charm geometry/materials and the final equipped attachment meshes are not in their cleanup list. The code establishes an ownership gap; the long-session memory impact is not yet measured.

**Proposed solution:** reuse scratch math objects and lookups; avoid fallback targeting when server yaw exists; compute attachment signatures when equipment changes. Add explicit ownership lists for actor-created resources and dispose those on removal, while retaining shared model assets and cached label textures. Freeze local matrices only on objects proven static; moving doors, weapon parts and bones must continue updating.

**Acceptance:** a repeated join/remove/weapon-switch soak should return GPU geometry/texture counts to a stable baseline. Confirm live characters sharing the same asset remain intact. Check aim pose, reload animation, rolls, downed bodies and scoped weapons against matching frames.

### PERF-06 — Cache collision inputs and remove avoidable navigation allocations

**Priority: P2 · Expected benefit: server headroom across many rooms · Effort: medium · Evidence: code review; local tick costs currently small.**

**Where:** `shared/map.js:236–280`, `shared/data.js:304–325`, `server/navigation.js`, `server/game.js:807–911`.

Movement/visibility queries recreate barrier arrays, filter doors and scan walls/44 obstacle circles repeatedly. Navigation already caches walkability and rebuilds its distance field every 0.4 seconds, but allocates a queue and neighbor arrays. Enemy separation uses pairwise checks; the actual cap is 36 enemies, so this is bounded and not the first optimization to undertake.

**Proposed solution:** cache immutable barrier/collision data by open-room revision; reuse a typed queue and precomputed neighbor lists. Reuse a distance field when both walkability and the set of living target cells are unchanged. If profiling still warrants it, use a spatial grid for broad-phase collision and enemy-neighbor candidates, retaining the current exact collision tests and deterministic ordering.

**Acceptance:** identical seeded simulations must preserve movement, damage and outcomes. Specifically test doorway boundaries, newly unlocked rooms, rolls, jumps, scoped rays, wheelchair/crawler geometry and enemies navigating around furniture. Measure multiple active rooms on the real host before more invasive work.

### PERF-07 — Index WebSocket clients by room

**Priority: P2 · Expected benefit: scales with concurrent rooms · Effort: small–medium · Evidence: confirmed global scan.**

**Where:** `server/index.js:124–128,188–225`.

Every active game scans the entire server's client set to find its recipients. This is inexpensive for one four-person room but grows with unrelated rooms. The project allows up to 100 rooms, which is a limit, not a measured hosting capacity.

**Proposed solution:** maintain a room-local connection set, updating it on join, leave, replacement, disconnect and restoration. Keep the global heartbeat loop. Continue skipping inactive-room simulation and retaining the existing recovery deadlines.

**Acceptance:** reconnecting cannot leave duplicate recipients, replacement sockets cannot remove their successors, and expired rooms release their connections. Benchmark several real sockets across isolated local rooms; do not load-test the public free server without a separate test plan.

### PERF-08 — Separate snapshot-driven sound bookkeeping from frame-driven presentation

**Priority: P2 · Expected benefit: small allocation/CPU reduction · Effort: small–medium · Evidence: code review.**

**Where:** `src/main.js:952–993`, `src/soundscape.js:103–300`, `src/music.js:89`.

The animation loop runs music state checks every frame. Soundscape rebuilds player/hazard/game maps and visible-card summaries every frame, even when the last 30 Hz snapshot has not changed. These checks mix state transitions with genuinely continuous audio timing.

**Proposed solution:** process new snapshot transitions once per snapshot, cache comparison structures, and keep listener orientation, footsteps, roulette/slot cadence and continuous time-based effects on their appropriate clocks. Set media volume or play/pause state only when its inputs change. Retain the current voice limits, cached noise, fade/ducking behavior and cleanup.

**Acceptance:** no duplicated or missed shots, reel stops, card reveals, music skips, warnings, footsteps or final-ten-second countdown beeps at different frame rates. Verify focus/mute/volume changes immediately take effect.

### PERF-09 — Improve asset packaging and first-load scheduling

**Priority: P2 · Expected benefit: faster/slimmer cold loads · Effort: medium · Evidence: measured sizes and eager loading.**

**Where:** `src/render/assets.js:71–96`, `src/render/world.js:179–197`, `src/main.js:225–236`, `vite.config.js`, `tools/build-assets.js`.

All GLBs load and parse together, blocking entry, and the current build bundles all main JavaScript together. The existing asset pipeline already deduplicates, welds, quantizes, prunes and resamples many assets. Repeating those transforms alone is not a new optimization.

**Proposed solution:** first evaluate lossless geometry/buffer compression and material-compatible static merging, with explicit decoder support. Split rarely opened menu code where this reduces initial parse cost; preload it while the welcome scene is running. Any later staged model loading must fetch room models before they become visible or interactable, provide retries, and preserve the current full-casino welcome view. Version asset URLs when bytes change so caching cannot retain stale models after deployment. Verify GitHub Pages compression behavior rather than assuming arbitrary response headers can be configured there.

**Acceptance:** compare uncached download bytes, parse/compile time and time-to-entry on a throttled connection; test the real `/dead-draw/` base path, slow room unlocks, first weapon use and refresh after an asset update. No placeholders, missing props, changed textures or menu-opening hitch should be introduced. The five songs should retain their present fidelity and streaming behavior.

### PERF-10 — Profile room visibility, lighting and shadow submissions before tuning them

**Priority: P3 / investigation · Expected benefit: potentially high, but more visual risk · Effort: medium–large.**

**Where:** `src/render/environment.js:33–53,140–149,332–354`, `src/render/world.js:36–92`, `src/render/assets.js:85`.

The building shell is merged across the whole casino; that limits fine-grained culling. Unlocked props are not partitioned by what the camera can actually see. Twelve room point lights exist globally, in addition to table lights. Skinned meshes disable ordinary frustum culling, and the directional shadow follows the player. These are candidates, not a measured breakdown of GPU cost.

**Proposed solution:** capture a SpectorJS/browser GPU/CPU frame trace first. Investigate room-sized geometry batches, conservative visible-room sets and animation-safe character bounds. A room outside the camera can still cast a visible shadow or affect a visible surface; preserve those contributors. Never decide lighting relevance solely from which room the player occupies. Keep the welcome overview as a separate visibility case. Optimize submissions before considering more complex shadow caching or light selection.

**Acceptance:** screenshot/video comparisons through every doorway, across long sightlines, with scopes, glass, pings, labels, enemies and moving shadows. The optimization is only acceptable if existing visible output is retained. Lowering shadow resolution, disabling bloom, reducing draw distance, or forcing low quality would change the appearance and is outside this request.

## Suggested execution and verification order

1. Record browser CPU/GPU frame timings and allocations at fixed cameras: atrium, all rooms open, full enemy cap, four-player heavy weapons, and concurrent casino play. Record cold/warm load separately.
2. Implement **PERF-01 and PERF-02** independently, with before/after visual and performance comparisons. Do **PERF-04** as a small independent cleanup.
3. Implement **PERF-03** with protocol/reconnect tests; then **PERF-07**. These changes require coordinated frontend/server rollout and compatibility handling.
4. Use the resulting profile to decide whether **PERF-05/06/08/09** are worth their cost. Investigate **PERF-10** only with frame captures.
5. Add a repeatable optional performance report around the existing QA fixtures: draw calls, p95/p99 frame times, allocation/resource counts and per-client bytes. Use stable test conditions and trend comparisons, not fragile absolute CI timing assertions. Run normal gameplay/deployment tests and a long co-op soak before an approved release.

## Keep as-is unless new evidence says otherwise

- Three.js + Vite + authoritative Node/WebSocket architecture; no need to migrate engines/frameworks for this audit.
- Current 30 Hz simulation, enemy cap, movement/fire/reload timing, map, payouts and game content.
- Existing shared GLB cloning, static-shell batching, instanced table chips, cached encounter labels/materials, and casino/Club menu fingerprint guards.
- Existing audio voice caps, cached procedural noise, cleanup and one-element MP3 playback. Do not preload all songs or lower their fidelity.
- Existing encrypted checkpoints and stable secret. Preserve checkpoint cadence/recovery semantics; synchronous sealing was cheap in the measured fixture.
- Existing localStorage keys/save compatibility. Do not add a service worker casually: stale multiplayer clients and stale assets would complicate deployment.
- Do not force low graphics, lower resolution, reduce particles/enemies, or downgrade music to report a performance gain.

**Recommended first batch after approval:** static prop batching, pooled combat effects, and change-only HUD/save updates. Then address snapshot bandwidth with dedicated multiplayer compatibility tests.
