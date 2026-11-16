# DEAD DRAW physical art direction

The Gilded Palm is a late-1970s casino built from real manufactured materials and maintained until the current emergency. Its luxury comes from warm pools of tungsten light, ivory marble, tobacco walnut, antique brass and jewel-toned textiles. Aging is local to use, moisture and contact; it is never a uniform dirt filter.

- Marble is honed ivory limestone with branching grey-brown veins, 2 m tile modules and narrow grout. It is dielectric, not metallic. Walkways have restrained clear reflections and fine polishing variation; there is no mirror floor.
- Carpet is densely woven wool in deep wine, green and midnight tones. Art Deco fan patterns are woven into the pile. Tiny crossing fibres and roughness make it absorb light. Broad traffic wear compresses the pile without painting random damage everywhere.
- Wall coverings are woven, subtly lustrous fabric set into walnut frames above a lacquered dado. Repeated geometric panels are manufactured at a consistent physical scale. Chamfered mouldings catch real highlights.
- Brass is aged yellow metal. Recessed/broad surfaces are darkened and brushed; the exposed edge trim is smoother and lighter. Contact hardware is polished. Black lacquer is a dielectric coating with controlled highlights.
- Walnut has longitudinal grain, deep warm brown colour and a thin lacquer surface. Grain and roughness are shared coherently across furniture. Exposed edge mouldings are warmer and smoother.
- Upholstery is dark burgundy leather or velvet. Fine grain, soft compression, seams and small piping give seats weight. Felt has small fibres and high roughness; chips and cards remain rigid manufactured objects.
- Chandeliers have brass frames, opal glass and individual refractive-looking prism faces. Emission lives on the lamp surfaces; surrounding architecture receives lighting from the actual lamp group.
- Existing geometry and gameplay footprints remain authoritative. New dimensional dressing belongs on walls, ceilings, or inside the current station/obstacle footprint. No decorative obstacle may block a traversable route or door.
- Emergency lighting keeps exit routes and silhouettes legible. Restored power increases actual lamp and bounced illumination. Any authored material map is albedo/roughness/normal, never a painted lighting substitute.

All procedural surface maps are deterministic original artwork generated locally by `src/render/surfaces.js`. Static geometry can be exported with `CasinoEnvironment.exportBakeScene()` for the reproducible lighting pipeline. This direction does not itself claim that Cycles baking has completed.

## Implemented geometry and resource budget

`src/render/physical-materials.js` authors eleven shared runtime textures: three 1024-pixel albedo maps, seven 512-pixel surface maps and one 256-pixel wool-wear map. Their approximate uncompressed GPU allocation including mipmaps is 25.7 MiB, excluding existing labels, models, render targets and any future lightmaps. There are no external texture requests or new CDN dependencies.

`src/render/environment-detail.js` adds coffer mouldings, recessed opal cove strips, wall-mounted fluted lamps, framed fan motifs, rug borders, crystal/brass chandeliers, attached machine controls and suspended station sign frames. Wall details occupy the existing wall margin. Station and seat additions remain inside existing station footprints. The gameplay room layout, openings and obstacle definitions are unchanged.

The static shell constructor and its exporter were executed under a minimal Canvas2D test adapter to check mesh composition and finite geometry. This validates construction, not pixels: 12 rooms, 12 room lights, 304 scene meshes and 250,508 triangles before loaded props; 224 export meshes including service entrances and stationary door frames. The 304 scene meshes include hidden moving shutters and labels. Static service entrances were batched, reducing 96 draw objects relative to the unbatched version. Browser-visible draw calls and GPU cost still require a real renderer measurement.

`CasinoEnvironment.exportBakeScene()` exports actual world-space positions, normals, UVs, triangle indices, material families and light approximations. Moving shutters and prize displays are explicitly excluded from baked shadows. Shader maps are albedo/normal/roughness only. No lighting bake has been run during this environment pass, and no screenshot-based quality claim is made without browser inspection.


## Visual improvement round 1

Inspected the title, combat and roulette screenshots from the actual renderer. The weakest visible environment elements were gold shutter slat aliasing, blank bright coffer fields, and overly uniform shiny trim/wood. The same captures exposed oversized stretched veneer grain and plastic-looking pink seats.

Changes: lowered shutter rib frequency and replaced bright metal with rough lacquered steel; added subtle trowelled plaster texture/normal detail; made the carpet medallion woven yarn rather than polished metal; assigned wall veneer/wallpaper UVs using physical dimensions; increased broad brass and walnut roughness; darkened upholstery toward burgundy; and gave printed felt fibre normals with restrained specular. These edits preserve station geometry and shared collision data.

## Completed lighting bake — 2026-11-16

The earlier construction notes above describe the initial environment pass.
The overhaul now includes an actual, inspected Cycles bake and an active runtime
adapter. Blender 4.5.9 LTS used OptiX on the RTX 4070 to bake separate emergency
and restored-power illumination at 4096 x 4096 and 256 samples, followed by guided
Open Image Denoise. Both final atlas inspection images and both Blender room
renders were read after completion.

The final export contains 574 opaque static meshes; 257 meshes / 39,602 triangles
receive baked diffuse light. It includes the actual loaded casino furniture and
service architecture, not collision-envelope substitutes. The current export
stores floating-point world positions, indices, material averages and stable
geometry signatures; normalized/interleaved glTF access is regression-tested.
Shared gameplay collision and authority remain unchanged.

Runtime material grain, weave and normal maps remain independent of the lightmaps.
Static diffuse illumination is replaced rather than added twice. Live specular
response and room-local reflection probes remain active, and the campaign's power
state blends both lighting states. Fine ornaments, moving actors, glass and doors
use live lighting; their dynamic shadows are not part of the static bake.

See [BAKED-LIGHTING.md](BAKED-LIGHTING.md) for reproduction, measured texture memory
and density, source files, and known hybrid-lighting limits. These completed bake
results supersede the earlier statements that no lighting bake had run.
