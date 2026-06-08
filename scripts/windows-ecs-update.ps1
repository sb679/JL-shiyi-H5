$ErrorActionPreference = 'Stop'

$InstallDir = 'C:\jl-shiyi-h5'
$TaskName = 'JL拾遗 H5 Server'

function Write-Section($Text) {
  Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

function Read-DotEnvValue($Path, $Name, $DefaultValue) {
  $Line = Get-Content $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $Line) { return $DefaultValue }
  return ($Line -replace "^$Name=", '').Trim()
}

if (-not (Test-Path $InstallDir)) {
  throw "Project directory not found: $InstallDir. Run scripts/windows-ecs-deploy.ps1 first."
}

Set-Location $InstallDir

if (-not (Test-Path '.env')) {
  throw "Missing $InstallDir\.env. Run scripts/windows-ecs-deploy.ps1 first, or create .env with server runtime variables."
}

$Port = Read-DotEnvValue '.env' 'PORT' '8080'

Write-Section 'Checking latest code'
$CurrentCommit = git rev-parse HEAD
git fetch origin main
$RemoteCommit = git rev-parse origin/main

if ($CurrentCommit -eq $RemoteCommit) {
  Write-Host 'Already up to date. No rebuild needed.' -ForegroundColor Green
  exit 0
}

$OldLockHash = if (Test-Path 'package-lock.json') { (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash } else { '' }

Write-Section 'Pulling latest code'
git reset --hard origin/main
$NewLockHash = if (Test-Path 'package-lock.json') { (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash } else { '' }

if ((-not (Test-Path 'node_modules')) -or $OldLockHash -ne $NewLockHash) {
  Write-Section 'Installing dependencies'
  npm ci
} else {
  Write-Section 'Dependencies unchanged'
}

Write-Section 'Building app'
npm run build

Write-Section 'Restarting server task'
Stop-Process -Name node -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

Write-Section 'Health check'
Invoke-RestMethod "http://127.0.0.1:$Port/api/health" | Out-Host
Write-Host "`nUpdate finished. Open: http://<ECS_PUBLIC_IP>:$Port/" -ForegroundColor Green
