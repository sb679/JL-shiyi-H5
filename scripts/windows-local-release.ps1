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

Write-Host "Committing and pushing to GitHub + Gitee..." -ForegroundColor Cyan
git add .
git commit -m $Message

Write-Host "  推送到 GitHub (origin)..." -ForegroundColor Yellow
git push origin main

Write-Host "  推送到 Gitee (gitee)..." -ForegroundColor Yellow
$GiteeExists = git remote | Where-Object { $_ -match '^gitee$' }
if ($GiteeExists) {
  git push gitee main
  Write-Host "Pushed to GitHub + Gitee." -ForegroundColor Green
} else {
  Write-Host "未找到 gitee remote，跳过 Gitee 推送。" -ForegroundColor Yellow
  Write-Host "运行 .\scripts\windows-gitee-mirror-setup.ps1 配置 Gitee 镜像。" -ForegroundColor Yellow
}

Write-Host "Published. GitHub Actions will run CI. ECS auto-update will pull from Gitee." -ForegroundColor Green
