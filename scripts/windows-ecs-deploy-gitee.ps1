[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '')]
param()

$ErrorActionPreference = 'Stop'

Write-Host @'
===============================================================================
  ECS 一键部署脚本（从 Gitee 拉取）
  用于国内 ECS 通过 Gitee 镜像获取代码，避开 GitHub 网络问题
===============================================================================
'@ -ForegroundColor Cyan

# ====== 配置区：修改这里指向你的 Gitee 仓库 ======
$GiteeUser = Read-Host '请输入你的 Gitee 用户名'
if ([string]::IsNullOrWhiteSpace($GiteeUser)) {
  throw 'Gitee 用户名不能为空。'
}
$RepoUrl = "https://gitee.com/$GiteeUser/JL-shiyi-H5.git"

$InstallDir = 'C:\jl-shiyi-h5'
$PublicMirrorDir = 'C:\wwwroot\JL-shiyi-H5'
$TaskName = 'JL拾遗 H5 Server'

function EnsureCommandAvailable($Name, $InstallHint) {
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

function Read-RequiredSecret($Prompt) {
  do {
    $SecureValue = Read-Host $Prompt -AsSecureString
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
      $Value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
    }
  } while ([string]::IsNullOrWhiteSpace($Value))
  return $Value.Trim()
}

function Write-Section($Text) {
  Write-Host "`n== $Text ==" -ForegroundColor Cyan
}

function Sync-PublicMirror($InstallDir, $PublicMirrorDir) {
  if (-not (Test-Path $PublicMirrorDir)) {
    return
  }

  Write-Section 'Syncing public wwwroot mirror'
  $SourceDist = Join-Path $InstallDir 'dist'
  $TargetDist = Join-Path $PublicMirrorDir 'dist'

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

Write-Section 'Checking tools'
EnsureCommandAvailable git 'Install Git for Windows first: https://git-scm.com/download/win'
EnsureCommandAvailable node 'Install Node.js 20 LTS first: https://nodejs.org/'
EnsureCommandAvailable npm 'Install Node.js 20 LTS first: https://nodejs.org/'

Write-Section 'Testing Gitee access'
try {
  $GiteeTest = Invoke-WebRequest "https://gitee.com/$GiteeUser/JL-shiyi-H5" -TimeoutSec 10 -UseBasicParsing
  Write-Host "Gitee 仓库可访问: https://gitee.com/$GiteeUser/JL-shiyi-H5" -ForegroundColor Green
} catch {
  Write-Host "警告：无法访问 Gitee 仓库页面（这不一定影响 git clone/fetch）" -ForegroundColor Yellow
  Write-Host "如果 clone 也失败，请检查 ECS 网络是否能访问 gitee.com" -ForegroundColor Yellow
}

Write-Section 'Preparing project directory'
if (Test-Path $InstallDir) {
  Write-Host "项目目录已存在，尝试更新..." -ForegroundColor Yellow
  Set-Location $InstallDir

  # 检查当前 remote 是否指向 Gitee
  $CurrentOrigin = git remote get-url origin
  if ($CurrentOrigin -notmatch 'gitee\.com') {
    Write-Host "当前 origin 指向: $CurrentOrigin" -ForegroundColor Yellow
    Write-Host "正在切换为 Gitee..." -ForegroundColor Yellow
    git remote set-url origin $RepoUrl
  }

  git fetch origin main
  git reset --hard origin/main
} else {
  Write-Host "克隆项目从 Gitee..." -ForegroundColor Yellow
  git clone $RepoUrl $InstallDir
  Set-Location $InstallDir
}

Write-Section 'Writing local environment file'
$OssRegion = Read-Required 'OSS_REGION, for example oss-cn-hangzhou'
$OssBucket = Read-Required 'OSS_BUCKET'
$OssAccessKeyId = Read-Required 'OSS_ACCESS_KEY_ID'
$OssAccessKeySecret = Read-RequiredSecret 'OSS_ACCESS_KEY_SECRET'
$OssPublicBaseUrl = Read-Host 'OSS_PUBLIC_BASE_URL, press Enter to auto-generate'
if ([string]::IsNullOrWhiteSpace($OssPublicBaseUrl)) {
  $OssPublicBaseUrl = "https://$OssBucket.$OssRegion.aliyuncs.com"
}
$Port = Read-Host 'Node/API/Web PORT, press Enter to use 8080'
if ([string]::IsNullOrWhiteSpace($Port)) {
  $Port = '8080'
}
$MysqlHost = Read-Host 'MYSQL_HOST / RDS endpoint, press Enter to use rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com'
if ([string]::IsNullOrWhiteSpace($MysqlHost)) {
  $MysqlHost = 'rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com'
}
$MysqlPort = Read-Host 'MYSQL_PORT, press Enter to use 3306'
if ([string]::IsNullOrWhiteSpace($MysqlPort)) {
  $MysqlPort = '3306'
}
$MysqlDatabase = Read-Host 'MYSQL_DATABASE, press Enter to use jl_shiyi_app'
if ([string]::IsNullOrWhiteSpace($MysqlDatabase)) {
  $MysqlDatabase = 'jl_shiyi_app'
}
$MysqlUser = Read-Host 'MYSQL_USER, press Enter to use jl_shiyi_app'
if ([string]::IsNullOrWhiteSpace($MysqlUser)) {
  $MysqlUser = 'jl_shiyi_app'
}
$MysqlPassword = Read-RequiredSecret 'MYSQL_PASSWORD / RDS password'

$EnvContent = @"
PORT=$Port
OSS_REGION=$OssRegion
OSS_BUCKET=$OssBucket
OSS_ACCESS_KEY_ID=$OssAccessKeyId
OSS_ACCESS_KEY_SECRET=$OssAccessKeySecret
OSS_PUBLIC_BASE_URL=$OssPublicBaseUrl
UPLOAD_MAX_FILE_SIZE=8388608
UPLOAD_MAX_FILES=30
MYSQL_HOST=$MysqlHost
MYSQL_PORT=$MysqlPort
MYSQL_DATABASE=$MysqlDatabase
MYSQL_USER=$MysqlUser
MYSQL_PASSWORD=$MysqlPassword
"@
Set-Content -Path (Join-Path $InstallDir '.env') -Value $EnvContent -Encoding UTF8

Write-Section 'Installing dependencies and building app'
npm ci
npm run build
Sync-PublicMirror $InstallDir $PublicMirrorDir

Write-Section 'Configuring firewall'
New-NetFirewallRule -DisplayName "JL拾遗 H5 API $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Section 'Registering startup task'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\scripts\start-server.ps1`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Write-Section 'Starting server now'
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

try {
  Invoke-RestMethod "http://127.0.0.1:$Port/api/health" | Out-Host
  Write-Host "`n===============================================================================" -ForegroundColor Green
  Write-Host "  部署完成！(代码来源：Gitee)" -ForegroundColor Green
  Write-Host "  访问地址: http://<ECS_PUBLIC_IP>:$Port/" -ForegroundColor Yellow
  Write-Host "  上传 API: http://<ECS_PUBLIC_IP>:$Port/api/uploads/images" -ForegroundColor Yellow
  Write-Host "  Gitee 仓库: $RepoUrl" -ForegroundColor Yellow
  Write-Host "===============================================================================" -ForegroundColor Green
} catch {
  Write-Host "Server task was created, but health check failed. Check Task Scheduler and logs." -ForegroundColor Yellow
  throw
}