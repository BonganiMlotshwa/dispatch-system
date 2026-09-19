@echo off
setlocal enableextensions

REM Hardcoded project root (handles spaces in path)
set "ROOT=C:\xampp\htdocs\USB Drive\dispatch"

REM PHP from XAMPP
set "PHP_EXE=C:\xampp\php\php.exe"

REM Helper: find free port starting from %1, store result in %2
goto :main

:find_free_port
for /f %%p in ('powershell -NoProfile -Command "$p=%~1; while($true){try{$l=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any,$p);$l.Start();$l.Stop();break}catch{$p++}};$p"') do set %~2=%%p
exit /b

:main

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

REM Find a free port for PHP backend (start from 8001)
echo [Backend] Finding available port from 8001...
call :find_free_port 8001 PHP_PORT
echo [Backend] Starting PHP dev server on port %PHP_PORT%...
start "backend-php" cmd /k ""%PHP_EXE%" -S 0.0.0.0:%PHP_PORT% -t "%ROOT%\backend""

REM Find a free port for React frontend (start from 3000)
echo [Frontend] Finding available port from 3000...
call :find_free_port 3000 REACT_PORT
echo [Frontend] Starting React dev server on port %REACT_PORT%...
start "frontend" /D "%ROOT%\frontend" cmd /k "set PORT=%REACT_PORT%&& npm start"

echo.
echo All services launched in separate windows:
echo   PHP backend  ^>  http://localhost:%PHP_PORT%
echo   React app    ^>  http://localhost:%REACT_PORT%
echo.
pause >nul
endlocal
