@echo off
chcp 65001 >nul 2>&1
title JL Shiyi H5 - Fix Upload Limit (Nginx / IIS / multer)
color 0A

echo ===============================================================================
echo   JL Shiyi H5 - Fix "request entity too large" upload limit
echo   50MB (Nginx client_max_body_size / IIS maxAllowedContentLength / multer)
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

REM ============================================================
REM Step 1: Try Nginx fix
REM ============================================================
echo [1/4] Searching for Nginx config file...

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
    echo [INFO]  Nginx not installed on this server. Skipping Nginx step.
    echo.
    goto :fix_iis
)

echo Found Nginx config: %NGINX_CONF%
echo.

echo [2/4] Checking Nginx client_max_body_size setting...
findstr /i "client_max_body_size" "%NGINX_CONF%" >nul 2>&1
if errorlevel 1 (
    echo Not found, adding client_max_body_size 50m...
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace '(http\s*\{)', \"`$1`r`n    client_max_body_size 50m;\"; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    echo Added client_max_body_size 50m;
) else (
    echo Found existing setting, updating to 50m...
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace 'client_max_body_size\s+[^;]+;', 'client_max_body_size 50m;'; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    echo Updated client_max_body_size to 50m;
)

echo.
echo [3/4] Reloading Nginx config...

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
    echo [WARN]  nginx.exe not found, restart Nginx manually: nginx -s reload
) else (
    "%NGINX_EXE%" -s reload
    echo Nginx reloaded successfully.
)

echo.
echo ===============================================================================
echo   Nginx step complete.
echo ===============================================================================
echo.

REM ============================================================
REM Step 2: IIS fix (if IIS is installed)
REM ============================================================
:fix_iis
set IIS_APPCMD=C:\Windows\System32\inetsrv\appcmd.exe
if not exist "%IIS_APPCMD%" (
    echo [INFO]  IIS is not installed on this server. Skipping IIS step.
    goto :fix_multer
)

echo [*]  IIS detected. Checking request limits...

REM Try to read current requestFiltering config
"%IIS_APPCMD%" list config /section:requestFiltering >nul 2>&1
if errorlevel 1 (
    echo [INFO]  Cannot read IIS config. Run script as Administrator.
    echo.
    echo Manual steps to increase IIS upload limit to 50MB:
    echo   1. Open IIS Manager (inetmgr)
    echo   2. Click the server node, then choose "Request Filtering"
    echo   3. Click "Edit Feature Settings..." in the right panel
    echo   4. Set "Maximum allowed content length" to 52428800
    echo   5. Restart the website / app pool
    echo.
    goto :fix_multer
)

echo Setting IIS maxAllowedContentLength to 50MB (52428800 bytes)...
"%IIS_APPCMD%" set config /section:requestFiltering /requestLimits.maxAllowedContentLength:52428800
if errorlevel 1 (
    echo [WARN]  Failed to set maxAllowedContentLength. Run script as Administrator.
) else (
    echo IIS maxAllowedContentLength set to 52428800.
)

echo Setting IIS uploadReadAheadSize to 50MB (52428800 bytes)...
"%IIS_APPCMD%" set config /section:system.webServer/serverRuntime /uploadReadAheadSize:52428800
if errorlevel 1 (
    echo [WARN]  Failed to set uploadReadAheadSize. Run script as Administrator.
) else (
    echo IIS uploadReadAheadSize set to 52428800.
)

echo.
echo ===============================================================================
echo   IIS step complete.
echo ===============================================================================
echo.

REM ============================================================
REM Step 3: multer (Node.js) upload size fix
REM ============================================================
:fix_multer
set ENV_FILE=
if exist "C:\jl-shiyi-h5\.env" set ENV_FILE=C:\jl-shiyi-h5\.env
if exist "C:\jl-shiyi-h5-gitee\.env" set ENV_FILE=C:\jl-shiyi-h5-gitee\.env

if "%ENV_FILE%"=="" (
    echo [INFO]  .env file not found. Skipping multer step.
    echo   If using multer for uploads, add to your .env:
    echo   UPLOAD_MAX_FILE_SIZE=52428800
    goto :done
)

echo [4/4] Checking multer (Node.js) file size limit in %ENV_FILE%...

findstr /i "UPLOAD_MAX_FILE_SIZE" "%ENV_FILE%" >nul 2>&1
if errorlevel 1 (
    echo UPLOAD_MAX_FILE_SIZE not found. Adding default 50MB...
    echo UPLOAD_MAX_FILE_SIZE=52428800 >> "%ENV_FILE%"
    echo Added. Run scripts/windows-ecs-update-gitee.ps1 to rebuild and restart.
) else (
    echo UPLOAD_MAX_FILE_SIZE already configured.
    echo Current setting:
    findstr /i "UPLOAD_MAX_FILE_SIZE" "%ENV_FILE%"
)

echo.
echo ===============================================================================
echo   Multer step complete.
echo ===============================================================================

:done
echo.
echo ===============================================================================
echo   ALL DONE - Upload limit raised to 50MB
echo.
echo   Summary:
echo     - Nginx client_max_body_size 50m (if Nginx installed)
echo     - IIS maxAllowedContentLength 52428800 (if IIS installed)
echo     - multer UPLOAD_MAX_FILE_SIZE 52428800 (in .env)
echo.
echo   If the error persists:
echo     1. Restart the website / app pool (IIS: iisreset)
echo     2. Rebuild and restart Node service (run update script)
echo     3. Check that no other reverse proxy has its own limit
echo ===============================================================================
echo.
pause