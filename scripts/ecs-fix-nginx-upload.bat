@echo off
chcp 65001 >nul 2>&1
title JL Shiyi H5 - Fix Nginx Upload Limit
color 0A

echo ===============================================================================
echo   JL Shiyi H5 - Fix Nginx "request entity too large" error
echo   Increase Nginx client_max_body_size from default 1MB to 50MB
echo ===============================================================================
echo.

:: Check admin privileges
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Please right-click this script and select "Run as administrator"!
    echo.
    pause
    exit /b 1
)

echo [1/3] Searching for Nginx config file...

:: Common Nginx config paths
set NGINX_CONF=
if exist "C:\nginx\conf\nginx.conf" set NGINX_CONF=C:\nginx\conf\nginx.conf
if exist "C:\Program Files\nginx\conf\nginx.conf" set NGINX_CONF=C:\Program Files\nginx\conf\nginx.conf
if exist "C:\nginx-1.24.0\conf\nginx.conf" set NGINX_CONF=C:\nginx-1.24.0\conf\nginx.conf
if exist "C:\nginx-1.26.0\conf\nginx.conf" set NGINX_CONF=C:\nginx-1.26.0\conf\nginx.conf

:: Try where command if not found
if "%NGINX_CONF%"=="" (
    for /f "delims=" %%i in ('where nginx 2^>nul') do (
        set NGINX_DIR=%%~dpi
    )
    if defined NGINX_DIR (
        set NGINX_CONF=%NGINX_DIR%..\conf\nginx.conf
    )
)

if "%NGINX_CONF%"=="" (
    echo [ERROR] Nginx config file not found!
    echo.
    echo Please manually edit Nginx config:
    echo/  1. Find nginx.conf file
    echo/  2. Add inside http block: client_max_body_size 50m;
    echo/  3. Reload Nginx: nginx -s reload
    echo.
    pause
    exit /b 1
)

echo Found config: %NGINX_CONF%
echo.

echo [2/3] Checking client_max_body_size setting...
findstr /i "client_max_body_size" "%NGINX_CONF%" >nul 2>&1
if errorlevel 1 (
    echo Not found, adding client_max_body_size...
    
    :: Backup original config
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    
    :: Add client_max_body_size after http {
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace '(http\s*\{)', \"`$1`r`n    client_max_body_size 50m;\"; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    
    echo Added client_max_body_size 50m;
) else (
    echo Found existing setting, updating to 50m...
    
    :: Backup original config
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    
    :: Replace existing client_max_body_size
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace 'client_max_body_size\s+[^;]+;', 'client_max_body_size 50m;'; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    
    echo Updated client_max_body_size to 50m;
)

echo.
echo [3/3] Reloading Nginx config...

:: Find nginx.exe
set NGINX_EXE=
if exist "C:\nginx\nginx.exe" set NGINX_EXE=C:\nginx\nginx.exe
if exist "C:\Program Files\nginx\nginx.exe" set NGINX_EXE=C:\Program Files\nginx\nginx.exe
if exist "C:\nginx-1.24.0\nginx.exe" set NGINX_EXE=C:\nginx-1.24.0\nginx.exe
if exist "C:\nginx-1.26.0\nginx.exe" set NGINX_EXE=C:\nginx-1.26.0\nginx.exe

if "%NGINX_EXE%"=="" (
    for /f "delims=" %%i in ('where nginx 2^>nul') do set NGINX_EXE=%%i
)

if "%NGINX_EXE%"=="" (
    echo [WARN] nginx.exe not found, please restart Nginx manually
) else (
    "%NGINX_EXE%" -s reload
    echo Nginx reloaded successfully
)

echo.
echo ===============================================================================
echo   Fix complete!
echo.
echo   You can now upload files up to 50MB.
echo   If still getting errors, please check:
echo/    1. Nginx restarted successfully
echo/    2. No other reverse proxy (like IIS) has limits
echo ===============================================================================
echo.
pause