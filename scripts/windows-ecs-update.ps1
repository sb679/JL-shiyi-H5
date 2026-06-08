$ErrorActionPreference = 'Stop'

$InstallDir = 'C:\jl-shiyi-h5'
$TaskName = 'JL拾遗 H5 Server'

function Write-Section($Text) {
  Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

if (-not (Test-Path $InstallDir)) {
  throw "Project directory not found: $InstallDir. Run scripts/windows-ecs-deploy.ps1 first."
}

Set-Location $InstallDir

if (-not (Test-Path '.env')) {
  throw "Missing $InstallDir\.env. Run scripts/windows-ecs-deploy.ps1 first, or create .env with server runtime variables."
}

Write-Section 'Pulling latest code'
git fetch origin main
git reset --hard origin/main

Write-Section 'Installing dependencies and building app'
npm ci
npm run build

Write-Section 'Restarting server task'
Stop-Process -Name node -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

Write-Section 'Health check'
Invoke-RestMethod 'http://127.0.0.1:3000/api/health' | Out-Host
Write-Host "`nUpdate finished." -ForegroundColor Green
