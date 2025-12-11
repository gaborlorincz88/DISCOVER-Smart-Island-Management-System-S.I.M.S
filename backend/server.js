/**
 * © 2025 Lőrincz Gábor – All Rights Reserved
 * Unauthorized copying or use is strictly prohibited.
 */

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression'); // Add gzip compression
require('dotenv').config(); // Add this line at the top

const placesRouter = require('./routes/places');
const eventsRouter = require('./routes/events'); // Import the events router
const ttsRouter = require('./routes/tts'); // Import the TTS router
const tilesRouter = require('./routes/tiles');
const adminRouter = require('./routes/admin');
const busRoutesRouter = require('./routes/busRoutes');
const analyticsRouter = require('./routes/analytics'); // Import the analytics router
const toursAnalyticsRouter = require('./routes/toursAnalytics'); // Import the tours analytics router
const hikingTrailsRouter = require('./routes/hikingTrails'); // Import the hiking trails router
const routesRouter = require('./routes/routes'); // Import the generic routes router
const toursRouter = require('./routes/tours'); // Import the tours router
const tripsRouter = require('./routes/trips'); // Import the trips router
const authRouter = require('./routes/auth'); // Import the auth router
const merchantRouter = require('./routes/merchant'); // Import the merchant router
const weatherRouter = require('./routes/weather'); // Import the weather router
const userAlarmsRouter = require('./routes/user-alarms'); // Import the user alarms router
const reviewsRouter = require('./routes/reviews'); // Import the reviews router
const adminAuthRouter = require('./routes/admin-auth'); // Import the admin auth router
const secureLogsRouter = require('./routes/secure-logs'); // Import the secure logs router
const deploymentRouter = require('./routes/deployment'); // Import the deployment router
const kmlImportRouter = require('./routes/kml-import'); // Import the KML import router
const imageGalleryRouter = require('./routes/image-gallery'); // Import the image gallery router
const galleryManagerRouter = require('./routes/gallery-manager'); // Import the gallery manager router
const headerSettingsRouter = require('./routes/header-settings'); // Import header settings router
const reportsRouter = require('./routes/reports'); // Import the reports router
const treasureHuntsRouter = require('./routes/treasure-hunts'); // Import the treasure hunts router
const aisRouter = require('./routes/ais'); // Import the AIS router
const aisService = require('./services/aisService'); // Import the AIS service
const aisWebSocketServer = require('./services/aisWebSocketServer'); // Import the AIS WebSocket server
const iconPushMiddleware = require('./middleware/iconPush'); // Import the icon push middleware
const { imageOptimizer } = require('./middleware/imageOptimizer'); // Import the image optimization middleware
const cleanupService = require('./services/alarmCleanupService'); // Import the alarm cleanup service
const { cleanupExpiredSessions } = require('./middleware/admin-auth'); // Import session cleanup
const deploymentConfig = require('./services/deploymentConfig'); // Import deployment configuration
const reportScheduler = require('./services/reportScheduler'); // Import the report scheduler

const app = express();
const PORT = Number(process.env.PORT) || 3002;

// Load deployment configuration on startup
deploymentConfig.loadConfig().then(() => {
  console.log('✅ Deployment configuration initialized');
}).catch(err => {
  console.error('⚠️ Error loading deployment config:', err);
});

// Custom CORS middleware with dynamic origins from deployment config
app.use((req, res, next) => {
  const normalizeOrigin = (value) =>
    value ? value.trim().replace(/\/$/, '') : value;

  const requestOriginRaw = req.headers.origin;
  const requestOrigin = normalizeOrigin(requestOriginRaw);

  const allowedOrigins = new Set(
    [
      ...(deploymentConfig.getCorsOrigins() || []),
      deploymentConfig.getBackendUrl(),
      'https://discover-gozo.com',
      'https://www.discover-gozo.com',
      'http://localhost:3003',
      'https://localhost:3002'
    ]
      .filter(Boolean)
      .map(normalizeOrigin)
  );

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
    const effectiveOrigin = requestOriginRaw || 'https://discover-gozo.com';
    console.log('[CORS] Allowing origin:', effectiveOrigin);
    res.header('Access-Control-Allow-Origin', effectiveOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');

    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
  } else if (requestOriginRaw) {
    console.warn('[CORS] Blocked origin:', requestOriginRaw, 'Allowed list:', Array.from(allowedOrigins));
    if (req.method === 'OPTIONS') {
      return res.status(403).send('CORS origin denied');
    }
  }

  next();
});

