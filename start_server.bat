@echo off
title Etihad Flight Tracker - Local Server
cd /d "%~dp0"

echo [Etihad Flight Tracker] Starting local web service...
echo Dashboard URL: http://localhost:3000
echo.

start "" "http://localhost:3000"

node server.js
