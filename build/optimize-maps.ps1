# build/optimize-maps.ps1
# Floor map (SVG) optimization script
# Usage: powershell -ExecutionPolicy Bypass -File .\build\optimize-maps.ps1 -MallId "halong"
#
# Shrinks embedded images in every SVG under medias/{MallId}/maps/{hostname}/
# down to (displayed size x max zoom) and overwrites the files (build/shrink-svg-images.mjs).
# Originals are backed up to medias/{MallId}/maps-backup/{timestamp}/{hostname}/.
# Re-running on optimized maps changes nothing. Distribute with media:compress as before.
#
# Requires: Node.js, ImageMagick (magick command)

param(
    [string]$MallId = "",
    # Max map zoom (keep in sync with TransformWrapper maxScale in src/screens/halong/ShopListScreen.tsx)
    [double]$MaxZoom = 4
)

chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

# Require MallId
if ([string]::IsNullOrWhiteSpace($MallId)) {
    Write-Host "Mall ID (e.g. halong): " -NoNewline
    $MallId = Read-Host
    if ([string]::IsNullOrWhiteSpace($MallId)) {
        Write-Host "Error: Mall ID is required." -ForegroundColor Red
        exit 1
    }
}

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "Error: ImageMagick (magick) is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$rootDir    = Split-Path -Parent $PSScriptRoot
$mapsDir    = Join-Path $rootDir "medias\$MallId\maps"
$shrinkJs   = Join-Path $PSScriptRoot "shrink-svg-images.mjs"

if (-not (Test-Path $mapsDir)) {
    Write-Host "Maps directory not found: $mapsDir" -ForegroundColor Red
    exit 1
}

$hostDirs = Get-ChildItem -Path $mapsDir -Directory
if ($hostDirs.Count -eq 0) {
    Write-Host "No hostname directories found in: $mapsDir" -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $rootDir "medias\$MallId\maps-backup\$timestamp"

Write-Host "`n=== Map Optimization ===" -ForegroundColor Cyan
Write-Host "Mall: $MallId  |  $($hostDirs.Count) host(s)  |  maxZoom: $MaxZoom"
Write-Host "Backup: $backupDir`n"

$results = @()
$failed = 0
foreach ($hostDir in $hostDirs) {
    $svgFiles = Get-ChildItem -Path $hostDir.FullName -Filter *.svg -File
    if ($svgFiles.Count -eq 0) { continue }

    # Back up originals
    $hostBackup = Join-Path $backupDir $hostDir.Name
    New-Item -ItemType Directory -Path $hostBackup -Force | Out-Null
    Copy-Item -Path ($svgFiles.FullName) -Destination $hostBackup

    Write-Host "[$($hostDir.Name)]" -ForegroundColor Yellow
    foreach ($file in $svgFiles) {
        $before = $file.Length
        $tmp = "$($file.FullName).tmp"
        Write-Host "  $($file.Name) ... " -NoNewline
        # Write to a temp file and replace only on success (original is kept on failure)
        $output = & node $shrinkJs $file.FullName $tmp $MaxZoom 2>&1
        if ($LASTEXITCODE -ne 0) {
            if (Test-Path $tmp) { Remove-Item $tmp -Force }
            Write-Host "FAILED (unchanged)" -ForegroundColor Red
            $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
            $failed++
            $results += [pscustomobject]@{ Host = $hostDir.Name; File = $file.Name; BeforeMB = [math]::Round($before / 1MB, 2); AfterMB = '-'; Result = 'failed' }
            continue
        }
        Move-Item -Path $tmp -Destination $file.FullName -Force
        $after = (Get-Item $file.FullName).Length
        Write-Host ("{0:N2}MB -> {1:N2}MB" -f ($before / 1MB), ($after / 1MB)) -ForegroundColor Green
        $results += [pscustomobject]@{ Host = $hostDir.Name; File = $file.Name; BeforeMB = [math]::Round($before / 1MB, 2); AfterMB = [math]::Round($after / 1MB, 2); Result = 'ok' }
    }
}

Write-Host ""
$results | Format-Table -AutoSize | Out-String | Write-Host

if ($failed -gt 0) {
    Write-Host "=== Done with $failed failure(s). Failed files were left unchanged. ===" -ForegroundColor Red
    exit 1
}
Write-Host "=== Done! Backup: $backupDir ===" -ForegroundColor Green