// Enable gzip compression for all responses
app.use(compression({
  // Compress responses with these MIME types
  filter: (req, res) => {
    // Don't compress SSE streams (text/event-stream)
    if (req.path === '/api/ais/stream' || res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    // Don't compress if client doesn't support gzip
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression for all text-based content and JSON
    return compression.filter(req, res);
  },
  // Compression level (1-9, 6 is default)
  level: 6,
  // Threshold for compression (bytes)
  threshold: 1024, // Compress files larger than 1KB
  // Memory level (1-9, 8 is default)
  memLevel: 8
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for importing places
app.use(cookieParser()); // Add cookie parser for session management

// Note: Image optimization middleware is applied in individual routes after file uploads

// Apply icon push middleware early for main page requests
app.use(iconPushMiddleware);

// API Routes - These should come before static file handlers for the frontend
app.use('/api/admin-auth', adminAuthRouter); // Admin authentication routes (no auth required)
app.use('/api/secure-logs', secureLogsRouter); // Secure logs routes (admin auth required)
app.use('/api/deployment', deploymentRouter); // Deployment configuration routes (admin auth required)
app.use('/api/kml-import', kmlImportRouter); // KML import routes (admin auth required)
app.use('/api/image-gallery', imageGalleryRouter); // Image gallery routes (admin auth required)
app.use('/api/gallery-manager', galleryManagerRouter); // Gallery manager routes (admin auth required)
app.use('/api/places', placesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/bus-routes', busRoutesRouter);
app.use('/api/analytics', analyticsRouter); // Use the analytics router
app.use('/api/analytics', toursAnalyticsRouter); // Use the tours analytics router (merchants, tours endpoints)
app.use('/api/hiking-trails', hikingTrailsRouter); // Use the hiking trails router
app.use('/api/routes', routesRouter); // Use the generic routes router
app.use('/api', toursRouter); // Use the tours router
app.use('/api/trips', tripsRouter); // Use the trips router
app.use('/api/auth', authRouter); // Use the auth router
app.use('/api/merchant', merchantRouter); // Use the merchant router
app.use('/api/weather', weatherRouter); // Use the weather router
app.use('/api/user-alarms', userAlarmsRouter); // Use the user alarms router
app.use('/api/reviews', reviewsRouter); // Use the reviews router
app.use('/api/settings', headerSettingsRouter); // Header/Menu settings
app.use('/api/reports', reportsRouter); // Use the reports router
app.use('/api/treasure-hunts', treasureHuntsRouter); // Use the treasure hunts router
app.use('/api/ais', aisRouter); // Use the AIS router

// Image proxy route
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Image URL is required.');
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Set appropriate headers for image content
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for a year
    response.body.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).send('Failed to proxy image.');
  }
});
app.use('/tiles', tilesRouter);

// CRITICAL: Custom handler for image files in /uploads to ensure CORS headers are ALWAYS set
// Use a wildcard pattern that Express understands
app.get(/^\/uploads\/.+/, (req, res, next) => {
  const relativePath = req.path.replace('/uploads/', '');
  const filePath = path.join(__dirname, 'uploads', relativePath);
  const isImageFile = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(filePath);

  // Only handle image files, let other files fall through to express.static
  if (!isImageFile) {
    return next();
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next();
  }

  // Get origin from headers
  let origin = req.headers.origin;

  // If no Origin header, try Referer (common for <img> tags)
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {
      // Invalid referer, ignore
    }
  }

  // Always allow frontend origin for cross-origin image loading
  const frontendUrl = deploymentConfig.getFrontendUrl() || 'https://discover-gozo.com';
  const allowedOrigins = [
    ...(deploymentConfig.getCorsOrigins() || []),
    'https://discover-gozo.com',
    'https://www.discover-gozo.com',
    'http://discover-gozo.com',
    'http://www.discover-gozo.com',
    frontendUrl
  ];

  // Set allow origin - use frontend URL if no origin header (for <img> tags)
  const allowOrigin = (origin && allowedOrigins.includes(origin)) ? origin : frontendUrl;

  // CRITICAL: Set CORS headers BEFORE sending the file
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '31536000');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year, immutable
  res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());

  const varyHeaders = ['Accept-Encoding'];
  if (origin) {
    varyHeaders.push('Origin');
  }
  res.setHeader('Vary', varyHeaders.join(', '));

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  // Send the file with headers already set
  res.sendFile(path.resolve(filePath));
});

