
import { openDB, IDBPDatabase } from 'idb';
import { getTileBaseUrl } from './config';

const DB_NAME = 'tile-cache-db';
const STORE_NAME = 'tile-store';
const DB_VERSION = 2; // Increment version for new schema

interface TileCacheEntry {
  blob: Blob;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class TileManager {
    private dbPromise: Promise<IDBPDatabase<unknown>>;
    private memoryCache: Map<string, Blob> = new Map();
    private preloadQueue: Set<string> = new Set();
    private maxMemoryCacheSize = 1000; // Max tiles in memory
    private maxDiskCacheSize = 10000; // Max tiles on disk

    constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion) {
                if (oldVersion < 1) {
                    // Create initial store
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                }
                if (oldVersion < 2) {
                    // Add new store for metadata
                    if (!db.objectStoreNames.contains('tile-metadata')) {
                        const metadataStore = db.createObjectStore('tile-metadata', { keyPath: 'url' });
                        metadataStore.createIndex('timestamp', 'timestamp');
                        metadataStore.createIndex('accessCount', 'accessCount');
                        metadataStore.createIndex('lastAccessed', 'lastAccessed');
                    }
                }
            },
        });
    }

    async getTile(url: string): Promise<Blob> {
        // Check memory cache first (fastest)
        if (this.memoryCache.has(url)) {
            this.updateAccessStats(url);
            return this.memoryCache.get(url)!;
        }

        // Check IndexedDB cache
        const cachedTile = await this.getFromDiskCache(url);
        if (cachedTile) {
            // Move to memory cache for faster access
            this.addToMemoryCache(url, cachedTile);
            this.updateAccessStats(url);
            return cachedTile;
        }

        // Fetch and cache
        const tileBlob = await this._fetchAndCacheTile(url);
        this.addToMemoryCache(url, tileBlob);
        return tileBlob;
    }

    private async getFromDiskCache(url: string): Promise<Blob | null> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const tile = await store.get(url);
            return tile || null;
        } catch (error) {
            console.warn('Failed to read from disk cache:', error);
            return null;
        }
    }

    private async _fetchAndCacheTile(url: string): Promise<Blob> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch tile: ${response.statusText}`);
            }
            
            const tileBlob = await response.blob();
            
            // Cache to disk
            await this.addToDiskCache(url, tileBlob);
            
            // Preload adjacent tiles for better UX
            this.preloadAdjacentTiles(url);
            
            return tileBlob;
        } catch (error) {
            console.error(`Failed to fetch and cache tile: ${url}`, error);
            throw error;
        }
    }

    private async addToDiskCache(url: string, blob: Blob): Promise<void> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            await store.put(blob, url);
            
            // Add metadata
            const metadataStore = tx.objectStore('tile-metadata', 'readwrite');
            await metadataStore.put({
                url,
                timestamp: Date.now(),
                accessCount: 1,
                lastAccessed: Date.now(),
                size: blob.size
            });
            
            // Cleanup old tiles if cache is full
            await this.cleanupCache();
        } catch (error) {
            console.warn('Failed to write to disk cache:', error);
        }
    }

    private addToMemoryCache(url: string, blob: Blob): void {
        // Remove oldest tiles if memory cache is full
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }
        
        this.memoryCache.set(url, blob);
    }

    private async updateAccessStats(url: string): Promise<void> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('tile-metadata', 'readwrite');
            const store = tx.objectStore('tile-metadata');
            
            const metadata = await store.get(url);
            if (metadata) {
                metadata.accessCount++;
                metadata.lastAccessed = Date.now();
                await store.put(metadata);
            }
        } catch (error) {
            // Ignore metadata update errors
        }
    }

    private async cleanupCache(): Promise<void> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('tile-metadata', 'readwrite');
            const store = tx.objectStore('tile-metadata');
            
            // Get all metadata sorted by access count and last accessed
            const allMetadata = await store.getAll();
            if (allMetadata.length <= this.maxDiskCacheSize) return;
            
            // Sort by least accessed and oldest
            allMetadata.sort((a, b) => {
                if (a.accessCount !== b.accessCount) {
                    return a.accessCount - b.accessCount;
                }
                return a.lastAccessed - b.lastAccessed;
            });
            
            // Remove oldest/least used tiles
            const tilesToRemove = allMetadata.slice(0, allMetadata.length - this.maxDiskCacheSize);
            
            for (const metadata of tilesToRemove) {
                // Remove from metadata store
                await store.delete(metadata.url);
                
                // Remove from tile store
                const tileTx = db.transaction(STORE_NAME, 'readwrite');
                const tileStore = tileTx.objectStore(STORE_NAME);
                await tileStore.delete(metadata.url);
            }
        } catch (error) {
            console.warn('Cache cleanup failed:', error);
        }
    }

    private preloadAdjacentTiles(url: string): void {
        // Parse URL to get zoom, x, y coordinates
        const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
        if (!match) return;
        
        const [, z, x, y] = match;
        const zoom = parseInt(z);
        const tileX = parseInt(x);
        const tileY = parseInt(y);
        
        // Preload adjacent tiles (8 surrounding tiles)
        const adjacentCoords = [
            [tileX - 1, tileY - 1], [tileX, tileY - 1], [tileX + 1, tileY - 1],
            [tileX - 1, tileY], [tileX + 1, tileY],
            [tileX - 1, tileY + 1], [tileX, tileY + 1], [tileX + 1, tileY + 1]
        ];
        
        for (const [adjX, adjY] of adjacentCoords) {
            if (adjX >= 0 && adjY >= 0) {
                const adjacentUrl = url.replace(/\/(\d+)\/(\d+)\.png$/, `/${adjX}/${adjY}.png`);
                this.preloadTile(adjacentUrl);
            }
        }
    }

    private preloadTile(url: string): void {
        if (this.preloadQueue.has(url) || this.memoryCache.has(url)) return;
        
        this.preloadQueue.add(url);
        
        // Preload in background
        setTimeout(async () => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    await this.addToDiskCache(url, blob);
                }
            } catch (error) {
                // Ignore preload errors
            } finally {
                this.preloadQueue.delete(url);
            }
        }, 100); // Small delay to avoid blocking main thread
    }

    // Preload tiles for a specific area
    async preloadArea(region: string, zoom: number, centerX: number, centerY: number, radius: number = 2): Promise<void> {
        const tileBaseUrl = getTileBaseUrl();
        const baseUrl = `${tileBaseUrl}/${region}/${zoom}`;
        
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                if (x >= 0 && y >= 0) {
                    const url = `${baseUrl}/${x}/${y}.png`;
                    this.preloadTile(url);
                }
            }
        }
    }

    // Get cache statistics
    async getCacheStats(): Promise<{
        memoryCacheSize: number;
        diskCacheSize: number;
        totalSize: number;
    }> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('tile-metadata', 'readonly');
            const store = tx.objectStore('tile-metadata');
            const allMetadata = await store.getAll();
            
            const totalSize = allMetadata.reduce((sum, meta) => sum + (meta.size || 0), 0);
            
            return {
                memoryCacheSize: this.memoryCache.size,
                diskCacheSize: allMetadata.length,
                totalSize
            };
        } catch (error) {
            return {
                memoryCacheSize: this.memoryCache.size,
                diskCacheSize: 0,
                totalSize: 0
            };
        }
    }

    // Clear all caches
    async clearCache(): Promise<void> {
        this.memoryCache.clear();
        this.preloadQueue.clear();
        
        try {
            const db = await this.dbPromise;
            const tx = db.transaction([STORE_NAME, 'tile-metadata'], 'readwrite');
            await tx.objectStore(STORE_NAME).clear();
            await tx.objectStore('tile-metadata').clear();
        } catch (error) {
            console.warn('Failed to clear disk cache:', error);
        }
    }
}

export const tileManager = new TileManager();
