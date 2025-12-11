import { tileManager } from './tileManager';
import { assetCache } from './assetCache';

class CacheManager {
    private static instance: CacheManager;
    private isInitialized = false;

    private constructor() {}

    static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('Initializing cache manager...');
            
            // Preload critical assets
            await this.preloadCriticalAssets();
            
            // Preload common map tiles for Gozo center area
            await this.preloadCommonTiles();
            
            this.isInitialized = true;
            console.log('Cache manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize cache manager:', error);
        }
    }

    private async preloadCriticalAssets(): Promise<void> {
        const criticalAssets = [
            // App icons and logos
            '/tours.svg',
            
            // Translation files
            '/locales/en/translation.json',
            '/locales/de/translation.json',
            '/locales/es/translation.json',
            '/locales/fr/translation.json',
            '/locales/it/translation.json',
            
            // Common images (if you have any)
            // '/images/logo.png',
            // '/images/default-place.jpg'
        ];

        console.log('Preloading critical assets...');
        await assetCache.preloadAssets(criticalAssets);
    }

    private async preloadCommonTiles(): Promise<void> {
        try {
            // Preload tiles for common zoom levels around Gozo center
            const gozoCenter = { x: 4420, y: 3215 }; // Approximate center coordinates
            
            // Preload tiles for zoom levels 10-15 (most commonly used)
            for (let zoom = 10; zoom <= 15; zoom++) {
                await tileManager.preloadArea('gozo', zoom, gozoCenter.x, gozoCenter.y, 3);
            }
            
            console.log('Common tiles preloaded successfully');
        } catch (error) {
            console.warn('Failed to preload common tiles:', error);
        }
    }

    async getCacheStats(): Promise<{
        tiles: { memoryCacheSize: number; diskCacheSize: number; totalSize: number };
        assets: { memoryCacheSize: number; diskCacheSize: number; totalSize: number };
        totalSize: number;
    }> {
        try {
            const [tileStats, assetStats] = await Promise.all([
                tileManager.getCacheStats(),
                assetCache.getCacheStats()
            ]);

            const totalSize = tileStats.totalSize + assetStats.totalSize;

            return {
                tiles: tileStats,
                assets: assetStats,
                totalSize
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return {
                tiles: { memoryCacheSize: 0, diskCacheSize: 0, totalSize: 0 },
                assets: { memoryCacheSize: 0, diskCacheSize: 0, totalSize: 0 },
                totalSize: 0
            };
        }
    }

    async clearAllCaches(): Promise<void> {
        try {
            console.log('Clearing all caches...');
            
            await Promise.all([
                tileManager.clearCache(),
                assetCache.clearCache()
            ]);

            // Clear service worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }

            console.log('All caches cleared successfully');
        } catch (error) {
            console.error('Failed to clear caches:', error);
        }
    }

    async optimizeCache(): Promise<void> {
        try {
            console.log('Optimizing cache...');
            
            // Get current cache stats
            const stats = await this.getCacheStats();
            
            // If total size is too large (>100MB), clear oldest items
            if (stats.totalSize > 100 * 1024 * 1024) {
                console.log('Cache size too large, clearing oldest items...');
                await this.clearOldestItems();
            }
            
            console.log('Cache optimization completed');
        } catch (error) {
            console.error('Cache optimization failed:', error);
        }
    }

    private async clearOldestItems(): Promise<void> {
        // This would need to be implemented based on your specific cache structure
        // For now, we'll just clear some caches
        try {
            // Clear some tile caches (keep recent ones)
            // This is a simplified approach - you might want more sophisticated logic
            
            console.log('Clearing oldest cache items...');
            
            // You could implement LRU (Least Recently Used) logic here
            // For now, we'll just clear some caches
            
        } catch (error) {
            console.warn('Failed to clear oldest items:', error);
        }
    }

    // Preload tiles for a specific area (called when user moves map)
    async preloadTilesForArea(region: string, zoom: number, centerX: number, centerY: number): Promise<void> {
        try {
            await tileManager.preloadArea(region, zoom, centerX, centerY, 2);
        } catch (error) {
            console.warn('Failed to preload tiles for area:', error);
        }
    }

    // Preload assets for a specific place or tour
    async preloadAssetsForPlace(place: any): Promise<void> {
        try {
            const assetUrls: string[] = [];
            
            // Add main image
            if (place.mainImage) {
                assetUrls.push(place.mainImage);
            }
            
            // Add gallery images
            if (place.images && Array.isArray(place.images)) {
                assetUrls.push(...place.images);
            }
            
            // Add icon if it's a custom image
            if (place.icon && place.icon.startsWith('/uploads/')) {
                assetUrls.push(place.icon);
            }
            
            if (assetUrls.length > 0) {
                await assetCache.preloadAssets(assetUrls);
            }
        } catch (error) {
            console.warn('Failed to preload assets for place:', error);
        }
    }

    // Get cache size in human-readable format
    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export const cacheManager = CacheManager.getInstance();

