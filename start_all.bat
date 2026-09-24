@echo off
setlocal enableextensions

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PHP_EXE=C:\xampp\php\php.exe"

title FTM Dispatch System

echo ========================================
echo  FTM Dispatch System
echo ========================================
echo.

REM Start MySQL silently (minimised, no extra window)
if exist "C:\xampp\mysql_start.bat" (
    echo [1/3] Starting MySQL...
    start "" /min "C:\xampp\mysql_start.bat"
    timeout /t 3 /nobreak >nul
) else (
    echo [1/3] MySQL: make sure it is running in XAMPP Control Panel.
)

REM Start PHP backend in this console session (no new window)
echo [2/3] PHP backend  ^>  http://localhost:8001
start /B "" "%PHP_EXE%" -S 0.0.0.0:8001 -t "%ROOT%\backend"
timeout /t 1 /nobreak >nul

REM Start React in the foreground — output shows in this window
echo [3/3] React frontend  ^>  http://localhost:3000
echo.
echo Press Ctrl+C to stop everything.
echo ----------------------------------------
echo.

cd /D "%ROOT%\frontend"
set PORT=3000
npm start

endlocal
