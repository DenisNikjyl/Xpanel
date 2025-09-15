@echo off
title Переименование старой client папки
echo ========================================
echo     Переименование старой React папки
echo ========================================
echo.

cd /d "%~dp0"

if exist "client" (
    echo Найдена старая папка client с React...
    if exist "client-old-react" (
        echo Удаляем старую резервную копию...
        rmdir /s /q "client-old-react"
    )
    echo Переименовываем client в client-old-react...
    ren "client" "client-old-react"
    echo ✅ Старая React папка переименована в client-old-react
) else (
    echo ✅ Папка client не найдена - уже удалена
)

echo.
echo Теперь используется только /public с простыми HTML/CSS/JS файлами!
echo.
pause
