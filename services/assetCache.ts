import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'asset-cache-db';
const STORE_NAME = 'asset-store';
const DB_VERSION = 1;

interface AssetMetadata {
  url: string;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  type: string;
}

class AssetCache {
    private dbPromise: Promise<IDBPDatabase<unknown>>;
    private memoryCache: Map<string, Blob> = new Map();
    private maxMemoryCacheSize = 500; // Max assets in memory
    private maxDiskCacheSize = 5000; // Max assets on disk

    constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('accessCount', 'accessCount');
                    store.createIndex('lastAccessed', 'lastAccessed');
                    store.createIndex('type', 'type');
                }
            },
        });
    }

    async getAsset(url: string): Promise<Blob> {
        // Check memory cache first (fastest)
        if (this.memoryCache.has(url)) {
            this.updateAccessStats(url);
            return this.memoryCache.get(url)!;
        }

        // Check IndexedDB cache
        const cachedAsset = await this.getFromDiskCache(url);
        if (cachedAsset) {
            // Move to memory cache for faster access
            this.addToMemoryCache(url, cachedAsset);
            this.updateAccessStats(url);
            return cachedAsset;
        }

        // Fetch and cache
        const assetBlob = await this._fetchAndCacheAsset(url);
        this.addToMemoryCache(url, assetBlob);
        return assetBlob;
    }

    private async getFromDiskCache(url: string): Promise<Blob | null> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const asset = await store.get(url);
            return asset || null;
        } catch (error) {
            console.warn('Failed to read from asset cache:', error);
            return null;
        }
    }

    private async _fetchAndCacheAsset(url: string): Promise<Blob> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch asset: ${response.statusText}`);
            }
            
            const assetBlob = await response.blob();
            
            // Cache to disk
            await this.addToDiskCache(url, assetBlob);
            
            return assetBlob;
        } catch (error) {
            console.error(`Failed to fetch and cache asset: ${url}`, error);
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
            const metadataStore = tx.objectStore('asset-metadata', 'readwrite');
            await metadataStore.put({
                url,
                timestamp: Date.now(),
                accessCount: 1,
                lastAccessed: Date.now(),
                size: blob.size,
                type: this.getAssetType(url)
            });
            
            // Cleanup old assets if cache is full
            await this.cleanupCache();
        } catch (error) {
            console.warn('Failed to write to asset cache:', error);
        }
    }

    private addToMemoryCache(url: string, blob: Blob): void {
        // Remove oldest assets if memory cache is full
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }
        
        this.memoryCache.set(url, blob);
    }

    private async updateAccessStats(url: string): Promise<void> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('asset-metadata', 'readwrite');
            const store = tx.objectStore('asset-metadata');
            
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

    private getAssetType(url: string): string {
        if (url.includes('.png')) return 'image/png';
        if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
        if (url.includes('.svg')) return 'image/svg+xml';
        if (url.includes('.gif')) return 'image/gif';
        if (url.includes('.webp')) return 'image/webp';
        return 'application/octet-stream';
    }

    private async cleanupCache(): Promise<void> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('asset-metadata', 'readwrite');
            const store = tx.objectStore('asset-metadata');
            
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
            
            // Remove oldest/least used assets
            const assetsToRemove = allMetadata.slice(0, allMetadata.length - this.maxDiskCacheSize);
            
            for (const metadata of assetsToRemove) {
                // Remove from metadata store
                await store.delete(metadata.url);
                
                // Remove from asset store
                const assetTx = db.transaction(STORE_NAME, 'readwrite');
                const assetStore = assetTx.objectStore(STORE_NAME);
                await assetStore.delete(metadata.url);
            }
        } catch (error) {
            console.warn('Asset cache cleanup failed:', error);
        }
    }

    // Preload critical assets
    async preloadAssets(urls: string[]): Promise<void> {
        for (const url of urls) {
            if (!this.memoryCache.has(url) && !this.isPreloading(url)) {
                this.preloadAsset(url);
            }
        }
    }

    private preloadQueue = new Set<string>();

    private isPreloading(url: string): boolean {
        return this.preloadQueue.has(url);
    }

    private preloadAsset(url: string): void {
        if (this.preloadQueue.has(url)) return;
        
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
        }, 50); // Small delay to avoid blocking main thread
    }

    // Get cache statistics
    async getCacheStats(): Promise<{
        memoryCacheSize: number;
        diskCacheSize: number;
        totalSize: number;
    }> {
        try {
            const db = await this.dbPromise;
            const tx = db.transaction('asset-metadata', 'readonly');
            const store = tx.objectStore('asset-metadata');
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
            const tx = db.transaction([STORE_NAME, 'asset-metadata'], 'readwrite');
            await tx.objectStore(STORE_NAME).clear();
            await tx.objectStore('asset-metadata').clear();
        } catch (error) {
            console.warn('Failed to clear asset cache:', error);
        }
    }
}

export const assetCache = new AssetCache();

