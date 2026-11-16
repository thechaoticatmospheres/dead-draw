# Dead Draw sound pilot

Run `node tools/audio-review-server.mjs` from the repository, then open http://127.0.0.1:5190.

Batch 3 contains all 110 remaining weapon and zombie sound families, generated with ElevenLabs Sound Effects v2: 10 weapon attacks, 37 handling sounds, 37 zombie vocals, 20 special effects and 6 impacts. Four candidates per family give 440 new recordings, with three technical shortlist picks and a reserve. Category filters, search, an unselected-only filter, and six sounds per page keep the complete batch navigable. Continuous loop previews play three cycles without a gap.

All 49 choices from the latest export are wired into the local game as the exact approved audition WAVs: 14 weapon attacks, 32 shared handling effects, and three zombie voices. This includes the seven earlier choices. Enable “Include previous batches” to revisit them. Listen to the current shortlist, select winners, retain alternates, and add feedback. Requests for new options are saved for Codex to act on, not automatically sent to ElevenLabs. Press Escape or Stop audio to stop all playback.

Decisions are stored in `decisions.json` in this folder. The export button provides a portable copy. New candidates have no winner preselected. The runtime manifest contains 49 approved recordings; the other 68 families retain existing game behavior, as authorized by the user. No unselected candidate was substituted. Samples preload once and use synthesized fallback while loading or if unavailable, without replaying old events. Shared handling families load once for compatible weapons. Saves update individual sound choices and preserve other batches.

## Review basis

Recommendations are provisional technical rankings, not claims of an auditory review. Weapon ordering considers attack-peak timing, energy beyond the firing interval, and decoded samples exceeding full scale. Zombie ordering checks technical validity and duration; this does not establish which performance sounds best. The user makes the subjective decision. Full-scale exceedance in MP3 decoding is a warning to listen for distortion, not proof of irreversible source clipping.

Original MP3s are preserved in `originals/`. The listening WAVs in `audio/` are mono 44.1 kHz with active RMS matching within families and a -3 dB peak ceiling. One-shots have silence trimming and short edge fades. Loops preserve full duration and their original boundaries, without one-shot fades. Repeated weapon playback uses the base firing interval; other effects use their catalog interval. The review player's compressor controls overlapping previews; final gameplay mixing still needs a separate check.

## Files and next steps

- `inventory.json`: all 14 weapons, 10 enemy types, common effects, and missing integration hooks.
- `catalog.json`: candidate IDs, prompts, technical measurements, rankings, and local filenames.
- `generation-record.json`: ElevenLabs flow, node, and session IDs for recovering original generations without charging for duplicates.
- `generation-record-02.json`: the second batch's node and session IDs.
- `approved-pilot.json`: the user's exported selections, preserved as the integration record.
- `approved-batch-02.json`: all seven approved selections exported by the user.
- `approved-batch-03.json`: the latest export, with all 49 selections implemented and null picks retained.
- `batch-03-plan.json`: all remaining sound prompts, timing, loop flags and shared-weapon assignments.
- `batch-03-nodes-*.json` and `batch-03-run-*.json`: generation ledger, including queue rejections. Only accepted sessions count; missing candidates are submitted after queue capacity becomes available.
- `coverage.json`: every required weapon/enemy event mapped to a candidate family, including shared handling.
- `decisions.json`: picks, alternates, regeneration requests, and notes, created on first save.

All remaining families are together in batch 3 at the user's request. Reload, reload completion, equip, and empty-click events now pass the local or remote player's weapon identity through the soundscape. The selected handling families cover 11 weapons; energy handling and sword equip retain procedural defaults. Replacing a gun in the same slot triggers its equip sound, and a cancelled reload cannot play the replacement gun's reload-completion sound. Gilded weapon rewards share base weapon identities. Unselected enemy attack, hurt, movement and sustained weapon-loop recordings remain in the review library; their additional runtime hooks have not been introduced.

Rebuild the inventory with `node tools/audio-review-inventory.mjs`, then `node tools/audio-review-coverage.mjs --complete` to verify coverage and refresh statuses. Rebuild previews with `python tools/audio-review-prepare.py .cache/audio-batch-03-downloads.json` (requires FFmpeg and reuses local originals). Preparing a batch preserves other batches. Fresh downloads need the ignored download record generated from the ElevenLabs result, whose signed URLs expire. Refresh those URLs by reading existing sessions, not by generating again.

Validation: `node tests/audio.test.js` checks all selection identities, weapon and enemy routing, local and remote handling transitions, fallback, preload lifecycle, mute, spatial mixing and voice cleanup. `node tools/audio-game-smoke.mjs` performs 139 actual browser mixer renders, covering all selected recordings, unselected handling defaults and stress tests. `node tools/audio-review-smoke.mjs` tests the listening page against an isolated copy of review data on port 5191, preserving live user decisions. Both browser checks use installed Microsoft Edge and Playwright.

This standalone local review server is outside the production build and binds only to 127.0.0.1. Its write API saves only validated review decisions.
