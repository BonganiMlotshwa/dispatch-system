@echo off
echo ===================================================
echo Network Access Setup for Dispatch Application
echo ===================================================
echo.

echo This script will help you set up network access for the application.
echo.

echo Step 1: After npm start, open the app at http://localhost:3000 in your browser.
echo.

echo Step 2: Running firewall configuration script...
echo.

echo IMPORTANT: You will need to provide administrator permission.
echo A PowerShell window will open. Please click "Yes" when prompted.
echo.

powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File "%~dp0create_firewall_rules.ps1"' -Verb RunAs"

echo.
echo Setup process initiated. Please follow the prompts in the PowerShell window.
echo.
echo If you encounter any issues, see the Network Access section in README.md.
echo.
pause