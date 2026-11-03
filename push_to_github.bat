@echo off
chcp 65001 >nul
title Push Etihad Flight Tracker to GitHub
cd /d "%~dp0"
echo ========================================================
echo   正在推送專案至 GitHub (mario-shu/EtihadFlightTracker)
echo ========================================================
echo.
git remote remove origin 2>nul
git remote add origin https://github.com/mario-shu/EtihadFlightTracker.git
git branch -M main
echo 正在連線並推送到 GitHub...
echo (若為初次連線，系統將會彈出 GitHub 登入授權視窗，請點選 Authorize 即可)
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [成功] 專案已成功推送到 GitHub！
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo [提示] 若推送失敗，請確認：
    echo 1. 已在 GitHub 上建立名為 EtihadFlightTracker 的 Public Repository。
    echo 2. 已在跳出的瀏覽器視窗中完成 GitHub 登入授權。
    echo ========================================================
)
echo.
pause
