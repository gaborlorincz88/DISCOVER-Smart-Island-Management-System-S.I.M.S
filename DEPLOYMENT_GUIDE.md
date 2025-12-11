# 🚀 Discover Gozo - Deployment Guide

## Overview

The Discover Gozo application now includes a production-ready deployment configuration system that allows master admins to configure frontend and backend connection settings through an admin interface.

## Architecture

### Current Setup

**Backend:**
- **Port 3002 (HTTPS)** - Primary production port with SSL/TLS
- **Port 3003 (HTTP)** - Development and fallback port

**Frontend:**
- **Port 5173 (HTTPS)** - Vite development server
- Connects to backend via dynamically configured API URL

### Key Features

✅ **Dynamic Configuration** - Configure URLs without code changes  
✅ **Multiple Environments** - Support for development, staging, and production  
✅ **CORS Management** - Centralized CORS origin configuration  
✅ **Admin Interface** - Easy-to-use web UI for configuration  
✅ **Secure Logging** - All configuration changes are logged  
✅ **Production Ready** - Optimized for server deployment  

---

## 🔧 Configuration Files

### Backend Configuration
**File:** `backend/config/deployment.json`

```json
{
  "backend": {
    "protocol": "http",
    "host": "localhost",
    "port": 3003,
    "httpsPort": 3002,
    "publicUrl": "",
    "useHttps": false
  },
  "frontend": {
    "protocol": "https",
    "host": "localhost",
    "port": 5173,
    "publicUrl": ""
  },
  "cors": {
    "allowedOrigins": [
      "https://localhost:5173",
      "http://localhost:5173"
    ]
  },
  "environment": "development"
}
```

### Configuration Options

| Field | Description | Example |
|-------|-------------|---------|
| `backend.protocol` | HTTP or HTTPS | `"https"` |
| `backend.host` | Server hostname or IP | `"api.discovergozo.com"` |
| `backend.port` | HTTP port number | `3003` |
| `backend.httpsPort` | HTTPS port number | `3002` |
| `backend.publicUrl` | Full public URL (overrides protocol/host/port) | `"https://api.discovergozo.com"` |
| `backend.useHttps` | Use HTTPS by default | `true` |
| `frontend.publicUrl` | Full frontend URL for production | `"https://discovergozo.com"` |
| `cors.allowedOrigins` | Array of allowed CORS origins | `["https://discovergozo.com"]` |
| `environment` | Environment type | `"development"`, `"staging"`, or `"production"` |

---

## 📋 Deployment Steps

### 1. Development Environment (Current Setup)

**Backend:**
```bash
cd backend
npm install
node server.js
```
- Runs on: `http://localhost:3003` (HTTP) and `https://localhost:3002` (HTTPS)

**Frontend:**
```bash
npm install
npm run dev
```
- Runs on: `https://localhost:5173`

**Configuration:**
- Environment: `development`
- Backend: `http://localhost:3003`
- Frontend: `https://localhost:5173`
- CORS: Both localhost URLs allowed

### 2. Production Deployment

#### Step 1: Build the Frontend
```bash
npm run build
```
This creates optimized production files in the `dist/` directory.

#### Step 2: Configure Deployment Settings

**Option A: Using Admin Interface** (Recommended)
1. Navigate to: `http://localhost:3003/admin.html`
2. Go to **Admin Tools** (enter master password)
3. Click **Deployment Configuration**
4. Update settings:
   - Set `Environment` to **Production**
   - Set `Backend Public URL` to your server URL (e.g., `https://api.discovergozo.com`)
   - Set `Frontend Public URL` to your frontend URL (e.g., `https://discovergozo.com`)
   - Add your production domain to CORS origins
5. Click **Save Configuration**

**Option B: Manual Configuration**
Edit `backend/config/deployment.json`:
```json
{
  "backend": {
    "protocol": "https",
    "host": "your-server-ip",
    "port": 3003,
    "httpsPort": 3002,
    "publicUrl": "https://api.discovergozo.com",
    "useHttps": true
  },
  "frontend": {
    "protocol": "https",
    "host": "your-domain.com",
    "port": 443,
    "publicUrl": "https://discovergozo.com"
  },
  "cors": {
    "allowedOrigins": [
      "https://discovergozo.com",
      "https://www.discovergozo.com"
    ]
  },
  "environment": "production"
}
```

#### Step 3: Deploy to Server

**Backend Deployment:**
```bash
# Copy backend files to server
scp -r backend/ user@your-server:/var/www/discovergozo-backend/

# SSH into server
ssh user@your-server

# Navigate to backend directory
cd /var/www/discovergozo-backend

# Install dependencies
npm install --production

# Start the server with PM2 (process manager)
pm2 start server.js --name discovergozo-backend
pm2 save
pm2 startup
```

