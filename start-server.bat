@echo off
cd /d "%~dp0"
echo Starting FinalWhistle secure server...
echo.
node server.js
echo.
echo Server stopped. Press any key to close this window.
pause >nul
