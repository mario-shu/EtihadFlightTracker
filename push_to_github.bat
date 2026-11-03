@echo off
title Push Etihad Flight Tracker to GitHub
cd /d "%~dp0"

echo ========================================================
echo   Pushing to GitHub: mario-shu/EtihadFlightTracker
echo ========================================================
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/mario-shu/EtihadFlightTracker.git
git branch -M main

echo Connecting to GitHub and pushing...
echo (If prompted, please sign in via browser and click Authorize)
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Pushed to GitHub successfully!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo [FAILED] Push failed.
    echo Please make sure:
    echo 1. You created the Public repo: EtihadFlightTracker on GitHub
    echo 2. You completed the login authorization in the popup window
    echo ========================================================
)

echo.
pause
