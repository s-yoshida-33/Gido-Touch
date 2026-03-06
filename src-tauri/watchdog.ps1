# Gido Touch Watchdog Script
# Monitors the Gido Touch process and restarts it if it exits unexpectedly.
# This script is launched by the scheduled task instead of the exe directly.

$exePath = Join-Path $PSScriptRoot "gido-touch.exe"
$logDir = Join-Path $env:LOCALAPPDATA "com.tti.gido-touch\logs"
$restartDelay = 5  # seconds to wait before restarting

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-WatchdogLog {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logFile = Join-Path $logDir ("gido-touch-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
    $entry = "[$timestamp] [INFO] [WATCHDOG] $Message"
    Add-Content -Path $logFile -Value $entry -Encoding UTF8
}

Write-WatchdogLog "Watchdog started. Monitoring: $exePath"

while ($true) {
    # Start the application
    Write-WatchdogLog "Starting Gido Touch..."
    $process = Start-Process -FilePath $exePath -PassThru

    # Wait for the process to exit
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    Write-WatchdogLog "Gido Touch exited with code $exitCode."

    # Exit code 0 from quit_app command = intentional shutdown, don't restart
    if ($exitCode -eq 0) {
        Write-WatchdogLog "Clean exit detected. Watchdog stopping."
        break
    }

    Write-WatchdogLog "Unexpected exit. Restarting in $restartDelay seconds..."
    Start-Sleep -Seconds $restartDelay
}
