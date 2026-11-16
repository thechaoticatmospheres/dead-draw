[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$baseCommit = '3cd427eef240a247ed89b744f8ad8c7bc483faf7'
$stableBranch = 'stable/pre-overhaul-2026-11-16'
$experimentBranch = 'codex/major-update'
$checkpointTag = 'pre-overhaul-2026-11-16'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed (exit $LASTEXITCODE). No further steps were run."
    }
}

Push-Location -LiteralPath $projectRoot
try {
    $headCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $headCommit -ne $baseCommit) {
        throw 'The checkout has changed since preparation. Review it before making this checkpoint.'
    }
    $originUrl = (& git remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0 -or $originUrl -ne 'https://github.com/thechaoticatmospheres/dead-draw.git') {
        throw 'Unexpected origin. No repository changes have been made.'
    }
    foreach ($ref in @("refs/heads/$stableBranch", "refs/heads/$experimentBranch", "refs/tags/$checkpointTag")) {
        & git show-ref --verify --quiet $ref
        if ($LASTEXITCODE -eq 0) { throw "$ref already exists. Review the existing checkpoint instead of replacing it." }
        if ($LASTEXITCODE -ne 1) { throw "Unable to inspect $ref." }
    }
    $remoteRefs = @(& git ls-remote --heads --tags origin "refs/heads/$stableBranch" "refs/heads/$experimentBranch" "refs/tags/$checkpointTag")
    if ($LASTEXITCODE -ne 0) { throw 'Cannot reach origin. No repository changes have been made.' }
    if ($remoteRefs.Count -gt 0) { throw 'A target branch or tag already exists on GitHub. Nothing has been overwritten.' }

    # Keep failures visible: a build alone is not sufficient to mark this stable.
    Invoke-Checked 'npm.cmd' @('test')
    Invoke-Checked 'npm.cmd' @('run', 'build')
    Invoke-Checked 'npm.cmd' @('run', 'check:build')
    Invoke-Checked 'node' @('tools/audio-game-smoke.mjs')
    Invoke-Checked 'node' @('tools/audio-review-smoke.mjs')
    Invoke-Checked 'git' @('diff', '--check')

    Invoke-Checked 'git' @('switch', '-c', $stableBranch)
    Invoke-Checked 'git' @('add', '--all')
    Invoke-Checked 'git' @('diff', '--cached', '--check')
    Invoke-Checked 'git' @('commit', '-m', 'Save verified pre-overhaul checkpoint with approved audio and source recordings')
    Invoke-Checked 'git' @('tag', '-a', $checkpointTag, '-m', 'Pre-overhaul checkpoint; unit, runtime, build and audio browser checks passed')
    Invoke-Checked 'git' @('branch', $experimentBranch)
    Invoke-Checked 'git' @('push', '--atomic', 'origin', "refs/heads/$stableBranch", "refs/heads/$experimentBranch", "refs/tags/$checkpointTag")

    $savedCommit = (& git rev-parse HEAD).Trim()
    $publishedRefs = @(& git ls-remote origin "refs/heads/$stableBranch" "refs/heads/$experimentBranch" "refs/tags/$checkpointTag^{}")
    if ($LASTEXITCODE -ne 0 -or $publishedRefs.Count -ne 3) { throw 'Push finished, but remote verification did not complete. Inspect GitHub before continuing.' }
    foreach ($line in $publishedRefs) {
        if (($line -split '\s+')[0] -ne $savedCommit) { throw 'Remote verification found a different commit. Inspect GitHub before continuing.' }
    }
    Invoke-Checked 'git' @('switch', $experimentBranch)
    Invoke-Checked 'git' @('branch', '--set-upstream-to', "origin/$experimentBranch")
    Write-Host "Saved and verified: $savedCommit"
    Write-Host "Stable checkpoint: $stableBranch (tag $checkpointTag)"
    Write-Host "Ready for changes: $experimentBranch"
    Write-Host 'main and the deployed game were not updated.'
} finally {
    Pop-Location
}
