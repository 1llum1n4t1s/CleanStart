# Clean Start extension packaging script
# Usage: powershell -ExecutionPolicy Bypass -File zip.ps1

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

npm install --silent
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

node scripts/generate-icons.js
if ($LASTEXITCODE -ne 0) { throw "Icon generation failed." }

$zipName = "clean-start.zip"
$tempDir = "temp-build"

if (Test-Path $zipName) {
  Remove-Item $zipName -Force
}

if (Test-Path $tempDir) {
  Remove-Item $tempDir -Recurse -Force
}

New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item "manifest.json" -Destination $tempDir
Copy-Item "popup.html" -Destination $tempDir
Copy-Item "options.html" -Destination $tempDir
Copy-Item "_locales" -Destination $tempDir -Recurse
Copy-Item "fonts" -Destination $tempDir -Recurse
Copy-Item "icons" -Destination $tempDir -Recurse
Copy-Item "src" -Destination $tempDir -Recurse

Compress-Archive -Path "$tempDir/*" -DestinationPath $zipName -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "Created $zipName" -ForegroundColor Green
