$ErrorActionPreference = 'Stop'

Write-Host @'
===============================================================================
  Gitee 镜像仓库配置脚本（本地执行）
  作用：为本地仓库添加 Gitee remote，实现双推送（GitHub + Gitee）
===============================================================================
'@ -ForegroundColor Cyan

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

Write-Host "`n== Step 1: 创建 Gitee 仓库 ==" -ForegroundColor Cyan
Write-Host "请先在浏览器中完成以下步骤："
Write-Host "  1. 打开 https://gitee.com/ 并登录"
Write-Host "  2. 点击右上角 + 号 → 新建仓库"
Write-Host "  3. 仓库名称填：JL-shiyi-H5"
Write-Host "  4. 仓库介绍：JL拾遗 - 校园二手书 H5 应用"
Write-Host "  5. 选择「私有」或「公开」（建议私有）"
Write-Host "  6. 不要勾选「使用 Readme 文件初始化仓库」"
Write-Host "  7. 不要勾选任何 Issue/PR 模板"
Write-Host "  8. 点击「创建」"
Write-Host "  9. 记录你的 Gitee 用户名（例如：sb679）`n" -ForegroundColor Yellow

$GiteeUser = Read-Host '请输入你的 Gitee 用户名'
if ([string]::IsNullOrWhiteSpace($GiteeUser)) {
  throw 'Gitee 用户名不能为空。'
}

$GiteeRepoUrl = "https://gitee.com/$GiteeUser/JL-shiyi-H5.git"

Write-Host "`n== Step 2: 检查已有 remote ==" -ForegroundColor Cyan
$ExistingRemotes = git remote -v
Write-Host $ExistingRemotes

$GiteeExists = $ExistingRemotes | Where-Object { $_ -match '^gitee\s' }
if ($GiteeExists) {
  Write-Host "`n已存在 gitee remote，正在更新 URL..." -ForegroundColor Yellow
  git remote set-url gitee $GiteeRepoUrl
} else {
  Write-Host "`n正在添加 gitee remote..." -ForegroundColor Yellow
  git remote add gitee $GiteeRepoUrl
}

Write-Host "`n== Step 3: 验证 remote 配置 ==" -ForegroundColor Cyan
git remote -v

Write-Host "`n== Step 4: 推送到 Gitee ==" -ForegroundColor Cyan
git push -u gitee main

Write-Host "`n== Step 5: 验证 Gitee 仓库 ==" -ForegroundColor Cyan
Write-Host "请打开浏览器验证：https://gitee.com/$GiteeUser/JL-shiyi-H5"
Start-Process "https://gitee.com/$GiteeUser/JL-shiyi-H5" -ErrorAction SilentlyContinue
$Confirmed = Read-Host '确认 Gitee 仓库已创建且代码已推送？(y/n)'
if ($Confirmed -ne 'y' -and $Confirmed -ne 'Y') {
  throw '请确认 Gitee 仓库后再运行此脚本。'
}

Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "  Gitee 镜像配置完成！" -ForegroundColor Green
Write-Host "  本地仓库现在有两个 remote：" -ForegroundColor Green
Write-Host "    origin -> $RepoUrl (GitHub)" -ForegroundColor Green
Write-Host "    gitee  -> $GiteeRepoUrl (Gitee)" -ForegroundColor Green
Write-Host ""
Write-Host "  下次发布代码时，使用:" -ForegroundColor Yellow
Write-Host "    powershell -ExecutionPolicy Bypass -File `".\scripts\windows-local-release.ps1`" `"提交说明`"" -ForegroundColor White
Write-Host "  它会自动同时推送到 GitHub 和 Gitee。" -ForegroundColor Green
Write-Host ""
Write-Host "  ECS 端配置：将此信息传给 ECS：" -ForegroundColor Yellow
Write-Host "    Gitee 仓库地址: $GiteeRepoUrl" -ForegroundColor White
Write-Host "    确保 gitee.com 可访问（国内 ECS 通常可以）" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green