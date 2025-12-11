import React, { useRef, useEffect, useState } from 'react';
import { waveService } from '../services/waveService';

interface WaveOverlayProps {
  isVisible: boolean;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  mapBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  onMinimizedChange?: (isMinimized: boolean) => void;
  onClose?: () => void;
  waveData: {
    height: number;
    direction: number;
    period: number;
    speed: number;
    windSpeed?: number;
    windDirection?: number;
    timestamp: number;
    temperature?: number;
    humidity?: number;
    pressure?: number;
    visibility?: number;
    rainChance?: number;
    waterTemperature?: number;
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
  };
  coastlineData: any;
}

const WaveOverlay: React.FC<WaveOverlayProps> = ({
  isVisible,
  mapCenter,
  mapZoom,
  mapBounds,
  waveData,
  coastlineData,
  onMinimizedChange,
  onClose
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const weatherCardRef = useRef<HTMLDivElement>(null);
  const [alarms, setAlarms] = useState<ConditionAlarm[]>([]);

  // Enhanced weather-responsive wave parameters
  const windSpeed = waveData.windSpeed || waveData.speed || 1;
  const waveHeight = waveData.height || 0.5;
  const originalWindDirection = waveData.windDirection || waveData.direction || 0;
  const windDirection = originalWindDirection + 180; // For wave patterns only
  
  // Calculate wave intensity based on wind speed and wave height
  const waveIntensity = Math.min((windSpeed / 10) + (waveHeight * 2), 5); // Scale to 0-5
  const waveSpeed = Math.max(0.3, windSpeed / 15); // Slower base speed for smoother animation
  const waveAmplitude = Math.max(0.5, waveHeight * 3); // Wave height affects amplitude
  
  // Weather conditions for wave characteristics
  const isCalm = windSpeed < 5;
  const isModerate = windSpeed >= 5 && windSpeed < 15;
  const isRough = windSpeed >= 15 && windSpeed < 25;
  const isStormy = windSpeed >= 25;

  console.log('Weather-responsive waves:', {
    windSpeed,
    waveHeight,
    windDirection,
    waveIntensity,
    waveSpeed,
    waveAmplitude,
    condition: isStormy ? 'stormy' : isRough ? 'rough' : isModerate ? 'moderate' : 'calm',
    hasForecast: !!waveData.forecast,
    forecastLength: waveData.forecast?.length || 0
  });

  // Generate proper coastline mask using SVG
  const generateCoastlineMask = () => {
    if (!coastlineData || !mapBounds) return null;

    // Get coastline points from various possible data structures
    let points = null;
    if (coastlineData?.activeCoastline?.points) {
      points = coastlineData.activeCoastline.points;
    } else if (coastlineData?.coastlines && coastlineData.coastlines.length > 0) {
      points = coastlineData.coastlines[0].points;
    } else if (coastlineData?.points) {
      points = coastlineData.points;
    }

    if (!points || points.length < 3) return null;

    // Convert lat/lng to SVG coordinates (0-2000 range)
    const svgPoints = points.map(point => {
      const x = ((point[1] - mapBounds.west) / (mapBounds.east - mapBounds.west)) * 2000;
      const y = ((mapBounds.north - point[0]) / (mapBounds.north - mapBounds.south)) * 2000;
      return `${x},${y}`;
    }).join(' ');

    return svgPoints;
  };

  if (!isVisible) return null;

  const coastlinePoints = generateCoastlineMask();

  // Helper function to get weather condition icon
  const getWeatherIcon = () => {
    if (isStormy) return "⛈️";
    if (isRough) return "🌊";
    if (isModerate) return "🌤️";
    return "☀️";
  };

  // Helper function to get weather condition text
  const getWeatherCondition = () => {
    if (isStormy) return "Stormy";
    if (isRough) return "Rough Seas";
    if (isModerate) return "Moderate";
    return "Calm";
  };

  // Helper function to convert degrees to compass direction
  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    // Normalize degrees to 0-360 range
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    // Convert to 16-point compass (each direction is 22.5 degrees)
    const index = Math.round(normalizedDegrees / 22.5) % 16;
    
    // Debug logging
    console.log('Wind Direction Debug:', {
      originalDegrees: degrees,
      normalizedDegrees: normalizedDegrees,
      index: index,
      direction: directions[index]
    });
    
    return directions[index];
  };

  // Helper function to convert wind speed to Beaufort scale
  const getWindForce = (speedKmh: number) => {
    if (speedKmh < 1) return 0; // Calm
    if (speedKmh < 6) return 1; // Light air
    if (speedKmh < 12) return 2; // Light breeze
    if (speedKmh < 20) return 3; // Gentle breeze
    if (speedKmh < 29) return 4; // Moderate breeze
    if (speedKmh < 39) return 5; // Fresh breeze
    if (speedKmh < 50) return 6; // Strong breeze
    if (speedKmh < 62) return 7; // Near gale
    if (speedKmh < 75) return 8; // Gale
    if (speedKmh < 89) return 9; // Strong gale
    if (speedKmh < 103) return 10; // Storm
    if (speedKmh < 118) return 11; // Violent storm
    return 12; // Hurricane
  };

  // Helper function to get active weather alerts
  const getActiveAlerts = () => {
    const alerts = [];
    
    // Thunderstorm alerts
    if (waveData.rainChance && waveData.rainChance > 70) {
      alerts.push({
        type: 'warning',
        message: 'High chance of thunderstorms'
      });
    }
    
    // Wind alerts
    if (windSpeed > 50) {
      alerts.push({
        type: 'warning',
        message: 'Strong winds - avoid water activities'
      });
    } else if (windSpeed > 30) {
      alerts.push({
        type: 'warning',
        message: 'Moderate winds - be cautious'
      });
    }
    
    // Wave height alerts
    if (waveHeight > 2) {
      alerts.push({
        type: 'warning',
        message: 'High waves - dangerous conditions'
      });
    } else if (waveHeight > 1.5) {
      alerts.push({
        type: 'warning',
        message: 'Moderate waves - experienced swimmers only'
      });
    }
    
    // Jellyfish alerts (simulated based on water temperature)
    if (waveData.waterTemperature && waveData.waterTemperature > 25) {
      alerts.push({
        type: 'warning',
        message: 'Jellyfish season - check local reports'
      });
    }
    
    // Temperature alerts
    if (waveData.temperature && waveData.temperature > 35) {
      alerts.push({
        type: 'warning',
        message: 'Extreme heat - stay hydrated'
      });
    }
    
    return alerts;
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Notify parent component when minimized state changes
  useEffect(() => {
    onMinimizedChange?.(isMinimized);
  }, [isMinimized, onMinimizedChange]);

  // Handle click outside weather card to close modal
  useEffect(() => {
    if (!isVisible || !onClose) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (weatherCardRef.current && !weatherCardRef.current.contains(event.target as Node)) {
        // Check if click is on the map or outside the weather card
        const target = event.target as HTMLElement;
        // Don't close if clicking on map controls or other UI elements
        if (!target.closest('.map-control-button') && !target.closest('.leaflet-control')) {
          onClose();
        }
      }
    };

    // Add event listener with a small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible, onClose]);


  // Calculate SVG viewBox based on map bounds for proper positioning
  const getViewBox = () => {
    if (!mapBounds) return "0 0 2000 2000";
    
    const width = 2000;
    const height = 2000;
    return `0 0 ${width} ${height}`;
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        background: 'transparent',
        overflow: 'hidden',
        // Ensure the overlay is positioned relative to the map container
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={getViewBox()}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          // Remove transform to prevent coordinate issues
          transform: 'none',
          willChange: 'auto'
        }}
      >
        <defs>
          {/* SVG Mask for coastline */}
          {coastlinePoints && (
            <mask id="coastlineMask">
              <rect width="2000" height="2000" fill="white" />
              <polygon points={coastlinePoints} fill="black" />
            </mask>
          )}

          {/* Wave Pattern Definitions - rotating with wind direction */}
          <pattern id="wavePattern1" x="0" y="0" width="200" height="60" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 100 30)`}>
            <path
              d="M0,30 Q50,10 100,30 T200,30"
              fill="none"
              stroke="#4A90E2"
              strokeWidth="2"
              opacity="0.6"
            />
            <path
              d="M0,45 Q50,25 100,45 T200,45"
              fill="none"
              stroke="#5BA0F2"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </pattern>

          <pattern id="wavePattern2" x="0" y="0" width="150" height="40" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 75 20)`}>
            <path
              d="M0,20 Q37.5,5 75,20 T150,20"
              fill="none"
              stroke="#6BB6FF"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <path
              d="M0,30 Q37.5,15 75,30 T150,30"
              fill="none"
              stroke="#7BC6FF"
              strokeWidth="1"
              opacity="0.3"
            />
          </pattern>

          <pattern id="wavePattern3" x="0" y="0" width="100" height="25" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 50 12.5)`}>
            <path
              d="M0,12.5 Q25,2.5 50,12.5 T100,12.5"
              fill="none"
              stroke="#8CD6FF"
              strokeWidth="1"
              opacity="0.4"
            />
          </pattern>

          {/* Static wave patterns that also move with the same direction */}
          <pattern id="staticWave1" x="0" y="0" width="250" height="50" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 125 25)`}>
            <g style={{ 
              animation: `waveMove ${18}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d="M0,25 Q62.5,10 125,25 T250,25"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <path
                d="M0,35 Q62.5,20 125,35 T250,35"
                fill="none"
                stroke="#93C5FD"
                strokeWidth="1"
                opacity="0.2"
              />
            </g>
          </pattern>

          <pattern id="staticWave2" x="0" y="0" width="180" height="35" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 90 17.5)`}>
            <g style={{ 
              animation: `waveMove ${16}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d="M0,17.5 Q45,7.5 90,17.5 T180,17.5"
                fill="none"
                stroke="#7BC6FF"
                strokeWidth="1"
                opacity="0.25"
              />
            </g>
          </pattern>

          <pattern id="staticWave3" x="0" y="0" width="120" height="20" patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} 60 10)`}>
            <g style={{ 
              animation: `waveMove ${14}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d="M0,10 Q30,3 60,10 T120,10"
                fill="none"
                stroke="#A5D6FF"
                strokeWidth="0.8"
                opacity="0.2"
              />
            </g>
          </pattern>

          {/* Weather-responsive animated wave patterns - moving with wind direction */}
          <pattern id="animatedWave1" x="0" y="0" width={300 + (waveAmplitude * 20)} height={80 + (waveAmplitude * 10)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} ${(300 + waveAmplitude * 20)/2} ${(80 + waveAmplitude * 10)/2})`}>
            <g style={{ 
              animation: `waveMove ${15}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d={`M0,${40 + (waveAmplitude * 5)} Q${75 + (waveAmplitude * 5)},${20 + (waveAmplitude * 8)} ${150 + (waveAmplitude * 10)},${40 + (waveAmplitude * 5)} T${300 + (waveAmplitude * 20)},${40 + (waveAmplitude * 5)}`}
                fill="none"
                stroke={isStormy ? "#1E3A8A" : isRough ? "#1E40AF" : "#3B82F6"}
                strokeWidth={isStormy ? 4 : isRough ? 3.5 : 3}
                opacity={isCalm ? 0.5 : isModerate ? 0.7 : isRough ? 0.8 : 0.9}
              />
              <path
                d={`M0,${55 + (waveAmplitude * 3)} Q${75 + (waveAmplitude * 5)},${35 + (waveAmplitude * 6)} ${150 + (waveAmplitude * 10)},${55 + (waveAmplitude * 3)} T${300 + (waveAmplitude * 20)},${55 + (waveAmplitude * 3)}`}
                fill="none"
                stroke={isStormy ? "#1E40AF" : "#60A5FA"}
                strokeWidth={isStormy ? 3 : isRough ? 2.5 : 2}
                opacity={isCalm ? 0.3 : isModerate ? 0.5 : isRough ? 0.6 : 0.7}
              />
              <path
                d={`M0,${65 + (waveAmplitude * 2)} Q${75 + (waveAmplitude * 5)},${45 + (waveAmplitude * 4)} ${150 + (waveAmplitude * 10)},${65 + (waveAmplitude * 2)} T${300 + (waveAmplitude * 20)},${65 + (waveAmplitude * 2)}`}
                fill="none"
                stroke={isStormy ? "#3B82F6" : "#93C5FD"}
                strokeWidth={isStormy ? 2.5 : isRough ? 2 : 1.5}
                opacity={isCalm ? 0.2 : isModerate ? 0.3 : isRough ? 0.4 : 0.5}
              />
            </g>
          </pattern>

          <pattern id="animatedWave2" x="0" y="0" width={200 + (waveAmplitude * 15)} height={60 + (waveAmplitude * 8)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} ${(200 + waveAmplitude * 15)/2} ${(60 + waveAmplitude * 8)/2})`}>
            <g style={{ 
              animation: `waveMove ${12}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d={`M0,${30 + (waveAmplitude * 4)} Q${50 + (waveAmplitude * 4)},${15 + (waveAmplitude * 6)} ${100 + (waveAmplitude * 8)},${30 + (waveAmplitude * 4)} T${200 + (waveAmplitude * 15)},${30 + (waveAmplitude * 4)}`}
                fill="none"
                stroke={isStormy ? "#0F172A" : isRough ? "#1E40AF" : "#1E40AF"}
                strokeWidth={isStormy ? 3.5 : isRough ? 3 : 2.5}
                opacity={isCalm ? 0.4 : isModerate ? 0.6 : isRough ? 0.7 : 0.8}
              />
              <path
                d={`M0,${45 + (waveAmplitude * 3)} Q${50 + (waveAmplitude * 4)},${30 + (waveAmplitude * 5)} ${100 + (waveAmplitude * 8)},${45 + (waveAmplitude * 3)} T${200 + (waveAmplitude * 15)},${45 + (waveAmplitude * 3)}`}
                fill="none"
                stroke={isStormy ? "#1E40AF" : "#3B82F6"}
                strokeWidth={isStormy ? 3 : isRough ? 2.5 : 2}
                opacity={isCalm ? 0.3 : isModerate ? 0.4 : isRough ? 0.5 : 0.6}
              />
            </g>
          </pattern>

          <pattern id="animatedWave3" x="0" y="0" width={150 + (waveAmplitude * 10)} height={40 + (waveAmplitude * 6)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${windDirection} ${(150 + waveAmplitude * 10)/2} ${(40 + waveAmplitude * 6)/2})`}>
            <g style={{ 
              animation: `waveMove ${10}s linear infinite`,
              transformOrigin: 'center'
            }}>
              <path
                d={`M0,${20 + (waveAmplitude * 3)} Q${37.5 + (waveAmplitude * 3)},${10 + (waveAmplitude * 4)} ${75 + (waveAmplitude * 5)},${20 + (waveAmplitude * 3)} T${150 + (waveAmplitude * 10)},${20 + (waveAmplitude * 3)}`}
                fill="none"
                stroke={isStormy ? "#3B82F6" : isRough ? "#60A5FA" : "#60A5FA"}
                strokeWidth={isStormy ? 2.5 : isRough ? 2 : 1.5}
                opacity={isCalm ? 0.3 : isModerate ? 0.5 : isRough ? 0.6 : 0.7}
              />
              <path
                d={`M0,${30 + (waveAmplitude * 2)} Q${37.5 + (waveAmplitude * 3)},${20 + (waveAmplitude * 3)} ${75 + (waveAmplitude * 5)},${30 + (waveAmplitude * 2)} T${150 + (waveAmplitude * 10)},${30 + (waveAmplitude * 2)}`}
                fill="none"
                stroke={isStormy ? "#60A5FA" : "#93C5FD"}
                strokeWidth={isStormy ? 2 : isRough ? 1.5 : 1}
                opacity={isCalm ? 0.2 : isModerate ? 0.3 : isRough ? 0.4 : 0.5}
              />
            </g>
          </pattern>
        </defs>

        {/* Wave Layers */}
        {coastlinePoints && (
          <>
            {/* Static background waves - always visible and moving */}
            <rect
              width="2000"
              height="2000"
              fill="url(#staticWave1)"
              mask="url(#coastlineMask)"
              opacity="0.4"
            />
            
            <rect
              width="2000"
              height="2000"
              fill="url(#staticWave2)"
              mask="url(#coastlineMask)"
              opacity="0.3"
              style={{ transform: 'translateY(15px)' }}
            />
            
            <rect
              width="2000"
              height="2000"
              fill="url(#staticWave3)"
              mask="url(#coastlineMask)"
              opacity="0.25"
              style={{ transform: 'translateY(30px)' }}
            />
            
            {/* Animated weather-responsive waves */}
            {/* Large waves */}
            <rect
              width="2000"
              height="2000"
              fill="url(#animatedWave1)"
              mask="url(#coastlineMask)"
              opacity={Math.min(waveIntensity * 0.3, 0.8)}
            />
            
            {/* Medium waves */}
            <rect
              width="2000"
              height="2000"
              fill="url(#animatedWave2)"
              mask="url(#coastlineMask)"
              opacity={Math.min(waveIntensity * 0.4, 0.7)}
              style={{ transform: 'translateY(20px)' }}
            />
            
            {/* Small waves */}
            <rect
              width="2000"
              height="2000"
              fill="url(#animatedWave3)"
              mask="url(#coastlineMask)"
              opacity={Math.min(waveIntensity * 0.5, 0.6)}
              style={{ transform: 'translateY(40px)' }}
            />

            {/* Static wave patterns for depth */}
            <rect
              width="2000"
              height="2000"
              fill="url(#wavePattern1)"
              mask="url(#coastlineMask)"
              opacity="0.2"
            />
            <rect
              width="2000"
              height="2000"
              fill="url(#wavePattern2)"
              mask="url(#coastlineMask)"
              opacity="0.15"
              style={{ transform: 'translateY(15px)' }}
            />
            <rect
              width="2000"
              height="2000"
              fill="url(#wavePattern3)"
              mask="url(#coastlineMask)"
              opacity="0.1"
              style={{ transform: 'translateY(30px)' }}
            />
          </>
        )}

        {/* Fallback for no coastline data */}
        {!coastlinePoints && (
          <>
            <rect
              width="2000"
              height="2000"
              fill="url(#animatedWave1)"
              opacity="0.3"
              style={{
                clipPath: 'ellipse(1200px 800px at 50% 60%)'
              }}
            />
            <rect
              width="2000"
              height="2000"
              fill="url(#animatedWave2)"
              opacity="0.2"
              style={{
                clipPath: 'ellipse(1200px 800px at 50% 60%)',
                transform: 'translateY(20px)'
              }}
            />
          </>
        )}

      </svg>


      {/* Apple-style Weather Info Overlay */}
      <div className="absolute top-4 left-4 right-20 sm:left-8 sm:right-8 lg:left-auto lg:right-24 pointer-events-auto z-20">
        <div ref={weatherCardRef} className={`weather-card bg-white/20 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border border-white/30 transition-all duration-500 ease-in-out ${
          isExpanded ? 'lg:min-w-[480px] lg:max-w-[540px]' : 'min-w-[180px]'
        } ${isExpanded ? 'max-h-[80vh] overflow-y-auto' : ''} ${
          isMinimized ? 'minimized' : ''
        } ${isAnimating ? 'minimizing' : ''}`} 
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}>
          {/* Header */}
          <div className="weather-header flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Left expand arrow for large screens */}
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden lg:flex items-center justify-center w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200"
                >
                <svg 
                  className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-2xl">{getWeatherIcon()}</div>
              <div>
                <h3 className="text-white font-semibold text-base">Gozo Weather</h3>
                <p className="text-white/70 text-xs">{getWeatherCondition()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-white text-xs opacity-70">Live</div>
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Content Container */}
          <div className={`weather-content transition-all duration-500 ease-in-out ${
            isExpanded ? 'lg:flex lg:flex-row-reverse lg:gap-3' : ''
          }`}>
            {/* Main Weather Data */}
            <div className={`${isExpanded ? 'lg:w-1/2' : ''}`}>
              {/* Top Row: Temperature and Humidity */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Temperature</div>
                  <div className="text-white text-2xl font-bold">{Math.round(waveData.temperature || 24)}°C</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Humidity</div>
                  <div className="text-white text-2xl font-bold">{Math.round(waveData.humidity || 60)}%</div>
                </div>
              </div>

              {/* Bottom Row: Water Temperature and Wave Height */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Water Temperature</div>
                  <div className="text-white text-2xl font-bold">{Math.round(waveData.waterTemperature || 22)}°C</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Wave Height</div>
                  <div className="text-white text-2xl font-bold">{waveHeight.toFixed(1)}m</div>
                </div>
              </div>

              {/* Wind Direction */}
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/70 text-xs uppercase tracking-wide mb-1">Wind Direction</div>
                    <div className="text-white text-sm font-semibold">
                      {getWindDirection(originalWindDirection)}  {Math.round(originalWindDirection)}°  {Math.round(windSpeed)}km/h
                    </div>
                    <div className="text-white/70 text-xs mt-1">
                      Force {getWindForce(windSpeed)}
                    </div>
                  </div>
               <div 
                 className="w-16 h-16 bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-indigo-600/30 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/30 backdrop-blur-sm"
               >
                {/* SVG Compass */}
                <svg 
                  className="compass" 
                  viewBox="0 0 200 200" 
                  width="60" 
                  height="60" 
                  style={{ '--direction': `${originalWindDirection}deg` } as React.CSSProperties}
                >
                  <text x="100" y="30" fill="#ffffff" fontSize="30" textAnchor="middle" fontWeight="bold">N</text>
                  <text x="100" y="195" fill="#ffffff" fontSize="35" textAnchor="middle" fontWeight="bold">S</text>
                  <text x="185" y="115" fill="#ffffff" fontSize="35" textAnchor="middle" fontWeight="bold">E</text>
                  <text x="15" y="115" fill="#ffffff" fontSize="30" textAnchor="middle" fontWeight="bold">W</text>
                  <circle cx="100" cy="100" r="20" fill="#ffaa00" />
                  <circle cx="100" cy="100" r="5" fill="white" />
                   <g transform={`translate(100, 100) rotate(${originalWindDirection - 90 + 180}) translate(-100, -100)`}>
                     <path d="M82 94 Q100 94 100 90 Q100 80 172 100 Q100 120 100 110 Q100 106 82 106 Z" fill="none" stroke="#ffaa00" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
                </div>
              </div>

              {/* Weather Alerts */}
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/70 text-xs uppercase tracking-wide">Weather Alerts</div>
                  <div className="text-white text-sm font-medium">{getActiveAlerts().length} active</div>
                </div>
                <div className="space-y-1">
                  {getActiveAlerts().length > 0 ? (
                    getActiveAlerts().map((alert, index) => (
                      <div key={index} className={`flex items-center gap-2 p-1.5 rounded-lg ${alert.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${alert.type === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
                        <span className="text-white text-xs">{alert.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/60 text-xs">No active alerts</div>
                  )}
                </div>
              </div>

              {/* Mobile Expand Button */}
              <div className="lg:hidden mt-3">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`w-full rounded-xl p-3 backdrop-blur-sm transition-all duration-200 flex items-center justify-center gap-2 text-white font-medium ${
                    isExpanded 
                      ? 'bg-purple-500/40 hover:bg-purple-500/50 border border-purple-400/60' 
                      : 'bg-purple-400/20 hover:bg-purple-400/30 border border-purple-300/30'
                  }`}
                >
                  {isExpanded ? 'Show Less' : 'Show More'}
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Extended Content - Horizontal on large screens, vertical on mobile */}
            {isExpanded && (
              <div className={`${isExpanded ? 'lg:w-1/2' : ''} ${
                isExpanded ? 'lg:block' : 'hidden'
              }`}>
                <div className="space-y-4">
                  {/* Detailed Current Weather */}
                  <div>
                    <h4 className="text-white font-medium mb-3">Current Conditions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <div className="text-white/70 text-xs mb-1">Pressure</div>
                        <div className="text-white font-semibold">{Math.round(waveData.pressure || 1013)} hPa</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <div className="text-white/70 text-xs mb-1">Visibility</div>
                        <div className="text-white font-semibold">{Math.round((waveData.visibility || 10000) / 1000)} km</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <div className="text-white/70 text-xs mb-1">Rain Chance</div>
                        <div className="text-white font-semibold">{Math.round(waveData.rainChance || 0)}%</div>
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Forecast */}
                  <div>
                    <h4 className="text-white font-medium mb-3">7-Day Forecast</h4>
                    <div className="space-y-2">
                       {waveData.forecast && waveData.forecast.map((day, index) => {
                         // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
                         const [year, month, dayNum] = day.date.split('-').map(Number);
                         const forecastDate = new Date(year, month - 1, dayNum);
                         const dateStr = forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                         
                         // Get today's date in Malta timezone for comparison
                         const now = new Date();
                         const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Malta' }); // YYYY-MM-DD
                         const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
                         const today = new Date(todayYear, todayMonth - 1, todayDay);
                         
                         // Calculate days difference
                         const daysDiff = Math.floor((forecastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                         
                         // Determine day name based on actual date comparison
                         let dayName = day.dayName;
                         if (daysDiff === 0) {
                           dayName = 'Today';
                         } else if (daysDiff === 1) {
                           dayName = 'Tomorrow';
                         }
                         
                         return (
                           <div key={day.date} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <div className="text-white/70 text-sm font-medium min-w-[80px]">
                                   <div>{dayName}</div>
                                   <div className="text-xs text-white/50">{dateStr}</div>
                                 </div>
                                 <div className="text-xl">
                                   {day.weather?.main === 'Clear' ? '☀️' : 
                                    day.weather?.main === 'Clouds' ? '☁️' :
                                    day.weather?.main === 'Rain' ? '🌧️' :
                                    day.weather?.main === 'Thunderstorm' ? '⛈️' : '🌤️'}
                                 </div>
                                 <div className="text-white text-sm">
                                   <span className="font-semibold">{Math.round(day.temperature.max)}°</span>
                                   <span className="text-white/70 ml-1">{Math.round(day.temperature.min)}°</span>
                                 </div>
                               </div>
                               <div className="text-white/70 text-xs text-right">
                                 <div>🌊 {day.waveHeight.toFixed(1)}m</div>
                                 <div>💨 {Math.round(day.windSpeed)} km/h</div>
                                 <div className="text-white/60">({getWindDirection(day.windDirection)})</div>
                               </div>
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* CSS Animations */}
      <style>{`
        @keyframes waveMove {
          0% { 
            transform: translateY(0) translateZ(0);
          }
          100% { 
            transform: translateY(-100%) translateZ(0);
          }
        }
        
        /* Ensure smooth animations during map navigation */
        svg {
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        /* Optimize for map overlay performance */
        .wave-overlay {
          will-change: auto;
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        /* Weather card animations */
        .weather-card {
          animation: slideInRight 0.5s ease-out;
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0% { 
            transform: scale(1);
            opacity: 0.9;
          }
          50% { 
            transform: scale(1.1);
            opacity: 0.7;
          }
          100% { 
            transform: scale(1);
            opacity: 0.9;
          }
        }

        /* Custom scrollbar for extended content */
        .lg\\:overflow-y-auto::-webkit-scrollbar {
          width: 4px;
        }

        .lg\\:overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        .lg\\:overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }

        .lg\\:overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        /* Mini Weather Card - Freeze the animation state */
        .weather-card.minimized {
          position: fixed !important;
          bottom: 16px !important;
          right: 16px !important;
          left: auto !important;
          top: auto !important;
          cursor: pointer !important;
          z-index: 30 !important;
          transform: scale(0.2) translateY(750px) translateX(500px) !important;
        }

        .weather-card.minimized:hover {
          transform: scale(0.22) translateY(750px) translateX(500px) !important;
        }

        /* Animation for shrinking to mini */
        .weather-card.minimizing {
          animation: shrinkAndMoveToCorner 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          transform-origin: center;
        }

        @keyframes shrinkAndMoveToCorner {
          0% {
            transform: scale(1) translateY(0) translateX(0);
          }
          95% {
            transform: scale(0.2) translateY(1200px) translateX(700px);
          }
          100% {
            transform: scale(0.2) translateY(1200px) translateX(700px);
          }
        }

        /* Floating Weather Button Glow Effect */
        .weather-float-btn {
          animation: weatherGlow 2s ease-in-out infinite alternate;
        }

        .weather-float-btn.appearing {
          animation: bottlePop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.3s both, purpleGlow 2s ease-in-out infinite alternate 0.8s;
        }

        @keyframes bottlePop {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes purpleGlow {
          from {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(147, 51, 234, 0.4), 0 0 60px rgba(147, 51, 234, 0.3), 0 0 80px rgba(147, 51, 234, 0.2);
          }
          to {
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.5), 0 0 60px rgba(147, 51, 234, 0.6), 0 0 90px rgba(147, 51, 234, 0.5), 0 0 120px rgba(147, 51, 234, 0.3);
          }
        }

        @keyframes weatherGlow {
          from {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.2);
          }
          to {
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.5), 0 0 60px rgba(59, 130, 246, 0.5), 0 0 90px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>

    </div>
  );
};

export default WaveOverlay;
