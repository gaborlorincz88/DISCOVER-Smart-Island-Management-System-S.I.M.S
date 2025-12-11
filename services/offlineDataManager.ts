import { getApiBaseUrl } from './config';

// Gozo island approximate bounds
const GOZO_BOUNDS = {
  north: 36.10,
  south: 35.95,
  east: 14.35,
  west: 14.15
};

// Zoom levels to cache (10-19 for detailed maps)
const MIN_ZOOM = 10;
const MAX_ZOOM = 19;

export interface DownloadProgress {
  total: number;
  downloaded: number;
  failed: number;
  currentTask: string;
  percentage: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Convert lat/lng to tile coordinates
 */
function deg2num(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Get all tile coordinates for a bounding box at a specific zoom level
 */
function getTilesForBounds(bounds: typeof GOZO_BOUNDS, zoom: number): Array<{ x: number; y: number; z: number }> {
  const topLeft = deg2num(bounds.north, bounds.west, zoom);
  const bottomRight = deg2num(bounds.south, bounds.east, zoom);
  
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
}

/**
 * Get all tile URLs for Gozo area
 */
export function getAllGozoTileUrls(): string[] {
  const apiBase = getApiBaseUrl();
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  
  // Generate tiles for all zoom levels
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    tiles.push(...getTilesForBounds(GOZO_BOUNDS, z));
  }
  
  // Convert to URLs
  return tiles.map(tile => `${apiBase}/tiles/gozo/${tile.z}/${tile.x}/${tile.y}.png`);
}

/**
 * Calculate total number of tiles
 */
export function getTotalTileCount(): number {
  let total = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const tiles = getTilesForBounds(GOZO_BOUNDS, z);
    total += tiles.length;
  }
  return total;
}

/**
 * Download and cache a single tile
 */
async function downloadTile(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      return false;
    }
    
    // Store in Service Worker cache
    const cache = await caches.open('discover-gozo-tiles-v6');
    await cache.put(url, response.clone());
    
    return true;
  } catch (error) {
    console.error('Failed to download tile:', url, error);
    return false;
  }
}

/**
 * Download all tiles with progress tracking
 */
export async function downloadAllTiles(
  onProgress?: ProgressCallback,
  batchSize: number = 10
): Promise<{ success: number; failed: number }> {
  const urls = getAllGozoTileUrls();
  const total = urls.length;
  let downloaded = 0;
  let failed = 0;
  
  // Process in batches to avoid overwhelming the browser
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    const results = await Promise.allSettled(
      batch.map(url => downloadTile(url))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        downloaded++;
      } else {
        failed++;
      }
    });
    
    if (onProgress) {
      const percentage = Math.round(((downloaded + failed) / total) * 100);
      onProgress({
        total,
        downloaded,
        failed,
        currentTask: `Downloading map tiles (zoom ${Math.floor((i / urls.length) * (MAX_ZOOM - MIN_ZOOM + 1)) + MIN_ZOOM})`,
        percentage
      });
    }
    
    // Small delay between batches to avoid overwhelming
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return { success: downloaded, failed };
}

/**
 * Cache places data in IndexedDB
 */
export async function cachePlacesData(places: any[]): Promise<boolean> {
  try {
    const dbName = 'DiscoverGozoOffline';
    const dbVersion = 1;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['places'], 'readwrite');
        const store = transaction.objectStore('places');
        
        // Clear existing data
        store.clear();
        
        // Add all places
        places.forEach((place, index) => {
          const placeWithId = { ...place, id: place.id || `place-${index}` };
          store.add(placeWithId);
        });
        
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('places')) {
          const store = db.createObjectStore('places', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };
    });
  } catch (error) {
    console.error('Failed to cache places data:', error);
    return false;
  }
}

/**
 * Check if offline data is already downloaded
 */
export async function isOfflineDataAvailable(): Promise<boolean> {
  try {
    // Check if tiles cache exists and has content
    const cache = await caches.open('discover-gozo-tiles-v6');
    const keys = await cache.keys();
    
    // If we have at least 100 tiles cached, consider it downloaded
    return keys.length >= 100;
  } catch (error) {
    return false;
  }
}

/**
 * Get cached places data from IndexedDB
 */
export async function getCachedPlacesData(): Promise<any[]> {
  try {
    const dbName = 'DiscoverGozoOffline';
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('places')) {
          resolve([]);
          return;
        }
        
        const transaction = db.transaction(['places'], 'readonly');
        const store = transaction.objectStore('places');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
    });
  } catch (error) {
    console.error('Failed to get cached places data:', error);
    return [];
  }
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  try {
    // Clear tile cache
    const cache = await caches.open('discover-gozo-tiles-v6');
    const keys = await cache.keys();
    await Promise.all(keys.map(key => cache.delete(key)));
    
    // Clear places data
    const dbName = 'DiscoverGozoOffline';
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains('places')) {
          const transaction = db.transaction(['places'], 'readwrite');
          const store = transaction.objectStore('places');
          store.clear();
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('Failed to clear offline data:', error);
  }
}

