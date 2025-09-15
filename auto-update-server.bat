@echo off
title Xpanel Auto Update

REM Initial 3 second delay for CMD initialization
echo Starting Xpanel Auto Update...
timeout /t 3 /nobreak >nul
cls

echo ========================================
timeout /t 1 /nobreak >nul
echo        Xpanel Auto Update
timeout /t 1 /nobreak >nul
echo    Automatic Server Update Tool
timeout /t 1 /nobreak >nul
echo ========================================
echo.
timeout /t 1 /nobreak >nul

set SERVER_IP=64.188.70.12
set SERVER_USER=root
set SERVER_PASS=Gamemode1

echo Connecting to server %SERVER_IP%...
timeout /t 2 /nobreak >nul

REM Check for plink (PuTTY)
where plink >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using PuTTY plink...
    timeout /t 1 /nobreak >nul
    echo.
    echo Executing commands on server...
    timeout /t 1 /nobreak >nul
    
    echo y | plink -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASS% -batch "cd /root/Xpanel && echo 'Current directory:' && pwd && echo 'Updating repository...' && git pull origin main && echo 'Update completed successfully!'"
    
    timeout /t 1 /nobreak >nul
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Server updated successfully!
        timeout /t 1 /nobreak >nul
    ) else (
        echo.
        echo Error updating server!
        timeout /t 1 /nobreak >nul
        echo Check your connection and server settings.
        timeout /t 2 /nobreak >nul
    )
) else (
    echo PuTTY not found!
    timeout /t 1 /nobreak >nul
    echo.
    echo Please install PuTTY from: https://www.putty.org/
    timeout /t 1 /nobreak >nul
    echo Or run: winget install PuTTY.PuTTY
    timeout /t 1 /nobreak >nul
    echo.
    echo Manual connection:
    timeout /t 1 /nobreak >nul
    echo ssh %SERVER_USER%@%SERVER_IP%
    timeout /t 1 /nobreak >nul
    echo Password: %SERVER_PASS%
    timeout /t 1 /nobreak >nul
    echo cd /root/Xpanel
    timeout /t 1 /nobreak >nul
    echo git pull origin main
    timeout /t 2 /nobreak >nul
)

echo.
echo Done! Press any key to exit...
pause >nul
