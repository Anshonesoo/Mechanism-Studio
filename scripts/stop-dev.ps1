$ErrorActionPreference = 'SilentlyContinue'
$targets = @(
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'vite[\\/]bin[\\/]vite\.js' }
)
if ($targets.Count -eq 0) {
  Write-Host 'No Mechanism Studio dev server is running.'
  exit 0
}
foreach ($t in $targets) {
  Stop-Process -Id $t.ProcessId -Force
  Write-Host "Stopped dev server (pid $($t.ProcessId))."
}
exit 0
