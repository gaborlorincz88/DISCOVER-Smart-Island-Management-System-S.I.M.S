# 📤 Backend Files Update Instructions

## 🚀 Quick User Guide - Step by Step

### Your Server Information
- **SSH Key:** `~/.ssh/discover-gozo`
- **Server:** `root@46.224.3.215`
- **Backend Path:** `/var/www/discover-gozo/backend`
- **PM2 Service Name:** `discover-gozo-api`

### Step 1: Navigate to Your Project Directory

**Windows PowerShell:**
```powershell
cd D:\DEV\00-Construction-00\MILESTONE\Discover-Gozo.com
```

**Linux/Mac:**
```bash
cd /path/to/Discover-Gozo.com
```

### Step 2: Find Your Backend Path (If Unknown)

If you don't know the backend path, find it first:

```powershell
# Find the backend path using PM2
ssh -i ~/.ssh/discover-gozo root@46.224.3.215 "pm2 info discover-gozo-api | grep -E 'script path|exec cwd'"
```

This will show you something like:
```
│ script path       │ /var/www/discover-gozo/backend/server.js    │
│ exec cwd          │ /var/www/discover-gozo/backend              │
```

Use the `exec cwd` path for your uploads.

### Step 3: Upload Backend Files

**Windows PowerShell (from project root):**

```powershell
# Upload database.js
scp -i ~/.ssh/discover-gozo backend/database.js root@46.224.3.215:/var/www/discover-gozo/backend/database.js

# Upload events.js route
scp -i ~/.ssh/discover-gozo backend/routes/events.js root@46.224.3.215:/var/www/discover-gozo/backend/routes/events.js

# Upload admin.html
scp -i ~/.ssh/discover-gozo backend/public/admin.html root@46.224.3.215:/var/www/discover-gozo/backend/public/admin.html

# Upload admin.js
scp -i ~/.ssh/discover-gozo backend/public/admin.js root@46.224.3.215:/var/www/discover-gozo/backend/public/admin.js
```

**Linux/Mac:**

```bash
# Upload database.js
scp -i ~/.ssh/discover-gozo backend/database.js root@46.224.3.215:/var/www/discover-gozo/backend/database.js

# Upload events.js route
scp -i ~/.ssh/discover-gozo backend/routes/events.js root@46.224.3.215:/var/www/discover-gozo/backend/routes/events.js

# Upload admin.html
scp -i ~/.ssh/discover-gozo backend/public/admin.html root@46.224.3.215:/var/www/discover-gozo/backend/public/admin.html

# Upload admin.js
scp -i ~/.ssh/discover-gozo backend/public/admin.js root@46.224.3.215:/var/www/discover-gozo/backend/public/admin.js
```

### Step 4: Restart Backend Service

```powershell
# Restart the PM2 service
ssh -i ~/.ssh/discover-gozo root@46.224.3.215 "pm2 restart discover-gozo-api"
```

### Step 5: Verify Migration Ran Successfully

```powershell
# Check logs for migration confirmation
ssh -i ~/.ssh/discover-gozo root@46.224.3.215 "pm2 logs discover-gozo-api --lines 30 --nostream | grep -i 'category\|migration\|database'"
```

You should see:
```
Adding category column to events table...
Database setup is complete and up-to-date.
```

### Step 6: Test in Admin Panel

1. Go to: `https://api.discover-gozo.com/admin.html`
2. Create or edit an event
3. Verify the "Event Category" dropdown appears with all options

---

## 📋 Complete Command Reference

### All-in-One PowerShell Script

Save this as `upload-backend.ps1` and run it from your project root:

```powershell
# Configuration
$SSH_KEY = "~/.ssh/discover-gozo"
$SERVER = "root@46.224.3.215"
$BACKEND_PATH = "/var/www/discover-gozo/backend"
$PM2_SERVICE = "discover-gozo-api"

# Navigate to project root (adjust path if needed)
cd D:\DEV\00-Construction-00\MILESTONE\Discover-Gozo.com

Write-Host "📤 Uploading backend files..." -ForegroundColor Cyan

# Upload files
scp -i $SSH_KEY backend/database.js ${SERVER}:${BACKEND_PATH}/database.js
scp -i $SSH_KEY backend/routes/events.js ${SERVER}:${BACKEND_PATH}/routes/events.js
scp -i $SSH_KEY backend/public/admin.html ${SERVER}:${BACKEND_PATH}/public/admin.html
scp -i $SSH_KEY backend/public/admin.js ${SERVER}:${BACKEND_PATH}/public/admin.js

Write-Host "✅ Files uploaded!" -ForegroundColor Green
Write-Host "🔄 Restarting backend service..." -ForegroundColor Cyan

# Restart service
ssh -i $SSH_KEY $SERVER "pm2 restart $PM2_SERVICE"

Write-Host "✅ Backend restarted!" -ForegroundColor Green
Write-Host "📋 Checking logs..." -ForegroundColor Cyan

# Verify migration
ssh -i $SSH_KEY $SERVER "pm2 logs $PM2_SERVICE --lines 30 --nostream | grep -i 'category\|migration\|database'"

Write-Host "✅ Done! Check the logs above to verify migration ran." -ForegroundColor Green
```

