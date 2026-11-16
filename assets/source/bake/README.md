# Casino Cycles lighting source

Status on 2026-11-16: **Baked locally, inspected and integrated into the overhaul renderer.**

The final job used Blender 4.5.9 LTS / Cycles / OptiX on the RTX 4070, with
256 samples and two 4096 x 4096 RGBM light atlases. Emergency and restored power
have separate illumination and bounced light. Open Image Denoise uses clean
normal guidance to remove Monte Carlo noise before encoding.

The current export contains 574 opaque static meshes from the actual loaded
game. Of these, 257 meshes / 39,602 triangles receive baked diffuse lighting,
including floors, walls, ceilings, cabinets, tables and service architecture.
Tiny ornaments and dense microdetails retain live lighting while remaining bake
occluders. Metallic reflections, transparent glass, actors and moving objects
remain live. The runtime replaces static diffuse illumination without adding it
twice, and blends both atlases using the real campaign power state.

## Editable sources

- `scene.json`: actual world-space mesh triangles, linear material averages and
  stable geometry signatures. Normalized/interleaved glTF data is read through
  accessors and transformed into floating-point vectors.
- `layout.json`: shared room, wall, station and light placement.
- `casino-static-lighting.blend`: editable Blender scene from the completed bake.
- `../../../tools/bake-casino.py`, `import-bake-scene.py`,
  `bake-casino-source.py` and `oidn-lightmap.py`: reproducible generation code.

Runtime lightmaps, UV mapping and the successful manifest are in
`public/assets/lighting/`. Raw and denoised EXRs plus inspection PNGs are in
`test-results/bake-production/`; inspection files are not shipped as game assets.
The final scene hash begins `302dca696b9d`; the manifest carries full hashes.

## Reproduce

From the overhaul checkout, with its local preview running on port 5191:

```powershell
node tools/export-bake-layout.mjs
node tools/export-bake-scene.mjs
node tools/bake-casino.mjs --preview
```

Inspect both room PNGs and both atlas inspection PNGs in
`test-results/bake-preview/`, including surface density, shadows and state
changes. Then run:

```powershell
node tools/bake-casino.mjs --production
node tools/check-bake-assets.js
```

The wrapper uses the verified portable Blender installation, or `BLENDER_BINARY`
when set, and passes `--python-exit-code 1`. It rejects failed/stale jobs and
checks every generated output's SHA-256 and size. The Python pipeline validates
UV coverage, floor density, RGBM decoding, power-state differences and denoising
energy changes before writing the successful manifest. Geometry changes require
a fresh export and bake; runtime geometry signatures reject mismatched atlases.

See [BAKED-LIGHTING.md](../../../docs/BAKED-LIGHTING.md) for complete commands,
measured memory/density, verification and hybrid-lighting limitations. Browser
inspection and representative combat performance remain separate checks from a
successful Blender job.