@echo off
title Etihad Flight Tracker - Remove Daily Task
cd /d "%~dp0"

echo ========================================================
echo   Etihad Flight Tracker - Remove Windows Scheduled Task
echo ========================================================
echo.

schtasks /Delete /TN "EtihadFlightTrackerDaily" /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Task removed successfully: EtihadFlightTrackerDaily
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo [INFO] Task does not exist or requires administrator privileges.
    echo ========================================================
)

echo.
echo Press any key to exit...
pause >nul
