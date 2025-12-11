# Security Updates Backend Files Upload Script
# Usage: .\upload-security-updates.ps1

# Configuration
$SSH_KEY = "~/.ssh/discover-gozo"
$SERVER = "root@46.224.3.215"
$BACKEND_PATH = "/var/www/discover-gozo/backend"
$FRONTEND_PATH = "/var/www/discover-gozo"
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
Write-Host "Uploading Security Updates..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Upload New Middleware Files
# ============================================
Write-Host "Uploading new security middleware..." -ForegroundColor Cyan

Write-Host "  Ensuring middleware directory exists..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/middleware"

Write-Host "  Uploading middleware/rateLimiter.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/middleware/rateLimiter.js ${SERVER}:${BACKEND_PATH}/middleware/rateLimiter.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ rateLimiter.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload rateLimiter.js" -ForegroundColor Red
}

Write-Host "  Uploading middleware/secureUpload.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/middleware/secureUpload.js ${SERVER}:${BACKEND_PATH}/middleware/secureUpload.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ secureUpload.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload secureUpload.js" -ForegroundColor Red
}

# ============================================
# 2. Upload Updated Route Files
# ============================================
Write-Host ""
Write-Host "Uploading updated route files..." -ForegroundColor Cyan

Write-Host "  Ensuring routes directory exists..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "mkdir -p ${BACKEND_PATH}/routes"

Write-Host "  Uploading routes/auth.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/auth.js ${SERVER}:${BACKEND_PATH}/routes/auth.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ auth.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload auth.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/admin-auth.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/admin-auth.js ${SERVER}:${BACKEND_PATH}/routes/admin-auth.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ admin-auth.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload admin-auth.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/merchant.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/merchant.js ${SERVER}:${BACKEND_PATH}/routes/merchant.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ merchant.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload merchant.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/places.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/places.js ${SERVER}:${BACKEND_PATH}/routes/places.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ places.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload places.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/tours.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/tours.js ${SERVER}:${BACKEND_PATH}/routes/tours.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ tours.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload tours.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/routes.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/routes.js ${SERVER}:${BACKEND_PATH}/routes/routes.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ routes.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload routes.js" -ForegroundColor Red
}

Write-Host "  Uploading routes/kml-import.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/routes/kml-import.js ${SERVER}:${BACKEND_PATH}/routes/kml-import.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ kml-import.js uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload kml-import.js" -ForegroundColor Red
}

# ============================================
# 3. Upload Updated Middleware Files
# ============================================
Write-Host ""
Write-Host "Uploading updated middleware files..." -ForegroundColor Cyan

Write-Host "  Uploading middleware/auth.js..." -ForegroundColor Gray
scp -i $SSH_KEY backend/middleware/auth.js ${SERVER}:${BACKEND_PATH}/middleware/auth.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ auth.js middleware uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload auth.js middleware" -ForegroundColor Red
}

# ============================================
# 4. Upload Core Backend Files
# ============================================
Write-Host ""
Write-Host "Uploading core backend files..." -ForegroundColor Cyan

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

Write-Host "  Uploading package.json..." -ForegroundColor Gray
scp -i $SSH_KEY backend/package.json ${SERVER}:${BACKEND_PATH}/package.json
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ package.json uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload package.json" -ForegroundColor Red
}

# ============================================
# 5. Install New Dependencies
# ============================================
Write-Host ""
Write-Host "Installing new security dependencies..." -ForegroundColor Cyan

Write-Host "  Running npm install in backend..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "cd ${BACKEND_PATH} && npm install"
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "    ⚠️  npm install completed with warnings/errors" -ForegroundColor Yellow
    Write-Host "    Please check manually if needed" -ForegroundColor Yellow
}

# ============================================
# 6. Upload Frontend Files
# ============================================
Write-Host ""
Write-Host "Uploading frontend/public files..." -ForegroundColor Cyan

Write-Host "  Ensuring public directory exists..." -ForegroundColor Gray
ssh -i $SSH_KEY $SERVER "mkdir -p ${FRONTEND_PATH}/public"

Write-Host "  Uploading public/privacy-policy.html..." -ForegroundColor Gray
scp -i $SSH_KEY public/privacy-policy.html ${SERVER}:${FRONTEND_PATH}/public/privacy-policy.html
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ privacy-policy.html uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload privacy-policy.html" -ForegroundColor Red
}

# ============================================
# 7. Upload Documentation
# ============================================
Write-Host ""
Write-Host "Uploading documentation..." -ForegroundColor Cyan

Write-Host "  Uploading SECURITY_FEATURES.md..." -ForegroundColor Gray
scp -i $SSH_KEY SECURITY_FEATURES.md ${SERVER}:${FRONTEND_PATH}/SECURITY_FEATURES.md
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ SECURITY_FEATURES.md uploaded" -ForegroundColor Green
} else {
    Write-Host "    ❌ Failed to upload SECURITY_FEATURES.md" -ForegroundColor Red
}

# ============================================
# 8. Restart Backend Service
# ============================================
Write-Host ""
Write-Host "Restarting backend service..." -ForegroundColor Cyan

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
# 9. Verify Installation
# ============================================
Write-Host ""
Write-Host "Checking logs for verification..." -ForegroundColor Cyan
Write-Host ""

# Wait a moment for service to start
Start-Sleep -Seconds 3

# Check for successful startup
ssh -i $SSH_KEY $SERVER "pm2 logs $PM2_SERVICE --lines 30 --nostream | tail -30"

Write-Host ""
Write-Host "Security updates upload complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Security Features Now Active:" -ForegroundColor Cyan
Write-Host "  - Bcrypt password encryption" -ForegroundColor White
Write-Host "  - Rate limiting on auth endpoints" -ForegroundColor White
Write-Host "  - CSRF protection" -ForegroundColor White
Write-Host "  - Security headers (Helmet)" -ForegroundColor White
Write-Host "  - Secure file uploads" -ForegroundColor White
Write-Host "  - Hardened CORS configuration" -ForegroundColor White
Write-Host "  - Enhanced error message protection" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test login functionality to ensure bcrypt migration works" -ForegroundColor White
Write-Host "2. Verify rate limiting (try 6 login attempts in 15 minutes)" -ForegroundColor White
Write-Host "3. Check that file uploads are working securely" -ForegroundColor White
Write-Host "4. Review privacy-policy.html at: https://discover-gozo.com/privacy-policy.html" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Set JWT_SECRET environment variable on server:" -ForegroundColor Yellow
Write-Host "   ssh -i $SSH_KEY $SERVER 'echo \"JWT_SECRET=your-strong-secret-here\" >> /var/www/discover-gozo/backend/.env'" -ForegroundColor Yellow
Write-Host "   Then restart: ssh -i $SSH_KEY $SERVER 'pm2 restart $PM2_SERVICE'" -ForegroundColor Yellow
Write-Host ""

