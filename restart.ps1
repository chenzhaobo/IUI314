# ============================================================
# Frontend Restart Script (frontend)
# Stop then start Vite dev server
# ============================================================
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========== Frontend Restart ==========" -ForegroundColor Cyan

# Step 1: Stop
Write-Host "[Frontend] Stopping service..." -ForegroundColor Yellow
& "$scriptDir\stop.ps1"

# Wait for port to be released
Start-Sleep -Seconds 2

# Step 2: Start
Write-Host "[Frontend] Starting service..." -ForegroundColor Yellow
& "$scriptDir\start.ps1"

Write-Host "=====================================" -ForegroundColor Cyan
