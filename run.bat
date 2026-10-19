@echo off
cd /d "%~dp0"
title NhamScan - Quet tai lieu nhieu trang
echo ========================================
echo  NhamScan - Quet tai lieu nhieu trang
echo  Trinh duyet: http://localhost:8080
echo  Bam Ctrl+C trong cua so nay de dung.
echo ========================================
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  py -m http.server 8080
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)
echo Khong tim thay Python 3. Hay cai Python va chon Add Python to PATH.
pause
