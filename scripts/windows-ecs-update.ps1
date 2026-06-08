$ErrorActionPreference = 'Stop'

$InstallDir = 'C:\jl-shiyi-h5'
$PublicMirrorDir = 'C:\wwwroot\JL-shiyi-H5'
$TaskName = 'JL拾遗 H5 Server'
$DesiredPublicPort = '8080'

function Write-Section($Text) {
  Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

function Read-DotEnvValue($Path, $Name, $DefaultValue) {
  $Line = Get-Content $Path | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $Line) { return $DefaultValue }
  return ($Line -replace "^$Name=", '').Trim()
}

function Set-DotEnvValue($Path, $Name, $Value) {
  $Lines = if (Test-Path $Path) { @(Get-Content $Path) } else { @() }
  $Found = $false
  $NextLines = $Lines | ForEach-Object {
    if ($_ -match "^$Name=") {
      $Found = $true
      "$Name=$Value"
    } else {
      $_
    }
  }

  if (-not $Found) {
    $NextLines += "$Name=$Value"
  }

  Set-Content -Path $Path -Value $NextLines -Encoding UTF8
}

function Restart-App($Port, $TaskName) {
  Write-Section 'Restarting server task'
  Stop-Process -Name nginx -Force -ErrorAction SilentlyContinue
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 3

  Write-Section 'Health check'
  try {
    Invoke-RestMethod "http://127.0.0.1:$Port/api/health" | Out-Host
  } catch {
    Write-Host "Node health check failed. Static wwwroot mirror may still be updated." -ForegroundColor Yellow
  }
}

function Test-AppHealth($Port) {
  try {
    $Result = Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 5
    return $Result.ok -eq $true
  } catch {
    return $false
  }
}

function Sync-PublicMirror($InstallDir, $PublicMirrorDir) {
  if (-not (Test-Path $PublicMirrorDir)) {
    return
  }

  Write-Section 'Syncing public wwwroot mirror'
  $SourceDist = Join-Path $InstallDir 'dist'
  $TargetDist = Join-Path $PublicMirrorDir 'dist'

  if (-not (Test-Path $SourceDist)) {
    throw "Build output not found: $SourceDist"
  }

  if (Test-Path $TargetDist) {
    Remove-Item $TargetDist -Recurse -Force
  }

  New-Item -ItemType Directory -Path $TargetDist -Force | Out-Null
  Copy-Item (Join-Path $SourceDist '*') $TargetDist -Recurse -Force
  Copy-Item (Join-Path $SourceDist 'index.html') (Join-Path $PublicMirrorDir 'index.html') -Force
  if (Test-Path (Join-Path $PublicMirrorDir 'assets')) {
    Remove-Item (Join-Path $PublicMirrorDir 'assets') -Recurse -Force
  }
  if (Test-Path (Join-Path $SourceDist 'assets')) {
    Copy-Item (Join-Path $SourceDist 'assets') (Join-Path $PublicMirrorDir 'assets') -Recurse -Force
  }
  Write-Host "Public mirror updated: $TargetDist" -ForegroundColor Green
}

if (-not (Test-Path $InstallDir)) {
  throw "Project directory not found: $InstallDir. Run scripts/windows-ecs-deploy.ps1 first."
}

Set-Location $InstallDir

if (-not (Test-Path '.env')) {
  throw "Missing $InstallDir\.env. Run scripts/windows-ecs-deploy.ps1 first, or create .env with server runtime variables."
}

$Port = Read-DotEnvValue '.env' 'PORT' $DesiredPublicPort
if ($Port -ne $DesiredPublicPort) {
  Write-Host "Updating .env PORT from $Port to $DesiredPublicPort for the public ECS site." -ForegroundColor Yellow
  Set-DotEnvValue '.env' 'PORT' $DesiredPublicPort
  $Port = $DesiredPublicPort
}

Write-Section 'Checking latest code'
$CurrentCommit = git rev-parse HEAD
git fetch origin main
$RemoteCommit = git rev-parse origin/main

if ($CurrentCommit -eq $RemoteCommit) {
  Write-Host 'Already up to date. No rebuild needed.' -ForegroundColor Green
  if (Test-Path (Join-Path $InstallDir 'dist')) {
    Sync-PublicMirror $InstallDir $PublicMirrorDir
  }
  if (-not (Test-AppHealth $Port)) {
    Write-Host 'App health check failed. Restarting app on the configured public port.' -ForegroundColor Yellow
    Restart-App $Port $TaskName
  }
  Write-Host "`nUpdate finished. Open: http://<ECS_PUBLIC_IP>:$Port/" -ForegroundColor Green
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
Sync-PublicMirror $InstallDir $PublicMirrorDir

Restart-App $Port $TaskName
Write-Host "`nUpdate finished. Open: http://<ECS_PUBLIC_IP>:$Port/" -ForegroundColor Green
