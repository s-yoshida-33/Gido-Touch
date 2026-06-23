# build/optimize-media.ps1
# Local media video optimization script
# Optimizes .mp4 files in medias/{mallId}/videos/ using ffmpeg and saves to optimized/

$ErrorActionPreference = "Stop"

$rootDir    = Split-Path -Parent $PSScriptRoot
$mediasRoot = Join-Path $rootDir "medias"

if (-not (Test-Path $mediasRoot)) {
    Write-Host "Medias directory not found: $mediasRoot" -ForegroundColor Red
    exit 1
}

$mallDirs = Get-ChildItem -Path $mediasRoot -Directory | Where-Object { -not $_.Name.StartsWith('.') }

if ($mallDirs.Count -eq 0) {
    Write-Host "No mall directories found under medias/." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Local Media Video Optimization ===" -ForegroundColor Cyan
Write-Host "Target malls: $($mallDirs.Count)`n"

foreach ($mall in $mallDirs) {
    $videosDir = Join-Path $mall.FullName "videos"

    if (-not (Test-Path $videosDir)) {
        Write-Host "[$($mall.Name)] No videos directory found - skipping" -ForegroundColor DarkGray
        continue
    }

    $mp4Files = Get-ChildItem -Path $videosDir -Filter *.mp4
    if ($mp4Files.Count -eq 0) {
        Write-Host "[$($mall.Name)] No .mp4 files found - skipping" -ForegroundColor DarkGray
        continue
    }

    $optimizedDir = Join-Path $videosDir "optimized"
    if (-not (Test-Path $optimizedDir)) {
        New-Item -ItemType Directory -Path $optimizedDir | Out-Null
    }

    Write-Host "[$($mall.Name)] Optimizing $($mp4Files.Count) video(s)..." -ForegroundColor Cyan

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

    Write-Host "[$($mall.Name)] Done`n" -ForegroundColor Green
}

Write-Host "=== All malls optimized! ===" -ForegroundColor Green
