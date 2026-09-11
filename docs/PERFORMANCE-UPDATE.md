# Performance update — 0.7.2

This release implements the safe optimizations from the [0.7.1 audit](PERFORMANCE-AUDIT.md). Gameplay, casino outcomes, saves, controls, model fidelity, lighting, shadows, music and the 30 Hz simulation remain unchanged.

## Implementation

| Audit item | Release outcome |
| --- | --- |
| PERF-01 | Merge material-compatible rigid prop parts, door frames, shutters and ceiling trims. Preserve animated ancestors, transparent glass, transforms and shadow flags. Freeze static local matrices. |
| PERF-02 | Reuse particle/tracer objects, geometry, materials and motion records. Instance dropped chips with a growing buffer. Transparent effects retain individual sorting and their original count and lifetime. |
| PERF-03 | Negotiate lossless protocol 2 snapshots; encode common room state once and private hands separately. Send changed fields, periodic full snapshots and explicit resyncs. Legacy clients still receive full state. Congested sockets retain transient events within a bounded queue. |
| PERF-04 | Guard unchanged HUD text/styles, map markup, session storage and career summaries. Preserve existing storage keys and checkpoint formats. |
| PERF-05 | Reuse animation/camera scratch objects and dispose actor-owned GPU resources without disposing shared models. Only update scope presentation and projection when necessary. |
| PERF-06 | Cache collision barriers and navigation fields; reuse grid neighbors and BFS scratch storage. Preserve target order and collision results. |
| PERF-07 | Maintain room-local socket sets for broadcast and replacement. |
| PERF-08 | Observe snapshot-driven sound transitions once per received state, while keeping continuous sound cadence, ambience and music updates. Avoid redundant music element operations. |
| PERF-09 | Ship lossless gzip GLBs with content-hashed URLs, browser decompression and original-file fallback. Handle both raw gzip and HTTP-decoded responses. Split Three.js into a separately cached vendor chunk. Keep models available before entry and retain current music streaming. Conditional staged loading/menu splitting was not introduced. |
| PERF-10 | Add optional bounded CPU/GPU timing and resource counters. Keep room visibility, lights, bloom and shadow quality unchanged; conditional portal/light/shadow tuning remains deferred pending evidence and full sightline comparisons. |

## Validation and measured results

- A deterministic comparison against release `3ef0311` matched **6,000 simulation ticks exactly**. Every compact snapshot also reconstructed its legacy equivalent, including private hands.
- Local synthetic per-player snapshot bytes fell **53–96%** across the measured break/combat cases; stocked four-player, 36-enemy combat fell **71.45%** (17,401 to 4,969 bytes on average). These are payload measurements, not measured Render capacity or a latency guarantee.
- All 30 model files decompress byte-for-byte to their originals: **5,931,024 → 2,708,021 bytes**, a **54.34%** reduction. Build validation checks every file. Original GLBs remain as compatibility fallbacks.
- Representative 1280×720 welcome samples fell from roughly **2,617 to 939 draw calls**, and atrium intermission from **1,267 to 561**. Camera motion and batching bounds affect samples; these are not FPS improvement claims.
- A local four-survivor/36-enemy heavy-weapon soak exercised minigun, flamethrower and RPG firing/reloading. Effect allocation stabilized at 392 reusable objects; active effects returned to zero afterward. Actor resources were released. No browser warnings/errors appeared in inspected logs. This was a bounded local soak, not a long-term leak guarantee.
- Automated coverage includes mixed legacy/modern real sockets, a full 90-second round break, snapshot resync/privacy, exact collision results for all 4,096 room combinations, navigation parity, effect reuse, rigid transforms, resource ownership, audio cadence, save/checkpoint behavior and production subpath assets.
- Production preview was exercised under `/dead-draw/`, including refresh, entry, combat, and Survivor’s Club with Auto Reload present. Compression tests cover HTTP-decoded and raw gzip responses. A final browser diagnostic-selector timeout prevented re-reading the compressed-file counter after the loader correction; loading completed with no reported browser errors.

Raw measurements: [2026-09-10-performance-after.json](audits/2026-09-10-performance-after.json). Baseline conditions are recorded in the original audit. No throttled cold-load/time-to-entry benchmark or exhaustive GPU frame capture was completed; do not infer those improvements from byte counts.

## Reproduce

Run `npm test`, `npm run build`, and `npm run check:build`. Run `node tools/performance-report.js` for synthetic timing/payload measurements. Set `PERF_BASELINE` to a checkout of 0.7.1 to additionally assert simulation parity.

Open a local game with `?profile=1` to collect bounded CPU/GPU p95 samples and renderer counters on the canvas data attributes. GPU timings require `EXT_disjoint_timer_query_webgl2`. The loopback-only expansion fixture provides `/__qa/performance` and `/__qa/performance-stop` for a repeatable heavy-combat setup; these endpoints are absent from the production server.

Deployment remains the existing main-branch GitHub Actions → GitHub Pages pipeline plus the Render multiplayer service. The server supports old clients during rollout. Refreshing loads the new frontend; saves retain their existing keys and formats.
