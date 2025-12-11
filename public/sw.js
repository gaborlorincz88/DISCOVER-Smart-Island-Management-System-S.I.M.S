const CACHE_VERSION = 'v9'; // Updated to fix login endpoint and use network-first for JS/CSS
const CACHE_NAME = `discover-gozo-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `discover-gozo-static-${CACHE_VERSION}`;
const ICON_CACHE_NAME = `discover-gozo-icons-${CACHE_VERSION}`;
const TILES_CACHE_NAME = `discover-gozo-tiles-${CACHE_VERSION}`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Critical icons to cache immediately
const CRITICAL_ICONS = [
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  '/tours.svg'
];

// Assets to cache on first visit
const DYNAMIC_ASSETS = [
  '/tours.svg',
  '/locales/en/translation.json',
  '/locales/de/translation.json',
  '/locales/es/translation.json',
  '/locales/fr/translation.json',
  '/locales/it/translation.json'
];

// Install event - cache static assets and critical icons
self.addEventListener('install', (event) => {
  console.log('Service Worker installing v9...');
  event.waitUntil(
    Promise.all([
      // Clear old caches
      caches.delete('discover-gozo-tiles-v4'),
      caches.delete('discover-gozo-tiles-v3'),
      caches.delete('discover-gozo-tiles-v2'),
      caches.delete('discover-gozo-tiles-v1'),
      caches.open(ICON_CACHE_NAME).then(cache => {
        console.log('Caching critical icons');
        return cache.addAll(CRITICAL_ICONS);
      })
    ])
    .then(() => {
      console.log('Critical icons cached successfully');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('Failed to cache assets:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating v9...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete all old caches including tile caches
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME && 
                cacheName !== ICON_CACHE_NAME && cacheName !== TILES_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated v9 - all old caches cleared');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/tiles/')) {
    return; // Let the browser request tiles directly (served from R2)
  } else if (url.hostname.includes('r2.dev') || url.hostname.includes('r2.cloudflarestorage.com')) {
    return; // Allow cross-origin tile/icon requests (e.g. R2) to go directly to the network
  } else if (url.hostname.includes('flagcdn.com') || url.hostname.includes('flagsapi.com')) {
    return; // Allow external flag CDN requests to go directly to the network (bypass SW to avoid CORS issues)
  } else if (url.hostname.includes('api.discover-gozo.com')) {
    return; // Allow cross-origin API image requests to go directly to the network (bypass SW to avoid CORS/opaque response issues)
  } else if (url.pathname.startsWith('/uploads/') || url.pathname.includes('.png') || url.pathname.includes('.jpg') || url.pathname.includes('.svg')) {
    // Images and icons - use cache-first strategy with icon-specific handling (only for same-origin)
    event.respondWith(handleIconRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - use network-first strategy
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    // HTML files - use stale-while-revalidate to get updates without breaking
    event.respondWith(handleStaleWhileRevalidate(request, event));
  } else if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    // JS and CSS - use network-first to ensure latest version (prevents stale code issues)
    event.respondWith(handleNetworkFirstRequest(request));
  } else {
    // Other assets - use cache-first strategy
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle tile requests with cache-first strategy
async function handleTileRequest(request, event) {
  try {
    const tilesCache = await caches.open(TILES_CACHE_NAME);
    // Check cache first
    const cachedResponse = await tilesCache.match(request);
    if (cachedResponse) {
      // Trigger a background revalidation to keep cache fresh
      if (event) {
        event.waitUntil(
          fetch(request).then(resp => {
            if (resp && resp.ok) tilesCache.put(request, resp.clone());
          }).catch(() => {})
        );
      }
      return cachedResponse;
    }

    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the tile for future use
      tilesCache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Tile fetch failed:', error);
    // Return a placeholder or error response
    return new Response('Tile not available', { status: 404 });
  }
}

// Handle icon and image requests with ULTRA-AGGRESSIVE cache-first strategy
async function handleIconRequest(request) {
  try {
    // Check icon cache first - MULTIPLE CACHE CHECK
    const iconCache = await caches.open(ICON_CACHE_NAME);
    const cachedResponse = await iconCache.match(request);
    if (cachedResponse) {
      console.log('SW: Icon served from cache:', request.url);
      return cachedResponse;
    }

    // Check main cache
    const mainCache = await caches.open(CACHE_NAME);
    const mainCachedResponse = await mainCache.match(request);
    if (mainCachedResponse) {
      console.log('SW: Icon served from main cache:', request.url);
      return mainCachedResponse;
    }

    // If not in cache, fetch from network with aggressive caching headers
    // Only use 'cors' mode for same-origin requests to avoid opaque response issues
    const requestUrl = new URL(request.url);
    const isSameOrigin = requestUrl.hostname === self.location.hostname;
    
    // Skip cross-origin requests - they should be bypassed by the fetch handler
    if (!isSameOrigin) {
      console.warn('SW: Cross-origin image request should be bypassed:', request.url);
      return fetch(request);
    }
    
    const fetchOptions = {
      cache: 'force-cache', // Force browser to cache
      mode: 'cors' // Always use CORS for same-origin to avoid opaque responses
    };
    
    try {
      const networkResponse = await fetch(request, fetchOptions);
      
      // Only cache successful, non-opaque responses
      if (networkResponse.ok && networkResponse.type !== 'opaque') {
        // Create a response with aggressive cache headers
        const headers = new Headers(networkResponse.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Expires', new Date(Date.now() + 31536000000).toUTCString());
        
        const cachedResponse = new Response(networkResponse.body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: headers
        });
        
        // Cache the icon IMMEDIATELY in both caches
        if (request.url.includes('.svg') || request.url.includes('/icon-') || request.url.includes('/tours.svg') || request.url.includes('/uploads/')) {
          // Cache in icon cache
          await iconCache.put(request, cachedResponse.clone());
          console.log('SW: Icon cached in icon cache:', request.url);
        }
        
        // Also cache in main cache for redundancy
        await mainCache.put(request, cachedResponse.clone());
        console.log('SW: Icon cached in main cache:', request.url);
        
        return cachedResponse;
      }
      
      // If response is opaque or not ok, return it without caching
      return networkResponse;
    } catch (fetchError) {
      console.error('SW: Network fetch failed:', fetchError);
      // Don't cache failed requests - let the browser handle it
      throw fetchError;
    }
  } catch (error) {
    console.error('SW: Icon/Image fetch failed:', error);
    // Don't return error response - let the browser handle the original request
    // This prevents caching failed responses that could cause issues
    return fetch(request).catch(() => {
      // Last resort: return 404 only if fetch completely fails
      return new Response('Icon not available', { status: 404 });
    });
  }
}

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API fetch failed (offline):', request.url);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return empty JSON array for API endpoints when offline (prevents app from breaking)
    // The app will use IndexedDB cached data instead
    const url = new URL(request.url);
    if (url.pathname.includes('/api/')) {
      return new Response('[]', { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For other requests, return 503
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy: serve from cache immediately, update in background
async function handleStaleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Start fetching from network in the background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      // Update cache in the background
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.log('Background fetch failed:', error);
    return null;
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If nothing in cache, wait for network
  try {
    const networkResponse = await fetchPromise;
    if (networkResponse && networkResponse.ok) {
      return networkResponse;
    }
  } catch (error) {
    console.error('Network request failed:', error);
  }
  
  // Last resort for navigation: serve offline page
  if (request.mode === 'navigate') {
    const offlineResponse = await cache.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
  }
  
  return new Response('Resource not available', { status: 404 });
}

// Handle network-first requests (for JS/CSS to ensure latest version)
async function handleNetworkFirstRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the asset for offline use
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Network-first request failed:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Asset not available', { status: 404 });
  }
}

// Handle static asset requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the asset for future use
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Static asset fetch failed:', error);
    
    // Try to serve offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response('Asset not available', { status: 404 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Perform any background sync operations here
    console.log('Performing background sync...');
    
    // Example: Sync offline data, preload tiles, etc.
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from Discover Gozo',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Discover Gozo', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action) {
    // Handle specific action
    console.log('Action clicked:', event.action);
  } else {
    // Default click behavior - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(cacheUrls(event.data.urls));
  }
  
  if (event.data && event.data.type === 'CACHE_ICON') {
    event.waitUntil(cacheIcon(event.data.url));
  }
  
  if (event.data && event.data.type === 'CACHE_TILES') {
    event.waitUntil(cacheUrls(event.data.urls));
  }
});

// Cache multiple URLs
async function cacheUrls(urls) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const promises = urls.map(url => 
      fetch(url).then(response => {
        if (response.ok) {
          return cache.put(url, response);
        }
      }).catch(error => {
        console.warn('Failed to cache URL:', url, error);
      })
    );
    
    await Promise.all(promises);
    console.log('URLs cached successfully');
  } catch (error) {
    console.error('Failed to cache URLs:', error);
  }
}

// Cache a single icon
async function cacheIcon(url) {
  try {
    const iconCache = await caches.open(ICON_CACHE_NAME);
    const response = await fetch(url);
    
    if (response.ok) {
      await iconCache.put(url, response.clone());
      console.log(`Icon cached successfully: ${url}`);
    }
  } catch (error) {
    console.warn(`Failed to cache icon: ${url}`, error);
  }
}

