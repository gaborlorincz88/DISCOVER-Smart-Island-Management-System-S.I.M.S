import { getApiBaseUrl } from './config';

export interface GradientStop {
  color: string;
  position: number;
}

export interface PageBackgroundConfig {
  type: 'solid' | 'gradient';
  color?: string; // For solid type
  direction?: string; // For gradient type
  stops?: GradientStop[]; // For gradient type
  custom?: string; // Custom CSS
}

let cachedSettings: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchHeaderSettings() {
  const now = Date.now();
  if (cachedSettings && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/settings/header`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('Failed to fetch header settings');
    }
    cachedSettings = await response.json();
    cacheTimestamp = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error fetching header settings:', error);
    return null;
  }
}

// Export as both named and default for compatibility
export async function getPageBackground(page: 'explorer' | 'events' | 'excursions' | 'contact' | 'trips', theme: 'light' | 'dark' = 'dark'): Promise<string | null> {
  console.log('pageBackgroundService: getPageBackground called with page:', page, 'theme:', theme);
  try {
    console.log('pageBackgroundService: Fetching header settings...');
    const settings = await fetchHeaderSettings();
    console.log('pageBackgroundService: Fetched settings:', settings);
    console.log('pageBackgroundService: Settings has pageBackgrounds?', !!settings?.pageBackgrounds);
    
    if (!settings || !settings.pageBackgrounds) {
      console.log('pageBackgroundService: No pageBackgrounds in settings, returning null');
      return null;
    }

    const key = `${page}_${theme}`;
    console.log('pageBackgroundService: Looking for key:', key);
    console.log('pageBackgroundService: Available keys:', Object.keys(settings.pageBackgrounds));
    const config: PageBackgroundConfig | undefined = settings.pageBackgrounds[key];

    if (!config) {
      console.log('pageBackgroundService: No config found for key:', key);
      return null;
    }
    console.log('pageBackgroundService: Found config:', config);

    // If custom CSS is provided, use it
    if (config.custom && config.custom.trim()) {
      console.log('pageBackgroundService: Using custom CSS:', config.custom);
      return config.custom.trim();
    }

    // Handle solid color
    if (config.type === 'solid' && config.color) {
      console.log('pageBackgroundService: Using solid color:', config.color);
      return config.color;
    }

    // Handle gradient
    if (config.type === 'gradient' && config.stops && config.stops.length > 0) {
      console.log('pageBackgroundService: Building gradient with stops:', config.stops);
      const stopStrings = config.stops.map(stop => {
        // Handle different color formats: hex, rgb(), or already formatted
        let color = stop.color;
        if (!color.startsWith('#') && !color.startsWith('rgb') && !color.startsWith('rgba')) {
          // If it's a simple string like "255, 255, 255", wrap it in rgb()
          if (color.includes(',')) {
            color = `rgb(${color})`;
          } else {
            // Assume it's a hex without #, add it
            color = color.startsWith('#') ? color : `#${color}`;
          }
        }
        return stop.position !== undefined ? `${color} ${stop.position}%` : color;
      });

      const gradient = config.direction === 'radial' 
        ? `radial-gradient(circle, ${stopStrings.join(', ')})`
        : `linear-gradient(${config.direction || 'to bottom right'}, ${stopStrings.join(', ')})`;
      
      console.log('pageBackgroundService: Generated gradient:', gradient);
      return gradient;
    }

    console.log('pageBackgroundService: No valid config type, returning null');
    return null;
  } catch (error) {
    console.error('pageBackgroundService: Error getting page background:', error);
    return null;
  }
}

// Clear cache when settings are updated
export function clearPageBackgroundCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}

// Listen for settings updates
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'dg_header_settings_updated') {
      clearPageBackgroundCache();
    }
  });

  // Also listen via BroadcastChannel if available
  try {
    const bc = new BroadcastChannel('dg-header');
    bc.addEventListener('message', () => {
      clearPageBackgroundCache();
    });
  } catch (e) {
    // BroadcastChannel not supported
  }
}

// Default export for compatibility
export default {
  getPageBackground,
  clearPageBackgroundCache
};

