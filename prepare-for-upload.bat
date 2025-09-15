@echo off
echo ========================================
echo    Preparing Xpanel for Server Upload
echo ========================================
echo.

echo 🔧 Step 1: Building client...
call build-client.bat

echo.
echo 📦 Step 2: Creating production .env file...
if exist .env del .env
copy .env.production .env
echo ✅ Production .env created

echo.
echo 🗜️ Step 3: Creating updated archive...
if exist a.zip del a.zip

echo Creating a.zip with all files...
powershell -Command "Compress-Archive -Path * -DestinationPath a.zip -Force -CompressionLevel Optimal"

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Archive creation failed!
    pause
    exit /b 1
)

echo ✅ Archive a.zip created successfully!
echo.
echo 📊 Archive contents:
powershell -Command "Get-ChildItem a.zip | Select-Object Name, Length"
echo.
echo 🚀 Ready for upload! Run: upload-to-server.bat
echo.
pause
