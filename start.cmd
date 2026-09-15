@echo off
setlocal
cd /d "%~dp0"

rem --- Locate Node.js ---
set "NODE="
where node >nul 2>nul && set "NODE=node"
if defined NODE goto node_ok
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if defined NODE goto node_ok
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if defined NODE goto node_ok
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined NODE goto node_ok
echo [ERROR] Node.js not found. Install it first, for example:
echo         winget install OpenJS.NodeJS.LTS
pause
exit /b 1

:node_ok
if exist "node_modules\vite\bin\vite.js" goto deps_ok
echo [ERROR] Dependencies are not installed yet. Run this first:
echo         npm install
pause
exit /b 1

:deps_ok
set "DEV_PORT=5173"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\start-dev.ps1" -Port %DEV_PORT%
exit /b 0
