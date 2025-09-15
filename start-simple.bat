@echo off
title Xpanel Simple Server
echo ========================================
echo        Xpanel Simple Server
echo     БЕЗ СБОРОК И REACT - ТОЛЬКО HTML/CSS/JS
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не найден!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js найден
echo.

echo [2/2] Запуск простого сервера...
cd server
node simple-server.js

pause
