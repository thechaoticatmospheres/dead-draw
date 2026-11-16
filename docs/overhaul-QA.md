# DEAD DRAW overhaul verification — 2026-11-16

## Current result

The existing game now runs with genuine, inspected Cycles lighting for the static casino. Both emergency and restored-power illumination are integrated. The working version remains in the isolated `codex/dead-draw-overhaul` copy; the original main deployment was not changed.

| Final check | Observed result |
| --- | --- |
| Complete automated suite, native Windows execution | **167 passed, 0 failed, 0 skipped**, 2.66 seconds; `test-results/final-native-tests.log` |
| Bake-specific tests | **5 passed**: interleaved and normalized Int16 export, runtime shader/material isolation, actual PNG/UV data and exact-source matching |
| Production build and asset checks | Passed at the root base path and `/dead-draw/`; all 30 models and 257 baked receivers present |
| Actual production subpath browser load | Baked lighting ready, all 257 receivers applied, no browser errors |
| Two-client browser smoke | **Passed all seven checks**, no page errors; `test-results/overhaul-browser/report.json` |
| Room lighting review | All twelve rooms in both power states captured and read through both contact sheets; full Atrium views in both states and Sapphire detail also inspected |
| Other visual review | Three full heavy-combat captures, House, defeat, extraction and restart; all six multiplayer-smoke screenshots inspected |
| Rules, recordings and save formats | No server-rule or save-format changes; shared changes are camera collision math; approved recordings and audio source assets preserved |

The earlier shell-only network failures were execution-context restrictions. The final native test run above resolved those checks; they were not skipped or changed to report success.

## What the browser smoke actually exercised

Two independent browser contexts joined the same ordinary multiplayer campaign. Through normal UI and input, the script verified:

- Pointer capture, held WASD movement, firing and full-magazine reload.
- Held movement without pointer lock, unlocked right-button drag, H/IJKL keyboard look and V aiming. Outbound input and the server's sequence acknowledgement were observed.
- Shift rolling and Space jumping/landing in authoritative snapshots.
- Walking to the slot machine with bounded camera-relative WASD steering, opening it with B, placing a real wager and receiving its settlement.
- The host's private hand remaining absent from the guest's stream.
- Reloading and resuming the same survivor without duplication.
- Both survivors readying early and the real first combat wave spawning.

The script does not teleport players, inject game state, grant chips or enable testing mode. Its six captures cover title, floor, unlocked aiming, floor plan, private casino and live combat. The camera unit suite also passes more than 20,000 samples across twelve rooms and checks every shutter's closed/open movement behavior.

## Actual Cycles output

Blender **4.5.9 LTS**, Cycles, **OptiX / NVIDIA GeForce RTX 4070** produced both **4096 × 4096**, **256-sample** atlases. Geometry and transforms come from the playable environment; all 574 exported opaque static meshes participate in transport. The runtime maps cover 257 diffuse receivers and 39,602 triangles. Very fine geometry, metal, emission, glass and moving objects retain live rendering.

Open Image Denoise uses a clean world-normal bake as guidance. The shader replaces static diffuse illumination while preserving live specular, room reflection probes and dynamic actors. Restored power blends the actual two lighting solutions.

| Asset measurement | Final value |
| --- | --- |
| Runtime PNGs plus UV data | 31,529,726 bytes, approximately 31.5 MB |
| Two RGBA atlases with mipmaps | 170.67 MiB of GPU texture storage |
| UV occupation | 36.56% |
| Floor lighting density | Approximately 21.08 texels/metre; separate surface textures retain fine material detail |
| Padding | Four-pixel dilation within eight-pixel packing gaps |
| Restored / emergency average light energy | 2.079× |
| RGBM normalized round-trip error | 0.235% / 0.191% |
| Denoising change to average light energy | 0.137% / 0.181% |
| Clipped pixels | Emergency 0%; restored 0.000632% |
| Final bake job | 86.74 seconds |
| Exact exported source SHA256 | `302dca696b9d8a6fe23a86a034074d967d80612c605bab5ee3845f0f85576876` |

`tools/check-bake-assets.js` independently checks PNG chunk CRCs and decoded pixels, SHA256/byte counts, UV bounds/topology, physical texel density, atlas dimensions and two-state energy. Build checks repeat validation on shipped files. Editable Blender source and reproducible scripts are retained.

Two earlier outputs were rejected during review. The first packed many disconnected triangles into tiny islands, leaving a 16-metre floor with only about five light pixels. Welding, receiver selection and explicit packing fixed that. A second defect transformed normalized Int16 glTF positions into integer storage, wrapping furniture near the origin. Export now transforms read-only vertices through floating-point vectors; dedicated regression tests verify world coordinates, unchanged source buffers and matching geometry signatures. These rejected outputs are not the delivered bake.

## Measured rendering performance

The recorded run used hardware-accelerated **ANGLE / NVIDIA GeForce RTX 4070 / Direct3D11**, Three.js r180, **1920 × 1080**, internal scale **1**, device-pixel ratio **1**, high quality and **4× MSAA**. It used a local gameplay fixture with four simulated survivors and active heavy-weapon effects; it is not a network-latency benchmark.

| Sample | Valid frames | Average | 95th / 99th percentile frame time | Frames over 20 ms |
| --- | ---: | ---: | ---: | ---: |
| Whole approximately ten-second window | 1,771 | 176.97 fps | 5.7 / 11.1 ms | 0 |
| Heavy subset, 20–35 enemies | 708 | 173.45 fps, 5.765 ms | 5.7 / 11.1 ms | 0 |

The heavy subset reached 456 active effects. One invalid negative initialization interval was excluded from the statistics and retained in the raw evidence. The source report is `test-results/baked-performance/report.json`. These measurements establish performance on this desktop RTX 4070 only.

## Authority and recovery coverage

`tests/overhaul-flow.test.js` exercises the real Game implementation, checkpoint modules and recipient-specific state streams. It buys room access through validated actions, fights naturally spawned waves 1–10 using actual firing/reload/damage, earns the two boss keys, restores power, retrieves the archive and defeats the House. It verifies extraction voting, authenticated checkpoint restoration, restart, downing/reviving, defeat and endless wave 12.

Four recipient-specific blackjack streams are checked for private hands and hidden-card/deck exclusion. The intermission deadline settles all pending hands exactly once and begins combat. Existing native socket tests also pass reconnect and encrypted checkpoint restoration after server restart.

These integration tests supply initial currency and positions for deterministic coverage. They are **not** a full input-driven browser campaign or a test of economy pacing.

## Preservation and remaining work

The recoverable baseline commit `6418a382957624de01e7f6344c771739d2df1fd9` is preserved on GitHub as `stable/pre-overhaul-2026-11-16` and tag `pre-overhaul-2026-11-16`. The original source archive and Git history bundle were verified. Original main remains separate; this work has not been deployed from main.

The following original overhaul requirements remain unfinished or unverified:

- A complete campaign played end to end through browser input.
- Six complete improvement rounds, each with three inspected captures followed by fixes and rechecks.
- Close-up inspection of every room, exhaustive physical wall/corner/furniture/doorway walking, and every doorway transition.
- Physical controller playtesting and the requested recent-laptop GPU performance target.
- The full photographic quality target: characters remain visibly stylized/blocky and some heavy-attack overlays remain opaque.
- Cold-load optimization: the approximately 31.5 MB bake can make the first load take more than five seconds.

The complete game remains playable. The bake and listed checks are complete; the entire original major-overhaul brief is not.

