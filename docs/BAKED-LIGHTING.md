# Genuine Cycles lighting in DEAD DRAW

This pipeline bakes illumination for the existing playable casino. It does not
replace the game, layout, collision, casino rules, progression or multiplayer.

## What is baked

The production pipeline uses Blender 4.5.9 LTS, Cycles, OptiX on an NVIDIA
GeForce RTX 4070, 256 samples and two 4096 x 4096 light atlases. The emergency
and restored-power images use identical UVs and genuinely different lamp power.
The final bake and denoising took 86.74 seconds after UV preparation. Both atlas
inspection images and both Blender room renders were read after this job.
The completed manifest records output checksums and the source scene hash.

`CasinoEnvironment.exportBakeScene()` exports the actual world-space triangles
and transforms after runtime models are installed. It reads interleaved glTF
attributes through their accessors, transforms into floating-point vectors, and
never writes world coordinates back into normalized integer vertex buffers.
Regression tests cover normalized, interleaved glTF geometry and untouched source
buffers. Stable mesh IDs and geometry signatures tie each triangle to its UVs.
Material colours are linear averages of the actual authored maps,
so carpet, walnut and marble contribute different bounced light. Their detailed
colour, roughness and normal maps remain live in Three.js.
Blender audit renders intentionally use those average colours, so sign lettering
and woven patterns appear only in the actual game, where their authored maps are
preserved. The audit renders verify architecture, light and occlusion.

The export contains 574 opaque static meshes. Of these, 257 meshes / 39,602
triangles receive baked diffuse illumination: floors, walls, ceilings, broad
furnishing surfaces, cabinets, table surfaces and service architecture. Full
source geometry remains in Blender as occluders. Tiny chip stacks, buttons,
piping and dense ornamental geometry retain live lighting: giving thousands of
small islands individual gutters would sacrifice usable wall and floor density.
Metallic and luminous surfaces keep live material response. Transparent glass,
moving shutters, actors, particles and relocating props are excluded from the
static bake. The cashier character is excluded while the cashier architecture
is included.

This is a hybrid renderer. It does not claim that every small prop is lightmapped,
that characters use baked skin lighting, or that dynamic doors cast new baked
shadows. Moving actors retain the live room lighting and contact-shadow planes.

## Runtime

`src/render/baked-lighting.js` validates all IDs, vertex/index counts, world-space
geometry signatures and UVs before modifying any mesh. It clones receiver
materials and converts only those geometries to per-corner UVs. A mismatch fails
closed to the existing live-light fallback rather than putting the wrong atlas
on an altered room.

The shader replaces static direct and indirect **diffuse** lighting with the
baked diffuse transport. It retains live specular response and the existing
room-local, position-corrected reflection probes. The lightmap does not include
albedo or view-dependent reflections. The actual campaign power state blends
the two lightmaps smoothly; fixtures and frozen captures use the same renderer.

RGBM stores scene-linear illumination with range 32 in RGBA8 PNG data. Textures
use `NoColorSpace`, unpremultiplied channel-packed alpha, and SHA-256 cache keys.
Every generated PNG is reopened, decoded and compared with the original linear
bake. Both images plus mipmaps consume about 170.7 MiB of GPU texture memory.
The two compressed PNGs total 28.88 MB; UV metadata is about 2.65 MB.

Open Image Denoise removes Monte Carlo noise from the linear lighting before
encoding. It uses clean Cycles world-space normal guidance and a unit-white
albedo guide, appropriate because material colour has been removed from the
lighting pass. Empty gutters remain empty. Raw EXRs are retained for comparison,
and a job fails if denoising changes total illumination energy by more than 15%.
The denoiser is Blender's bundled library; no extra runtime dependency is added.
Final measured energy changes were 0.137% and 0.181%. PNG encoding roundtrip
errors were below 0.24%; restored lighting has approximately 2.08 times the atlas
energy of emergency lighting. A tiny 0.000632% of restored texels exceed RGBM's
range near bright practical sources; the emergency atlas has no clipped texels.

The atlas uses welded geometry and a common pack to preserve runtime batching.
Floor/carpet islands receive additional area. Production floor density is about
21.08 lighting texels per metre; detailed material textures remain independent.
Packing occupies 36.56% of the atlas, with gutters and hidden/unlit surfaces
accounting for the remainder. Nominal inter-island separation is eight production
pixels, with four-pixel edge dilation on each side in production. Validation rejects low
floor density and wasteful packing before running an expensive bake.

## Reproduction

1. Run the local game from the overhaul checkout, then run
   `node tools/export-bake-scene.mjs`. It defaults to the preview on port 5191;
   set `DEAD_DRAW_URL` for a different server and `EDGE_PATH` for a different
   browser executable. The helper waits for the loaded world, exports
   `__deadDraw.world.environment.exportBakeScene()` to
   `assets/source/bake/scene.json`, and uses `?bake=off` to retain original indexed
   topology. The export is local; no scene is sent to an external service.
2. Run `node tools/export-bake-layout.mjs` when shared layout/light placement
   changes. Review the resulting `assets/source/bake/layout.json`.
3. Run the small bake first:

   ```powershell
   node tools/bake-casino.mjs --preview
   ```

4. Inspect both room PNGs and both atlas PNGs under `test-results/bake-preview/`.
   Check the manifest, coverage, state difference, seams, light leaks and density.
   A successful process alone is not a visual approval.
5. Run the production bake:

   ```powershell
   node tools/bake-casino.mjs --production
   ```

6. Run `node tools/check-bake-assets.js`, `npm test`, `npm run build` and
   `npm run check:build`. Inspect production atlas/room images under
   `test-results/bake-production/` and the actual browser's rooms, doorways and
   close surfaces in both power states. The two power states must visibly differ.

The wrapper selects the verified portable Blender by default on Windows, or
`BLENDER_BINARY` when provided. It passes `--python-exit-code 1`, rejects failed
or stale jobs, and verifies every generated file's size and SHA-256. The Python
pipeline also rejects source/layout edits made while a bake is running.

Runtime PNGs, UV metadata and the completed manifest live in
`public/assets/lighting/`. Linear inspection EXRs stay outside the runtime assets.
The editable source is `assets/source/bake/casino-static-lighting.blend`, alongside
its exported layout/mesh JSON and the checked-in generation scripts. A manifest
is written only after all bake, image roundtrip and state-difference checks pass.
Changing geometry or its placement requires a fresh export and bake.

## Limits

Microdetails and moving objects use live lighting. A moving shutter cannot change
precomputed bounce light through its doorway; actor contact shadows are separate
from the static bake. Atlas resolution is a lighting budget, not a replacement
for the authored high-frequency surface maps. No performance claim follows from
bake duration; the game must be measured separately with representative combat.
