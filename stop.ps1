# ============================================================
# Frontend Stop Script (frontend)
# Kill Vite dev server by port 9876 / 9877
# ============================================================
$ports = @(9876, 9877)
$stopped = $false

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $processId = $connection.OwningProcess | Select-Object -First 1
        Write-Host "[Frontend] Stopping service (port $port, PID: $processId)..." -ForegroundColor Yellow

        # Also kill parent process (node/pnpm)
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue).ParentProcessId
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        if ($parent) {
            $parentProc = Get-Process -Id $parent -ErrorAction SilentlyContinue
            if ($parentProc -and $parentProc.ProcessName -match "node|pnpm") {
                Stop-Process -Id $parent -Force -ErrorAction SilentlyContinue
                Write-Host "[Frontend] Also killed parent process $($parentProc.ProcessName) (PID: $parent)" -ForegroundColor DarkGray
            }
        }
        $stopped = $true
    }
}

if ($stopped) {
    Start-Sleep -Milliseconds 500
    Write-Host "[Frontend] Service stopped" -ForegroundColor Green
} else {
    Write-Host "[Frontend] Service is not running" -ForegroundColor DarkGray
}
