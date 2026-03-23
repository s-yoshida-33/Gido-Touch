# Video compression and S3 upload script for Gido-Touch
# Usage: powershell -ExecutionPolicy Bypass -File .\build\compress-video.ps1 -MallId "sendaikamisugi"
#
# Source layout expected:
#   media/{MallId}/videos/optimized/   ← optimized video files
#   media/{MallId}/videos/             ← fallback (raw videos)
#
# S3 upload path:
#   s3://tti-distribution/public/gido-touch/medias/videos/{MallId}/

param(
    [string]$MallId = ""
)

chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (e.g. sendaikamisugi, suzaka): " -NoNewline
    $MallId = Read-Host
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: Mall ID is required." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Compressing video media for mall: $MallId" -ForegroundColor Cyan

# Source paths
$rootDir    = Split-Path -Parent $PSScriptRoot
$sourceDir  = Join-Path $rootDir "media\$MallId\videos\optimized"
$fallbackDir = Join-Path $rootDir "media\$MallId\videos"

# Use optimized/ if it exists and has video files, otherwise fall back
if ((Test-Path $sourceDir) -and (Get-ChildItem -Path $sourceDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }).Count -gt 0) {
    Write-Host "Using optimized videos from: $sourceDir" -ForegroundColor Green
} elseif (Test-Path $fallbackDir) {
    Write-Host "Optimized directory not found or empty, falling back to: $fallbackDir" -ForegroundColor Yellow
    $sourceDir = $fallbackDir
} else {
    Write-Host "Error: Source directory not found: $fallbackDir" -ForegroundColor Red
    exit 1
}

# Output paths: release/{MallId}/video-{yyyy-MM-dd-HH-mm-ss}.zip
$today      = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$zipFileName = "video-$today.zip"
$outputDir  = Join-Path $rootDir "release\$MallId"
$zipPath    = Join-Path $outputDir $zipFileName
$versionPath = Join-Path $outputDir "latest.json"

# Check video files
$videoFiles = Get-ChildItem -Path $sourceDir -File | Where-Object { $_.Extension -match '\.(mp4|webm|mov)$' }

if ($videoFiles.Count -eq 0) {
    Write-Host "Error: No video files found in $sourceDir" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($videoFiles.Count) video file(s)" -ForegroundColor Green
$videoFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }

# Create output directory
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# Remove existing zip if present
if (Test-Path $zipPath) {
    Write-Host "Removing existing zip file: $zipPath" -ForegroundColor Yellow
    Remove-Item $zipPath -Force
}

# Compress to ZIP
try {
    Write-Host "Compressing to ZIP file..." -ForegroundColor Cyan
    Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipPath -Force

    $fileSize   = (Get-Item $zipPath).Length
    $fileSizeMB = [Math]::Round($fileSize / 1MB, 2)

    Write-Host "Compression completed!" -ForegroundColor Green
    Write-Host "Output: $zipPath ($fileSizeMB MB)" -ForegroundColor Green
} catch {
    Write-Host "Error during compression: $_" -ForegroundColor Red
    exit 1
}

# Generate latest.json
$updatedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$versionJson = @{
    zip        = $zipFileName
    updated_at = $updatedAt
} | ConvertTo-Json -Compress

[System.IO.File]::WriteAllText($versionPath, $versionJson, [System.Text.Encoding]::UTF8)

Write-Host "Generated latest.json:" -ForegroundColor Green
Write-Host "  zip        : $zipFileName" -ForegroundColor Gray
Write-Host "  updated_at : $updatedAt" -ForegroundColor Gray

$s3Base = "s3://tti-distribution/public/gido-touch/medias/videos/$MallId"

Write-Host "`nFiles to upload to S3:" -ForegroundColor Cyan
Write-Host "  $zipPath" -ForegroundColor White
Write-Host "  $versionPath" -ForegroundColor White
Write-Host "  -> https://dl.tti.ninja/public/gido-touch/medias/videos/$MallId/" -ForegroundColor Gray

# Auto-upload via AWS CLI if available
if (Get-Command aws -ErrorAction SilentlyContinue) {
    # --- Archive existing S3 ZIPs before uploading new one ---
    $archiveDir = Join-Path $outputDir "archive"
    Write-Host "`nChecking for existing S3 ZIPs to archive..." -ForegroundColor Cyan

    if (-not (Test-Path $archiveDir)) {
        New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
    }

    # Download existing ZIPs (excluding latest.json) for local archive
    aws s3 sync "$s3Base/" $archiveDir --exclude "latest.json" 2>&1 | Out-Null

    $archivedFiles = Get-ChildItem -Path $archiveDir -File -ErrorAction SilentlyContinue
    if ($archivedFiles.Count -gt 0) {
        Write-Host "Downloaded $($archivedFiles.Count) existing ZIP(s) to archive: $archiveDir" -ForegroundColor Green
        $archivedFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }

        # Clean up old ZIPs from S3 (keep latest.json)
        Write-Host "Cleaning up old ZIPs from S3 (keeping latest.json)..." -ForegroundColor Cyan
        aws s3 rm "$s3Base/" --recursive --exclude "latest.json"
        Write-Host "S3 cleanup complete." -ForegroundColor Green
    } else {
        Write-Host "No existing ZIPs found on S3 (first upload)." -ForegroundColor Gray
        Remove-Item $archiveDir -Force -Recurse -ErrorAction SilentlyContinue
    }

    Write-Host "`nUploading to S3..." -ForegroundColor Cyan

    try {
        # Upload ZIP (cache allowed – filename is unique per timestamp)
        aws s3 cp $zipPath "$s3Base/$zipFileName" --content-type "application/zip"
        Write-Host "Uploaded: $zipFileName" -ForegroundColor Green

        # Upload latest.json with no-cache to prevent CDN from serving stale data
        aws s3 cp $versionPath "$s3Base/latest.json" `
            --content-type "application/json" `
            --cache-control "no-cache, no-store"
        Write-Host "Uploaded: latest.json (Cache-Control: no-cache)" -ForegroundColor Green

        Write-Host "`nUpload complete!" -ForegroundColor Green
        Write-Host "  https://dl.tti.ninja/public/gido-touch/medias/videos/$MallId/$zipFileName" -ForegroundColor Gray
        Write-Host "  https://dl.tti.ninja/public/gido-touch/medias/videos/$MallId/latest.json" -ForegroundColor Gray
    } catch {
        Write-Host "Upload failed: $_" -ForegroundColor Red
        Write-Host "Please upload manually using the commands above." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[INFO] AWS CLI not found. Please upload manually:" -ForegroundColor Yellow
    Write-Host "  aws s3 cp `"$zipPath`" `"$s3Base/$zipFileName`" --content-type application/zip" -ForegroundColor Gray
    Write-Host "  aws s3 cp `"$versionPath`" `"$s3Base/latest.json`" --content-type application/json --cache-control no-cache,no-store" -ForegroundColor Gray
}
