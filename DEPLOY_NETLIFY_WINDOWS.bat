@echo off
cd /d %~dp0
call npm ci
call npx netlify deploy --build --prod
pause
