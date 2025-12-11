@echo off
echo ========================================
echo Converting PNG Tiles to WebP Format
echo ========================================
echo.
echo This will compress your map tiles for better performance.
echo Estimated reduction: 70-80%% smaller files
echo.
echo Press Ctrl+C to cancel, or
pause

node backend/scripts/convert-tiles-to-webp.js

echo.
echo ========================================
echo Conversion Complete!
echo ========================================
pause

