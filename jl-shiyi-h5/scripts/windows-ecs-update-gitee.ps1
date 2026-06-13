$ErrorActionPreference = 'Stop'

Write-Host @'
===============================================================================
  ECS 日常更新脚本（从 Gitee 拉取）
  国内 ECS 从 Gitee 镜像获取最新代码，安装依赖、构建、同步 dist、重启服务
===============================================================================
'@ -ForegroundColor Cyan

$InstallDir = 'C:\jl-shiyi-h5-gitee'
$PublicMirrorDir = 'C:\wwwroot\JL-shiyi-H5'
$TaskName = 'JL拾遗 H5 Server'
$DesiredApiPort = '8080'
$PublicPagePort = '8080'

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
  Write-Section 'Restarting Node API task'
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "JL拾遗 H5 API $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -ErrorAction SilentlyContinue | Out-Null
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
  throw "Project directory not found: $InstallDir. Run scripts/windows-ecs-deploy-gitee.ps1 first."
}

Set-Location $InstallDir

if (-not (Test-Path '.env')) {
  throw "Missing $InstallDir\.env. Run scripts/windows-ecs-deploy-gitee.ps1 first."
}

$Port = Read-DotEnvValue '.env' 'PORT' $DesiredApiPort
if ($Port -ne $DesiredApiPort) {
  Write-Host "Updating .env PORT from $Port to $DesiredApiPort for the Node upload API." -ForegroundColor Yellow
  Set-DotEnvValue '.env' 'PORT' $DesiredApiPort
  $Port = $DesiredApiPort
}

# ====== 核心：从 Gitee 拉取最新代码 ======
Write-Section 'Checking latest code from Gitee'

# 确保 origin 指向 Gitee
$CurrentOrigin = git remote get-url origin
if ($CurrentOrigin -notmatch 'gitee\.com') {
  Write-Host "警告：当前 origin 不是 Gitee 地址，无法正常更新！" -ForegroundColor Red
  Write-Host "  当前 origin: $CurrentOrigin" -ForegroundColor Red
  Write-Host "  请运行 scripts/windows-ecs-deploy-gitee.ps1 重新部署。" -ForegroundColor Red
  exit 1
}

Write-Host "代码来源: $CurrentOrigin" -ForegroundColor Green

$CurrentCommit = git rev-parse HEAD
git fetch origin main

# 检查 fetch 是否成功
if ($LASTEXITCODE -ne 0) {
  Write-Host "git fetch 失败！" -ForegroundColor Red
  Write-Host "可能原因：" -ForegroundColor Yellow
  Write-Host "  1. ECS 无法访问 gitee.com" -ForegroundColor Yellow
  Write-Host "  2. 仓库不存在或已改名" -ForegroundColor Yellow
  Write-Host "  3. Gitee 用户名/密码变更" -ForegroundColor Yellow
  Write-Host "  4. 如果公共仓库设置了仓库可见性为私有，需要配置 Gitee 凭据" -ForegroundColor Yellow
  exit 1
}

$RemoteCommit = git rev-parse origin/main

if ($CurrentCommit -eq $RemoteCommit) {
  Write-Host 'Already up to date (Gitee). No rebuild needed.' -ForegroundColor Green
  if (Test-Path (Join-Path $InstallDir 'dist')) {
    Sync-PublicMirror $InstallDir $PublicMirrorDir
  }
  if (-not (Test-AppHealth $Port)) {
    Write-Host 'App health check failed. Restarting app on the configured public port.' -ForegroundColor Yellow
    Restart-App $Port $TaskName
  }
  Write-Host "`nUpdate finished (代码来源: Gitee)." -ForegroundColor Green
  Write-Host "Open page: http://<ECS_PUBLIC_IP>:$PublicPagePort/" -ForegroundColor Yellow
  exit 0
}

Write-Section 'Pulling latest code from Gitee'
git reset --hard origin/main

Write-Section 'Installing dependencies'
npm install

Write-Section 'Building app'
npm run build
Sync-PublicMirror $InstallDir $PublicMirrorDir

Restart-App $Port $TaskName
Write-Host "`nUpdate finished (代码来源: Gitee)." -ForegroundColor Green
Write-Host "Open page: http://<ECS_PUBLIC_IP>:$PublicPagePort/" -ForegroundColor Yellow