@echo off
chcp 65001 >nul 2>&1
title JL Shiyi H5 - One Click Update
color 0A

echo ===============================================================================
echo   JL Shiyi H5 - One Click Update
echo   Pull latest code from Gitee, build and restart service
echo ===============================================================================
echo.

cd /d C:\jl-shiyi-h5-gitee

if not exist "C:\jl-shiyi-h5-gitee" (
    echo [ERROR] Project directory C:\jl-shiyi-h5-gitee not found!
    echo Please run deploy script first.
    pause
    exit /b 1
)

echo [1/5] Checking Gitee connection...
git remote get-url origin
if errorlevel 1 (
    echo [ERROR] Cannot get Git remote URL
    pause
    exit /b 1
)

echo.
echo [2/5] Fetching latest code from Gitee...
git fetch origin main
if errorlevel 1 (
    echo [ERROR] git fetch failed, please check network
    pause
    exit /b 1
)

echo.
echo [3/5] Updating local code...
git reset --hard origin/main

echo.
echo [4/5] Building project...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo [5/5] Restarting service...
taskkill /f /im node.exe >nul 2>&1
schtasks /run /tn "JL拾遗 H5 Server"
if errorlevel 1 (
    echo [WARN] Scheduled task failed, starting directly...
    start /b node server/index.js
)

echo.
echo ===============================================================================
echo   Update complete! Checking service health in 3 seconds...
echo ===============================================================================
timeout /t 3 /nobreak >nul

curl -s http://127.0.0.1:8080/api/health
echo.
echo.
echo Press any key to close...
pause >nul