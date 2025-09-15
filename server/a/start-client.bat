@echo off
echo ===============================================================================
echo                            XPANEL - ЗАПУСК КЛИЕНТА
echo ===============================================================================
echo.

cd /d "%~dp0\client"

echo [1/3] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не установлен!
    echo Скачайте и установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Установка зависимостей клиента...
if not exist "node_modules" (
    echo Устанавливаем зависимости клиента...
    call npm install
    if errorlevel 1 (
        echo ОШИБКА: Не удалось установить зависимости клиента!
        pause
        exit /b 1
    )
)

echo [3/3] Запуск React клиента...
echo.
echo ===============================================================================
echo   React клиент запускается на http://localhost:3000
echo   Для остановки нажмите Ctrl+C
echo ===============================================================================
echo.

call npm run dev

pause
