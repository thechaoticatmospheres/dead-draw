# DEAD DRAW asset credits

The survivor, survivor-female, zombie and zombie-alt GLB models use Kenney's **Animated Characters Survivors** pack (CC0).

- Creator: Kenney — https://kenney.nl
- Source: https://kenney.nl/assets/animated-characters-survivors
- License: Creative Commons Zero — https://creativecommons.org/publicdomain/zero/1.0/
- Original license text: `Kenney-CC0.txt`
- Source FBX character, idle/run/targeting animations and PNG skins are retained under `assets/source/kenney-survivors/` in the project.
- Processing: select skins/animations, normalize to 1.82 meters with feet at the origin, export GLB, deduplicate, weld, quantize, prune, and resample. Runtime character clones use independent skeletons and animation mixers; aim/shamble arm poses are added in the renderer.

The other fourteen GLB assets were created for this project in `tools/author-props.js`: slots, poker, roulette, blackjack, craps, baccarat, chair, chandelier, column, cocktail table, pistol, SMG, rifle and shotgun. Architecture, carpets, marble, wallpaper, table lettering and cabinet screens are original code-authored geometry/textures.

All runtime models contain their own textures. No remote asset host is needed during play. Rebuild with the development server running using `node tools/build-assets.js`.
