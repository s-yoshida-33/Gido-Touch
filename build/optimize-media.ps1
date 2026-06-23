# build/optimize-media.ps1
# Local media video optimization script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\optimize-media.ps1 -MallId "suzaka"
# Optimizes .mp4 files in medias/{mallId}/videos/ using ffmpeg and saves to optimized/

param(
    [string]$MallId = ""
)

$ErrorActionPreference = "Stop"

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (e.g. suzaka, sendaikamisugi): " -NoNewline
    $MallId = Read-Host
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: Mall ID is required." -ForegroundColor Red
        exit 1
    }
}

$rootDir   = Split-Path -Parent $PSScriptRoot
$videosDir = Join-Path $rootDir "medias\$MallId\videos"

if (-not (Test-Path $videosDir)) {
    Write-Host "Videos directory not found: $videosDir" -ForegroundColor Red
    exit 1
}

$mp4Files = Get-ChildItem -Path $videosDir -Filter *.mp4
if ($mp4Files.Count -eq 0) {
    Write-Host "No .mp4 files found in: $videosDir" -ForegroundColor Red
    exit 1
}

$optimizedDir = Join-Path $videosDir "optimized"
if (-not (Test-Path $optimizedDir)) {
    New-Item -ItemType Directory -Path $optimizedDir | Out-Null
}

Write-Host "`n=== Local Media Video Optimization ===" -ForegroundColor Cyan
Write-Host "Mall: $MallId  |  $($mp4Files.Count) video(s)`n"

Push-Location $videosDir
try {
    foreach ($file in $mp4Files) {
        Write-Host "  Converting $($file.Name)..." -ForegroundColor Yellow
        $outputPath = Join-Path "optimized" $file.Name
        ffmpeg -i $file.FullName -c:v libx264 -b:v 3000k -maxrate 3000k -bufsize 6000k -profile:v main -c:a aac -b:a 128k $outputPath -y
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Failed to convert $($file.Name)" -ForegroundColor Red
        }
    }
}
finally {
    Pop-Location
}

Write-Host "`n=== Done! ===" -ForegroundColor Green
