# Deployment Configuration

This directory contains the deployment configuration for the Discover Gozo application.

## Files

- `deployment.json` - Main deployment configuration file

## Configuration Structure

```json
{
  "backend": {
    "protocol": "http",          // Protocol (http or https)
    "host": "localhost",          // Host name or IP
    "port": 3003,                 // HTTP port
    "httpsPort": 3002,            // HTTPS port
    "publicUrl": "",              // Full public URL (overrides protocol/host/port in production)
    "useHttps": false             // Whether to use HTTPS by default
  },
  "frontend": {
    "protocol": "https",          // Protocol
    "host": "localhost",          // Host name
    "port": 5173,                 // Port (Vite dev server default)
    "publicUrl": ""               // Full public URL for production
  },
  "cors": {
    "allowedOrigins": [           // List of allowed CORS origins
      "https://localhost:5173",
      "http://localhost:5173"
    ]
  },
  "environment": "development"    // Environment: development, staging, or production
}
```

## Usage

### Development
- Use `localhost` for both backend and frontend
- Frontend runs on port 5173 (Vite dev server)
- Backend runs on port 3003 (HTTP) and 3002 (HTTPS)

### Production
- Set `environment` to `production`
- Configure `publicUrl` for both backend and frontend
- Add production domain to `allowedOrigins`
- Restart the server after making changes

## Admin Interface

You can manage the deployment configuration through the admin interface:
1. Go to Admin Panel → Admin Tools (requires master password)
2. Click "Deployment Configuration"
3. Update settings as needed
4. Save and restart the server

## Security Notes

- The deployment configuration is stored in plaintext
- In production, consider using environment variables for sensitive data
- Restrict access to the admin panel with strong authentication
- The configuration file can be excluded from version control if needed


