param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$node = $null
$found = Get-Command node -ErrorAction SilentlyContinue
if ($found) { $node = $found.Source }
if (-not $node) {
  foreach ($p in @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )) {
    if (Test-Path -LiteralPath $p) { $node = $p; break }
  }
}
if (-not $node) { Write-Host '[ERROR] Node.js not found.'; exit 1 }

$vite = Join-Path $root 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $vite)) { Write-Host '[ERROR] Dependencies missing. Run: npm install'; exit 1 }

& (Join-Path $PSScriptRoot 'stop-dev.ps1') | Out-Null

Start-Process -FilePath $node `
  -ArgumentList @($vite, '--port', "$Port", '--open') `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root 'dev-server.log') `
  -RedirectStandardError (Join-Path $root 'dev-server.err')

Write-Host "Mechanism Studio dev server starting on port $Port"
exit 0
