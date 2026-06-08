$ErrorActionPreference = 'Stop'

$TaskName = 'JL-Shiyi-H5-Auto-Update'
$IntervalMinutes = 5
$UpdateScriptUrl = 'https://raw.githubusercontent.com/sb679/JL-shiyi-H5/main/scripts/windows-ecs-update.ps1'
$LocalScriptPath = '$env:TEMP\jl-shiyi-update.ps1'

$Command = "iwr $UpdateScriptUrl -OutFile $LocalScriptPath; & $LocalScriptPath"

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$Command`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Write-Host "Auto update enabled. The server will check GitHub every $IntervalMinutes minutes." -ForegroundColor Green
Write-Host "Task name: $TaskName"
