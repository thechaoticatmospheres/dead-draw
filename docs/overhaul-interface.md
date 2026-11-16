# DEAD DRAW interface pass

## Changes

- Gilded Palm title treatment retains a wide unobscured environment view. Play combat demo and start/join campaign are distinct actions.
- Explicit Enable sound controls on title and HUD; main/audio integration owns activation and stored-volume behavior.
- Compact edge HUD retains health, armor, chips/comps, ammunition, objective, teammate, revive and intermission data. Most reference help stays collapsed.
- Local system fonts replace a runtime Google Fonts request.
- Casino presentation uses opaque dark lacquer surrounds, woven felt, printed card pips and court marks, moulded dice, layered chips and a brass/wood roulette wheel. It never changes the authority's result.
- Only newly arriving cards deal. Existing cards persist visually across snapshot re-renders; masked cards reveal in place. Input focus, scroll and expanded rules survive same-hand refreshes.
- Roulette animation uses elapsed time rather than frame count. An optional presentation clock supports isolated deterministic capture.
- Slots bonus choices are compact but open automatically when free spins or a bonus are available. No values, odds or awards changed.
- Sic Bo renders the authoritative dice as pip faces using the same die renderer as craps.
- Help describes private simultaneous hands and the real 90-second bell. Keyboard-look instructions preserve the normal control map.

## Verification

JavaScript syntax checks passed for casino-ui.js, extra-casino-ui.js and high-stakes-ui.js. Direct imported card rendering checks confirmed masked card markup does not expose the hidden suit, ten-card markup has ten pips, and court/ace cards have the expected rendered detail. No undefined text appeared in these probes.

Shell-driven browser capture was blocked by the environment's Edge launch/profile pipe restriction, and localhost requests from that shell failed EACCES. A real browser screenshot review is required before claiming visual verification of this pass. These notes do not claim completed browser playtesting.

## Ending and capture follow-up

The authoritative `summary.extracted` flag now selects the victory headline and Play Again label. Defeat keeps the original House headline and restart action. Summary details appear before the restart button. A phase marker hides combat HUD information and revive hints during the ending, while the demo's Back to Title control remains reachable. Restarting into an active phase restores the combat HUD automatically.

The local demonstration strip sits at the bottom center above the controls, leaving the boss header clear. `crew-ui.js` passed a JavaScript syntax check; the root browser review must verify the House, defeat, extraction, and restarted views before these layout changes are declared visually checked.
