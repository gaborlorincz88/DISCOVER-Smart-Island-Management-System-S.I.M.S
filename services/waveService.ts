import { Coordinates } from '../types';
import { getApiBaseUrl } from './config';

export interface WaveData {
  height: number; // in meters
  direction: number; // in degrees (0-360)
  period: number; // in seconds
  speed: number; // in m/s
  windSpeed?: number; // in km/h
  windDirection?: number; // in degrees
  timestamp: number;
  // Additional weather data
  temperature?: number;
  humidity?: number;
  pressure?: number;
  visibility?: number;
  rainChance?: number;
  waterTemperature?: number;
  // Forecast data
  forecast?: Array<{
    date: string;
    dayName: string;
    temperature: { min: number; max: number; avg: number };
    humidity: number;
    windSpeed: number;
    windDirection: number;
    rainChance: number;
    weather: { main: string; description: string };
    waterTemperature: number;
    waveHeight: number;
    waveDirection: number;
  }>;
}

export interface WaveForecast {
  current: WaveData;
  forecast: WaveData[];
  location: Coordinates;
}

export interface ConditionAlarm {
  id: string;
  type: 'jellyfish' | 'tsunami' | 'shark' | 'storm' | 'wind' | 'current' | 'pollution' | 'other';
  title: string;
  description: string;
  coordinates: Coordinates;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

class WaveService {
  private cache: Map<string, WaveForecast> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private coastlineData: any = null;

  // Mock wave data generator for Gozo area
  private generateMockWaveData(location: Coordinates): WaveData {
    // Simulate realistic wave conditions for Mediterranean Sea around Gozo
    const baseHeight = 0.5 + Math.random() * 2.0; // 0.5-2.5m
    const baseDirection = 180 + (Math.random() - 0.5) * 60; // 150-210 degrees (south-southwest)
    const basePeriod = 4 + Math.random() * 6; // 4-10 seconds
    const baseSpeed = baseHeight * 1.5 + Math.random() * 0.5; // Roughly proportional to height

    return {
      height: Math.round(baseHeight * 10) / 10,
      direction: Math.round(baseDirection),
      period: Math.round(basePeriod * 10) / 10,
      speed: Math.round(baseSpeed * 10) / 10,
      timestamp: Date.now()
    };
  }

