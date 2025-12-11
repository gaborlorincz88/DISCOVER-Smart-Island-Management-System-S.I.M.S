@echo off
title HYELLO Widget Installer
echo.
echo ========================================
echo   HYELLO Payment Widget Installer
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Then run this installer again.
    pause
    exit /b 1
)

echo Checking Node.js version...
node --version
echo.

REM Check if we're in a React project
if not exist "package.json" (
    echo ERROR: No package.json found!
    echo.
    echo Please run this installer in your React project root directory.
    pause
    exit /b 1
)

echo Starting HYELLO Widget Installer...
echo.
node "%~dp0hyello-widget-installer.cjs"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Installation Complete! 
    echo ========================================
) else (
    echo.
    echo Installation failed with error code %ERRORLEVEL%
)

echo.
pause
