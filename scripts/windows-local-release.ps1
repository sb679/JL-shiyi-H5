$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$Message = if ($args.Count -gt 0) { $args -join ' ' } else { Read-Host 'Commit message' }
if ([string]::IsNullOrWhiteSpace($Message)) {
  throw 'Commit message is required.'
}

Write-Host "Checking working tree..." -ForegroundColor Cyan
git status --short

Write-Host "Running local verification..." -ForegroundColor Cyan
npm run build
npm run lint

Write-Host "Committing and pushing to GitHub..." -ForegroundColor Cyan
git add .
git commit -m $Message
git push origin main

Write-Host "Published to GitHub. GitHub Actions will run CI, and ECS auto-update will pull the new code if its scheduled task is enabled." -ForegroundColor Green
