@echo off
setlocal EnableExtensions
title Nham Scan - Installer FIX
echo ==========================================
echo       NHAM SCAN - INSTALLER FIX
echo ==========================================
echo.

set "ROOT=D:\MyWorkSpace\NhamScan"
set "APP=%ROOT%\app"
set "ZIP=%ROOT%\scanner-source.zip"
set "EXTRACT=%ROOT%\_extract"
set "SRC="

if not exist "D:\MyWorkSpace" mkdir "D:\MyWorkSpace"
if not exist "%ROOT%" mkdir "%ROOT%"

where powershell >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay PowerShell.
  pause
  exit /b 1
)

echo [1/4] Kiem tra quyen ghi thu muc...
echo test>"%ROOT%\write_test.tmp" 2>nul
if not exist "%ROOT%\write_test.tmp" (
  echo [LOI] Khong ghi duoc vao %ROOT%
  echo Hay dong cua so dang dung file trong thu muc nay, hoac chon thu muc khac.
  pause
  exit /b 1
)
del "%ROOT%\write_test.tmp" >nul 2>nul

echo [2/4] Tai ma nguon tu GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri 'https://codeload.github.com/MeredyddKJones/scanner/zip/refs/heads/main' -OutFile '%ZIP%'"
if errorlevel 1 (
  echo [LOI] Khong tai duoc ZIP. Kiem tra Internet/Firewall roi chay lai.
  pause
  exit /b 1
)

echo [3/4] Giai nen vao thu muc rieng...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%" 2>nul
mkdir "%EXTRACT%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if errorlevel 1 (
  echo [LOI] PowerShell khong giai nen duoc. ZIP duoc giu lai tai:
  echo %ZIP%
  pause
  exit /b 1
)

for /d %%D in ("%EXTRACT%\scanner-*") do (
  if exist "%%D\index.html" set "SRC=%%D"
)
if not defined SRC (
  echo [LOI] Khong tim thay index.html trong ZIP.
  echo Hay mo thu muc: %EXTRACT%
  echo ZIP giu lai tai: %ZIP%
  pause
  exit /b 1
)

echo [4/4] Sao chep ma nguon...
if exist "%APP%\index.html" (
  choice /C YN /M "Da co app. Thay the app cu bang ma nguon moi"
  if errorlevel 2 goto :skipcopy
  rmdir /s /q "%APP%"
)
if not exist "%APP%" mkdir "%APP%"
robocopy "%SRC%" "%APP%" /E /NFL /NDL /NJH /NJS /NC /NS
if errorlevel 8 (
  echo [LOI] Sao chep that bai. Ma nguon van con trong %EXTRACT%
  pause
  exit /b 1
)

:skipcopy
(
echo @echo off
echo setlocal
echo title Nham Scan
echo cd /d "%APP%"
echo where py ^>nul 2^>nul
echo if errorlevel 1 ^(
echo   echo Khong tim thay Python Launcher. Cai Python 3 va chon Add Python to PATH.
echo   pause
echo   exit /b 1
echo ^)
echo start "" http://localhost:8000
echo py -m http.server 8000
) > "%ROOT%\RUN_NHAM_SCAN.bat"

echo.
echo CAI DAT XONG.
echo Ma nguon: %APP%
echo Chay: %ROOT%\RUN_NHAM_SCAN.bat
echo Mo: http://localhost:8000
echo.
pause