// CRITICAL: Custom handler for image files in public folder (like satelite.png) to ensure CORS headers are ALWAYS set
app.get('/*', (req, res, next) => {
  // Skip if it's an API route, uploads route, or admin route
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/admin') || req.path.startsWith('/tiles')) {
    return next();
  }

  const filePath = path.join(__dirname, 'public', req.path);
  const isImageFile = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(req.path);

  // Only handle image files, let other files fall through to express.static
  if (!isImageFile) {
    return next();
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next();
  }

  // Get origin from headers
  let origin = req.headers.origin;

  // If no Origin header, try Referer (common for <img> tags)
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {
      // Invalid referer, ignore
    }
  }

  // Always allow frontend origin for cross-origin image loading
  const frontendUrl = deploymentConfig.getFrontendUrl() || 'https://discover-gozo.com';
  const allowedOrigins = [
    ...(deploymentConfig.getCorsOrigins() || []),
    'https://discover-gozo.com',
    'https://www.discover-gozo.com',
    'http://discover-gozo.com',
    'http://www.discover-gozo.com',
    frontendUrl
  ];

  // Set allow origin - use frontend URL if no origin header (for <img> tags)
  const allowOrigin = (origin && allowedOrigins.includes(origin)) ? origin : frontendUrl;

  // CRITICAL: Set CORS headers BEFORE sending the file
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '31536000');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());

  const varyHeaders = ['Accept-Encoding'];
  if (origin) {
    varyHeaders.push('Origin');
  }
  res.setHeader('Vary', varyHeaders.join(', '));

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  // Send the file with headers already set
  res.sendFile(path.resolve(filePath));
});

// Serve static assets (e.g., images, admin UI) with compression
app.use(express.static(path.join(__dirname, 'public'), {
  // Enable compression for static files
  setHeaders: (res, path) => {
    // Set cache headers for better performance
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    } else if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }

    // Add CORS headers for images and other static assets
    const isImage = path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i);
    if (isImage) {
      // Get origin from Origin header (standard for CORS requests)
      let origin = res.req.headers.origin;

      // If no Origin header, try to get it from Referer header (common for <img> tags)
      if (!origin && res.req.headers.referer) {
        try {
          const refererUrl = new URL(res.req.headers.referer);
          origin = refererUrl.origin;
        } catch (e) {
          // Invalid referer URL, ignore
        }
      }

      const allowedOrigins = new Set([
        ...(deploymentConfig.getCorsOrigins() || []),
        deploymentConfig.getBackendUrl(),
        'http://localhost:3003',
        'https://localhost:3002',
        'https://discover-gozo.com',
        'https://www.discover-gozo.com',
        'http://discover-gozo.com',
        'http://www.discover-gozo.com'
      ]);

      let allowOrigin = null;

      // Check if origin is allowed
      if (origin && allowedOrigins.has(origin)) {
        allowOrigin = origin;
      } else {
        // Default to frontend URL if origin not found or not allowed
        allowOrigin = deploymentConfig.getFrontendUrl() || 'https://discover-gozo.com';
      }

      // Always set CORS headers for images
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Max-Age', '31536000'); // Cache preflight for 1 year
    }
  }
}));
app.use('/admin', express.static(path.join(__dirname, 'public'))); // Keeps /admin/admin.html working

// Serve logo file
app.get('/logo.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(__dirname, 'discovergozologo.png'));
});

// Serve uploads with compression and MOBILE-SPECIFIC AGGRESSIVE caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y', // Cache for 1 year
  immutable: true, // Mark as immutable for better caching
  etag: true, // Enable ETags for better mobile cache validation
  lastModified: true, // Enable Last-Modified headers
  setHeaders: (res, path) => {
    // ULTRA-AGGRESSIVE caching for uploaded images - MOBILE SPECIFIC
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year, immutable

    // For image requests, always set CORS headers to allow cross-origin access
    const isImageFile = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(path);

    if (isImageFile) {
      // Get origin from Origin header (standard for CORS requests)
      let origin = res.req.headers.origin;

      // If no Origin header, try to get it from Referer header (common for <img> tags)
      if (!origin && res.req.headers.referer) {
        try {
          const refererUrl = new URL(res.req.headers.referer);
          origin = refererUrl.origin;
        } catch (e) {
          // Invalid referer URL, ignore
        }
      }

      const allowedOrigins = new Set([
        ...(deploymentConfig.getCorsOrigins() || []),
        deploymentConfig.getBackendUrl(),
        'http://localhost:3003',
        'https://localhost:3002',
        'https://discover-gozo.com',
        'https://www.discover-gozo.com',
        'http://discover-gozo.com',
        'http://www.discover-gozo.com'
      ]);

      let allowOrigin = null;

      // For images, always allow the frontend origin (cross-origin image loading)
      // Check if origin is in allowed list, otherwise default to frontend
      if (origin && allowedOrigins.has(origin)) {
        allowOrigin = origin;
      } else {
        // Default to frontend URL for cross-origin image requests
        allowOrigin = deploymentConfig.getFrontendUrl() || 'https://discover-gozo.com';
      }

      // CRITICAL: Always set CORS headers for images BEFORE sending the file
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Max-Age', '31536000'); // Cache preflight for 1 year

      const varyHeaders = ['Accept-Encoding'];
      if (origin) {
        varyHeaders.push('Origin');
      }
      res.setHeader('Vary', varyHeaders.join(', '));
    }

    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()); // Set explicit expiry

    // For icons specifically, add even more aggressive caching with mobile-specific headers
    if (path.includes('icon') || path.includes('optimized')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400');
      res.setHeader('Pragma', 'public'); // HTTP 1.0 cache support
      res.setHeader('X-Content-Duration', '31536000'); // Tell mobile browsers to cache aggressively
    }
  }
}));

