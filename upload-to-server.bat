@echo off
echo ========================================
echo    Xpanel - Quick Upload Script
echo ========================================
echo.

set SERVER_IP=64.188.70.12
set SERVER_USER=root

echo 📦 Uploading a.zip to server...

REM Using pscp (PuTTY SCP) if available, otherwise try scp
where pscp >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using PuTTY SCP...
    pscp a.zip %SERVER_USER%@%SERVER_IP%:/root/
) else (
    echo Using OpenSSH SCP...
    scp a.zip %SERVER_USER%@%SERVER_IP%:/root/
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Upload failed! Try these solutions:
    echo.
    echo 1. Manual upload via WinSCP or FileZilla:
    echo    - Host: %SERVER_IP%
    echo    - User: %SERVER_USER%
    echo    - Upload a.zip to /root/ directory
    echo.
    echo 2. Or use PowerShell SCP:
    echo    scp a.zip %SERVER_USER%@%SERVER_IP%:/root/
    echo.
    pause
    exit /b 1
)

echo ✅ Upload successful!
echo.
echo 🔧 Now connect to your server and run:
echo    ssh %SERVER_USER%@%SERVER_IP%
echo    cd /root
echo    unzip -o a.zip
echo    cd Xpanels
echo    chmod +x setup-server.sh
echo    ./setup-server.sh
echo.
pause
