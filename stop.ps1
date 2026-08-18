# ============================================================
# Frontend Stop Script (frontend)
# Kill Vite dev server by port 9876 / 9877
# ============================================================
$ports = @(9876, 9877)
$stopped = $false

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
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
    Start-Sleep -Seconds 1
    # 验证端口是否真正释放
    $stillListening = $false
    foreach ($p in $ports) {
        $verifyConn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($verifyConn) {
            Write-Host "[Frontend] Failed to stop: port $p still in use (PID: $($verifyConn.OwningProcess | Select-Object -First 1))" -ForegroundColor Red
            $stillListening = $true
        }
    }
    if (-not $stillListening) {
        Write-Host "[Frontend] Service stopped" -ForegroundColor Green
    }
} else {
    Write-Host "[Frontend] Service is not running" -ForegroundColor DarkGray
}
