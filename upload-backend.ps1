# Backend Files Upload Script
# Usage: .\upload-backend.ps1

# Configuration
$SSH_KEY = "~/.ssh/discover-gozo"
$SERVER = "root@46.224.3.215"
$BACKEND_PATH = "/var/www/discover-gozo/backend"
$PM2_SERVICE = "discover-gozo-api"

# Navigate to project root (adjust path if needed)
$PROJECT_ROOT = "D:\DEV\00-Construction-00\MILESTONE\Discover-Gozo.com"
if (Test-Path $PROJECT_ROOT) {
    Set-Location $PROJECT_ROOT
    Write-Host "✅ Navigated to project root" -ForegroundColor Green
} else {
    Write-Host "⚠️  Project root not found at: $PROJECT_ROOT" -ForegroundColor Yellow
    Write-Host "Please navigate to your project root manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📤 Uploading backend files..." -ForegroundColor Cyan
Write-Host ""

# Upload files
Write-Host "Uploading database.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/database.js ${SERVER}:${BACKEND_PATH}/database.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ database.js uploaded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to upload database.js" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading routes/events.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/events.js ${SERVER}:${BACKEND_PATH}/routes/events.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ events.js uploaded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to upload events.js" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading public/admin.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/admin.html ${SERVER}:${BACKEND_PATH}/public/admin.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ admin.html uploaded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to upload admin.html" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading public/admin.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/admin.js ${SERVER}:${BACKEND_PATH}/public/admin.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ admin.js uploaded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed to upload admin.js" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ All files uploaded successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Restarting backend service..." -ForegroundColor Cyan

# Restart service
ssh -i $SSH_KEY $SERVER "pm2 restart $PM2_SERVICE"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend restarted!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to restart backend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Checking logs for migration confirmation..." -ForegroundColor Cyan
Write-Host ""

# Verify migration
ssh -i $SSH_KEY $SERVER "pm2 logs $PM2_SERVICE --lines 30 --nostream | grep -i 'category\|migration\|database'"

Write-Host ""
Write-Host "✅ Done! Check the logs above to verify migration ran." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://api.discover-gozo.com/admin.html" -ForegroundColor White
Write-Host "2. Create or edit an event" -ForegroundColor White
Write-Host "3. Verify the 'Event Category' dropdown appears" -ForegroundColor White