**Frontend Deployment:**
```bash
# Copy built files to web server
scp -r dist/ user@your-server:/var/www/discovergozo-frontend/

# Or use the backend to serve the frontend
# The backend already serves the dist/ directory
```

#### Step 4: Configure Reverse Proxy (Optional)

**Nginx Configuration:**
```nginx
# Backend API
server {
    listen 443 ssl;
    server_name api.discovergozo.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 443 ssl;
    server_name discovergozo.com www.discovergozo.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/discovergozo-frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Step 5: Restart Services
```bash
# Restart backend
pm2 restart discovergozo-backend

# Restart Nginx (if using)
sudo systemctl restart nginx
```

---

## 🔍 Port Usage Summary

| Service | Protocol | Port | Purpose |
|---------|----------|------|---------|
| Backend | HTTPS | 3002 | Primary production port with SSL |
| Backend | HTTP | 3003 | Development/fallback port |
| Frontend (Dev) | HTTPS | 5173 | Vite development server |
| Frontend (Prod) | HTTPS | 443 | Production web server (via Nginx) |

**Recommendation:** In production, use a single backend port (3002 for HTTPS) and route all traffic through it. The HTTP port (3003) can be disabled in production for security.

---

## 🔐 Security Considerations

1. **SSL/TLS Certificates**
   - Use valid SSL certificates in production (Let's Encrypt recommended)
   - Update certificate paths in `backend/certs/`

2. **CORS Configuration**
   - Only allow trusted domains in `cors.allowedOrigins`
   - Remove localhost origins in production

3. **Environment Variables**
   - Consider using environment variables for sensitive data
   - Keep `deployment.json` secure with proper file permissions

4. **Admin Access**
   - Protect admin panel with strong authentication
   - Restrict access to deployment configuration
   - Monitor admin activity logs

---

## 🧪 Testing

### Test Connection
1. Go to **Deployment Configuration** page
2. Click **Test Connection** button
3. Verify successful response

### Verify Configuration
Check current settings:
```bash
curl http://localhost:3003/api/deployment/public-config
```

Expected response:
```json
{
  "success": true,
  "backendUrl": "http://localhost:3003",
  "environment": "development"
}
```

---

## 📊 Monitoring

### Server Status
The deployment page shows real-time status:
- Backend URL
- Frontend URL
- Server Uptime
- Memory Usage
- Environment

### Admin Logs
All configuration changes are logged in:
- Database: `admin_logs` table
- Secure logs: `backend/logs/secure/`

---

## 🚨 Troubleshooting

### Issue: CORS Errors
**Symptom:** Frontend cannot connect to backend, CORS errors in console

**Solution:**
1. Check `cors.allowedOrigins` in deployment config
2. Ensure frontend URL is in the allowed origins list
3. Restart backend after changing CORS settings

### Issue: 404 Not Found
**Symptom:** API endpoints return 404

**Solution:**
1. Verify backend URL is correct
2. Check that backend server is running
3. Test connection using deployment page

### Issue: Configuration Not Applied
**Symptom:** Changes to deployment config don't take effect

**Solution:**
1. Configuration changes require server restart
2. Restart backend: `pm2 restart discovergozo-backend`
3. Clear browser cache and reload frontend

### Issue: Can't Access Deployment Page
**Symptom:** 401 Unauthorized when accessing deployment page

**Solution:**
1. You must be logged in as admin
2. Admin Tools section requires master password
3. Check admin session is valid

---

## 📝 Best Practices

1. ✅ **Use HTTPS in Production** - Always use SSL/TLS for secure communication
2. ✅ **Test in Staging First** - Test configuration changes in staging before production
3. ✅ **Monitor Logs** - Regularly check admin logs for configuration changes
4. ✅ **Backup Configuration** - Keep backups of `deployment.json`
5. ✅ **Document Changes** - Document any custom deployment configurations
6. ✅ **Use Process Manager** - Use PM2 or similar for production deployments
7. ✅ **Set Up Monitoring** - Monitor server health and uptime

---

## 🆘 Support

For deployment issues or questions:
1. Check this guide thoroughly
2. Review admin activity logs
3. Test connection using deployment page
4. Check server logs: `pm2 logs discovergozo-backend`

---

## 📚 Additional Resources

- [Node.js Deployment Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt SSL](https://letsencrypt.org/getting-started/)

---

**Last Updated:** October 18, 2025  
**Version:** 1.0.0


