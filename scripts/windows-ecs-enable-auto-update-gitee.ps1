$ErrorActionPreference = 'Stop'

Write-Host @'
===============================================================================
  ECS 自动更新计划任务（从 Gitee 拉取）
  每 5 分钟从 Gitee 检查更新并自动部署
===============================================================================
'@ -ForegroundColor Cyan

$TaskName = 'JL-Shiyi-H5-Auto-Update-Gitee'
$IntervalMinutes = 5
$LocalScriptPath = 'C:\Windows\Temp\jl-shiyi-update-gitee.ps1'

# 首先检查 ECS 上是否有 Gitee 的更新脚本
$UpdateScriptSource = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\windows-ecs-update-gitee.ps1'

if (-not (Test-Path $UpdateScriptSource)) {
  Write-Host "警告：未找到 $UpdateScriptSource" -ForegroundColor Yellow
  Write-Host "  自动更新将在本地脚本就绪后自动生效。" -ForegroundColor Yellow
}

# 先清理旧的 GitHub 版自动更新任务
Unregister-ScheduledTask -TaskName 'JL拾遗 H5 Auto Update' -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'JL-Shiyi-H5-Auto-Update' -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 任务调用 ECS 本地的 Gitee 更新脚本
$Command = "if (Test-Path '$UpdateScriptSource') { & '$UpdateScriptSource' } else { Write-Host 'Update script not found, waiting for deploy.' }"

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$Command`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "  自动更新已启用！（代码来源：Gitee）" -ForegroundColor Green
Write-Host "  任务名称: $TaskName" -ForegroundColor Yellow
Write-Host "  检查频率: 每 $IntervalMinutes 分钟" -ForegroundColor Yellow
Write-Host "  更新脚本: $UpdateScriptSource" -ForegroundColor Yellow
Write-Host ""
Write-Host "  管理命令:" -ForegroundColor Cyan
Write-Host "    查看状态: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    禁用:     Disable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    启用:     Enable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    删除:     Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green