---

## Files Modified

The following backend files need to be updated on your server:

1. **`backend/database.js`** - Added category column migration for events table
2. **`backend/routes/events.js`** - Updated to handle event category field
3. **`backend/public/admin.html`** - Added category dropdown to event form
4. **`backend/public/admin.js`** - Updated to populate category when editing events

## Option 1: Using SCP (Recommended)

### Windows (PowerShell or Git Bash)

```powershell
# Set your server details
$SERVER_USER = "your-username"
$SERVER_HOST = "your-server.com"
$BACKEND_PATH = "/var/www/discovergozo-backend"

# Upload files
scp backend/database.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/database.js
scp backend/routes/events.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/routes/events.js
scp backend/public/admin.html ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/public/admin.html
scp backend/public/admin.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/public/admin.js
```

### Linux/Mac

```bash
# Set your server details
SERVER_USER="your-username"
SERVER_HOST="your-server.com"
BACKEND_PATH="/var/www/discovergozo-backend"

# Upload files
scp backend/database.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/database.js
scp backend/routes/events.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/routes/events.js
scp backend/public/admin.html ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/public/admin.html
scp backend/public/admin.js ${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/public/admin.js
```

Or use the provided script:
```bash
chmod +x update-backend-files.sh
./update-backend-files.sh your-username your-server.com /var/www/discovergozo-backend
```

## Option 2: Manual Upload via SFTP

1. Connect to your server using an SFTP client (FileZilla, WinSCP, etc.)
2. Navigate to your backend directory (e.g., `/var/www/discovergozo-backend`)
3. Upload these files:
   - `backend/database.js` → `database.js`
   - `backend/routes/events.js` → `routes/events.js`
   - `backend/public/admin.html` → `public/admin.html`
   - `backend/public/admin.js` → `public/admin.js`

## Option 3: Direct Server Edit (Not Recommended)

If you have direct server access, you can edit the files directly on the server.

## After Uploading

### 1. SSH into your server:
```bash
ssh your-username@your-server.com
```

### 2. Navigate to backend directory:
```bash
cd /var/www/discovergozo-backend
```

### 3. Restart the backend service:

**If using PM2:**
```bash
pm2 restart discovergozo-backend
# or
pm2 restart all
```

**If using systemd:**
```bash
sudo systemctl restart discovergozo-backend
```

**If running directly with node:**
```bash
# Stop the current process (Ctrl+C) and restart:
node server.js
```

### 4. Verify the update:

The database migration will run automatically when the server starts. You should see a log message:
```
Adding category column to events table...
```

### 5. Test the changes:

1. Go to your admin dashboard: `https://api.discover-gozo.com/admin.html`
2. Try creating or editing an event
3. You should see the "Event Category" dropdown with these options:
   - Culture & Heritage
   - Music & Festivals
   - Food & Drink
   - Outdoors & Adventure
   - Family, Arts & Wellness

## Verification

After restarting, check the server logs to confirm:
- Database migration ran successfully
- No errors occurred
- The server is running properly

```bash
# If using PM2:
pm2 logs discovergozo-backend

# If using systemd:
sudo journalctl -u discovergozo-backend -f
```

## Troubleshooting

### If the category column already exists:
The migration script checks if the column exists before adding it, so it's safe to run multiple times.

### If you get permission errors:
Make sure the files have the correct permissions:
```bash
chmod 644 database.js routes/events.js public/admin.html public/admin.js
```

### If the server won't start:
Check the logs for errors and verify all files were uploaded correctly.

## Notes

- The database migration is **safe** - it only adds the column if it doesn't exist
- Existing events will have `NULL` category until you update them
- The frontend will work with or without categories (category is optional)
- All changes are backward compatible

