@echo off
cd /d "%~dp0"

echo [Etihad Flight Tracker] Running daily price tracker...
node tracker.js >> tracker.log 2>&1
echo [Done] Dashboard updated to index.html
