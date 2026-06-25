param([switch]$NoPopup)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot ".flowlog-data\server.pid"
$healthUrl = "http://127.0.0.1:4173/api/health"

function Show-Result([string]$Message, [bool]$Success) {
  if ($Success) { Write-Host $Message -ForegroundColor Green }
  else { Write-Host $Message -ForegroundColor Red }
  if (-not $NoPopup) {
    try {
      $shell = New-Object -ComObject WScript.Shell
      $icon = if ($Success) { 64 } else { 16 }
      $null = $shell.Popup($Message, 6, "Flowlog", $icon)
    } catch { }
  }
}

function Get-FlowlogHealth {
  try {
    return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
  } catch {
    return $null
  }
}

try {
  $health = Get-FlowlogHealth
  if (-not $health) {
    if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
    Show-Result "Flowlog is not running." $true
    exit 0
  }
  if ($health.service -ne "flowlog") { throw "Port 4173 is not a Flowlog service. Stop was refused." }

  $serverPid = if (Test-Path -LiteralPath $pidFile) { [int](Get-Content -Raw -LiteralPath $pidFile) } else { [int]$health.pid }
  if ($serverPid -ne [int]$health.pid) { $serverPid = [int]$health.pid }
  Stop-Process -Id $serverPid -Force

  foreach ($attempt in 1..25) {
    Start-Sleep -Milliseconds 200
    if (-not (Get-FlowlogHealth)) {
      if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
      Show-Result "Flowlog stopped successfully." $true
      exit 0
    }
  }
  throw "The stop command was sent, but Flowlog is still running."
} catch {
  Show-Result "Flowlog failed to stop.`n$($_.Exception.Message)" $false
  exit 1
}
