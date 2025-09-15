@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    Xpanel Auto Update                        ║
echo ║                  (PuTTY Version)                             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set SERVER_IP=64.188.70.12
set SERVER_USER=root
set SERVER_PASS=Gamemode1

echo 🔄 Подключение к серверу %SERVER_IP%...

REM Проверяем наличие plink (PuTTY)
where plink >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ PuTTY не найден!
    echo.
    echo 📥 Скачайте PuTTY с официального сайта:
    echo https://www.putty.org/
    echo.
    echo Или установите через winget:
    echo winget install PuTTY.PuTTY
    echo.
    pause
    exit /b 1
)

echo 📡 Выполнение команд на сервере...
echo.

REM Выполняем команды на сервере
echo y | plink -ssh %SERVER_USER%@%SERVER_IP% -pw %SERVER_PASS% -batch "cd /root/Xpanel && echo 'Current directory:' && pwd && echo 'Updating repository...' && git pull origin main && echo 'Update completed successfully!'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Сервер успешно обновлен!
) else (
    echo.
    echo ❌ Ошибка при обновлении сервера!
    echo Проверьте:
    echo - Подключение к интернету
    echo - Правильность IP адреса и пароля
    echo - Наличие папки /root/Xpanel на сервере
)

echo.
pause
