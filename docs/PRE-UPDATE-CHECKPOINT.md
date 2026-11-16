# Pre-update checkpoint preparation - 2026-11-16

The project is DEAD DRAW 0.7.2 (workspace name: zombiino).

## Current state

- Local `main` and GitHub `main`: `3cd427eef240a247ed89b744f8ad8c7bc483faf7`.
- Current local work includes approved recorded audio, routing changes, tests, the audio review interface, all candidate recordings and source MP3s, and generation/selection records.
- No game source was changed during checkpoint preparation. This note and the checkpoint script were added; `/backups/` was added to `.gitignore` so archives do not become recursive Git inputs.
- Creating a local branch was denied because `.git` is read-only in this session. Shell network access is also restricted; the connected GitHub app returned `403 Resource not accessible by integration` when asked to create a branch. No commit, tag, branch or deployment was created or changed.

## Verification

- Production build: PASS.
- Production asset checks: PASS (30 models, music, compiled files).
- Automated tests: 141 passed; three network tests could not connect to localhost (`EACCES`). These concern production runtime, protected serving and checkpoint recovery. They were not disabled or modified.
- Audio browser checks: blocked by browser-launch and localhost permissions.
- This is a recoverable source snapshot, not a claim that every stability check passed.

## Finish the Git checkpoint

From PowerShell outside the restricted session, at the project root:

```powershell
& .\tools\Save-PreUpdateCheckpoint.ps1
```

The script checks the starting commit and origin, refuses to replace existing refs, runs all automated tests and both audio browser checks, commits the current files on `stable/pre-overhaul-2026-11-16`, creates the annotated tag `pre-overhaul-2026-11-16`, and creates `codex/major-update`. It pushes all three refs atomically, verifies their remote commit IDs, and switches to the experimental branch. It never pushes `main` or triggers its deployment.

The script deliberately stops on failure. If a failure occurs after a local commit, those commits remain safe; inspect the current state before retrying or pushing manually. Run it before making further changes so the checkpoint describes the snapshot reviewed here. Node.js 22 and the existing dependencies are required; a fresh checkout should first run `npm ci`. Browser tests require installed Microsoft Edge.

## Recovery archive

The companion archive contains:

- `working-tree/`: every tracked and non-ignored untracked file, including all audio-review recordings.
- `repository-history.bundle`: complete Git history for all 15 local and remote-tracking refs present during preparation, verified with `git bundle verify`.
- `snapshot-manifest.json`: SHA-256 checksums for each working-tree file, plus the original HEAD and refs.
- `validation/`: the actual automated test output and build output.
- `assets-source/kenney-survivors.zip`: the ignored source asset package, retained separately.
- `RESTORE.md`: restoration steps into a new directory.

Dependencies, generated builds, caches, credentials and browser-specific player saves are not required to reconstruct the source tree and are excluded. Local-only branches are preserved in the history bundle. Recover the bundle into a new folder, then overlay `working-tree/` to restore the uncommitted work. Never reset or clean the original project to perform recovery.
