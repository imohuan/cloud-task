@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo Killing PID %%a on port 3000
    taskkill /PID %%a /F
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":2024 " ^| findstr "LISTENING"') do (
    echo Killing PID %%a on port 2024
    taskkill /PID %%a /F
)
echo Done.
