@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev.ps1"
echo.
echo Press any key to close.
pause >nul
exit /b 0
