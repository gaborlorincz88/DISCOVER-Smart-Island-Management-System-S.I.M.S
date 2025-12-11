interface IconPriority {
  high: string[];
  normal: string[];
  low: string[];
}

interface PreloadQueue {
  [key: string]: {
    priority: 'high' | 'normal' | 'low';
    timestamp: number;
    retries: number;
  };
}

class IconPreloader {
  private preloadQueue: PreloadQueue = {};
  private isPreloading = false;
  private maxConcurrent = 3;
  private currentPreloading = 0;
  private retryLimit = 3;
  private retryDelay = 1000;

  // Define icon priorities based on usage patterns
  private iconPriorities: IconPriority = {
    high: [
      // Critical UI icons that are always visible
      '/icon-192x192.png',
      '/icon-512x512.png',
      '/tours.svg'
    ],
    normal: [
      // Common category icons - these will be dynamically added
    ],
    low: [
      // Less frequently used icons - these will be dynamically added
    ]
  };

  constructor() {
    this.initializePreloader();
  }

  private initializePreloader(): void {
    // Preload high priority icons immediately
    this.preloadHighPriorityIcons();
    
    // Set up periodic cleanup
    setInterval(() => this.cleanupQueue(), 30000); // Every 30 seconds
  }

  /**
   * Preload high priority icons immediately
   */
  private async preloadHighPriorityIcons(): Promise<void> {
    for (const iconUrl of this.iconPriorities.high) {
      this.addToPreloadQueue(iconUrl, 'high');
    }
    
    // Start processing the queue
    this.processQueue();
  }

  /**
   * Add an icon to the preload queue
   */
  addToPreloadQueue(iconUrl: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    if (this.preloadQueue[iconUrl]) {
      // Update priority if higher
      if (this.getPriorityWeight(priority) > this.getPriorityWeight(this.preloadQueue[iconUrl].priority)) {
        this.preloadQueue[iconUrl].priority = priority;
        this.preloadQueue[iconUrl].timestamp = Date.now();
      }
      return;
    }

    this.preloadQueue[iconUrl] = {
      priority,
      timestamp: Date.now(),
      retries: 0
    };

    // If this is a high priority icon, process immediately
    if (priority === 'high') {
      this.processQueue();
    }
  }

  /**
   * Get priority weight for sorting
   */
  private getPriorityWeight(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  /**
   * Process the preload queue
   */
  private async processQueue(): Promise<void> {
    if (this.isPreloading || this.currentPreloading >= this.maxConcurrent) {
      return;
    }

    this.isPreloading = true;

    try {
      // Sort queue by priority and timestamp
      const sortedQueue = Object.entries(this.preloadQueue)
        .sort(([, a], [, b]) => {
          const priorityDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
          if (priorityDiff !== 0) return priorityDiff;
          return a.timestamp - b.timestamp;
        });

      // Process high priority icons first
      for (const [iconUrl, item] of sortedQueue) {
        if (this.currentPreloading >= this.maxConcurrent) break;
        
        if (item.priority === 'high' || this.currentPreloading < 2) {
          this.preloadIcon(iconUrl);
        }
      }
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload a single icon
   */
  private async preloadIcon(iconUrl: string): Promise<void> {
    if (!this.preloadQueue[iconUrl]) return;

    this.currentPreloading++;
    
    try {
      // Check if already cached
      if ('caches' in window) {
        const cache = await caches.open('discover-gozo-icons-v1');
        const cached = await cache.match(iconUrl);
        
        if (cached) {
          this.removeFromQueue(iconUrl);
          return;
        }
      }

      // Fetch and cache the icon
      const response = await fetch(iconUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache'
      });

      if (response.ok) {
        // Cache the icon
        if ('caches' in window) {
          const cache = await caches.open('discover-gozo-icons-v1');
          await cache.put(iconUrl, response.clone());
        }
        
        this.removeFromQueue(iconUrl);
        
        // Notify service worker to cache this icon
        this.notifyServiceWorker(iconUrl);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`Failed to preload icon ${iconUrl}:`, error);
      
      // Retry logic
      const item = this.preloadQueue[iconUrl];
      if (item && item.retries < this.retryLimit) {
        item.retries++;
        setTimeout(() => {
          this.preloadIcon(iconUrl);
        }, this.retryDelay * item.retries);
      } else {
        this.removeFromQueue(iconUrl);
      }
    } finally {
      this.currentPreloading--;
      
      // Continue processing queue
      if (this.currentPreloading < this.maxConcurrent) {
        this.processQueue();
      }
    }
  }

  /**
   * Remove icon from queue
   */
  private removeFromQueue(iconUrl: string): void {
    delete this.preloadQueue[iconUrl];
  }

  /**
   * Notify service worker to cache the icon
   */
  private notifyServiceWorker(iconUrl: string): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_ICON',
        url: iconUrl
      });
    }
  }

  /**
   * Preload icons for a specific view/component
   */
  preloadForView(viewName: string): void {
    const viewIcons = this.getIconsForView(viewName);
    
    for (const icon of viewIcons) {
      this.addToPreloadQueue(icon.url, icon.priority);
    }
    
    this.processQueue();
  }

  /**
   * Get icons needed for a specific view
   */
  private getIconsForView(viewName: string): Array<{ url: string; priority: 'high' | 'normal' | 'low' }> {
    // For now, return empty array - icons will be added dynamically
    // This prevents hardcoded paths that don't exist
    return [];
  }

  /**
   * Clean up old entries from the queue
   */
  private cleanupQueue(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [iconUrl, item] of Object.entries(this.preloadQueue)) {
      if (now - item.timestamp > maxAge) {
        this.removeFromQueue(iconUrl);
      }
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    total: number;
    high: number;
    normal: number;
    low: number;
    currentPreloading: number;
  } {
    const counts = { high: 0, normal: 0, low: 0 };
    
    for (const item of Object.values(this.preloadQueue)) {
      counts[item.priority]++;
    }

    return {
      total: Object.keys(this.preloadQueue).length,
      ...counts,
      currentPreloading: this.currentPreloading
    };
  }

  /**
   * Clear all queues
   */
  clearQueue(): void {
    this.preloadQueue = {};
    this.currentPreloading = 0;
  }
}

// Export singleton instance
export const iconPreloader = new IconPreloader();

// Export the class for testing
export { IconPreloader };
