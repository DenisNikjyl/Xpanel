@echo off
echo ========================================
echo    Building Xpanel Client for Production
echo ========================================
echo.

cd client
echo 📦 Installing dependencies...
call npm install

echo 🔨 Building production version...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo ✅ Build completed successfully!
echo 📁 Build files are in client/build/
echo.
pause
