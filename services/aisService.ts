import { getApiBaseUrl } from './config';

export interface AISPosition {
  mmsi: string;
  latitude: number;
  longitude: number;
  course?: number | null;
  speed?: number | null;
  timestamp: string;
  subscriptionId?: string;
  subscriptionName?: string;
}

type PositionUpdateCallback = (position: AISPosition) => void;

class AISService {
  private positionCallbacks: Set<PositionUpdateCallback> = new Set();
  private currentPositions: Map<string, AISPosition> = new Map();
  private pollingInterval: number | null = null;
  private pollingDelay: number = 5000; // 5 seconds - reasonable update frequency
  private isPolling: boolean = false;

  /**
   * Connect to AIS service via polling (reliable, works through Cloudflare)
   */
  connect(): void {
    if (this.isPolling) {
      console.log('AIS polling already active');
      return;
    }

    this.isPolling = true;
    console.log('🔄 Starting AIS position polling (every 5 seconds)');

    // Fetch positions immediately
    this.fetchPositions();

    // Then poll every few seconds
    this.pollingInterval = window.setInterval(() => {
      this.fetchPositions();
    }, this.pollingDelay);
  }

  /**
   * Fetch current positions from API
   */
  private async fetchPositions(): Promise<void> {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/ais/positions`, {
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const positions = await response.json();
        
        // Update positions
        if (Array.isArray(positions)) {
          if (positions.length > 0) {
            console.log(`📊 Received ${positions.length} AIS positions (array)`);
          }
          positions.forEach((position: AISPosition) => {
            if (position && position.mmsi) {
              this.updatePosition(position);
            }
          });
        } else if (typeof positions === 'object' && positions !== null) {
          const positionArray = Object.values(positions);
          if (positionArray.length > 0) {
            console.log(`📊 Received ${positionArray.length} AIS positions (object)`);
            console.log('📋 Position MMSIs:', Object.keys(positions).join(', '));
          } else if (this.currentPositions.size === 0) {
            // Only log warning if we've never received any positions
            console.warn('⚠️ No AIS positions received from backend. Check backend logs to see if AisStream.io is sending data.');
          }
          positionArray.forEach((position: any) => {
            if (position && position.mmsi) {
              this.updatePosition(position);
            }
          });
        } else {
          console.warn('⚠️ Unexpected positions format:', typeof positions, positions);
        }
      } else {
        console.warn('❌ Failed to fetch AIS positions:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching AIS positions:', error);
    }
  }

  /**
   * Update position and notify callbacks
   */
  private updatePosition(position: AISPosition): void {
    const mmsi = position.mmsi;
    const existingPosition = this.currentPositions.get(mmsi);
    
    // Always notify callbacks when we receive a position update (even if same position)
    // This ensures the frontend knows we're receiving data
    const isNewPosition = !existingPosition || 
      existingPosition.latitude !== position.latitude || 
      existingPosition.longitude !== position.longitude;
    
    // Store position
    this.currentPositions.set(mmsi, position);

    // Always notify callbacks (frontend needs to know about updates)
    this.positionCallbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('Error in position callback:', error);
      }
    });

    // Log position update
    if (isNewPosition) {
      console.log(`📍 AIS position update: MMSI ${mmsi} at ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`);
    } else {
      console.log(`📍 AIS position refresh: MMSI ${mmsi} (same position)`);
    }
  }

  /**
   * Add a callback for position updates
   */
  onPositionUpdate(callback: PositionUpdateCallback): () => void {
    this.positionCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.positionCallbacks.delete(callback);
    };
  }

  /**
   * Get current position for a specific MMSI
   */
  getPosition(mmsi: string): AISPosition | null {
    return this.currentPositions.get(mmsi) || null;
  }

  /**
   * Get all current positions
   */
  getAllPositions(): Map<string, AISPosition> {
    return new Map(this.currentPositions);
  }

  /**
   * Get positions for a specific subscription (place/event ID)
   */
  async getPositionsForSubscription(id: string): Promise<AISPosition[]> {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/ais/positions/${id}`);
      
      if (response.ok) {
        const positions = await response.json();
        return Array.isArray(positions) ? positions : [];
      }
    } catch (error) {
      console.error('Error fetching positions for subscription:', error);
    }
    
    return [];
  }

  /**
   * Disconnect from AIS service
   */
  disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('🚢 AIS polling stopped');
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; trackedVessels: number; mode: 'polling' } {
    return {
      connected: this.isPolling,
      trackedVessels: this.currentPositions.size,
      mode: 'polling'
    };
  }
}

// Export singleton instance
export const aisService = new AISService();
