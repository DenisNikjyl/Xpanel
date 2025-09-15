@echo off
echo ========================================
echo    Xpanel - Deployment to Server
echo ========================================
echo.

set SERVER_IP=185.250.180.254
set SERVER_USER=root
set ARCHIVE_NAME=a.zip

echo 🚀 Uploading project to server %SERVER_IP%...
echo.

REM Upload archive using SCP
echo Uploading %ARCHIVE_NAME% to server...
scp %ARCHIVE_NAME% %SERVER_USER%@%SERVER_IP%:/root/

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Upload failed! Make sure:
    echo   - SSH key is configured
    echo   - Server is accessible
    echo   - Archive file exists
    pause
    exit /b 1
)

echo ✅ Upload completed!
echo.

echo 📦 Connecting to server to extract and setup...
ssh %SERVER_USER%@%SERVER_IP% "cd /root && unzip -o %ARCHIVE_NAME% && cd Xpanels && chmod +x *.sh && ./setup-server.sh"

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Server setup failed!
    pause
    exit /b 1
)

echo.
echo ✅ Deployment completed successfully!
echo 🌐 Your Xpanel should be available at: http://xpanel.xload.ru
echo.
pause
