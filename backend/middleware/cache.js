const cache = require('../services/redisCache');

/**
 * Middleware to cache GET requests
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {function} keyGenerator - Optional function to generate cache key from request
 */
function cacheMiddleware(ttlSeconds = 600, keyGenerator = null) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `cache:${req.path}:${JSON.stringify(req.query)}`;

    try {
      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Cache miss - override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Only cache successful responses (status 200)
        if (res.statusCode === 200) {
          cache.set(cacheKey, data, ttlSeconds).catch(err => {
            console.warn('[Cache] Error setting cache:', err.message);
          });
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.warn('[Cache] Error in cache middleware:', error.message);
      next();
    }
  };
}

/**
 * Cache key generators for specific endpoints
 */
const keyGenerators = {
  placesLightweight: (req) => `places:lightweight:${JSON.stringify(req.query)}`,
  placeDetails: (req) => `place:${req.params.id}`,
  eventsLightweight: (req) => `events:lightweight:${JSON.stringify(req.query)}`,
  eventDetails: (req) => `event:${req.params.id}`,
  busRoutes: () => 'bus-routes:all',
  hikingTrails: () => 'hiking-trails:all',
};

/**
 * Pre-configured cache middlewares
 */
const cacheMiddlewares = {
  placesLightweight: cacheMiddleware(600, keyGenerators.placesLightweight), // 10 minutes
  placeDetails: cacheMiddleware(300, keyGenerators.placeDetails), // 5 minutes
  eventsLightweight: cacheMiddleware(600, keyGenerators.eventsLightweight), // 10 minutes
  eventDetails: cacheMiddleware(300, keyGenerators.eventDetails), // 5 minutes
  busRoutes: cacheMiddleware(1800, keyGenerators.busRoutes), // 30 minutes
  hikingTrails: cacheMiddleware(1800, keyGenerators.hikingTrails), // 30 minutes
};

module.exports = {
  cacheMiddleware,
  keyGenerators,
  cacheMiddlewares,
  cache, // Export cache service for manual cache operations
};


