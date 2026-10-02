@echo off
title Road Warden: Virginia
cd /d "%~dp0app"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing for the first time. This takes a minute...
  call npm install
)
echo Building the game...
call npm run build
if errorlevel 1 (
  echo Build failed. See the messages above.
  pause
  exit /b 1
)
echo Starting Road Warden. Your browser will open. Close this window to stop the game.
call npx vite preview --port 4173 --open
