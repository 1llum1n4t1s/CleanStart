# Clean Start extension packaging script
# Usage: powershell -ExecutionPolicy Bypass -File zip.ps1


# 検証済みの作業対象だけを標準APIで削除する。
function Remove-LocalWorkItem {
    param([string[]]$LiteralPath, [string]$AllowedRoot, [switch]$IgnoreMissing, [switch]$AllowLeafJunction)
    if ([string]::IsNullOrWhiteSpace($AllowedRoot) -or -not [IO.Path]::IsPathRooted($AllowedRoot)) { throw 'Cleanup root must be absolute.' }
    $boundary = [IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    foreach ($target in $LiteralPath) {
        if ([string]::IsNullOrWhiteSpace($target) -or -not [IO.Path]::IsPathRooted($target)) { throw 'Cleanup target must be absolute.' }
        $resolved = [IO.Path]::GetFullPath($target)
        if (-not $resolved.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup target is outside the allowed root.' }
        $ancestor = $resolved
        while ($ancestor) {
            if (Test-Path -LiteralPath $ancestor) {
                $item = Get-Item -LiteralPath $ancestor -Force -ErrorAction Stop
                if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and -not ($AllowLeafJunction -and $ancestor -eq $resolved -and $item.LinkType -eq 'Junction')) { throw 'Cleanup path contains a reparse point.' }
            }
            $ancestor = Split-Path $ancestor -Parent
        }
        if (-not (Test-Path -LiteralPath $resolved)) { if ($IgnoreMissing) { continue }; throw "Cleanup target is missing: $resolved" }
        $item = Get-Item -LiteralPath $resolved -Force -ErrorAction Stop
        $leafLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
        if ($item.PSIsContainer -and -not $leafLink) {
            if (@(Get-ChildItem -LiteralPath $resolved -Recurse -Force -ErrorAction Stop | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Cleanup directory contains a reparse point.' }
        }
        Remove-Item -LiteralPath $resolved -Recurse:($item.PSIsContainer -and -not $leafLink) -Force -ErrorAction Stop
        if (Test-Path -LiteralPath $resolved) { throw "Cleanup target remains: $resolved" }
    }
}

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath -and $PSCommandPath) {
  $scriptPath = $PSCommandPath
}
if (-not $scriptPath) {
  $scriptPath = (Get-Location).Path
}

$scriptDir = Split-Path -Parent $scriptPath
if ($scriptDir) { Set-Location $scriptDir }

Write-Host "Packaging Clean Start..." -ForegroundColor Cyan

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "pnpm install --frozen-lockfile failed." }

node scripts/generate-icons.js
if ($LASTEXITCODE -ne 0) { throw "Icon generation failed." }

$zipName = "clean-start.zip"
$tempDir = "temp-build"

if (Test-Path $zipName) {
   Remove-LocalWorkItem -LiteralPath ($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($zipName)) -AllowedRoot $PSScriptRoot
}

if (Test-Path $tempDir) {
   Remove-LocalWorkItem -LiteralPath ($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($tempDir)) -AllowedRoot $PSScriptRoot
}

New-Item -ItemType Directory -Path $tempDir | Out-Null

node -e "const m=require('./manifest.json');delete m.key;require('fs').writeFileSync('temp-build/manifest.json',JSON.stringify(m,null,2))"
if ($LASTEXITCODE -ne 0) { throw "Manifest preparation failed." }
Copy-Item "popup.html" -Destination $tempDir
Copy-Item "_locales" -Destination $tempDir -Recurse
Copy-Item "icons" -Destination $tempDir -Recurse
Copy-Item "src" -Destination $tempDir -Recurse

Compress-Archive -Path "$tempDir/*" -DestinationPath $zipName -Force
 Remove-LocalWorkItem -LiteralPath ($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($tempDir)) -AllowedRoot $PSScriptRoot

Write-Host "Created $zipName" -ForegroundColor Green
