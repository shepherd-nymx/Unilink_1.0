@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sign-UniLink.ps1"
set "UNILINK_EXIT_CODE=%ERRORLEVEL%"
if not "%UNILINK_EXIT_CODE%"=="0" echo Signing did not finish. Read the message above; no key or password was uploaded.
pause
exit /b %UNILINK_EXIT_CODE%
