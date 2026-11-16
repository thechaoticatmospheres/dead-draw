# Character and combat presentation pass

This pass changes rendering only; weapon damage, ammunition, perks, rewards, attack timing, aimRay and enemy hit volumes are untouched.

- Four original articulated employee/patron models regenerated from `tools/author-enemies.js`: rounded garment edges, seams, lapels, cuffs, sockets/brows, and separated metal/cloth response. Existing head positions, low-profile crawler/seated envelopes and pivots retained.
- Standard and special weapons receive controlled physical highlights and visible hardware. Pose uses player pitch, right-hand anchoring, three reload beats, recoil in hands/weapon and retained optics. Visual tracer endpoint always remains the server result.
- Pooled sparks, soft smoke/muzzle light, electrical arcs, flames, HP-triggered hit reactions, short capped defeat falls, contact shadows and heavy-attack anticipation follow actual snapshot state. No forced camera shake.
- Camera uses unchanged shared aimRay collision math. Attract fallback is now inside the Atrium at eye height. `world.inspectionView`, `world.setInspectionView`, and seeded effect generation support isolated deterministic captures.
- Subtle grain affects the scene only; DOM HUD remains sharp. Distant special-enemy labels are culled by camera distance.

Verified: 22 targeted automated checks pass (existing performance, enemy hit volumes, asset containers, input/collision checks, plus seeded effects and regenerated model envelopes). Total 30 shipped GLBs remain below the existing six MiB budget (6,191,824 bytes before other agents' asset changes).

Not yet verified by this author: live browser images, actual GPU frame cost, effects readability, first-person weapon alignment, or all special-weapon views. Browser launch restrictions were reported by QA; root is checking an alternate browser surface. These changes are a first pass pending actual visual review, not a claim of photorealistic character fidelity.
