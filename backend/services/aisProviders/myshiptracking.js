/**
 * MyShipTracking AIS Provider
 * Free trial: 2,000 credits, 10 days
 * Documentation: https://api.myshiptracking.com/
 */

const https = require('https');

class MyShipTrackingProvider {
  constructor(apiKey, apiSecret) {
    this.name = 'MyShipTracking';
    this.baseUrl = 'https://api.myshiptracking.com';
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.pollInterval = 30000; // Poll every 30 seconds
    this.pollTimers = new Map();
    this.positions = new Map();
  }

  /**
   * Start tracking a vessel by MMSI
   */
  startTracking(mmsi, apiKey = null, onPositionUpdate = null) {
    const mmsiStr = String(mmsi);
    
    if (this.pollTimers.has(mmsiStr)) {
      console.log(`ℹ️ Already tracking MMSI ${mmsiStr} via MyShipTracking`);
      return;
    }

    if (!this.apiKey || !this.apiSecret) {
      console.error(`❌ MyShipTracking: API key and secret required for MMSI ${mmsiStr}`);
      return;
    }

    console.log(`🚢 Starting MyShipTracking tracking for MMSI ${mmsiStr}`);
    
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
      console.log(`🛑 Stopped MyShipTracking tracking for MMSI ${mmsiStr}`);
    }
  }

  /**
   * Fetch latest position from MyShipTracking API
   */
  fetchPosition(mmsi, onPositionUpdate) {
    const mmsiStr = String(mmsi);
    const url = `${this.baseUrl}/vessel/status?apikey=${this.apiKey}&apisecret=${this.apiSecret}&mmsi=${mmsiStr}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.status === 'OK' && response.data && response.data.length > 0) {
            const vesselData = response.data[0];
            
            const position = {
              mmsi: String(vesselData.mmsi),
              latitude: vesselData.latitude,
              longitude: vesselData.longitude,
              course: vesselData.course || null,
              speed: vesselData.speed || null,
              heading: vesselData.heading || null,
              timestamp: vesselData.timestamp || new Date().toISOString()
            };
            
            this.positions.set(mmsiStr, position);
            
            if (onPositionUpdate) {
              onPositionUpdate(position);
            }
            
            console.log(`📍 MyShipTracking: Position update for MMSI ${mmsiStr} - ${position.latitude}, ${position.longitude}`);
          } else {
            console.warn(`⚠️ MyShipTracking: No data for MMSI ${mmsiStr} - ${response.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`❌ MyShipTracking: Error parsing response for MMSI ${mmsiStr}:`, error.message);
        }
      });
    }).on('error', (error) => {
      console.error(`❌ MyShipTracking: Error fetching position for MMSI ${mmsiStr}:`, error.message);
    });
  }

  getPosition(mmsi) {
    return this.positions.get(String(mmsi)) || null;
  }

  getAllPositions() {
    const result = {};
    this.positions.forEach((position, mmsi) => {
      result[mmsi] = position;
    });
    return result;
  }

  stopAll() {
    this.pollTimers.forEach((timer, mmsi) => {
      clearInterval(timer);
    });
    this.pollTimers.clear();
    this.positions.clear();
    console.log('🛑 Stopped all MyShipTracking tracking');
  }
}

module.exports = MyShipTrackingProvider;


