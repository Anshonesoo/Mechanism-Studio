param([string]$Message = "deploy: ??????")
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-Npm {
  $c = Get-Command npm -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in @(
    "$env:ProgramFiles\nodejs\npm.cmd",
    "${env:ProgramFiles(x86)}\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd"
  )) {
    if (Test-Path -LiteralPath $p) { return $p }
  }
  throw 'npm not found. Install Node.js 18+ first.'
}

$npm = Get-Npm

Write-Host '[1/4] ????? ...'
& $npm run build
if ($LASTEXITCODE -ne 0) { throw 'build failed' }

Write-Host '[2/4] ?? gh-pages ???? ...'
$tmpIndex = Join-Path $env:TEMP ("ghp-index-" + [guid]::NewGuid().ToString('N'))
$env:GIT_INDEX_FILE = $tmpIndex
try {
  git --work-tree=dist add -A
  if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
  $tree = (git write-tree).Trim()
} finally {
  Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
  Remove-Item $tmpIndex -Force -ErrorAction SilentlyContinue
}
Write-Host "      tree = $tree"

Write-Host '[3/4] ???? ...'
$commit = (git commit-tree $tree -m $Message).Trim()
Write-Host "      commit = $commit"

Write-Host '[4/4] ??? origin/gh-pages ...'
git push -f origin "${commit}:refs/heads/gh-pages"
if ($LASTEXITCODE -ne 0) { throw 'push failed' }

Write-Host ''
Write-Host '???? 1 ?????? https://anshonesoo.github.io/Mechanism-Studio/'
