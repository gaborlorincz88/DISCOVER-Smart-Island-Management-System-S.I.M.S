/**
 * AIS Provider Manager
 * Manages multiple AIS data providers (AisStream, Marinesia, etc.)
 */

const AisStreamProvider = require('./aisProviders/aisstream');
const MarinesiaProvider = require('./aisProviders/marinesia');

class AISProviderManager {
  constructor() {
    this.providers = new Map();
    this.positions = new Map(); // Unified position cache across all providers
    this.positionListeners = new Set();
    
    // Initialize providers
    this.registerProvider('AisStream', new AisStreamProvider());
    this.registerProvider('Marinesia', new MarinesiaProvider());
    this.registerProvider('MarinesiaAPI', new MarinesiaProvider()); // Alias
  }

  /**
   * Register a provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    console.log(`📦 Registered AIS provider: ${name}`);
  }

  /**
   * Get provider by name
   */
  getProvider(name) {
    // Normalize provider name
    const normalized = this.normalizeProviderName(name);
    return this.providers.get(normalized) || null;
  }

  /**
   * Normalize provider name (case-insensitive, handle aliases)
   */
  normalizeProviderName(name) {
    if (!name) return null;
    
    const lower = name.toLowerCase();
    if (lower === 'aisstream' || lower === 'ais_stream') return 'AisStream';
    if (lower === 'marinesia' || lower === 'marinesiaapi') return 'Marinesia';
    
    return name; // Return as-is if no match
  }

  /**
   * Start tracking a vessel with a specific provider
   */
  startTracking(providerName, mmsi, apiKey = null) {
    const provider = this.getProvider(providerName);
    if (!provider) {
      console.error(`❌ Unknown AIS provider: ${providerName}`);
      return false;
    }

    const mmsiStr = String(mmsi);
    
    // Set up position update callback
    const onPositionUpdate = (position) => {
      // Store in unified cache
      this.positions.set(mmsiStr, position);
      
      // Notify all listeners
      this.positionListeners.forEach(listener => {
        try {
          listener(position);
        } catch (error) {
          console.error('Error in position listener:', error);
        }
      });
    };

    // Start tracking with provider
    if (provider.startTracking) {
      provider.startTracking(mmsiStr, apiKey, onPositionUpdate);
      return true;
    } else {
      console.error(`❌ Provider ${providerName} does not support startTracking`);
      return false;
    }
  }

  /**
   * Stop tracking a vessel
   */
  stopTracking(providerName, mmsi) {
    const provider = this.getProvider(providerName);
    if (provider && provider.stopTracking) {
      provider.stopTracking(mmsi);
      this.positions.delete(String(mmsi));
    }
  }

  /**
   * Get position for a vessel (from unified cache)
   */
  getPosition(mmsi) {
    return this.positions.get(String(mmsi)) || null;
  }

  /**
   * Get all positions (from unified cache)
   */
  getAllPositions() {
    const result = {};
    this.positions.forEach((position, mmsi) => {
      result[mmsi] = position;
    });
    return result;
  }

  /**
   * Add position update listener
   */
  onPositionUpdate(callback) {
    this.positionListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.positionListeners.delete(callback);
    };
  }

  /**
   * Stop all providers
   */
  stopAll() {
    this.providers.forEach((provider, name) => {
      if (provider.stopAll) {
        provider.stopAll();
      }
    });
    this.positions.clear();
    console.log('🛑 Stopped all AIS providers');
  }
}

module.exports = AISProviderManager;


