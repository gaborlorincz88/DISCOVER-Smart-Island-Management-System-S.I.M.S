import React, { useState, useEffect, useRef, useCallback } from 'react';
import { simpleIconCache } from '../services/simpleIconCache';

interface ProgressiveIconProps {
  src: string;
  alt: string;
  className?: string;
  size?: number;
  fallbackIcon?: string;
  priority?: 'high' | 'normal' | 'low';
  onLoad?: () => void;
  onError?: () => void;
}

const ProgressiveIcon: React.FC<ProgressiveIconProps> = ({
  src,
  alt,
  className = '',
  size = 32,
  fallbackIcon = '📍',
  priority = 'normal',
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate blur placeholder for the icon
  const getBlurPlaceholder = useCallback((iconSrc: string) => {
    // For uploaded images, create a tiny data URL as placeholder
    if (iconSrc.startsWith('/uploads/') || iconSrc.startsWith('http')) {
      // Create a 20x20px canvas with a blurred version
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Create a simple colored placeholder
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, 20, 20);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(5, 5, 10, 10);
      }
      
      return canvas.toDataURL();
    }
    
    // For emoji icons, return empty string (no placeholder needed)
    return '';
  }, []);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current || priority === 'high') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.1 
      }
    );

    observer.observe(imgRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority]);

  // Preload high priority icons immediately
  useEffect(() => {
    if (priority === 'high' && (src.startsWith('/uploads/') || src.startsWith('http'))) {
      simpleIconCache.preloadIcon(src);
    }
  }, [src, priority]);

  // Load icon when visible
  useEffect(() => {
    if (!isVisible) return;

    // Set initial placeholder
    if (src.startsWith('/uploads/') || src.startsWith('http')) {
      setCurrentSrc(getBlurPlaceholder(src));
    }

    // Try to load from cache first
    const loadIcon = async () => {
      try {
        // Check cache first
        const cachedIcon = await simpleIconCache.getIcon(src);
        if (cachedIcon) {
          console.log(`🚀 Icon loaded from cache: ${src}`);
          setCurrentSrc(cachedIcon);
          setIsLoaded(true);
          setHasError(false);
          onLoad?.();
          return;
        }

        console.log(`📥 Loading icon from network: ${src}`);

        // If not in cache, fetch and cache
        const img = new Image();
        
        img.onload = async () => {
          // Cache the icon for future use
          try {
            const response = await fetch(src);
            if (response.ok) {
              const blob = await response.blob();
              await simpleIconCache.cacheIcon(src, img.src, blob.size);
            }
          } catch (error) {
            console.warn('Failed to cache icon:', error);
          }
          
          setCurrentSrc(src);
          setIsLoaded(true);
          setHasError(false);
          onLoad?.();
        };
        
        img.onerror = () => {
          setHasError(true);
          setCurrentSrc('');
          onError?.();
        };
        
        img.src = src;
      } catch (error) {
        console.error('Failed to load icon:', error);
        setHasError(true);
        onError?.();
      }
    };

    loadIcon();
  }, [src, isVisible, getBlurPlaceholder, onLoad, onError]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Handle different icon types
  if (hasError) {
    // Fallback to emoji
    return (
      <div 
        ref={imgRef}
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-2xl">{fallbackIcon}</span>
      </div>
    );
  }

  if (src.startsWith('/uploads/') || src.startsWith('http')) {
    // Image icon with progressive loading
    return (
      <img
        ref={imgRef}
        src={currentSrc || getBlurPlaceholder(src)}
        alt={alt}
        className={`${className} transition-all duration-300 ${
          isLoaded 
            ? 'opacity-100 scale-100' 
            : 'opacity-50 scale-95 blur-sm'
        }`}
        style={{ width: size, height: size }}
        loading={priority === 'high' ? 'eager' : 'lazy'}
      />
    );
  }

  // Emoji or text icon
  return (
    <div 
      ref={imgRef}
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-2xl">{src || fallbackIcon}</span>
    </div>
  );
};

export default ProgressiveIcon;