  // Load coastline data from backend
  async loadCoastlineData(): Promise<void> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/weather/coastlines`);
      if (response.ok) {
        const data = await response.json();
        this.coastlineData = data;
      }
    } catch (error) {
      console.error('Error loading coastline data:', error);
    }
  }

  // Check if location is in sea area based on coastline data
  private isLocationInSea(location: Coordinates): boolean {
    if (!this.coastlineData?.activeCoastline?.points) {
      // If no coastline data, assume it's sea if it's in the general Gozo area
      return location.lat >= 35.8 && location.lat <= 36.3 && 
             location.lng >= 13.9 && location.lng <= 14.4;
    }

    // Use ray casting algorithm to check if point is inside polygon
    const points = this.coastlineData.activeCoastline.points;
    let inside = false;
    
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      if (((points[i][1] > location.lng) !== (points[j][1] > location.lng)) &&
          (location.lat < (points[j][0] - points[i][0]) * (location.lng - points[i][1]) / (points[j][1] - points[i][1]) + points[i][0])) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Get current wave data for a location
  async getCurrentWaveData(location: Coordinates): Promise<WaveData> {
    // Load coastline data if not already loaded
    if (!this.coastlineData) {
      await this.loadCoastlineData();
    }

    // Check if location is in sea area
    if (!this.isLocationInSea(location)) {
      // Return null or empty data for land areas
      return {
        height: 0,
        direction: 0,
        period: 0,
        speed: 0,
        timestamp: Date.now()
      };
    }

    const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
    const cached = this.cache.get(key);

    // Return cached data if still valid
    if (cached && Date.now() - cached.current.timestamp < this.cacheTimeout) {
      return cached.current;
    }

    try {
      // Try to fetch real weather data from weather API
      const response = await fetch(`${getApiBaseUrl()}/api/weather/current`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const weatherData = data.data;
          
          // Convert weather data to wave data
          const windSpeedNum = weatherData.windSpeed ? parseFloat(weatherData.windSpeed) : 0;
          const windDirectionNum = weatherData.windDirection ? parseFloat(weatherData.windDirection) : 180;
          
          const waveData: WaveData = {
            height: weatherData.waveHeight || 0.5,
            direction: windDirectionNum,
            period: weatherData.wavePeriod || 5,
            speed: windSpeedNum / 3.6, // Convert km/h to m/s
            windSpeed: windSpeedNum,
            windDirection: windDirectionNum,
            timestamp: Date.now(),
            // Include additional weather data
            temperature: weatherData.temperature,
            humidity: weatherData.humidity,
            pressure: weatherData.pressure,
            visibility: weatherData.visibility,
            rainChance: weatherData.rainChance,
            waterTemperature: weatherData.waterTemperature,
            // Include forecast data
            forecast: weatherData.forecast
          };
          
          console.log('Converted wave data:', waveData);
          console.log('Forecast data included:', !!waveData.forecast, 'length:', waveData.forecast?.length);
          
          // Update cache
          const forecast: WaveForecast = {
            current: waveData,
            forecast: this.generateForecast(waveData),
            location
          };
          this.cache.set(key, forecast);
          return waveData;
        }
      }
      
      // Fallback to mock data
      const waveData = this.generateMockWaveData(location);
      
      // Update cache
      const forecast: WaveForecast = {
        current: waveData,
        forecast: this.generateForecast(waveData),
        location
      };
      this.cache.set(key, forecast);

      return waveData;
    } catch (error) {
      console.error('Error fetching wave data:', error);
      // Return default values on error
      return {
        height: 1.0,
        direction: 180,
        period: 6.0,
        speed: 2.0,
        timestamp: Date.now()
      };
    }
  }

  // Generate forecast data
  private generateForecast(current: WaveData): WaveData[] {
    const forecast: WaveData[] = [];
    const hours = [3, 6, 12, 24, 48]; // 3h, 6h, 12h, 24h, 48h forecast

    hours.forEach(hoursAhead => {
      const variation = 0.2; // 20% variation
      const heightVariation = (Math.random() - 0.5) * variation;
      const directionVariation = (Math.random() - 0.5) * 30; // ±15 degrees
      const periodVariation = (Math.random() - 0.5) * variation;

      forecast.push({
        height: Math.max(0.1, current.height + heightVariation),
        direction: (current.direction + directionVariation + 360) % 360,
        period: Math.max(2, current.period + periodVariation),
        speed: Math.max(0.5, current.speed + heightVariation * 0.5),
        timestamp: Date.now() + hoursAhead * 60 * 60 * 1000
      });
    });

    return forecast;
  }

  // Get wave forecast for a location
  async getWaveForecast(location: Coordinates): Promise<WaveForecast> {
    const key = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.current.timestamp < this.cacheTimeout) {
      return cached;
    }

    // Fetch fresh data
    const current = await this.getCurrentWaveData(location);
    const forecast = this.generateForecast(current);

    const result: WaveForecast = {
      current,
      forecast,
      location
    };

    this.cache.set(key, result);
    return result;
  }

  // Get wave data for multiple locations (useful for map overlay)
  async getWaveDataForBounds(
    north: number,
    south: number,
    east: number,
    west: number,
    gridSize: number = 5
  ): Promise<Map<string, WaveData>> {
    const waveDataMap = new Map<string, WaveData>();
    const latStep = (north - south) / gridSize;
    const lngStep = (east - west) / gridSize;

    const promises: Promise<void>[] = [];

    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const lat = south + i * latStep;
        const lng = west + j * lngStep;
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;

        promises.push(
          this.getCurrentWaveData({ lat, lng }).then(data => {
            waveDataMap.set(key, data);
          })
        );
      }
    }

    await Promise.all(promises);
    return waveDataMap;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Fetch condition alarms
  async getConditionAlarms(): Promise<ConditionAlarm[]> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/weather/condition-alarms`);
      const data = await response.json();
      
      if (data.success) {
        return data.alarms || [];
      } else {
        console.error('Error fetching condition alarms:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching condition alarms:', error);
      return [];
    }
  }
}

export const waveService = new WaveService();
