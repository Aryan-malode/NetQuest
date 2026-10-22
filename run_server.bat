@echo off
cd /d "%~dp0"
py server.py
if errorlevel 1 (
  echo.
  echo NetQuest could not start. Check that Python 3.10 or newer is installed.
  echo You can also open Command Prompt in this folder and run: py server.py
  pause
)
