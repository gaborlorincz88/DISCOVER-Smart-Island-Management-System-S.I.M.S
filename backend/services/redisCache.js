const Redis = require('ioredis');

// In-memory fallback cache
const memoryCache = new Map();
const memoryCacheTTL = new Map(); // Track TTL for memory cache entries

let redisClient = null;
let useRedis = false;

// Initialize Redis connection with fallback to in-memory cache
function initializeRedis() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || 6379;
  const redisPassword = process.env.REDIS_PASSWORD || null;
  const redisDb = process.env.REDIS_DB || 0;

  try {
    const redisOptions = {
      host: redisHost,
      port: redisPort,
      db: redisDb,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    if (redisPassword) {
      redisOptions.password = redisPassword;
    }

    redisClient = new Redis(redisOptions);

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
      useRedis = true;
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis connection error, falling back to in-memory cache:', err.message);
      useRedis = false;
    });

    redisClient.on('close', () => {
      console.warn('⚠️ Redis connection closed, falling back to in-memory cache');
      useRedis = false;
    });

    // Attempt to connect
    redisClient.connect().catch((err) => {
      console.warn('⚠️ Failed to connect to Redis, using in-memory cache:', err.message);
      useRedis = false;
    });
  } catch (error) {
    console.warn('⚠️ Redis initialization error, using in-memory cache:', error.message);
    useRedis = false;
  }
}

// Get value from cache (Redis or memory)
async function get(key) {
  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.warn(`[Cache] Redis get error for key ${key}, falling back to memory:`, error.message);
      useRedis = false;
    }
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached) {
    const ttl = memoryCacheTTL.get(key);
    if (ttl && Date.now() > ttl) {
      // Expired
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
      return null;
    }
    return cached;
  }
  return null;
}

// Set value in cache (Redis or memory)
async function set(key, value, ttlSeconds = 600) {
  const serialized = JSON.stringify(value);

  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      console.warn(`[Cache] Redis set error for key ${key}, falling back to memory:`, error.message);
      useRedis = false;
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, value);
  memoryCacheTTL.set(key, Date.now() + (ttlSeconds * 1000));
  return true;
}

// Delete value from cache
async function del(key) {
  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.warn(`[Cache] Redis del error for key ${key}, falling back to memory:`, error.message);
    }
  }

  // Also delete from memory cache
  memoryCache.delete(key);
  memoryCacheTTL.delete(key);
}

// Delete multiple keys matching pattern
async function delPattern(pattern) {
  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.warn(`[Cache] Redis delPattern error for pattern ${pattern}:`, error.message);
    }
  }

  // Also delete from memory cache
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    }
  }
}

// Clear all cache
async function clear() {
  if (useRedis && redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.flushdb();
    } catch (error) {
      console.warn('[Cache] Redis clear error:', error.message);
    }
  }

  memoryCache.clear();
  memoryCacheTTL.clear();
}

// Get cache stats
function getStats() {
  return {
    usingRedis: useRedis && redisClient && redisClient.status === 'ready',
    memoryCacheSize: memoryCache.size,
  };
}

// Cleanup expired memory cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, ttl] of memoryCacheTTL.entries()) {
    if (now > ttl) {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    }
  }
}, 60000); // Run every minute

// Initialize on module load
initializeRedis();

module.exports = {
  get,
  set,
  del,
  delPattern,
  clear,
  getStats,
  initializeRedis,
};


