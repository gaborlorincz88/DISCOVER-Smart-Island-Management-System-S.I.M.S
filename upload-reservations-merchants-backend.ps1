# Reservations & Merchants Analytics Backend Files Upload Script
# Usage: .\upload-reservations-merchants-backend.ps1

# Configuration
$SSH_KEY = "~/.ssh/discover-gozo"
$SERVER = "root@46.224.3.215"
$BACKEND_PATH = "/var/www/discover-gozo/backend"
$PM2_SERVICE = "discover-gozo-api"

# Navigate to project root
$PROJECT_ROOT = "D:\DEV\00-Construction-00\MILESTONE\Discover-Gozo.com"
if (Test-Path $PROJECT_ROOT) {
    Set-Location $PROJECT_ROOT
    Write-Host "✅ Navigated to project root" -ForegroundColor Green
} else {
    Write-Host "⚠️  Project root not found at: $PROJECT_ROOT" -ForegroundColor Yellow
    Write-Host "Please navigate to your project root manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📤 Uploading Reservations & Merchants Analytics backend files..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Upload New Route File
# ============================================
Write-Host "🛣️  Uploading route files..." -ForegroundColor Cyan

Write-Host "  Uploading routes/toursAnalytics.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/toursAnalytics.js ${SERVER}:${BACKEND_PATH}/routes/toursAnalytics.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ toursAnalytics.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload toursAnalytics.js" -ForegroundColor Red
}

# ============================================
# 2. Upload Updated Service Files
# ============================================
Write-Host ""
Write-Host "📦 Uploading updated service files..." -ForegroundColor Cyan

Write-Host "  Uploading services/reportGenerator.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/services/reportGenerator.js ${SERVER}:${BACKEND_PATH}/services/reportGenerator.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ reportGenerator.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload reportGenerator.js" -ForegroundColor Red
}

# ============================================
# 3. Upload Updated Template File
# ============================================
Write-Host ""
Write-Host "📄 Uploading template files..." -ForegroundColor Cyan

Write-Host "  Ensuring templates directory exists..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/templates"

Write-Host "  Uploading templates/report-template.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/templates/report-template.html ${SERVER}:${BACKEND_PATH}/templates/report-template.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ report-template.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload report-template.html" -ForegroundColor Red
}

# ============================================
# 4. Upload Updated Public Files
# ============================================
Write-Host ""
Write-Host "🌐 Uploading public files..." -ForegroundColor Cyan

Write-Host "  Uploading public/analytics.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/analytics.html ${SERVER}:${BACKEND_PATH}/public/analytics.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ analytics.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload analytics.html" -ForegroundColor Red
}

# ============================================
# 5. Upload Updated Server File
# ============================================
Write-Host ""
Write-Host "🔄 Uploading updated server files..." -ForegroundColor Cyan

Write-Host "  Uploading server.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/server.js ${SERVER}:${BACKEND_PATH}/server.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ server.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload server.js" -ForegroundColor Red
}

# ============================================
# 6. Ensure Required Directories Exist
# ============================================
Write-Host ""
Write-Host "📁 Ensuring required directories exist..." -ForegroundColor Cyan

ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/routes"
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/templates"

# ============================================
# 7. Restart Backend Service
# ============================================
Write-Host ""
Write-Host "🔄 Restarting backend service..." -ForegroundColor Cyan

ssh -i $SSH_KEY $SERVER "pm2 restart $PM2_SERVICE"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend restarted!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to restart backend" -ForegroundColor Red
    Write-Host "You may need to restart manually:" -ForegroundColor Yellow
    Write-Host "ssh -i $SSH_KEY $SERVER 'pm2 restart $PM2_SERVICE'" -ForegroundColor Yellow
    exit 1
}

# ============================================
# 8. Verify Installation
# ============================================
Write-Host ""
Write-Host "📋 Checking logs for verification..." -ForegroundColor Cyan
Write-Host ""

# Check for successful startup
ssh -i $SSH_KEY $SERVER "pm2 logs $PM2_SERVICE --lines 20 --nostream | tail -20"

Write-Host ""
Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://api.discover-gozo.com/analytics.html" -ForegroundColor White
Write-Host "2. Click on 'Reservations & Merchants' tab" -ForegroundColor White
Write-Host "3. View the new analytics charts and data" -ForegroundColor White
Write-Host "4. Generate an AI Analytics Report to see tour/merchant data in PDF" -ForegroundColor White
Write-Host ""


