@echo off
chcp 65001 > nul
title DigiClock
cd /d "%~dp0"

echo ==================================================
echo   ⏰ DigiClock を起動しています...
echo   ブラウザが自動的に開きます。
echo   終了するときは、この黒い画面を閉じてください。
echo ==================================================

start "" http://localhost:8000

if exist "server.py" (
    python server.py
) else (
    python -m http.server 8000
)

pause
