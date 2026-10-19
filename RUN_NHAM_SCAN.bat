@echo off
setlocal
title Nham Scan - Local Web App
set "APP=D:\MyWorkSpace\NhamScan\app"
if not exist "%APP%\index.html" (
  echo Chua cai dat. Hay chay INSTALL_NHAM_SCAN.bat truoc.
  pause
  exit /b 1
)
where py >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Python Launcher. Cai Python 3 va chon Add Python to PATH.
  pause
  exit /b 1
)
cd /d "%APP%"
start "" http://localhost:8000
py -m http.server 8000
