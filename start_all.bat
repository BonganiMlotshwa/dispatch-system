@echo off
setlocal enableextensions

REM Hardcoded project root (handles spaces in path)
set "ROOT=C:\xampp\htdocs\USB Drive\dispatch"

REM PHP from XAMPP
set "PHP_EXE=C:\xampp\php\php.exe"

REM Start XAMPP Apache and MySQL
echo [XAMPP] Starting Apache and MySQL...
if exist "C:\xampp\apache_start.bat" (
  start "XAMPP-Apache" /min "C:\xampp\apache_start.bat"
) else (
  echo [XAMPP] apache_start.bat not found, skipping.
)
if exist "C:\xampp\mysql_start.bat" (
  start "XAMPP-MySQL" /min "C:\xampp\mysql_start.bat"
) else (
  echo [XAMPP] mysql_start.bat not found, skipping.
)

REM Wait for MySQL to come up
timeout /t 3 /nobreak >nul

REM Start PHP backend dev server on port 8001
echo [Backend] Starting PHP dev server on port 8001...
start "backend-php" cmd /k ""%PHP_EXE%" -S 0.0.0.0:8001 -t "%ROOT%\backend""

REM Start React frontend
echo [Frontend] Starting React dev server...
start "frontend" /D "%ROOT%\frontend" cmd /k "npm start"

echo.
echo All services launched in separate windows.
pause >nul
endlocal
