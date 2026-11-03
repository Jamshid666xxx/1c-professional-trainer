@echo off
chcp 65001 >nul
title 1С:Профессионал — Тренажер подготовки к экзамену

cd /d "%~dp0"

set "PYTHON_EXE="

if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Python\bin\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        where py >nul 2>nul
        if %errorlevel% equ 0 (
            set "PYTHON_EXE=py"
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ОШИБКА] Python не найден в системе!
    echo Установите Python или добавьте его в переменную PATH.
    pause
    exit /b 1
)

echo ============================================================
echo   Запуск тренажера 1С:Профессионал (Платформа 8.3)
echo ============================================================
echo.
echo Python: %PYTHON_EXE%
echo Браузер откроется автоматически...
echo.

"%PYTHON_EXE%" server.py
pause
