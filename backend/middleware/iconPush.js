/**
 * HTTP/2 Server Push Middleware for Icons
 * This middleware automatically pushes critical icons when serving the main page
 */

const iconPushMiddleware = (req, res, next) => {
  // Only apply to main page requests
  if (req.path === '/' || req.path === '/index.html') {
    // Set Link headers for HTTP/2 server push
    const criticalIcons = [
      '/icon-192x192.png',
      '/icon-512x512.png',
      '/tours.svg'
    ];

    const linkHeaders = criticalIcons.map(icon => 
      `<${icon}>; rel=preload; as=image; type=${icon.endsWith('.svg') ? 'image/svg+xml' : 'image/png'}`
    ).join(', ');

    if (linkHeaders) {
      res.set('Link', linkHeaders);
    }

    // Add additional performance headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });
  }

  next();
};

module.exports = iconPushMiddleware;

