@echo off
REM Script to update backend files on the server (Windows)
REM Usage: update-backend-files.bat [server-user] [server-host] [backend-path]

setlocal

set SERVER_USER=%1
set SERVER_HOST=%2
set BACKEND_PATH=%3

if "%SERVER_USER%"=="" set SERVER_USER=your-username
if "%SERVER_HOST%"=="" set SERVER_HOST=your-server.com
if "%BACKEND_PATH%"=="" set BACKEND_PATH=/var/www/discovergozo-backend

echo.
echo 🚀 Updating backend files on server...
echo Server: %SERVER_USER%@%SERVER_HOST%
echo Path: %BACKEND_PATH%
echo.

echo 📤 Uploading backend/database.js...
scp backend/database.js %SERVER_USER%@%SERVER_HOST%:%BACKEND_PATH%/database.js
if errorlevel 1 (
    echo ❌ Failed to upload database.js
    pause
    exit /b 1
)

echo 📤 Uploading backend/routes/events.js...
scp backend/routes/events.js %SERVER_USER%@%SERVER_HOST%:%BACKEND_PATH%/routes/events.js
if errorlevel 1 (
    echo ❌ Failed to upload events.js
    pause
    exit /b 1
)

echo 📤 Uploading backend/public/admin.html...
scp backend/public/admin.html %SERVER_USER%@%SERVER_HOST%:%BACKEND_PATH%/public/admin.html
if errorlevel 1 (
    echo ❌ Failed to upload admin.html
    pause
    exit /b 1
)

echo 📤 Uploading backend/public/admin.js...
scp backend/public/admin.js %SERVER_USER%@%SERVER_HOST%:%BACKEND_PATH%/public/admin.js
if errorlevel 1 (
    echo ❌ Failed to upload admin.js
    pause
    exit /b 1
)

echo.
echo ✅ Files uploaded successfully!
echo.
echo 📋 Next steps:
echo 1. SSH into your server: ssh %SERVER_USER%@%SERVER_HOST%
echo 2. Navigate to backend: cd %BACKEND_PATH%
echo 3. Restart the backend service:
echo    pm2 restart discovergozo-backend
echo    OR
echo    systemctl restart discovergozo-backend
echo.
echo The database migration will run automatically on next server start.
echo.
pause



