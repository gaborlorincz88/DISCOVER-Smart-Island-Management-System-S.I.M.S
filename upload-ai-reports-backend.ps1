# AI Analytics Report Backend Files Upload Script
# Usage: .\upload-ai-reports-backend.ps1

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
Write-Host "📤 Uploading AI Analytics Report backend files..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Upload New Service Files
# ============================================
Write-Host "📦 Uploading service files..." -ForegroundColor Cyan

Write-Host "  Uploading services/aiReportService.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/services/aiReportService.js ${SERVER}:${BACKEND_PATH}/services/aiReportService.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ aiReportService.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload aiReportService.js" -ForegroundColor Red
}

Write-Host "  Uploading services/emailService.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/services/emailService.js ${SERVER}:${BACKEND_PATH}/services/emailService.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ emailService.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload emailService.js" -ForegroundColor Red
}

Write-Host "  Uploading services/reportGenerator.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/services/reportGenerator.js ${SERVER}:${BACKEND_PATH}/services/reportGenerator.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ reportGenerator.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload reportGenerator.js" -ForegroundColor Red
}

Write-Host "  Uploading services/reportScheduler.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/services/reportScheduler.js ${SERVER}:${BACKEND_PATH}/services/reportScheduler.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ reportScheduler.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload reportScheduler.js" -ForegroundColor Red
}

# ============================================
# 2. Upload New Route File
# ============================================
Write-Host ""
Write-Host "🛣️  Uploading route files..." -ForegroundColor Cyan

Write-Host "  Uploading routes/reports.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/reports.js ${SERVER}:${BACKEND_PATH}/routes/reports.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ reports.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload reports.js" -ForegroundColor Red
}

# ============================================
# 3. Upload Template File
# ============================================
Write-Host ""
Write-Host "📄 Uploading template files..." -ForegroundColor Cyan

Write-Host "  Creating templates directory..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/templates"

Write-Host "  Uploading templates/report-template.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/templates/report-template.html ${SERVER}:${BACKEND_PATH}/templates/report-template.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ report-template.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload report-template.html" -ForegroundColor Red
}

# ============================================
# 4. Upload Public Files (Control Panel)
# ============================================
Write-Host ""
Write-Host "🌐 Uploading public files..." -ForegroundColor Cyan

Write-Host "  Uploading public/ai-analytics-report.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/ai-analytics-report.html ${SERVER}:${BACKEND_PATH}/public/ai-analytics-report.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ ai-analytics-report.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload ai-analytics-report.html" -ForegroundColor Red
}

Write-Host "  Uploading public/ai-analytics-report.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/ai-analytics-report.js ${SERVER}:${BACKEND_PATH}/public/ai-analytics-report.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ ai-analytics-report.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload ai-analytics-report.js" -ForegroundColor Red
}

# ============================================
# 5. Upload Updated Files
# ============================================
Write-Host ""
Write-Host "🔄 Uploading updated files..." -ForegroundColor Cyan

Write-Host "  Uploading database.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/database.js ${SERVER}:${BACKEND_PATH}/database.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ database.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload database.js" -ForegroundColor Red
}

Write-Host "  Uploading server.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/server.js ${SERVER}:${BACKEND_PATH}/server.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ server.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload server.js" -ForegroundColor Red
}

Write-Host "  Uploading public/admin.html..." -ForegroundColor Gray
scp -i $SSH_KEY backend/public/admin.html ${SERVER}:${BACKEND_PATH}/public/admin.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ admin.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload admin.html" -ForegroundColor Red
}

Write-Host "  Uploading package.json..." -ForegroundColor Gray
scp -i $SSH_KEY backend/package.json ${SERVER}:${BACKEND_PATH}/package.json
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ package.json uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload package.json" -ForegroundColor Red
}

# ============================================
# 6. Create Required Directories on Server
# ============================================
Write-Host ""
Write-Host "📁 Creating required directories..." -ForegroundColor Cyan

ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/reports"
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/templates"
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/services"

# ============================================
# 7. Install NPM Dependencies on Server
# ============================================
Write-Host ""
Write-Host "📦 Installing npm dependencies on server..." -ForegroundColor Cyan
Write-Host "  This may take a few minutes..." -ForegroundColor Gray

ssh -i $SSH_KEY $SERVER "cd ${BACKEND_PATH} && npm install @google/generative-ai puppeteer nodemailer node-cron"
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "    You may need to install them manually:" -ForegroundColor Yellow
    Write-Host "    ssh -i $SSH_KEY $SERVER 'cd ${BACKEND_PATH} && npm install @google/generative-ai puppeteer nodemailer node-cron'" -ForegroundColor Yellow
}

# ============================================
# 8. Restart Backend Service
# ============================================
Write-Host ""
Write-Host "🔄 Restarting backend service..." -ForegroundColor Cyan

ssh -i $SSH_KEY $SERVER "pm2 restart $PM2_SERVICE"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend restarted!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to restart backend" -ForegroundColor Red
    exit 1
}

# ============================================
# 9. Verify Installation
# ============================================
Write-Host ""
Write-Host "📋 Checking logs for verification..." -ForegroundColor Cyan
Write-Host ""

# Check for database migration
ssh -i $SSH_KEY $SERVER "pm2 logs $PM2_SERVICE --lines 50 --nostream | grep -i 'settings\|report\|scheduler\|database'"

Write-Host ""
Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://api.discover-gozo.com/admin.html" -ForegroundColor White
Write-Host "2. Navigate to Analytics tab" -ForegroundColor White
Write-Host "3. Click 'AI Analytics Report' button" -ForegroundColor White
Write-Host "4. Configure your Google AI API key" -ForegroundColor White
Write-Host "5. Generate your first report!" -ForegroundColor White
Write-Host ""

