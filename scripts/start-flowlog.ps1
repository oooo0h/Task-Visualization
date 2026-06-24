param([switch]$NoPopup)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverFile = Join-Path $projectRoot "server.js"
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

function Test-Flowlog {
  try {
    $result = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
    return $result.ok -eq $true -and $result.service -eq "flowlog"
  } catch {
    return $false
  }
}

try {
  if (Test-Flowlog) {
    Show-Result "Flowlog is already running.`nhttp://127.0.0.1:4173/" $true
    exit 0
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $nodePath = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath "F:\NodeJs\node.exe") { "F:\NodeJs\node.exe" } else { $null }
  if (-not $nodePath) { throw "Node.js was not found." }
  if (-not (Test-Path -LiteralPath $serverFile)) { throw "server.js was not found." }

  $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @($serverFile) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  foreach ($attempt in 1..30) {
    Start-Sleep -Milliseconds 200
    if (Test-Flowlog) {
      Show-Result "Flowlog started successfully.`nhttp://127.0.0.1:4173/" $true
      exit 0
    }
    if ($serverProcess.HasExited) { break }
  }

  if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
  throw "Flowlog did not start within 6 seconds. Port 4173 may be in use."
} catch {
  Show-Result "Flowlog failed to start.`n$($_.Exception.Message)" $false
  exit 1
}
