@echo off
chcp 65001 >nul 2>&1
title JL拾遗 H5 - 修复 Nginx 上传限制
color 0A

echo ===============================================================================
echo   JL拾遗 H5 - 修复 Nginx "request entity too large" 错误
echo   将 Nginx 的 client_max_body_size 从默认 1MB 增加到 50MB
echo ===============================================================================
echo.

:: 检查是否以管理员身份运行
net session >nul 2>&1
if errorlevel 1 (
    echo [错误] 请右键此脚本，选择"以管理员身份运行"！
    echo.
    pause
    exit /b 1
)

echo [1/3] 查找 Nginx 配置文件...

:: 常见 Nginx 配置路径
set NGINX_CONF=
if exist "C:\nginx\conf\nginx.conf" set NGINX_CONF=C:\nginx\conf\nginx.conf
if exist "C:\Program Files\nginx\conf\nginx.conf" set NGINX_CONF=C:\Program Files\nginx\conf\nginx.conf
if exist "C:\nginx-1.24.0\conf\nginx.conf" set NGINX_CONF=C:\nginx-1.24.0\conf\nginx.conf
if exist "C:\nginx-1.26.0\conf\nginx.conf" set NGINX_CONF=C:\nginx-1.26.0\conf\nginx.conf

:: 如果没找到，尝试用 where 命令
if "%NGINX_CONF%"=="" (
    for /f "delims=" %%i in ('where nginx 2^>nul') do (
        set NGINX_DIR=%%~dpi
    )
    if defined NGINX_DIR (
        set NGINX_CONF=%NGINX_DIR%..\conf\nginx.conf
    )
)

if "%NGINX_CONF%"=="" (
    echo [错误] 未找到 Nginx 配置文件！
    echo.
    echo 请手动修改 Nginx 配置：
    echo   1. 找到 nginx.conf 文件
    echo   2. 在 http { } 块内添加：client_max_body_size 50m;
    echo   3. 重启 Nginx：nginx -s reload
    echo.
    pause
    exit /b 1
)

echo 找到配置文件: %NGINX_CONF%
echo.

echo [2/3] 检查是否已配置 client_max_body_size...
findstr /i "client_max_body_size" "%NGINX_CONF%" >nul 2>&1
if errorlevel 1 (
    echo 未找到 client_max_body_size 配置，正在添加...
    
    :: 备份原配置
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    
    :: 在 http { 后面添加 client_max_body_size
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace '(http\s*\{)', \"`$1`r`n    client_max_body_size 50m;\"; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    
    echo 已添加 client_max_body_size 50m;
) else (
    echo 已存在 client_max_body_size 配置，正在更新为 50m...
    
    :: 备份原配置
    copy "%NGINX_CONF%" "%NGINX_CONF%.bak" >nul
    
    :: 替换现有的 client_max_body_size
    powershell -Command "$content = Get-Content '%NGINX_CONF%' -Raw; $content = $content -replace 'client_max_body_size\s+[^;]+;', 'client_max_body_size 50m;'; Set-Content '%NGINX_CONF%' -Value $content -Encoding UTF8"
    
    echo 已更新 client_max_body_size 为 50m;
)

echo.
echo [3/3] 重新加载 Nginx 配置...

:: 查找 nginx.exe
set NGINX_EXE=
if exist "C:\nginx\nginx.exe" set NGINX_EXE=C:\nginx\nginx.exe
if exist "C:\Program Files\nginx\nginx.exe" set NGINX_EXE=C:\Program Files\nginx\nginx.exe
if exist "C:\nginx-1.24.0\nginx.exe" set NGINX_EXE=C:\nginx-1.24.0\nginx.exe
if exist "C:\nginx-1.26.0\nginx.exe" set NGINX_EXE=C:\nginx-1.26.0\nginx.exe

if "%NGINX_EXE%"=="" (
    for /f "delims=" %%i in ('where nginx 2^>nul') do set NGINX_EXE=%%i
)

if "%NGINX_EXE%"=="" (
    echo [警告] 未找到 nginx.exe，请手动重启 Nginx
) else (
    "%NGINX_EXE%" -s reload
    echo Nginx 已重新加载
)

echo.
echo ===============================================================================
echo   修复完成！
echo.
echo   现在可以上传最大 50MB 的文件了。
echo   如果仍然报错，请检查：
echo     1. Nginx 是否成功重启
echo     2. 是否有其他反向代理（如 IIS）也有限制
echo ===============================================================================
echo.
pause