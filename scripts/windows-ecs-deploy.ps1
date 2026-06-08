$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/sb679/JL-shiyi-H5.git'
$InstallDir = 'C:\jl-shiyi-h5'
$TaskName = 'JL拾遗 H5 Server'

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed. $InstallHint"
  }
}

function Read-Required($Prompt) {
  do {
    $Value = Read-Host $Prompt
  } while ([string]::IsNullOrWhiteSpace($Value))
  return $Value.Trim()
}

function Write-Section($Text) {
  Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

Write-Section 'Checking tools'
Require-Command git 'Install Git for Windows first: https://git-scm.com/download/win'
Require-Command node 'Install Node.js 20 LTS first: https://nodejs.org/'
Require-Command npm 'Install Node.js 20 LTS first: https://nodejs.org/'

Write-Section 'Preparing project directory'
if (Test-Path $InstallDir) {
  Set-Location $InstallDir
  git fetch origin main
  git reset --hard origin/main
} else {
  git clone $RepoUrl $InstallDir
  Set-Location $InstallDir
}

Write-Section 'Writing local environment file'
$OssRegion = Read-Required 'OSS_REGION, for example oss-cn-hangzhou'
$OssBucket = Read-Required 'OSS_BUCKET'
$OssAccessKeyId = Read-Required 'OSS_ACCESS_KEY_ID'
$OssAccessKeySecret = Read-Required 'OSS_ACCESS_KEY_SECRET'
$OssPublicBaseUrl = Read-Host 'OSS_PUBLIC_BASE_URL, press Enter to auto-generate'
if ([string]::IsNullOrWhiteSpace($OssPublicBaseUrl)) {
  $OssPublicBaseUrl = "https://$OssBucket.$OssRegion.aliyuncs.com"
}
$Port = Read-Host 'PORT, press Enter to use 8080'
if ([string]::IsNullOrWhiteSpace($Port)) {
  $Port = '8080'
}

$EnvContent = @"
PORT=$Port
OSS_REGION=$OssRegion
OSS_BUCKET=$OssBucket
OSS_ACCESS_KEY_ID=$OssAccessKeyId
OSS_ACCESS_KEY_SECRET=$OssAccessKeySecret
OSS_PUBLIC_BASE_URL=$OssPublicBaseUrl
UPLOAD_MAX_FILE_SIZE=8388608
UPLOAD_MAX_FILES=30
"@
Set-Content -Path (Join-Path $InstallDir '.env') -Value $EnvContent -Encoding UTF8

Write-Section 'Installing dependencies and building app'
npm ci
npm run build

Write-Section 'Configuring firewall'
New-NetFirewallRule -DisplayName "JL拾遗 H5 $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Section 'Registering startup task'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\scripts\start-server.ps1`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Write-Section 'Starting server now'
Stop-Process -Name node -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

try {
  Invoke-RestMethod "http://127.0.0.1:$Port/api/health" | Out-Host
  Write-Host "`nDeployment finished. Open: http://<ECS_PUBLIC_IP>:$Port/" -ForegroundColor Green
} catch {
  Write-Host "Server task was created, but health check failed. Check Task Scheduler and logs." -ForegroundColor Yellow
  throw
}
