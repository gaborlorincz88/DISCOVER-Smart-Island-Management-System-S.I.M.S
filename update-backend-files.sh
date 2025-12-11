#!/bin/bash

# Script to update backend files on the server
# Usage: ./update-backend-files.sh [server-user] [server-host] [backend-path]

SERVER_USER=${1:-"your-username"}
SERVER_HOST=${2:-"your-server.com"}
BACKEND_PATH=${3:-"/var/www/discovergozo-backend"}

echo "🚀 Updating backend files on server..."
echo "Server: ${SERVER_USER}@${SERVER_HOST}"
echo "Path: ${BACKEND_PATH}"
echo ""

# Files to update
FILES=(
    "backend/database.js"
    "backend/routes/events.js"
    "backend/public/admin.html"
    "backend/public/admin.js"
)

# Upload each file
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📤 Uploading $file..."
        scp "$file" "${SERVER_USER}@${SERVER_HOST}:${BACKEND_PATH}/${file#backend/}"
    else
        echo "❌ File not found: $file"
    fi
done

echo ""
echo "✅ Files uploaded successfully!"
echo ""
echo "📋 Next steps:"
echo "1. SSH into your server: ssh ${SERVER_USER}@${SERVER_HOST}"
echo "2. Navigate to backend: cd ${BACKEND_PATH}"
echo "3. Restart the backend service:"
echo "   pm2 restart discovergozo-backend"
echo "   OR"
echo "   systemctl restart discovergozo-backend"
echo ""
echo "The database migration will run automatically on next server start."



