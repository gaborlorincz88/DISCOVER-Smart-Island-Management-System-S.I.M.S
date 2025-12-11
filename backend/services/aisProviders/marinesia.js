/**
 * Marinesia AIS Provider
 * Free REST API - no API key required for basic position data
 * Documentation: https://docs.marinesia.com/
 */

const https = require('https');

class MarinesiaProvider {
  constructor() {
    this.name = 'Marinesia';
    this.baseUrl = 'https://api.marinesia.com/api/v1';
    this.pollInterval = 30000; // Poll every 30 seconds
    this.pollTimers = new Map(); // Map of MMSI to polling timer
    this.positions = new Map(); // Cache of latest positions
  }

  /**
   * Start tracking a vessel by MMSI
   * @param {string} mmsi - MMSI number
   * @param {string} apiKey - API key (not required for Marinesia, but kept for interface compatibility)
   * @param {function} onPositionUpdate - Callback when position is received
   */
  startTracking(mmsi, apiKey = null, onPositionUpdate = null) {
    const mmsiStr = String(mmsi);
    
    // If already tracking, just add the listener
    if (this.pollTimers.has(mmsiStr)) {
      console.log(`ℹ️ Already tracking MMSI ${mmsiStr} via Marinesia`);
      return;
    }

    console.log(`🚢 Starting Marinesia tracking for MMSI ${mmsiStr}`);
    
    // Immediate first fetch
    this.fetchPosition(mmsiStr, onPositionUpdate);
    
    // Set up polling interval
    const timer = setInterval(() => {
      this.fetchPosition(mmsiStr, onPositionUpdate);
    }, this.pollInterval);
    
    this.pollTimers.set(mmsiStr, timer);
  }

  /**
   * Stop tracking a vessel
   */
  stopTracking(mmsi) {
    const mmsiStr = String(mmsi);
    const timer = this.pollTimers.get(mmsiStr);
    
    if (timer) {
      clearInterval(timer);
      this.pollTimers.delete(mmsiStr);
      this.positions.delete(mmsiStr);
      console.log(`🛑 Stopped Marinesia tracking for MMSI ${mmsiStr}`);
    }
  }

  /**
   * Fetch latest position from Marinesia API
   */
  fetchPosition(mmsi, onPositionUpdate) {
    const mmsiStr = String(mmsi);
    const url = `${this.baseUrl}/vessel/${mmsiStr}/location/latest`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.error === false && response.data) {
            const vesselData = response.data;
            
            // Marinesia API format
            const position = {
              mmsi: String(vesselData.mmsi),
              latitude: vesselData.lat,
              longitude: vesselData.lng,
              course: vesselData.cog || null,
              speed: vesselData.sog || null,
              heading: vesselData.hdt || null,
              timestamp: vesselData.ts || new Date().toISOString()
            };
            
            // Cache position
            this.positions.set(mmsiStr, position);
            
            // Notify listener
            if (onPositionUpdate) {
              onPositionUpdate(position);
            }
            
            console.log(`📍 Marinesia: Position update for MMSI ${mmsiStr} - ${position.latitude}, ${position.longitude}`);
          } else {
            console.warn(`⚠️ Marinesia: No data for MMSI ${mmsiStr} - ${response.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`❌ Marinesia: Error parsing response for MMSI ${mmsiStr}:`, error.message);
        }
      });
    }).on('error', (error) => {
      console.error(`❌ Marinesia: Error fetching position for MMSI ${mmsiStr}:`, error.message);
    });
  }

  /**
   * Get cached position for a vessel
   */
  getPosition(mmsi) {
    return this.positions.get(String(mmsi)) || null;
  }

  /**
   * Get all cached positions
   */
  getAllPositions() {
    const result = {};
    this.positions.forEach((position, mmsi) => {
      result[mmsi] = position;
    });
    return result;
  }

  /**
   * Stop all tracking
   */
  stopAll() {
    this.pollTimers.forEach((timer, mmsi) => {
      clearInterval(timer);
    });
    this.pollTimers.clear();
    this.positions.clear();
    console.log('🛑 Stopped all Marinesia tracking');
  }
}

module.exports = MarinesiaProvider;


