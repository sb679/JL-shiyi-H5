$ErrorActionPreference = 'Stop'

Write-Host @'
===============================================================================
  ECS Auto Update Task (from Gitee)
  Check for updates every 5 minutes and auto deploy
===============================================================================
'@ -ForegroundColor Cyan

$TaskName = 'JL-Shiyi-H5-Auto-Update-Gitee'
$IntervalMinutes = 5
$InstallDir = 'C:\jl-shiyi-h5-gitee'
$UpdateScriptPath = Join-Path $InstallDir 'scripts\windows-ecs-update-gitee.ps1'

# Clean up old auto update tasks
Unregister-ScheduledTask -TaskName 'JL H5 Auto Update' -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'JL-Shiyi-H5-Auto-Update' -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Build the command that the scheduled task will run
$Command = "if (Test-Path '$UpdateScriptPath') { & '$UpdateScriptPath' } else { Write-Host 'Update script not found at $UpdateScriptPath' }"

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$Command`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  Auto update enabled! (Source: Gitee)" -ForegroundColor Green
Write-Host "  Task Name: $TaskName" -ForegroundColor Yellow
Write-Host "  Interval: Every $IntervalMinutes minutes" -ForegroundColor Yellow
Write-Host "  Update Script: $UpdateScriptPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Management Commands:" -ForegroundColor Cyan
Write-Host "    Status:  Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    Disable: Disable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    Enable:  Enable-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "    Delete:  Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green