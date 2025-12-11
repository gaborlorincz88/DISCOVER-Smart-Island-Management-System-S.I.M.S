const CACHE_VERSION = 'v4'; // Updated to force cache clear and fix tile issues
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
  console.log('Service Worker installing v4...');
  event.waitUntil(
    Promise.all([
      // Clear old tile caches to fix tile loading issues
      caches.delete('discover-gozo-tiles-v3'),
      caches.delete('discover-gozo-tiles-v2'),
      caches.delete('discover-gozo-tiles-v1'),
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(ICON_CACHE_NAME).then(cache => {
        console.log('Caching critical icons');
        return cache.addAll(CRITICAL_ICONS);
      })
    ])
    .then(() => {
      console.log('Static assets and critical icons cached successfully');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('Failed to cache assets:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating v4...');
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
        console.log('Service Worker activated - all old caches cleared');
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
    // Map tiles - completely bypass service worker to avoid caching issues
    console.log('SW: Bypassing service worker for tile request:', request.url);
    // Don't handle tile requests at all - let them go directly to the server
    return;
  } else if (url.pathname.startsWith('/uploads/categories/')) {
    // Category images - bypass service worker to avoid CORS/CORP caching issues
    // These images need fresh requests to ensure CORS headers are correct
    console.log('SW: Bypassing service worker for category image:', request.url);
    return;
  } else if (url.pathname.startsWith('/uploads/') || url.pathname.includes('.png') || url.pathname.includes('.jpg') || url.pathname.includes('.svg')) {
    // Images and icons - use cache-first strategy with icon-specific handling
    event.respondWith(handleIconRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - use network-first strategy
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.includes('category-editor') || url.pathname.includes('admin') || url.pathname.includes('.html') || (url.pathname.endsWith('.js') && (url.pathname.includes('admin') || url.pathname.includes('image-gallery-modal')))) {
    // Admin pages, HTML files, and admin JS files - always fetch from network (no caching)
    console.log('SW: Bypassing service worker for admin/JS file:', request.url);
    event.respondWith(fetch(request));
  } else {
    // Static assets - use cache-first strategy
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

// Handle icon and image requests with cache-first strategy
async function handleIconRequest(request) {
  try {
    // Check icon cache first
    const iconCache = await caches.open(ICON_CACHE_NAME);
    const cachedResponse = await iconCache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Check main cache
    const mainCache = await caches.open(CACHE_NAME);
    const mainCachedResponse = await mainCache.match(request);
    if (mainCachedResponse) {
      return mainCachedResponse;
    }

    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the icon in the appropriate cache
      if (request.url.includes('.svg') || request.url.includes('/icon-') || request.url.includes('/tours.svg')) {
        // Cache in icon cache
        iconCache.put(request, networkResponse.clone());
      } else {
        // Cache in main cache
        mainCache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Icon/Image fetch failed:', error);
    // Return a placeholder or error response
    return new Response('Icon not available', { status: 404 });
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
    console.error('API fetch failed:', error);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response('API not available offline', { status: 503 });
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





