@echo off
title Etihad Flight Tracker - Task Scheduler Setup
cd /d "%~dp0"

echo ========================================================
echo   Etihad Flight Tracker - Setup Windows Daily Task
echo ========================================================
echo.
echo [1/2] Registering daily 09:00 AM background task...
echo.

schtasks /Create /TN "EtihadFlightTrackerDaily" /TR "\"%~dp0run_daily.bat\"" /SC DAILY /ST 09:00 /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Task created successfully: EtihadFlightTrackerDaily
    echo [Schedule] Runs every day at 09:00 AM in the background
    echo [Target] Updates d:\Work\EtihadFlightTracker\index.html
    echo ========================================================
    echo.
    echo Tip: Press Win + R and enter taskschd.msc to view tasks in Windows.
) else (
    echo.
    echo ========================================================
    echo [FAILED] Permission denied or creation failed.
    echo Please right-click this file and select "Run as administrator".
    echo ========================================================
)

echo.
echo Press any key to exit...
pause >nul
