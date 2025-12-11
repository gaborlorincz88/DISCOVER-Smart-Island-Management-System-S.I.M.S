import { useEffect, useCallback } from 'react';
import { iconPreloader } from '../services/iconPreloader';

interface UseIconPreloadingOptions {
  viewName?: string;
  autoPreload?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

interface UseIconPreloadingReturn {
  preloadIcon: (url: string, priority?: 'high' | 'normal' | 'low') => void;
  preloadMultipleIcons: (urls: string[], priority?: 'high' | 'normal' | 'low') => void;
  getQueueStatus: () => {
    total: number;
    high: number;
    normal: number;
    low: number;
    currentPreloading: number;
  };
  clearQueue: () => void;
}

/**
 * Custom hook for managing icon preloading
 * Provides easy access to icon preloading functionality
 */
export const useIconPreloading = (options: UseIconPreloadingOptions = {}): UseIconPreloadingReturn => {
  const { viewName, autoPreload = true, priority = 'normal' } = options;

  // Auto-preload icons for the specified view
  useEffect(() => {
    if (autoPreload && viewName) {
      iconPreloader.preloadForView(viewName);
    }
  }, [viewName, autoPreload]);

  // Preload a single icon
  const preloadIcon = useCallback((url: string, iconPriority: 'high' | 'normal' | 'low' = priority) => {
    iconPreloader.addToPreloadQueue(url, iconPriority);
  }, [priority]);

  // Preload multiple icons
  const preloadMultipleIcons = useCallback((urls: string[], iconPriority: 'high' | 'normal' | 'low' = priority) => {
    urls.forEach(url => {
      iconPreloader.addToPreloadQueue(url, iconPriority);
    });
  }, [priority]);

  // Get current queue status
  const getQueueStatus = useCallback(() => {
    return iconPreloader.getQueueStatus();
  }, []);

  // Clear the queue
  const clearQueue = useCallback(() => {
    iconPreloader.clearQueue();
  }, []);

  return {
    preloadIcon,
    preloadMultipleIcons,
    getQueueStatus,
    clearQueue
  };
};

/**
 * Hook for preloading critical icons on app initialization
 */
export const useCriticalIconPreloading = () => {
  useEffect(() => {
    // Preload critical icons immediately
    const criticalIcons = [
      '/icon-192x192.png',
      '/icon-512x512.png',
      '/tours.svg'
    ];

    criticalIcons.forEach(icon => {
      iconPreloader.addToPreloadQueue(icon, 'high');
    });
  }, []);
};

/**
 * Hook for preloading icons based on user interaction
 */
export const useInteractiveIconPreloading = () => {
  const preloadOnHover = useCallback((url: string) => {
    iconPreloader.addToPreloadQueue(url, 'normal');
  }, []);

  const preloadOnFocus = useCallback((url: string) => {
    iconPreloader.addToPreloadQueue(url, 'high');
  }, []);

  return {
    preloadOnHover,
    preloadOnFocus
  };
};

/**
 * Hook for preloading icons for a specific view
 */
export const useViewIconPreloading = (viewName: string) => {
  useEffect(() => {
    iconPreloader.preloadForView(viewName);
  }, [viewName]);
};

