# ============================================================
# Frontend Start Script (frontend)
# Port: 9876 (Vite may fallback to 9877 if occupied)
# ============================================================
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$port = 9876

# Check if port is already in use
$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connection) {
    Write-Host "[Frontend] Port $port is already in use, service may already be running" -ForegroundColor Red
    exit 1
}

Write-Host "[Frontend] Starting Vite dev server..." -ForegroundColor Cyan
Write-Host "[Frontend] Working dir: $scriptDir" -ForegroundColor DarkGray
Write-Host "[Frontend] Listen port: $port" -ForegroundColor DarkGray
Write-Host ""

# Launch pnpm dev in a new window
Start-Process -FilePath "cmd" -ArgumentList "/c", "pnpm dev" -WorkingDirectory $scriptDir

Write-Host "[Frontend] Service launching in new window..." -ForegroundColor Green
Write-Host "[Frontend] Will be available at: http://localhost:$port" -ForegroundColor Green
