@echo off
chcp 65001 >nul 2>&1
title JL拾遗 H5 - 一键更新
color 0A

echo ===============================================================================
echo   JL拾遗 H5 - 一键更新脚本
echo   双击此文件即可从 Gitee 拉取最新代码、构建并重启服务
echo ===============================================================================
echo.

cd /d C:\jl-shiyi-h5-gitee

if not exist "C:\jl-shiyi-h5-gitee" (
    echo [错误] 项目目录 C:\jl-shiyi-h5-gitee 不存在！
    echo 请先运行部署脚本。
    pause
    exit /b 1
)

echo [1/5] 检查 Gitee 连接...
git remote get-url origin
if errorlevel 1 (
    echo [错误] 无法获取 Git 远程地址
    pause
    exit /b 1
)

echo.
echo [2/5] 从 Gitee 拉取最新代码...
git fetch origin main
if errorlevel 1 (
    echo [错误] git fetch 失败，请检查网络连接
    pause
    exit /b 1
)

echo.
echo [3/5] 更新本地代码...
git reset --hard origin/main

echo.
echo [4/5] 构建项目...
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [5/5] 重启服务...
taskkill /f /im node.exe >nul 2>&1
schtasks /run /tn "JL拾遗 H5 Server"
if errorlevel 1 (
    echo [警告] 计划任务启动失败，尝试直接启动...
    start /b node server/index.js
)

echo.
echo ===============================================================================
echo   更新完成！
echo   等待 3 秒后检查服务状态...
echo ===============================================================================
timeout /t 3 /nobreak >nul

curl -s http://127.0.0.1:8080/api/health
echo.
echo.
echo 按任意键关闭此窗口...
pause >nul