// Force no-cache for user-alarms.html
app.get('/user-alarms.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public/user-alarms.html'));
});

// Force no-cache for header-editor.html and header-editor.js
app.get('/header-editor.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public/header-editor.html'));
});

app.get('/header-editor.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public/header-editor.js'));
});

// Protected route for deployment.html - requires admin authentication
app.get('/deployment.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public/deployment.html'));
});

// Serve the main frontend application's static files with compression support
app.use(express.static(path.join(__dirname, '../dist'), {
  setHeaders: (res, path) => {
    // Set cache headers for frontend assets
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    } else if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
    res.setHeader('Vary', 'Accept-Encoding'); // Tell CDNs to cache different versions

    // Add CORS headers for images
    const isImage = path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i);
    if (isImage) {
      const origin = res.req.headers.origin;
      const allowedOrigins = new Set([
        ...(deploymentConfig.getCorsOrigins() || []),
        deploymentConfig.getBackendUrl(),
        'http://localhost:3003',
        'https://localhost:3002',
        'https://discover-gozo.com',
        'https://www.discover-gozo.com',
        'http://discover-gozo.com',
        'http://www.discover-gozo.com'
      ]);

      let allowOrigin = null;
      if (origin && allowedOrigins.has(origin)) {
        allowOrigin = origin;
      } else {
        const frontendUrl = deploymentConfig.getFrontendUrl() || 'https://discover-gozo.com';
        allowOrigin = frontendUrl;
      }

      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
  }
}));

// Serve compressed files if available (gzip and brotli)
app.get('*', (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const filePath = path.join(__dirname, '../dist', req.path);

  // Check for brotli compressed file first (better compression)
  if (acceptEncoding.includes('br') && fs.existsSync(filePath + '.br')) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Content-Type', getContentType(req.path));
    res.sendFile(filePath + '.br');
    return;
  }

  // Check for gzip compressed file
  if (acceptEncoding.includes('gzip') && fs.existsSync(filePath + '.gz')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Type', getContentType(req.path));
    res.sendFile(filePath + '.gz');
    return;
  }

  next();
});

// Helper function to get content type
function getContentType(filePath) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return types[ext] || 'application/octet-stream';
}

// The "catchall" handler: for any other request, send back React's index.html file.
// This is essential for client-side routing to work.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
};

// Start HTTPS server
const httpsServer = https.createServer(httpsOptions, app);

httpsServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS Server is running on https://0.0.0.0:${PORT}`);

  // Initialize AIS WebSocket server (must be after listen)
  // The WebSocket server will handle upgrades automatically
  aisWebSocketServer.initialize(httpsServer);

  // Start the alarm cleanup service
  cleanupService.startScheduler();

  // Initialize AIS service
  aisService.initialize().catch(err => {
    console.error('Error initializing AIS service:', err);
  });

  // Start session cleanup (runs every hour)
  setInterval(() => {
    cleanupExpiredSessions();
  }, 60 * 60 * 1000);

  // Start report scheduler
  // Scheduler is now controlled via the UI - don't auto-start
  // reportScheduler.start();
  console.log('✅ Report scheduler started');
  console.log('🔐 Admin session cleanup scheduler started');
});

// Start HTTP server for localhost development
const HTTP_PORT = PORT + 1; // Use next port for HTTP
const httpServer = http.createServer(app);

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP Server is running on http://0.0.0.0:${HTTP_PORT}`);

  // Initialize AIS WebSocket server for HTTP (development)
  // Note: Only one WebSocket server can be active, so this is for dev only
  // In production, only HTTPS server is used
  if (process.env.NODE_ENV !== 'production') {
    aisWebSocketServer.initialize(httpServer);
  }

  // Start the alarm cleanup service (only once)
  if (!cleanupService.isRunning) {
    cleanupService.startScheduler();
  }

  // AIS service is already initialized in HTTPS server block above
  // Don't initialize again to avoid duplicate connections
});
