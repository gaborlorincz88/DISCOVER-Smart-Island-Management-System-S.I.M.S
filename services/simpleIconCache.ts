/**
 * Simple Icon Cache Service
 * Provides fast icon loading through memory and localStorage caching
 */

interface CachedIcon {
  dataUrl: string;
  timestamp: number;
  size: number;
}

class SimpleIconCache {
  private memoryCache: Map<string, CachedIcon> = new Map();
  private readonly CACHE_KEY = 'discover-gozo-icon-cache';
  private readonly MAX_CACHE_SIZE = 100; // Max icons in cache
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get an icon from cache
   */
  async getIcon(url: string): Promise<string | null> {
    // Check memory cache first (fastest)
    if (this.memoryCache.has(url)) {
      const cached = this.memoryCache.get(url)!;
      if (Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
        return cached.dataUrl;
      } else {
        // Expired, remove from cache
        this.memoryCache.delete(url);
      }
    }

    // Check localStorage
    const stored = this.getFromStorage(url);
    if (stored && Date.now() - stored.timestamp < this.CACHE_EXPIRY) {
      // Move to memory cache for faster access
      this.memoryCache.set(url, stored);
      return stored.dataUrl;
    }

    return null;
  }

  /**
   * Cache an icon
   */
  async cacheIcon(url: string, dataUrl: string, size: number): Promise<void> {
    const cachedIcon: CachedIcon = {
      dataUrl,
      timestamp: Date.now(),
      size
    };

    // Add to memory cache
    this.memoryCache.set(url, cachedIcon);

    // Add to localStorage
    this.addToStorage(url, cachedIcon);

    // Cleanup if cache is too large
    if (this.memoryCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }
  }

  /**
   * Preload an icon (fetch and cache)
   */
  async preloadIcon(url: string): Promise<void> {
    try {
      // Check if already cached
      if (await this.getIcon(url)) {
        return;
      }

      // Fetch the icon
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const dataUrl = await this.blobToDataUrl(blob);

      // Cache the icon
      await this.cacheIcon(url, dataUrl, blob.size);

      console.log(`Icon preloaded and cached: ${url}`);
    } catch (error) {
      console.warn(`Failed to preload icon ${url}:`, error);
    }
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get icon from localStorage
   */
  private getFromStorage(url: string): CachedIcon | null {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        return cache[url] || null;
      }
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
    }
    return null;
  }

  /**
   * Add icon to localStorage
   */
  private addToStorage(url: string, cachedIcon: CachedIcon): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      
      cache[url] = cachedIcon;
      
      // Limit cache size
      const urls = Object.keys(cache);
      if (urls.length > this.MAX_CACHE_SIZE) {
        // Remove oldest entries
        urls.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        urls.slice(0, urls.length - this.MAX_CACHE_SIZE).forEach(key => {
          delete cache[key];
        });
      }

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        const now = Date.now();
        
        // Load non-expired icons into memory
        Object.entries(cache).forEach(([url, cachedIcon]: [string, any]) => {
          if (now - cachedIcon.timestamp < this.CACHE_EXPIRY) {
            this.memoryCache.set(url, cachedIcon);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredUrls: string[] = [];

    this.memoryCache.forEach((cachedIcon, url) => {
      if (now - cachedIcon.timestamp > this.CACHE_EXPIRY) {
        expiredUrls.push(url);
      }
    });

    expiredUrls.forEach(url => {
      this.memoryCache.delete(url);
    });

    // Also clean localStorage
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        expiredUrls.forEach(url => {
          delete cache[url];
        });
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.warn('Failed to cleanup localStorage:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    totalCached: number;
    memoryUsage: number;
  } {
    let totalSize = 0;
    this.memoryCache.forEach(icon => {
      totalSize += icon.size;
    });

    return {
      memoryCacheSize: this.memoryCache.size,
      totalCached: this.memoryCache.size,
      memoryUsage: totalSize
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.memoryCache.clear();
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }
}

// Export singleton instance
export const simpleIconCache = new SimpleIconCache();

