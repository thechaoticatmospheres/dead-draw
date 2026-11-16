[CmdletBinding()]
param([int]$Port = 5191)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    Push-Location -LiteralPath $projectRoot
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    } finally { Pop-Location }
}
$env:PORT = [string]$Port
$serverEntry = Join-Path $projectRoot 'server/index.js'
$logDirectory = Join-Path $projectRoot '.cache'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$process = Start-Process -FilePath $node -ArgumentList @('"' + $serverEntry + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'preview.log') -RedirectStandardError (Join-Path $logDirectory 'preview-error.log')
Write-Host "DEAD DRAW overhaul: http://localhost:$Port"
Write-Host "Preview process: $($process.Id). The original game and deployment are unchanged."
