@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\deploy-gh-pages.ps1"
echo.
echo Press any key to close.
pause >nul
exit /b 0
