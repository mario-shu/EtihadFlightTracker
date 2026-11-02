@echo off
chcp 65001 >nul
title Push Etihad Flight Tracker to GitHub
echo ========================================================
echo     推送專案至 GitHub (請輸入您的 GitHub 帳號名稱)
echo ========================================================
echo.
set /p GH_USER="請輸入您的 GitHub 帳號名稱 (例如: yourname): "
if "%GH_USER%"=="" (
    echo [錯誤] 帳號名稱不可為空！
    pause
    exit /b 1
)

echo.
echo 設定遠端儲存庫: https://github.com/%GH_USER%/EtihadFlightTracker.git ...
git remote remove origin 2>nul
git remote add origin https://github.com/%GH_USER%/EtihadFlightTracker.git
git branch -M main

echo.
echo 正在推送到 GitHub main 分支...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [成功] 已成功推送到 GitHub！
    echo ========================================================
) else (
    echo.
    echo [提示] 若推送失敗，請確認該 Repository 已在 GitHub 上建立為 Public。
)

pause
