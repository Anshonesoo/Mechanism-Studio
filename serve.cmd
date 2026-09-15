@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if defined NODE_EXE goto node_ok
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if defined NODE_EXE goto node_ok
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if defined NODE_EXE goto node_ok
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined NODE_EXE goto node_ok
echo [ERROR] Node.js not found. Install Node.js 18 or newer.
pause
exit /b 1

:node_ok
if exist "dist\index.html" goto dist_ok
echo [ERROR] dist\index.html not found. Build it first:
echo         npm run build
pause
exit /b 1

:dist_ok
set "DISPLAY_PORT=%MECHANISM_PORT%"
if not defined DISPLAY_PORT set "DISPLAY_PORT=4173"
echo Serving production build at http://127.0.0.1:%DISPLAY_PORT%/
echo Keep this window open. Press Ctrl+C to stop.
"%NODE_EXE%" "scripts\serve-dist.mjs"
exit /b 0
