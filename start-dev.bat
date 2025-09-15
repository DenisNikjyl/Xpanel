@echo off
echo ===============================================================================
echo                        XPANEL - РЕЖИМ РАЗРАБОТКИ
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [1/4] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не установлен!
    echo Скачайте и установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [2/4] Проверка зависимостей...
if not exist "node_modules" (
    echo Устанавливаем зависимости сервера...
    call npm install
)

if not exist "client\node_modules" (
    echo Устанавливаем зависимости клиента...
    cd client
    call npm install
    cd ..
)

echo [3/4] Запуск сервера в фоне...
start "Xpanel Server" cmd /c "npm run dev & pause"

echo Ожидание запуска сервера...
timeout /t 5 /nobreak >nul

echo [4/4] Запуск клиента...
echo.
echo ===============================================================================
echo   Сервер: http://localhost:3001 (окно "Xpanel Server")
echo   Клиент: http://localhost:3000 (это окно)
echo   Для остановки закройте оба окна
echo ===============================================================================
echo.

cd client
call npm run dev

pause
