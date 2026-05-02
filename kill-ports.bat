@echo off
echo Killing all Node.js processes...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% == 0 (
    echo Done.
) else (
    echo No Node.js processes found.
)
