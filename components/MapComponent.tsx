import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getApiBaseUrl, getTileBaseUrl } from '../services/config';
import { Coordinates, Place, TripPlan, TravelMode, GroupedBusStop, PlaceCategory, HikingTrail } from '../types';
import { CATEGORY_INFO, DEFAULT_INITIAL_COORDS } from '../constants';
import MapImagePreview from './MapImagePreview';
import TripMapPreview from './TripMapPreview';
import WaveOverlay from './WaveOverlayNew';
import { createVillageLabelMarkers } from './VillageLabels';
import allPlacesData from '@/backend/places.json';
import { tileManager } from '../services/tileManager';
import { assetCache } from '../services/assetCache';
import { waveService, WaveData, ConditionAlarm } from '../services/waveService';
import { aisService, AISPosition } from '../services/aisService';
import UserAlarmModal from './UserAlarmModal';
import TreasureHuntModal from './TreasureHuntModal';
import { useAuth } from '../auth/AuthContext';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MapComponentProps {
  flyToLocation: Coordinates | null;
  flyToFromEventsOrExcursions?: boolean; // Flag to indicate if flyTo is from events/excursions page
  userLocation: Coordinates | null;
  places: Place[];
  onMarkerClick: (place: Place | GroupedBusStop) => void;
  onClusterClick: (stops: any[]) => void;
  selectedPlace: Place | null;
  hoveredPlaceId: string | null;
  onPlaceHover: (placeId: string | null) => void;
  viewingTrip: TripPlan | null;
  hoveredTripPlaceId: string | null;
  activeTravelMode?: TravelMode;
  isLocationTrackingEnabled: boolean;
  onToggleLocationTracking: () => void;
  onMapMove: (center: Coordinates) => void;
  onMapBoundsChange?: (bounds: MapBounds | null) => void;
  manualPinLocation: Coordinates | null;
  onMapLongPress: (coords: Coordinates) => void;
  onRemovePin: () => void;
  isSidebarOpen: boolean;
  selectedBusRoute: string | null;
  mapCenter: Coordinates;
  selectedGroupedBusStop: GroupedBusStop | null;
  selectedCategories: PlaceCategory[];
  isSmallScreen: boolean;
  tourRoutes: any[];
  selectedTour: Place | null;
  hikingTrails: Place[];
  allBusStops: Place[];
  selectedBusRouteCoordinates: Coordinates[] | null;
  showWaves?: boolean;
  onToggleWaves?: () => void;
  theme?: 'light' | 'dark';
  searchRadius?: number;
  onGoModeChange?: (isActive: boolean) => void;
}

const isValidLatLng = (coords: any): coords is Coordinates => {
    if (!coords) return false;
    const { lat, lng } = coords;
    return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
};

const getDistance = (coords1: Coordinates, coords2: Coordinates) => {
    if (!coords1 || !coords2) return Infinity;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // distance in meters
};

const MapComponent: React.FC<MapComponentProps> = ({ flyToLocation, flyToFromEventsOrExcursions = false, userLocation, places, onMarkerClick, onClusterClick, selectedPlace, hoveredPlaceId, onPlaceHover, viewingTrip, hoveredTripPlaceId, activeTravelMode, isLocationTrackingEnabled, onToggleLocationTracking, onMapMove, onMapBoundsChange, manualPinLocation, onMapLongPress, onRemovePin, isSidebarOpen, selectedBusRoute, mapCenter, selectedGroupedBusStop, selectedCategories, isSmallScreen, tourRoutes, selectedTour, hikingTrails, allBusStops, selectedBusRouteCoordinates, showWaves = false, onToggleWaves, theme = 'dark', searchRadius = 50, onGoModeChange }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  // Monitor onboarding state via body class
  useEffect(() => {
    const checkOnboarding = () => {
      setIsOnboardingActive(document.body.classList.contains('onboarding-active'));
    };
    
    checkOnboarding();
    const observer = new MutationObserver(checkOnboarding);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);
  
  // Track when the Leaflet library is available (loaded via CDN)
  // Cache status state for debugging
  const [cacheStatus, setCacheStatus] = useState<{ hits: number; misses: number; total: number }>({ hits: 0, misses: 0, total: 0 });
  
  // Safety check to ensure selectedCategories is always an array
  const safeSelectedCategories = selectedCategories || [];
  
  // Safety check to ensure selectedTour is always defined
  const safeSelectedTour = selectedTour || null;
  
  // Safety checks to ensure arrays are always defined
  const safeTourRoutes = tourRoutes || [];
  const safeHikingTrails = hikingTrails || [];
  
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const pinMarkerRef = useRef<any>(null);
  const placeMarkersRef = useRef<any[]>([]);
  const labelMarkersRef = useRef<any[]>([]);
  const villageLabelMarkersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);
  const busRouteLayerRef = useRef<any>(null);
  const busStopMarkersRef = useRef<any>(null);
  const busRoutePolylineRef = useRef<any>(null);
  const panTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [busStopClusters, setBusStopClusters] = useState<any[]>([]);
  const [previewPosition, setPreviewPosition] = useState<{x: number, y: number} | null>(null);
  const [iconOffsets, setIconOffsets] = useState<{ [key: string]: { x: number, y: number } }>({});
  const [mapZoom, setMapZoom] = useState(13); // Initial zoom level
  const hikingTrailLayersRef = useRef<any[]>([]);
  const hikingTrailPointMarkersRef = useRef<any[]>([]);
  const tourRouteLayersRef = useRef<any[]>([]); // New ref for tour route layers

  const [isGoModeActive, setIsGoModeActive] = useState(false);
  const [toursPreserved, setToursPreserved] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [waveData, setWaveData] = useState<WaveData | null>(null);
  const [routeNamesMap, setRouteNamesMap] = useState<{ [key: string]: string }>({});
  
  // Track icon loading for cache status indicator
  const [iconLoadStats, setIconLoadStats] = useState<{hits: number, misses: number, total: number}>({hits: 0, misses: 0, total: 0});
  
  // Fetch route names for lookup
  useEffect(() => {
    const fetchRouteNames = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/bus-routes`);
        const routes = await response.json();
        const namesMap: { [key: string]: string } = {};
        routes.forEach((route: { id: string; displayedName?: string; name: string }) => {
          namesMap[route.id] = route.displayedName || route.name;
        });
        setRouteNamesMap(namesMap);
      } catch (error) {
        console.error('Failed to fetch route names:', error);
      }
    };
    
    fetchRouteNames();
  }, []);

  // Monitor icon loading performance to detect cache hits (ONCE on mount)
  const hasCheckedIcons = useRef(false);
  const preloadedIconsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!places || places.length === 0 || hasCheckedIcons.current) return;
    
    hasCheckedIcons.current = true;
    
    // Use small version for faster loading
    const customIcons = places
      .filter(place => place.icon && place.icon.startsWith('/uploads/'))
      .map(place => {
        let icon = place.icon;
        if (icon.includes('-optimized.webp')) {
          icon = icon.replace('-optimized.webp', '-small.webp');
        }
        return icon;
      })
      .filter((icon, index, self) => self.indexOf(icon) === index);
    
    if (customIcons.length === 0) return;
    
    let loadedCount = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    const totalIcons = customIcons.length;
    
    const loadIcon = (iconUrl: string) => {
      // Check if already preloaded
      if (preloadedIconsRef.current.has(iconUrl)) {
        cacheHits++;
        loadedCount++;
        setCacheStatus({ hits: cacheHits, misses: cacheMisses, total: totalIcons });
        return;
      }
      
      const startTime = performance.now();
      const fullUrl = `${getApiBaseUrl()}${iconUrl}`;
      
      // CRITICAL: Use fetch with highest priority to start loading IMMEDIATELY
      fetch(fullUrl, { 
        cache: 'force-cache',
        priority: 'high' as any // Force high priority
      }).then(response => {
        if (response.ok) {
          response.blob().then(() => {
            // Image is now in browser cache
            loadedCount++;
            const loadTime = performance.now() - startTime;
            
            if (loadTime < 50) {
              cacheHits++;
            } else {
              cacheMisses++;
            }
            
            preloadedIconsRef.current.add(iconUrl);
            setIconLoadStats({ hits: cacheHits, misses: cacheMisses, total: totalIcons });
            setCacheStatus({ hits: cacheHits, misses: cacheMisses, total: totalIcons });
          });
        }
      }).catch(() => {
        loadedCount++;
        cacheMisses++;
        setIconLoadStats({ hits: cacheHits, misses: cacheMisses, total: totalIcons });
        setCacheStatus({ hits: cacheHits, misses: cacheMisses, total: totalIcons });
      });
    };
    
    // Load icons immediately - browser will use HTTP cache
    customIcons.forEach(icon => loadIcon(icon));
  }, [places]);

  // Load custom categories
  useEffect(() => {
    const loadCustomCategories = async () => {
      try {
        // Try loading from localStorage first
        const saved = localStorage.getItem('customCategories');
        if (saved) {
          const customCats = JSON.parse(saved);
          setCustomCategories(customCats);
        } else {
          // Fallback to static file
          const response = await fetch('/custom-categories.json');
          const customCats = await response.json();
          setCustomCategories(customCats);
        }
      } catch (error) {
        console.error('Error loading custom categories:', error);
      }
    };
    
    loadCustomCategories();
    
    // Listen for custom categories changes
    const handleCustomCategoriesChange = () => {
      loadCustomCategories();
    };
    
    window.addEventListener('customCategoriesChanged', handleCustomCategoriesChange);
    window.addEventListener('storage', (e) => {
      if (e.key === 'customCategories') {
        loadCustomCategories();
      }
    });
    
    return () => {
      window.removeEventListener('customCategoriesChanged', handleCustomCategoriesChange);
    };
  }, []);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [coastlineData, setCoastlineData] = useState<any>(null);
  const [alarms, setAlarms] = useState<ConditionAlarm[]>([]);
  const alarmMarkersRef = useRef<any[]>([]);
  const [userAlarms, setUserAlarms] = useState<any[]>([]);
  const userAlarmMarkersRef = useRef<any[]>([]);
  const [isUserAlarmModalOpen, setIsUserAlarmModalOpen] = useState(false);
  const [userAlarmCoordinates, setUserAlarmCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [isWeatherMinimized, setIsWeatherMinimized] = useState(false);
  const [showUserAlarms, setShowUserAlarms] = useState(false);
  const [isTreasureHuntModalOpen, setIsTreasureHuntModalOpen] = useState(false);
  const [selectedHuntIdForModal, setSelectedHuntIdForModal] = useState<number | null>(null);
  const [activeTreasureHunt, setActiveTreasureHunt] = useState<any>(null);
  const [treasureHuntClue, setTreasureHuntClue] = useState<any>(null);
  const [allTreasureHunts, setAllTreasureHunts] = useState<any[]>([]);
  // Load selected active hunt ID from localStorage on mount
  const getInitialHuntId = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedActiveHuntId');
      return saved ? parseInt(saved, 10) : null;
    }
    return null;
  };
  
  // Load showTreasureHuntClues preference from localStorage on mount
  const getInitialShowClues = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showTreasureHuntClues');
      return saved !== null ? saved === 'true' : true; // Default to true if not set
    }
    return true;
  };
  
  const [showTreasureHuntClues, setShowTreasureHuntClues] = useState(getInitialShowClues);
  
  // Persist showTreasureHuntClues to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showTreasureHuntClues', showTreasureHuntClues.toString());
    }
  }, [showTreasureHuntClues]);
  
  const [selectedActiveHuntId, setSelectedActiveHuntId] = useState<number | null>(getInitialHuntId);
  const selectedActiveHuntIdRef = useRef<number | null>(getInitialHuntId());
  const treasureHuntMarkerRef = useRef<any>(null);
  const treasureHuntStartMarkersRef = useRef<Map<number, any>>(new Map());
  
  // AIS tracking for dynamic ferry markers
  const ferryMarkersRef = useRef<Map<string, { marker: any; placeId: string; targetPosition: Coordinates; animationStartTime: number; animationStartPos: Coordinates }>>(new Map());
  const [aisPositions, setAisPositions] = useState<Map<string, AISPosition>>(new Map());

  // Load all treasure hunts and active hunt with current clue
  const loadActiveTreasureHunt = useCallback(async (preferredHuntId?: number | null) => {
    if (!user || !mapRef.current) return;
    
    // If no preferred hunt ID is provided, try to load from localStorage
    if (!preferredHuntId && typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedActiveHuntId');
      if (saved) {
        preferredHuntId = parseInt(saved, 10);
      }
    }
    
    try {
      const { treasureHuntService } = await import('../services/treasureHuntService');
      const hunts = await treasureHuntService.getTreasureHunts();
      
      console.log('[Treasure Hunt] Loading hunts, found:', hunts.length, 'Preferred hunt ID:', preferredHuntId);
      
      // Store all active hunts
      const activeHunts = hunts.filter(h => h.is_active === 1);
      setAllTreasureHunts(activeHunts);
      
      // If a preferred hunt ID is specified, prioritize it
      let foundActiveHunt = false;
      
      if (preferredHuntId) {
        const preferredHunt = activeHunts.find(h => h.id === preferredHuntId);
        if (preferredHunt) {
          console.log('[Treasure Hunt] Checking preferred hunt:', preferredHunt.id, preferredHunt.name);
          const progress = await treasureHuntService.getUserProgress(preferredHunt.id);
          if (progress) {
            const clue = await treasureHuntService.getCurrentClue(preferredHunt.id);
            if (clue && clue.latitude != null && clue.longitude != null && 
                typeof clue.latitude === 'number' && typeof clue.longitude === 'number' &&
                !isNaN(clue.latitude) && !isNaN(clue.longitude)) {
              console.log('[Treasure Hunt] Setting preferred active hunt and clue:', preferredHunt.id, clue.clue_number);
              setActiveTreasureHunt(preferredHunt);
              setTreasureHuntClue(clue);
              setSelectedActiveHuntId(preferredHunt.id);
              selectedActiveHuntIdRef.current = preferredHunt.id;
              // Persist to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('selectedActiveHuntId', preferredHunt.id.toString());
              }
              foundActiveHunt = true;
            }
          }
        }
      }
      
      // If preferred hunt not found or not specified, find first hunt with progress
      if (!foundActiveHunt) {
        for (const hunt of activeHunts) {
          // Skip if this was the preferred hunt we already checked
          if (preferredHuntId && hunt.id === preferredHuntId) continue;
          
          console.log('[Treasure Hunt] Checking hunt:', hunt.id, hunt.name);
          const progress = await treasureHuntService.getUserProgress(hunt.id);
          console.log('[Treasure Hunt] Progress for hunt', hunt.id, ':', progress);
          
          if (progress) {
            // User has started this hunt
            console.log('[Treasure Hunt] User has progress, fetching current clue for hunt', hunt.id);
            const clue = await treasureHuntService.getCurrentClue(hunt.id);
            console.log('[Treasure Hunt] Current clue for hunt', hunt.id, ':', clue);
            
            // Only set clue if it exists and has valid coordinates
            if (clue && clue.latitude != null && clue.longitude != null && 
                typeof clue.latitude === 'number' && typeof clue.longitude === 'number' &&
                !isNaN(clue.latitude) && !isNaN(clue.longitude)) {
              console.log('[Treasure Hunt] Setting active hunt and clue:', hunt.id, clue.clue_number);
              setActiveTreasureHunt(hunt);
              setTreasureHuntClue(clue);
              setSelectedActiveHuntId(hunt.id);
              selectedActiveHuntIdRef.current = hunt.id;
              // Persist to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('selectedActiveHuntId', hunt.id.toString());
              }
              foundActiveHunt = true;
              break; // Only show one active hunt's clue at a time
            } else {
              console.warn('[Treasure Hunt] Clue missing or has invalid coordinates for hunt', hunt.id, ':', clue);
            }
          } else {
            console.log('[Treasure Hunt] No progress for hunt', hunt.id);
          }
        }
      }
      
      if (!foundActiveHunt) {
        console.log('[Treasure Hunt] No active hunt with progress found');
        setActiveTreasureHunt(null);
        setTreasureHuntClue(null);
        setSelectedActiveHuntId(null);
        selectedActiveHuntIdRef.current = null;
        // Clear from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('selectedActiveHuntId');
        }
      }
    } catch (error) {
      console.error('[Treasure Hunt] Error loading treasure hunts:', error);
      setActiveTreasureHunt(null);
      setTreasureHuntClue(null);
      setSelectedActiveHuntId(null);
      selectedActiveHuntIdRef.current = null;
      // Clear from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedActiveHuntId');
      }
      setAllTreasureHunts([]);
    }
  }, [user]);

  // Load treasure hunt on mount and when user changes
  useEffect(() => {
    if (user) {
      loadActiveTreasureHunt();
    }
  }, [user, loadActiveTreasureHunt]);

  // Create treasure hunt clue marker on map
  useEffect(() => {
    if (!mapRef.current || !treasureHuntClue || !showTreasureHuntClues) {
      // Remove marker if clue icons are hidden
      if (mapRef.current && treasureHuntMarkerRef.current) {
        mapRef.current.removeLayer(treasureHuntMarkerRef.current);
        treasureHuntMarkerRef.current = null;
      }
      return;
    }
    
    const map = mapRef.current;
    
    // Remove existing marker
    if (treasureHuntMarkerRef.current) {
      map.removeLayer(treasureHuntMarkerRef.current);
      treasureHuntMarkerRef.current = null;
    }
    
    // Create new marker for current clue
    const clue = treasureHuntClue;
    
    // Validate coordinates before creating marker
    if (!clue.latitude || !clue.longitude || 
        typeof clue.latitude !== 'number' || typeof clue.longitude !== 'number' ||
        isNaN(clue.latitude) || isNaN(clue.longitude)) {
      console.warn('Invalid clue coordinates:', clue);
      return;
    }
    
    // Validate latitude and longitude are within valid ranges
    if (clue.latitude < -90 || clue.latitude > 90 || 
        clue.longitude < -180 || clue.longitude > 180) {
      console.warn('Clue coordinates out of range:', clue);
      return;
    }
    
    const icon = clue.icon || activeTreasureHunt?.icon || '🏴‍☠️';
    const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.endsWith('.png') || icon.endsWith('.gif') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp');
    const isEmoji = !isImageUrl && /[\u{1F300}-\u{1F9FF}]/u.test(icon);
    
    let markerHtml;
    if (isImageUrl) {
      // Handle data URLs, HTTP URLs, and file paths correctly
      let imgSrc;
      if (icon.startsWith('data:image')) {
        // Data URL - use directly
        imgSrc = icon;
      } else if (icon.startsWith('http://') || icon.startsWith('https://')) {
        // Full HTTP/HTTPS URL - use directly
        imgSrc = icon;
      } else if (icon.startsWith('/uploads/') || icon.startsWith('/')) {
        // Absolute path - prepend API base URL if needed
        imgSrc = icon.startsWith('/uploads/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}${icon}`;
      } else {
        // Relative path - assume it's in /uploads/
        imgSrc = `${getApiBaseUrl()}/uploads/${icon}`;
      }
      markerHtml = `<div style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.95); border-radius: 50%; border: 3px solid #f59e0b; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"><img src="${imgSrc}" alt="Clue" style="width: 40px; height: 40px; object-fit: contain; border-radius: 50%;"></div>`;
    } else if (isEmoji) {
      markerHtml = `<div style="font-size: 40px; text-align: center; line-height: 1; background: rgba(255, 255, 255, 0.95); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border: 3px solid #f59e0b; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">${icon}</div>`;
    } else {
      markerHtml = `<div style="font-size: 40px; text-align: center; line-height: 1; background: rgba(255, 255, 255, 0.95); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border: 3px solid #f59e0b; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">🏴‍☠️</div>`;
    }
    
    // Ensure coordinates are valid numbers
    const lat = Number(clue.latitude);
    const lng = Number(clue.longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid clue coordinates:', { lat, lng, clue });
      return;
    }
    
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'treasure-hunt-clue-marker',
        html: markerHtml,
        iconSize: [50, 50] as [number, number],
        iconAnchor: [25, 25] as [number, number]
      }),
      zIndexOffset: 1500
    }).addTo(map);
    
    // Add popup with clue info
    // Format icon for popup display
    let popupIconHtml;
    if (isImageUrl && icon.startsWith('data:image')) {
      // Data URL - use directly in img tag
      popupIconHtml = `<img src="${icon}" alt="Clue Icon" style="width: 32px; height: 32px; object-fit: contain; vertical-align: middle;">`;
    } else if (isImageUrl) {
      // Image URL - use img tag with proper src
      let popupImgSrc;
      if (icon.startsWith('http://') || icon.startsWith('https://')) {
        popupImgSrc = icon;
      } else if (icon.startsWith('/uploads/') || icon.startsWith('/')) {
        popupImgSrc = `${getApiBaseUrl()}${icon}`;
      } else {
        popupImgSrc = `${getApiBaseUrl()}/uploads/${icon}`;
      }
      popupIconHtml = `<img src="${popupImgSrc}" alt="Clue Icon" style="width: 32px; height: 32px; object-fit: contain; vertical-align: middle;">`;
    } else {
      // Emoji or text - display directly
      popupIconHtml = `<span style="font-size: 24px; vertical-align: middle;">${icon}</span>`;
    }
    
    const popupContent = `
      <div style="min-width: 200px; text-align: center;">
        <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: center;">${popupIconHtml}</div>
        <strong style="color: #f59e0b; font-size: 16px;">Treasure Hunt Clue #${clue.clue_number}</strong>
        ${clue.title ? `<div style="margin-top: 8px; font-weight: 600;">${clue.title}</div>` : ''}
        ${clue.clue_text ? `<div style="margin-top: 8px; font-size: 14px; color: #666;">${clue.clue_text.substring(0, 100)}${clue.clue_text.length > 100 ? '...' : ''}</div>` : ''}
        <div style="margin-top: 12px;">
          <button onclick="window.openTreasureHuntModalForClue && window.openTreasureHuntModalForClue(${activeTreasureHunt?.id || 'null'})" style="
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
            transition: all 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Open Clue</button>
        </div>
      </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Remove click handler - popup will show on click, button in popup opens modal
    // Set global function for popup button
    (window as any).openTreasureHuntModalForClue = (huntId: number | null) => {
      if (huntId) {
        setSelectedHuntIdForModal(huntId);
        setIsTreasureHuntModalOpen(true);
      }
    };
    
    treasureHuntMarkerRef.current = marker;
    
    // Fly to clue location when marker is first created (not on every update)
    if (!treasureHuntMarkerRef.current._hasFlown) {
      map.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
      treasureHuntMarkerRef.current._hasFlown = true;
    }
    
    return () => {
      if (treasureHuntMarkerRef.current) {
        map.removeLayer(treasureHuntMarkerRef.current);
        treasureHuntMarkerRef.current = null;
      }
      // Cleanup global function
      (window as any).openTreasureHuntModalForClue = undefined;
    };
  }, [treasureHuntClue, activeTreasureHunt, showTreasureHuntClues]);

  // Create marker for active treasure hunt only (at first clue location)
  useEffect(() => {
    if (!mapRef.current || !allTreasureHunts.length || !user) return;

    const map = mapRef.current;

    // Remove existing hunt start markers
    treasureHuntStartMarkersRef.current.forEach((marker, huntId) => {
      map.removeLayer(marker);
    });
    treasureHuntStartMarkersRef.current.clear();

    // Only show marker for the active hunt
    const activeHuntId = selectedActiveHuntIdRef.current;
    if (!activeHuntId) {
      return; // No active hunt, don't show any markers
    }

    // Find the active hunt
    const activeHunt = allTreasureHunts.find(hunt => hunt.id === activeHuntId);
    if (!activeHunt) {
      return; // Active hunt not found in list
    }

    // Create marker for the active hunt only
    (async () => {
      try {
        const { treasureHuntService } = await import('../services/treasureHuntService');
        const huntDetails = await treasureHuntService.getHuntDetails(activeHunt.id);
        
        if (!huntDetails || !huntDetails.clues || huntDetails.clues.length === 0) {
          return; // No clues, skip
        }

        // Get first clue location
        const firstClue = huntDetails.clues.sort((a: any, b: any) => a.clue_number - b.clue_number)[0];
        
        if (!firstClue.latitude || !firstClue.longitude ||
            typeof firstClue.latitude !== 'number' || typeof firstClue.longitude !== 'number' ||
            isNaN(firstClue.latitude) || isNaN(firstClue.longitude)) {
          return; // Invalid coordinates
        }

        // Check if user has started this hunt (if so, don't show start marker, show clue marker instead)
        const progress = await treasureHuntService.getUserProgress(activeHunt.id);
        if (progress) {
          // User has started this hunt, don't show start marker (clue marker will show instead)
          return;
        }

        const icon = activeHunt.icon || '🏴‍☠️';
        const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.endsWith('.png') || icon.endsWith('.gif') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp');
        const isEmoji = !isImageUrl && /[\u{1F300}-\u{1F9FF}]/u.test(icon);

        let markerHtml;
        if (isImageUrl) {
          let imgSrc;
          if (icon.startsWith('data:image')) {
            imgSrc = icon;
          } else if (icon.startsWith('http://') || icon.startsWith('https://')) {
            imgSrc = icon;
          } else if (icon.startsWith('/uploads/') || icon.startsWith('/')) {
            imgSrc = icon.startsWith('/uploads/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}${icon}`;
          } else {
            imgSrc = `${getApiBaseUrl()}/uploads/${icon}`;
          }
          markerHtml = `<div style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.95); border-radius: 50%; border: 3px solid #10b981; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"><img src="${imgSrc}" alt="Treasure Hunt" style="width: 35px; height: 35px; object-fit: contain; border-radius: 50%;"></div>`;
        } else if (isEmoji) {
          markerHtml = `<div style="font-size: 35px; text-align: center; line-height: 1; background: rgba(255, 255, 255, 0.95); border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border: 3px solid #10b981; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">${icon}</div>`;
        } else {
          markerHtml = `<div style="font-size: 35px; text-align: center; line-height: 1; background: rgba(255, 255, 255, 0.95); border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border: 3px solid #10b981; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">🏴‍☠️</div>`;
        }

        const marker = L.marker([firstClue.latitude, firstClue.longitude], {
          icon: L.divIcon({
            className: 'treasure-hunt-start-marker',
            html: markerHtml,
            iconSize: [45, 45] as [number, number],
            iconAnchor: [22.5, 22.5] as [number, number]
          }),
          zIndexOffset: 1000
        }).addTo(map);

        // Add popup
        const popupContent = `
          <div style="min-width: 200px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
            <strong style="color: #10b981; font-size: 16px;">${activeHunt.name}</strong>
            ${activeHunt.description ? `<div style="margin-top: 8px; font-size: 14px; color: #666;">${activeHunt.description.substring(0, 80)}${activeHunt.description.length > 80 ? '...' : ''}</div>` : ''}
            <div style="margin-top: 12px;">
              <button onclick="window.openTreasureHuntModalForHunt && window.openTreasureHuntModalForHunt(${activeHunt.id})" style="
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
              ">Start Hunt</button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add click handler
        marker.on('click', () => {
          setSelectedHuntIdForModal(activeHunt.id);
          setIsTreasureHuntModalOpen(true);
        });

        treasureHuntStartMarkersRef.current.set(activeHunt.id, marker);
      } catch (error) {
        console.error(`[Treasure Hunt] Error creating marker for hunt ${activeHunt.id}:`, error);
      }
    });

    // Make function globally accessible for popup button
    (window as any).openTreasureHuntModalForHunt = (huntId: number) => {
      setSelectedHuntIdForModal(huntId);
      setIsTreasureHuntModalOpen(true);
    };

    return () => {
      treasureHuntStartMarkersRef.current.forEach((marker) => {
        map.removeLayer(marker);
      });
      treasureHuntStartMarkersRef.current.clear();
      (window as any).openTreasureHuntModalForHunt = undefined;
    };
  }, [allTreasureHunts, user, selectedActiveHuntId]);

  // Cleanup marker on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current && treasureHuntMarkerRef.current) {
        mapRef.current.removeLayer(treasureHuntMarkerRef.current);
        treasureHuntMarkerRef.current = null;
      }
    };
  }, []);

  // Fetch coastline data for wave masking
  useEffect(() => {
    const fetchCoastlineData = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/weather/coastlines`);
        if (response.ok) {
          const data = await response.json();
          setCoastlineData(data);
        }
      } catch (error) {
        console.error('Error fetching coastline data:', error);
      }
    };

    fetchCoastlineData();
  }, []);

  // Create alarm markers
  const createAlarmMarkers = useCallback(() => {
    if (!mapRef.current || !showWaves) {
      console.log('Cannot create alarm markers:', { mapRef: !!mapRef.current, showWaves });
      return;
    }
    
    const map = mapRef.current;
    
    // Check if map is ready and has proper bounds
    if (!map.getContainer()) {
      console.log('Map container not ready, retrying in 100ms');
      setTimeout(() => createAlarmMarkers(), 100);
      return;
    }
    
    // Simple check if map is ready
    if (map.getZoom() <= 0) {
      console.log('Map zoom not ready, retrying in 100ms');
      setTimeout(() => createAlarmMarkers(), 100);
      return;
    }
    
    console.log('Creating alarm markers for', alarms.length, 'alarms');
    console.log('Map bounds:', map.getBounds());
    console.log('Map center:', map.getCenter());
    console.log('Map zoom:', map.getZoom());
    
    // Clear existing alarm markers
    alarmMarkersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    alarmMarkersRef.current = [];
    
    // Create new markers for active alarms
    alarms.filter(alarm => alarm.isActive).forEach((alarm, index) => {
      console.log(`Creating alarm marker ${index + 1}:`, {
        id: alarm.id,
        coordinates: alarm.coordinates,
        title: alarm.title
      });
      
      // Validate coordinates
      if (isNaN(alarm.coordinates.lat) || isNaN(alarm.coordinates.lng)) {
        console.error('Invalid coordinates for alarm:', alarm.id, alarm.coordinates);
        return;
      }
      
      if (alarm.coordinates.lat === 0 && alarm.coordinates.lng === 0) {
        console.warn('Alarm has default coordinates (0,0):', alarm.id);
        return;
      }
      
      // Check if coordinates are within Gozo bounds (roughly)
      if (alarm.coordinates.lat < 35.8 || alarm.coordinates.lat > 36.3 || 
          alarm.coordinates.lng < 13.9 || alarm.coordinates.lng > 14.4) {
        console.warn('Alarm coordinates outside Gozo area:', alarm.id, alarm.coordinates);
        return;
      }
      
      // TEST: Try without any custom CSS - just a simple colored circle
      const marker = L.marker([alarm.coordinates.lat, alarm.coordinates.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background: ${alarm.color};
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            border: 3px solid white;
          ">${alarm.icon}</div>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        })
      }).addTo(map);
      
      marker.bindPopup(`<b>${alarm.title}</b><br>${alarm.description || ''}`);
      
      alarmMarkersRef.current.push(marker);
    });
    
    console.log(`Created ${alarmMarkersRef.current.length} alarm markers at their respective positions`);
  }, [alarms, showWaves]);

  // Create user alarm markers
  const createUserAlarmMarkers = useCallback(() => {
    if (!mapRef.current || !showUserAlarms) {
      console.log('Cannot create user alarm markers:', { mapRef: !!mapRef.current, showUserAlarms });
      return;
    }
    
    const map = mapRef.current;
    
    // Simple check if map is ready
    if (map.getZoom() <= 0) {
      console.log('Map zoom not ready for user alarms, retrying in 100ms');
      setTimeout(() => createUserAlarmMarkers(), 100);
      return;
    }
    
    console.log('Creating user alarm markers for', userAlarms.length, 'user alarms');
    
    // Clear existing user alarm markers
    userAlarmMarkersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    userAlarmMarkersRef.current = [];
    
    // Create new markers for active user alarms (exclude moderated and rejected)
    userAlarms.filter(alarm => 
      alarm.isActive && 
      !alarm.isModerated && 
      !alarm.isRejected
    ).forEach((alarm, index) => {
      console.log(`Creating user alarm marker ${index + 1}:`, {
        id: alarm.id,
        coordinates: alarm.coordinates,
        title: alarm.title
      });
      
      // Validate coordinates
      if (isNaN(alarm.coordinates.lat) || isNaN(alarm.coordinates.lng)) {
        console.error('Invalid coordinates for user alarm:', alarm.id, alarm.coordinates);
        return;
      }
      
      // Create user alarm marker with different styling
      const marker = L.marker([alarm.coordinates.lat, alarm.coordinates.lng], {
        icon: L.divIcon({
          className: 'user-alarm-marker',
          html: `<div style="
            background: ${alarm.color};
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">${alarm.icon}</div>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        })
      }).addTo(map);
      
      // Create popup content with user info and deactivate option
      const popupContent = `
        <div style="min-width: 200px; background: rgba(17, 24, 39, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(75, 85, 99, 0.3); border-radius: 12px; padding: 16px; color: #f3f4f6;">
          <h4 style="margin: 0 0 8px 0; color: ${alarm.color}; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600;">
            ${alarm.icon} ${alarm.title}
          </h4>
          ${alarm.isModerated ? `
          <div style="background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 8px; margin: 8px 0; color: #f59e0b; font-size: 12px; font-weight: 600;">
            ⚠️ This alarm contains inappropriate language and is under review
          </div>
          ` : ''}
          <p style="margin: 0 0 8px 0; color: #d1d5db; font-size: 14px; line-height: 1.4;">${alarm.description || 'No description'}</p>
          ${alarm.imageUrl ? `
          <div style="margin: 8px 0; text-align: center;">
            <img src="${getApiBaseUrl()}${alarm.imageUrl}" alt="Alarm image" crossorigin="anonymous" style="
              max-width: 200px; 
              max-height: 150px; 
              border-radius: 8px; 
              border: 2px solid ${alarm.color}; 
              cursor: pointer;
              transition: transform 0.2s;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            " onclick="window.open('${getApiBaseUrl()}${alarm.imageUrl}', '_blank')" 
            onmouseover="this.style.transform='scale(1.05)'" 
            onmouseout="this.style.transform='scale(1)'"
            title="Click to view full size">
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="background: ${alarm.color}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">${alarm.severity}</span>
            <small style="color: #9ca3af; font-size: 11px;">User Report</small>
          </div>
          <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
            Created: ${new Date(alarm.createdAt).toLocaleString()}
          </div>
             ${alarm.createdByUsername ? `<div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">Reported by: ${alarm.createdByUsername}</div>` : ''}
          ${user ? `
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            ${alarm.isModerated ? `
            <button disabled style="
              background: linear-gradient(135deg, #6b7280, #4b5563);
              color: #9ca3af;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 12px;
              cursor: not-allowed;
              font-weight: 600;
              opacity: 0.6;
            ">
              🔒 Under Review
            </button>
            ` : `
            <button onclick="deactivateUserAlarm('${alarm.id}')" style="
              background: linear-gradient(135deg, #EF4444, #DC2626);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 12px;
              cursor: pointer;
              font-weight: 600;
              transition: all 0.2s;
              box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
            " onmouseover="this.style.background='linear-gradient(135deg, #DC2626, #B91C1C)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.4)'" onmouseout="this.style.background='linear-gradient(135deg, #EF4444, #DC2626)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(239, 68, 68, 0.3)'">
              🚫 Deactivate Alert
            </button>
            `}
          </div>
          ` : `
          <div style="margin-top: 12px; padding: 10px; background: rgba(55, 65, 81, 0.5); border-radius: 8px; text-align: center; border: 1px solid rgba(75, 85, 99, 0.3);">
            <small style="color: #d1d5db; font-weight: bold; font-size: 12px;">🔒 Login to create or deactivate alarms</small>
          </div>
          `}
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        className: 'custom-alarm-popup',
        closeButton: true,
        autoClose: false,
        closeOnClick: false
      });
      userAlarmMarkersRef.current.push(marker);
    });
    
    console.log(`Created ${userAlarmMarkersRef.current.length} user alarm markers at their respective positions`);
  }, [userAlarms, showUserAlarms]);

  // Fetch condition alarms
  useEffect(() => {
    const fetchAlarms = async () => {
      try {
        const alarmData = await waveService.getConditionAlarms();
        console.log('Fetched alarm data:', alarmData);
        setAlarms(alarmData);
      } catch (error) {
        console.error('Error fetching condition alarms:', error);
      }
    };

    if (showWaves) {
      fetchAlarms();
      // Refresh alarms every 2 minutes
      const interval = setInterval(fetchAlarms, 2 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [showWaves]);

  // Fetch user-generated alarms
  useEffect(() => {
    const fetchUserAlarms = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/user-alarms`, {
          credentials: 'include'
        });
        if (response.ok) {
          const userAlarmData = await response.json();
          console.log('Fetched user alarm data:', userAlarmData);
          setUserAlarms(userAlarmData);
        }
      } catch (error) {
        console.error('Error fetching user alarms:', error);
      }
    };

    if (showUserAlarms || showWaves) {
      fetchUserAlarms();
      // Refresh user alarms every 2 minutes
      const interval = setInterval(fetchUserAlarms, 2 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [showUserAlarms, showWaves]);

  // Update alarm markers when alarms change
  useEffect(() => {
    if (!mapRef.current || !showWaves) return;
    
    // Simple approach: create markers with a small delay
    const timer = setTimeout(() => {
      createAlarmMarkers();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [createAlarmMarkers, showWaves]);

  // Update user alarm markers when user alarms change
  useEffect(() => {
    if (!mapRef.current || !showUserAlarms) return;
    
    // Simple approach: create user alarm markers with a small delay
    const timer = setTimeout(() => {
      createUserAlarmMarkers();
    }, 150); // Slightly longer delay to avoid conflicts
    
    return () => clearTimeout(timer);
  }, [createUserAlarmMarkers, showUserAlarms]);

  // Cleanup alarm markers when component unmounts or waves are disabled
  useEffect(() => {
    return () => {
      if (mapRef.current && alarmMarkersRef.current.length > 0) {
        alarmMarkersRef.current.forEach(marker => {
          mapRef.current.removeLayer(marker);
        });
        alarmMarkersRef.current = [];
      }
    };
  }, []);

  // Cleanup user alarm markers when user alarms are disabled
  useEffect(() => {
    if (!showUserAlarms && mapRef.current && userAlarmMarkersRef.current.length > 0) {
      console.log('🧹 Removing user alarm markers - user alarms disabled');
      userAlarmMarkersRef.current.forEach(marker => {
        mapRef.current?.removeLayer(marker);
      });
      userAlarmMarkersRef.current = [];
    }
  }, [showUserAlarms]);

  // Cleanup alarm markers when waves are disabled
  useEffect(() => {
    if (!showWaves && mapRef.current) {
      alarmMarkersRef.current.forEach(marker => {
        mapRef.current.removeLayer(marker);
      });
      alarmMarkersRef.current = [];
    }
  }, [showWaves]);

  // Helper function to get icon size based on screen size
  const getIconSize = useCallback((baseSize: number) => {
    return isSmallScreen ? Math.round(baseSize * 0.7) : baseSize; // 30% smaller on small screens
  }, [isSmallScreen]);



  // Helper function to add tour marker and points
  const addTourMarkerAndPoints = useCallback((place: any, map: any, L: any, layerRef?: any) => {
    try {
      // Use the provided layerRef if available, otherwise use the default tourRouteLayersRef
      const targetLayerRef = layerRef || tourRouteLayersRef;
      
      // Validate place data
      if (!place || !place.name || !place.coordinates) {
        console.warn('Invalid place data for addTourMarkerAndPoints:', place);
        return;
      }
      
      // Add a tour icon marker at the start of the route
      if (place.coordinates && isValidLatLng(place.coordinates)) {

      let tourMarkerHtml;
      let tourIconOptions;
      
      // Check if it's an emoji icon
      if (place.icon && place.icon.length <= 4 && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(place.icon)) {
        // It's an emoji, create emoji marker
        const iconSize = getIconSize(place.iconSize || 32);
        tourMarkerHtml = `<div style="background-color: #8A2BE2; color: white; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(16, iconSize * 0.6)}px; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25); transform: scale(1.1);">${place.icon}</div>`;
        tourIconOptions = { 
          className: 'custom-tour-emoji-icon', 
          html: tourMarkerHtml, 
          iconSize: [iconSize + 6, iconSize + 6], 
          iconAnchor: [(iconSize + 6) / 2, (iconSize + 6) / 2] 
        };
      } else if (place.icon && place.icon.startsWith('/uploads/')) {
        // It's a custom uploaded icon
        const iconSize = getIconSize(place.iconSize || 32);
        tourMarkerHtml = `<img src="${getApiBaseUrl()}${place.icon}" alt="${place.name}" crossorigin="anonymous" style="width: ${iconSize}px; height: ${iconSize}px; object-fit: contain;">`;
        tourIconOptions = { 
          className: 'custom-tour-image-icon', 
          html: tourMarkerHtml, 
          iconSize: [iconSize, iconSize], 
          iconAnchor: [iconSize / 2, iconSize] 
        };
      } else {
        // Default tour icon
        const iconSize = getIconSize(32);
        tourMarkerHtml = `<div style="background-color: #8A2BE2; color: white; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(16, iconSize * 0.6)}px; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">🎯</div>`;
        tourIconOptions = { 
          className: 'custom-tour-default-icon', 
          html: tourMarkerHtml, 
          iconSize: [iconSize + 6, iconSize + 6], 
          iconAnchor: [(iconSize + 6) / 2, iconSize + 6] 
        };
      }
      
      const tourMarker = L.marker([place.coordinates.lat, place.coordinates.lng], { 
        icon: L.divIcon(tourIconOptions),
        zIndexOffset: 300
      }).addTo(map);
      
      console.log('Added tour marker to map:', place.id, place.name);
      
      tourMarker.bindPopup(`<b>${place.name}</b><br>${place.shortDescription || ''}`);
      
      // Add click handler to make tour markers interactive
      tourMarker.on('click', () => {
        console.log('Tour marker clicked for:', place.name, 'with ID:', place.id);
        console.log('Original place object:', place);
        console.log('place.mainImage:', place.mainImage);
        
        // Check if this tour is already selected - if so, deselect it
        console.log('=== Tour marker click handler ===');
        console.log('selectedTour:', selectedTour);
        console.log('place.id:', place.id);
        console.log('selectedTour?.id:', selectedTour?.id);
        console.log('Are they equal?', selectedTour?.id === place.id);
        
        if (selectedTour && selectedTour.id === place.id) {
          console.log('Tour already selected, deselecting it');
          // Create a deselection object that the parent component can handle
          const deselectionPlace: Place = {
            id: `deselect-${place.id}`,
            name: place.name,
            category: PlaceCategory.TOURS,
            coordinates: place.coordinates,
            shortDescription: '',
            description: '',
            icon: place.icon,
            iconSize: place.iconSize,
            type: 'tour-deselect', // Special type to indicate deselection
            mainImage: place.mainImage || '',
            points: place.points || []
          };
          console.log('Created deselection place:', deselectionPlace);
          onMarkerClick(deselectionPlace);
          return;
        }
        
        // Create a Place object for the tour and trigger selection
        const tourPlace: Place = {
          id: place.id,
          name: place.name,
          category: PlaceCategory.TOURS,
          coordinates: place.coordinates,
          shortDescription: place.shortDescription || '',
          description: place.description || '',
          icon: place.icon,
          iconSize: place.iconSize,
          type: place.type || 'tour', // Preserve the original type (hiking-trail, tour, etc.)
          // Include the main tour image
          mainImage: place.mainImage || '',
          // Include tour points for context
          points: place.points || []
        };
        console.log('Tour marker clicked, created tourPlace:', tourPlace);
        console.log('tourPlace.mainImage:', tourPlace.mainImage);
        console.log('tourPlace object keys:', Object.keys(tourPlace));
        console.log('About to call onMarkerClick with tourPlace');
        onMarkerClick(tourPlace);
      });
      
      // Add tour ID to the marker for tracking
      (tourMarker as any)._tourId = place.id;
      targetLayerRef.current.push(tourMarker);
    } else {
      console.warn('MapComponent: Invalid tour coordinates:', place.coordinates);
    }

    // Add individual tour STOPS only (not shape points) if they exist
    if (place.points && place.points.length > 0) {
      
      place.points.forEach((point: any, index: number) => {
        
        // Only show stops, not shape points
        if (point.type !== 'stop') {
          return;
        }
        
        // Handle different point coordinate formats
        let pointLat, pointLng;
        if (point.lat && point.lng) {
          pointLat = point.lat;
          pointLng = point.lng;
        } else if (point.coordinates && Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
          pointLat = point.coordinates[0];
          pointLng = point.coordinates[1];
        } else {
          console.warn('MapComponent: Invalid stop coordinates:', point);
          return;
        }

        if (isValidLatLng({ lat: pointLat, lng: pointLng })) {
          
          // Create a marker for each tour stop using the tour's icon
          let stopMarkerHtml;
          let stopIconOptions;
          
          // Use the same icon logic as the tour marker
          if (place.icon && place.icon.length <= 4 && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(place.icon)) {
            // It's an emoji, create emoji marker
            const stopIconSize = getIconSize(24);
            stopMarkerHtml = `<div style="background-color: #8A2BE2; color: white; width: ${stopIconSize}px; height: ${stopIconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(12, stopIconSize * 0.6)}px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">${place.icon}</div>`;
            stopIconOptions = { 
              className: 'custom-tour-stop-icon', 
              html: stopMarkerHtml, 
              iconSize: [stopIconSize + 4, stopIconSize + 4], 
              iconAnchor: [(stopIconSize + 4) / 2, (stopIconSize + 4) / 2] 
            };
          } else if (place.icon && place.icon.startsWith('/uploads/')) {
            // It's a custom uploaded icon
            const stopIconSize = getIconSize(24);
            stopMarkerHtml = `<img src="${getApiBaseUrl()}${place.icon}" alt="${point.name}" crossorigin="anonymous" style="width: ${stopIconSize}px; height: ${stopIconSize}px; object-fit: contain;">`;
            stopIconOptions = { 
              className: 'custom-tour-stop-icon', 
              html: stopMarkerHtml, 
              iconSize: [stopIconSize, stopIconSize], 
              iconAnchor: [stopIconSize / 2, stopIconSize / 2] 
            };
          } else {
            // Default tour icon (smaller version)
            const stopIconSize = getIconSize(24);
            stopMarkerHtml = `<div style="background-color: #8A2BE2; color: white; width: ${stopIconSize}px; height: ${stopIconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(12, stopIconSize * 0.6)}px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">🎯</div>`;
            stopIconOptions = { 
              className: 'custom-tour-stop-icon', 
              html: stopMarkerHtml, 
              iconSize: [stopIconSize + 4, stopIconSize + 4], 
              iconAnchor: [(stopIconSize + 4) / 2, (stopIconSize + 4) / 2] 
            };
          }
          
          const stopMarker = L.marker([pointLat, pointLng], { 
            icon: L.divIcon(stopIconOptions),
            zIndexOffset: 250
          }).addTo(map);
          
          // Add popup for the stop
          const stopName = point.name || `Stop ${index + 1}`;
          const stopDescription = point.description || '';
          stopMarker.bindPopup(`<b>${stopName}</b>${stopDescription ? `<br>${stopDescription}` : ''}`);
          
          // Add click handler for the stop
          stopMarker.on('click', () => {
            // Create a Place object for the tour stop and trigger selection
            const tourStopPlace: Place = {
              id: `tour-stop-${place.id}-${index}`,
              name: stopName,
              category: PlaceCategory.TOURS,
              coordinates: { lat: pointLat, lng: pointLng },
              shortDescription: stopDescription,
              description: stopDescription,
              icon: place.icon || '🛑', // Use the tour's icon
              iconSize: 24,
              type: 'tour-stop',
              // Add tour context so the app knows this stop belongs to a tour
              tourId: place.id,
              tourName: place.name,
              // Include images if available
              images: point.images || []
            };
            
            console.log('Tour stop clicked:', {
              stopName,
              tourId: place.id,
              tourName: place.name,
              tourStopPlace,
              placeObject: place,
              pointObject: point
            });
            
            // Pass the tour stop to show its details, but also ensure the parent tour is selected
            if (onMarkerClick) {
              console.log('About to call onMarkerClick with tour stop:', tourStopPlace);
              console.log('Available tourRoutes:', tourRoutes);
              console.log('Available hikingTrails:', hikingTrails);
              
                          // Check if this tour is already selected - if so, deselect it
            if (selectedTour && selectedTour.id === place.id) {
              console.log('Tour stop clicked but tour already selected, deselecting it');
              // Create a deselection object that the parent component can handle
              const deselectionPlace: Place = {
                id: `deselect-${place.id}`,
                name: place.name,
                category: PlaceCategory.TOURS,
                coordinates: place.coordinates,
                shortDescription: '',
                description: '',
                icon: place.icon,
                iconSize: place.iconSize,
                type: 'tour-deselect', // Special type to indicate deselection
                mainImage: place.mainImage || '',
                points: place.points || []
              };
              onMarkerClick(deselectionPlace);
              return;
            }
            
            // CRITICAL: Pass the parent tour object with tour stop context
            // This makes tour stops have the same effect as clicking the main tour icon
            const parentTourPlace: Place = {
              id: place.id,
              name: place.name,
              category: PlaceCategory.TOURS,
              coordinates: place.coordinates,
              shortDescription: place.shortDescription || '',
              description: place.description || '',
              icon: place.icon,
              iconSize: place.iconSize,
              type: place.type || 'tour', // Same as main tour icon
              mainImage: place.mainImage || '',
              points: place.points || [],
              // Add tour stop context so the app knows this tour was clicked via a stop
              tourStopContext: {
                stopId: `tour-stop-${place.id}-${index}`,
                stopName: stopName,
                stopDescription: stopDescription,
                stopCoordinates: { lat: pointLat, lng: pointLng },
                stopImages: point.images || []
              }
            };
            
            console.log('Tour stop clicked - passing parent tour with stop context:', parentTourPlace);
            
            // Call onMarkerClick with the parent tour that includes stop context
            // This ensures the tour is selected AND the stop context is available
            onMarkerClick(parentTourPlace);
            }
          });
          
          // Add tour ID to the stop marker for tracking
          (stopMarker as any)._tourId = place.id;
          
          // Use the provided layerRef if available, otherwise use the default tourRouteLayersRef
          targetLayerRef.current.push(stopMarker);
        }
      });
    }
    } catch (error) {
      console.error('Error in addTourMarkerAndPoints:', error);
      console.error('Place data that caused error:', place);
    }
  }, [selectedTour, onMarkerClick]);

  const hoveredPlace = useMemo(() => {
    if (!hoveredPlaceId) return null;
    return places.find(p => p.id === hoveredPlaceId) || null;
  }, [hoveredPlaceId, places]);

  const hoveredTripPlace = useMemo(() => {
    if (!hoveredTripPlaceId || !viewingTrip) return null;
    return viewingTrip.places.find(p => p.id === hoveredTripPlaceId) || null;
  }, [hoveredTripPlaceId, viewingTrip]);

  const handleGoToUserLocation = useCallback(() => {
    if (mapRef.current && isValidLatLng(userLocation)) {
        mapRef.current.flyTo([userLocation.lat, userLocation.lng], 14, { animate: true, duration: 1.5 });
    }
  }, [userLocation]);

  // Effect for continuous user location tracking
  useEffect(() => {
    if (!mapRef.current || !isGoModeActive || !isValidLatLng(userLocation)) return;

    const map = mapRef.current;
    const targetZoom = 16; // Desired zoom level for continuous tracking
    map.flyTo([userLocation.lat, userLocation.lng], targetZoom, { animate: true, duration: 0.5 });

  }, [userLocation, isGoModeActive]);

  

  const handleZoomIn = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomOut();
  }, []);

  // Handle map context menu for user alarm creation
  const handleMapContextMenu = useCallback((e: any) => {
    console.log('=== MAP CONTEXT MENU DEBUG ===');
    console.log('Event received:', e);
    console.log('showUserAlarms state:', showUserAlarms);
    console.log('Event latlng:', e.latlng);
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    
    // If user alarms are visible, create user alarm
    if (showUserAlarms) {
      console.log('✅ USER ALARMS ACTIVE - Creating user alarm at:', e.latlng.lat, e.latlng.lng);
      setUserAlarmCoordinates({ lat: e.latlng.lat, lng: e.latlng.lng });
      setIsUserAlarmModalOpen(true);
      console.log('UserAlarmModal should now be open');
      console.log('State after setting:', { 
        userAlarmCoordinates: { lat: e.latlng.lat, lng: e.latlng.lng },
        isUserAlarmModalOpen: true 
      });
    } else {
      // Default behavior: drop a pin (when user alarms are off)
      console.log('📍 Dropping pin at:', e.latlng.lat, e.latlng.lng, '(User alarms off)');
      onMapLongPress({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  }, [showUserAlarms, onMapLongPress]);

  // Effect to update zoom constraints when screen size changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // Don't update minZoom if we're in the middle of our animation OR if zoom protection is active
    if (isAnimatingRef.current || skipZoomEndUpdateRef.current || zoomProtectionRef.current) {
      console.log('[Map] Skipping minZoom update - animation/protection in progress');
      return;
    }
    
    // Update zoom constraints when isSmallScreen changes
    const newMinZoom = isSmallScreen ? 12 : 13;
    // CRITICAL: Don't change minZoom if it's currently set to 15 (our protection level)
    if (map.getMinZoom() === 15) {
      console.log('[Map] Skipping minZoom update - currently at protection level 15');
      return;
    }
    
    if (map.getMinZoom() !== newMinZoom) {
      console.log('Updating map minZoom from', map.getMinZoom(), 'to', newMinZoom);
      map.setMinZoom(newMinZoom);
    }
  }, [isSmallScreen]);

  // Function to manually refresh wave data (for testing)
  const refreshWaveData = useCallback(async () => {
    console.log('refreshWaveData called:', { mapRef: !!mapRef.current, mapCenter });
    if (!mapRef.current) {
      console.log('No map ref, skipping wave data refresh');
      return;
    }
    
    try {
      console.log('Manually refreshing wave data...');
      const data = await waveService.getCurrentWaveData(mapCenter);
      setWaveData(data);
      console.log('Wave data manually refreshed successfully:', data);
    } catch (error) {
      console.error('Error refreshing wave data:', error);
    }
  }, [mapCenter]);

  // Effect to fetch wave data when waves are enabled
  useEffect(() => {
    console.log('Wave effect triggered:', { showWaves, mapRef: !!mapRef.current });
    if (!showWaves || !mapRef.current) return;

    const fetchWaveData = async () => {
      try {
        console.log('Fetching wave data from service...');
        const data = await waveService.getCurrentWaveData(mapCenter);
        setWaveData(data);
        console.log('Wave data fetched successfully:', data);
      } catch (error) {
        console.error('Error fetching wave data:', error);
      }
    };

    fetchWaveData();
    
    // Update wave data every 2 minutes for testing (more frequent than weather data)
    const interval = setInterval(fetchWaveData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [showWaves]); // Removed mapCenter dependency to prevent frequent updates

  // Expose refresh function globally for testing
  useEffect(() => {
    (window as any).refreshWaveData = refreshWaveData;
    (window as any).forceRefreshWaves = () => {
      console.log('Force refresh waves called from global function');
      refreshWaveData();
    };
    return () => {
      delete (window as any).refreshWaveData;
      delete (window as any).forceRefreshWaves;
    };
  }, [refreshWaveData]);

  // Monitor localStorage for test weather refresh signals
  useEffect(() => {
    console.log('Setting up localStorage monitoring for test weather refresh signals...');
    
    const handleStorageChange = (e: StorageEvent) => {
      console.log('Storage event detected:', e.key, e.newValue);
      if (e.key === 'weatherTestRefresh' && e.newValue) {
        console.log('Detected test weather refresh signal via storage event, refreshing wave data...');
        refreshWaveData();
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also check localStorage periodically for same-tab signals
    const checkInterval = setInterval(() => {
      const lastRefresh = localStorage.getItem('weatherTestRefresh');
      if (lastRefresh) {
        const refreshTime = parseInt(lastRefresh);
        const now = Date.now();
        console.log('Checking refresh signal:', { lastRefresh, refreshTime, now, diff: now - refreshTime });
        // If refresh signal is less than 5 seconds old, refresh
        if (now - refreshTime < 5000) {
          console.log('Detected recent test weather refresh signal, refreshing wave data...');
          refreshWaveData();
          // Clear the signal to prevent repeated refreshes
          localStorage.removeItem('weatherTestRefresh');
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [refreshWaveData]);

  // Effect to update map bounds for wave overlay
  useEffect(() => {
    if (!mapRef.current || !showWaves) return;
    
    const map = mapRef.current;
    const updateBounds = () => {
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    };

    // Update bounds on map move and zoom
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);
    
    // Initial bounds
    updateBounds();

    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [showWaves]);

  // Effect for map initialization and event listeners
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) {
      return;
    }

    console.log('[Map] Initializing map with Leaflet', L?.version);

    const initialCoords = isValidLatLng(flyToLocation) ? flyToLocation : DEFAULT_INITIAL_COORDS;
    const initialCenter: [number, number] = [initialCoords.lat, initialCoords.lng];
    
    const tileBaseUrl = getTileBaseUrl();
    const tileRegion = 'gozo';
    const remoteTileUrl = `${tileBaseUrl}/${tileRegion}/{z}/{x}/{y}.png`;
    const attribution = 'Tiles &copy; Discover Gozo';

    // Create tile layers with offline fallback support
    // Adjust minZoom for small screens to allow one step zoom out
    const tileMinZoom = isSmallScreen ? 12 : 4;
    
    const onlineTiles = L.tileLayer(remoteTileUrl, {
        attribution: attribution,
        minZoom: tileMinZoom,
        maxZoom: 19,
        // Add error handling for offline scenarios
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        // Additional options to prevent tile gaps
        noWrap: false,
        keepBuffer: 2,
        updateWhenIdle: false,
        updateWhenZooming: false,
        tileSize: 256,
        zoomOffset: 0,
        crossOrigin: 'anonymous' as const,
        // Prevent tile gaps on mobile devices
        detectRetina: false,
        // Add slight overlap to prevent gaps
        className: 'leaflet-tile-no-gaps'
    });

    console.log('[Map] Tile base URL:', tileBaseUrl);
    console.log('[Map] Remote tile URL template:', remoteTileUrl);

    onlineTiles.on('load', () => {
      console.debug('[Map] Tiles loaded successfully from', tileBaseUrl);
      // Force a repaint to ensure tiles render correctly and grid lines disappear
      if (mapRef.current) {
        const map = mapRef.current;
        // Trigger a reflow/repaint by briefly toggling opacity
        map.getContainer().style.opacity = '0.999';
        requestAnimationFrame(() => {
          if (mapRef.current) {
            mapRef.current.getContainer().style.opacity = '1';
          }
        });
      }
    });

    onlineTiles.on('tileerror', (event: any) => {
      console.error('[Map] Tile load error:', {
        tileUrl: event?.tile?.src,
        coords: event?.coords,
        error: event?.error,
      });
    });
    
    // For now we just use the online tile source directly
    const baseTileLayer = onlineTiles;
    
    // Add tile loading event listeners for debugging and offline detection
    let onlineTileErrors = 0;
    let isOfflineMode = false;
    
    // Offline indicator functions
    const showOfflineIndicator = () => {
        const existingIndicator = document.getElementById('offline-indicator');
        if (existingIndicator) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(239, 68, 68, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
            ">
                📡 Offline Mode - Using Local Maps
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 5000);
    };
    
    const hideOfflineIndicator = () => {
        const indicator = document.getElementById('offline-indicator');
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    };
    
    // Check if we're offline on page load
    const checkOfflineStatus = () => {
        if (!navigator.onLine) {
            console.log('Browser reports offline status');
            isOfflineMode = true;
            showOfflineIndicator();
            return true;
        }
        return false;
    };
    
    // Initial offline check
    if (checkOfflineStatus()) {
        // Already in offline mode
    } else {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('Browser came online, switching back to hybrid mode');
            isOfflineMode = false;
            onlineTileErrors = 0;
            hideOfflineIndicator();
        });
        
        window.addEventListener('offline', () => {
            console.log('Browser went offline');
            isOfflineMode = true;
            // Show offline indicator
            showOfflineIndicator();
        });
    }
    
    onlineTiles.on('tileloadstart', (e: any) => {
        console.log('Online tile loading started:', e.coords);
    });
    
    onlineTiles.on('tileload', (e: any) => {
        console.log('Online tile loaded successfully:', e.coords);
        onlineTileErrors = 0; // Reset error count on successful load
    });
    
    onlineTiles.on('tileerror', (e: any) => {
        console.log('Online tile error:', e.coords, e);
        onlineTileErrors++;
        
        // If we get multiple online tile errors, switch to offline mode
        if (onlineTileErrors >= 3 && !isOfflineMode) {
            console.log('Multiple online tile errors detected');
        }
    });
    
    const gozoBounds = L.latLngBounds(
        [35.92, 14.16], // SW corner (minLat, minLon) - tight around Gozo & Comino
        [36.17, 14.35]  // NE corner (maxLat, maxLon)
    );
    const paddedBounds = gozoBounds.pad(isSmallScreen ? 0.06 : 0.03);

    // Determine initial zoom and minZoom based on offline status and screen size
    const initialZoom = isSmallScreen ? 12 : 13;
    const minZoom = isSmallScreen ? 12 : 13; // Allow one step zoom out on small screens
    
    const mapOptions = {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: minZoom, // Allow zoom level 4 when offline or on small screens
        maxZoom: 19, // Set explicit max zoom
        maxBounds: paddedBounds,
        maxBoundsViscosity: 1.0,
        // Ensure no other constraints
        layers: [baseTileLayer],
        zoomControl: false, // Disable default zoom control
        attributionControl: false, // Disable Leaflet attribution
        scrollWheelZoom: true, // Explicitly enable wheel zoom
        doubleClickZoom: true, // Enable double-click zoom
        boxZoom: true, // Enable box zoom
        keyboard: true, // Enable keyboard zoom
        worldCopyJump: false, // Disable world copy jump
        // Options to fix tile rendering on high-DPI/scaled displays
        preferCanvas: false,
        zoomSnap: 1, // Force integer zoom levels to prevent fractional pixel rendering
        zoomDelta: 1,
        wheelPxPerZoomLevel: 60
    };
    
    console.log('[Map] Creating map with options:', mapOptions);
    console.log('isSmallScreen:', isSmallScreen);
    console.log('Window width:', window.innerWidth);
    console.log('Calculated minZoom:', minZoom);
    console.log('tileMinZoom:', tileMinZoom);
    
    mapRef.current = L.map('map', mapOptions);

    (window as any).__DG_mapInstance = mapRef.current;
    console.log('[Map] Stored map instance on window.__DG_mapInstance for debugging');

    const map = mapRef.current;

    baseTileLayer.addTo(map);
    
    // Fix for Windows display scaling - detect and compensate for DPI scaling
    const devicePixelRatio = window.devicePixelRatio || 1;
    if (devicePixelRatio !== 1) {
      console.log(`Display scaling detected: ${devicePixelRatio * 100}%`);
      
      const overlap = Math.ceil(devicePixelRatio);
      const newSize = 256 + overlap;
      const offset = overlap / 2;

      const style = document.createElement('style');
      style.id = 'leaflet-tile-overlap-fix';
      style.innerHTML = `
        .leaflet-tile {
          width: ${newSize}px !important;
          height: ${newSize}px !important;
          margin-left: -${offset}px !important;
          margin-top: -${offset}px !important;
        }
      `;
      
      // Remove existing style if present
      const existingStyle = document.getElementById('leaflet-tile-overlap-fix');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(style);
    }
    
    // Debug map state after creation
    console.log('[Map] Map created successfully');
    console.log('Initial map minZoom:', map.getMinZoom());
    console.log('Tile layer minZoom:', tileMinZoom);
    console.log('Map maxZoom:', map.getMaxZoom());
    console.log('Initial map zoom:', map.getZoom());
    console.log('[Map] Map options used:', mapOptions);
    
    // Reinforce bounds & zoom limits after map creation
    map.setMaxBounds(paddedBounds);

    // Force set zoom limits after map creation to ensure they take effect
    if (isOfflineMode) {
        map.setMinZoom(4);
        console.log('Forced minZoom to 4 for offline mode');
    } else if (isSmallScreen) {
        map.setMinZoom(12);
        console.log('Forced minZoom to 12 for small screen - allows one step zoom out');
    } else {
        map.setMinZoom(13);
        console.log('Forced minZoom to 13 for large screen');
    }
    
    // Ensure wheel zoom is enabled
    map.scrollWheelZoom.enable();
    console.log('Wheel zoom enabled');
    
    // Test if we can actually zoom out to the minimum level
    setTimeout(() => {
        const testZoom = isSmallScreen ? 12 : 4;
        console.log(`Testing zoom out to level ${testZoom}...`);
        console.log('Current zoom before test:', map.getZoom());
        console.log('Current minZoom:', map.getMinZoom());
        console.log('Map layers:', map.eachLayer ? 'Layers available' : 'No layers method');
        map.setZoom(testZoom);
        console.log(`Zoom after setZoom(${testZoom}):`, map.getZoom());
        
        // Also try to check what tiles are available
        const currentZoom = map.getZoom();
        const center = map.getCenter();
        console.log('Current center:', center);
        console.log('Current zoom level:', currentZoom);
    }, 1000);
    
    const moveendHandler = () => {
      // Skip if we're in the middle of our animation
      if (isAnimatingRef.current || skipZoomEndUpdateRef.current) {
        console.log('[Map] Skipping moveend handler - animation in progress');
        return;
      }
        const center = map.getCenter();
        onMapMove({ lat: center.lat, lng: center.lng });
        
        // Report viewport bounds for bus stop filtering
        if (onMapBoundsChange) {
          const bounds = map.getBounds();
          onMapBoundsChange({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          });
        }
    };

    const zoomendHandler = () => {
        const currentZoom = map.getZoom();
    console.log('[Map] Map zoom changed to:', currentZoom);
        console.log('Map minZoom:', map.getMinZoom());
        console.log('Map maxZoom:', map.getMaxZoom());
        console.log('isSmallScreen:', isSmallScreen);
        console.log('Can zoom out more?', currentZoom > map.getMinZoom());
        console.log('Map bounds:', map.getBounds());
        console.log('Map center:', map.getCenter());
      console.log('isAnimatingRef:', isAnimatingRef.current);
      console.log('skipZoomEndUpdateRef:', skipZoomEndUpdateRef.current);
      
      // Skip state update if we're in the middle of our animation
      if (!skipZoomEndUpdateRef.current && !isAnimatingRef.current) {
        setMapZoom(currentZoom);
      } else {
        console.log('[Map] Skipping zoomend state update - animation in progress');
      }
      
      // Report viewport bounds for bus stop filtering
      if (onMapBoundsChange) {
        const bounds = map.getBounds();
        onMapBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      }
    };
    
    map.on('moveend', moveendHandler);
    map.on('zoomend', zoomendHandler);
    
    // Add additional zoom event listeners for debugging
    map.on('zoomstart', () => {
        console.log('Zoom started');
    });
    
    map.on('zoom', () => {
        console.log('Zooming... current zoom:', map.getZoom());
    });

    // Add wheel event debugging
    map.on('wheel', (e: any) => {
        console.log('Wheel event on map:', e);
    });

    const center = map.getCenter();
    onMapMove({ lat: center.lat, lng: center.lng });
    
    // Report initial viewport bounds
    if (onMapBoundsChange) {
      const bounds = map.getBounds();
      onMapBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
    
  }, [isSmallScreen, onMapBoundsChange]);

  // Add context menu listener separately to avoid re-attachment issues
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    console.log('🔧 Attaching context menu listener to map');
    map.on('contextmenu', handleMapContextMenu);
    console.log('✅ Context menu listener attached');
    
    // Cleanup function to remove listener when component unmounts
    return () => {
      console.log('🧹 Removing context menu listener');
      map.off('contextmenu', handleMapContextMenu);
    };
  }, [handleMapContextMenu]);

  // Ref to track the last flyToLocation to prevent duplicate calls
  const lastFlyToLocationRef = useRef<Coordinates | null>(null);
  const hasPerformedFitBoundsRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false); // Track if we're in the middle of our animation
  const zoomProtectionRef = useRef<NodeJS.Timeout | null>(null); // Track zoom protection interval
  const skipZoomEndUpdateRef = useRef<boolean>(false); // Flag to skip zoomend state updates

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Skip if viewing a trip
    if (viewingTrip) {
        if (viewingTrip.places.length > 0) {
            const validPlaceCoords = viewingTrip.places.map(p => p.coordinates).filter(isValidLatLng).map(c => [c.lat, c.lng]);
            if (validPlaceCoords.length > 0) {
                
            }
        }
        return;
    }
    
    // Only process if flyToLocation is valid and different from last one
    if (isValidLatLng(flyToLocation)) {
        // Check if this is the same location we just flew to (prevent duplicate calls)
        const isSameLocation = lastFlyToLocationRef.current && 
          lastFlyToLocationRef.current.lat === flyToLocation.lat && 
          lastFlyToLocationRef.current.lng === flyToLocation.lng;
        
        if (!isSameLocation) {
          // Store the location we're flying to
          lastFlyToLocationRef.current = flyToLocation;
          hasPerformedFitBoundsRef.current = false; // Reset flag for new location
          
          // On mobile when coming from events/excursions, use flyTo with offset to position icon at 30% from top
          if (isSmallScreen && flyToFromEventsOrExcursions) {
            // Stop any ongoing animations first to prevent conflicts
            map.stop();
            
            // Clear any existing pan timeout
            if (panTimeoutRef.current) {
              clearTimeout(panTimeoutRef.current);
              panTimeoutRef.current = null;
            }
            
            // Wait for bottom sheet to open and resize
            const flyToTimeout = setTimeout(() => {
              console.log('[Map] Timeout fired - checking conditions');
              console.log('[Map] hasPerformedFitBoundsRef:', hasPerformedFitBoundsRef.current);
              console.log('[Map] mapRef.current:', !!mapRef.current);
              console.log('[Map] lastFlyToLocationRef:', lastFlyToLocationRef.current);
              
              // Only perform flyTo once per flyToLocation
              if (hasPerformedFitBoundsRef.current) {
                console.log('[Map] Skipping - already performed fitBounds');
                return;
              }
              
              if (!mapRef.current) {
                console.log('[Map] Skipping - no map ref');
                return;
              }
              
              if (!lastFlyToLocationRef.current) {
                console.log('[Map] Skipping - no lastFlyToLocation');
                return;
              }
              
              const mapContainer = map.getContainer();
              if (!mapContainer) {
                console.log('[Map] No container - using fallback flyTo');
                // Fallback to regular flyTo if container not available
                hasPerformedFitBoundsRef.current = true;
                mapRef.current.flyTo([flyToLocation.lat, flyToLocation.lng], 15, { 
                  animate: true, 
                  duration: 1.5 
                });
                return;
              }
              
              console.log('[Map] Starting animation setup');
              
              // Mark that we're starting animation
              isAnimatingRef.current = true;
              hasPerformedFitBoundsRef.current = true;
              skipZoomEndUpdateRef.current = true; // Prevent zoomend handler from updating state
              
              // CRITICAL: Stop ALL animations and prevent any zoom changes
              map.stop();
              
              // Temporarily disable moveend and zoomend listeners to prevent interference
              const moveendHandler = () => {
                const center = map.getCenter();
                onMapMove({ lat: center.lat, lng: center.lng });
              };
              const zoomendHandler = () => {
                const currentZoom = map.getZoom();
                if (!skipZoomEndUpdateRef.current) {
                  setMapZoom(currentZoom);
                }
              };
              
              // Remove listeners temporarily
              map.off('moveend', moveendHandler);
              map.off('zoomend', zoomendHandler);
              
              // Get viewport height (don't call invalidateSize - it triggers zoom resets!)
              const viewportHeight = mapContainer.clientHeight;
              
              // Calculate the center point that will position the icon at 70% from top
              // If icon is at center (50%), to make it appear at 70% from top, we need to move center DOWN
              // Moving center DOWN (decrease lat) moves icon UP on screen
              const targetYPercent = 0.7; // 70% from top (30% from bottom)
              const centerYPercent = 0.5; // Center is at 50%
              const offsetPercent = centerYPercent - targetYPercent; // -0.2 = move center DOWN by 20%
              
              // Calculate meters per pixel at zoom 15
              const metersPerPixel = 40075017 / (256 * Math.pow(2, 15));
              const pixelOffset = viewportHeight * offsetPercent;
              const metersOffset = pixelOffset * metersPerPixel;
              const latOffset = metersOffset / 111000; // Convert meters to degrees (will be negative)
              
              // Calculate adjusted center: move center DOWN (decrease lat) so icon appears HIGHER on screen (at 70% from top)
              const adjustedCenter: [number, number] = [
                flyToLocation.lat + latOffset,
                flyToLocation.lng
              ];
              
              console.log('[Map] Centering calculation:', {
                targetYPercent,
                offsetPercent,
                pixelOffset,
                latOffset,
                originalLat: flyToLocation.lat,
                adjustedLat: adjustedCenter[0]
              });
              
              // Check if adjusted center would go outside map bounds
              try {
                const maxBounds = map.getMaxBounds && map.getMaxBounds();
                if (maxBounds && typeof maxBounds.getSouthWest === 'function' && typeof maxBounds.getNorthEast === 'function') {
                  const sw = maxBounds.getSouthWest();
                  const ne = maxBounds.getNorthEast();
                  
                  // Clamp adjusted center to stay within bounds
                  adjustedCenter[0] = Math.max(sw.lat, Math.min(ne.lat, adjustedCenter[0]));
                  adjustedCenter[1] = Math.max(sw.lng, Math.min(ne.lng, adjustedCenter[1]));
                }
              } catch (error) {
                console.warn('[Map] Error getting maxBounds, skipping bounds check:', error);
              }
              
              console.log('[Map] Setting view to adjusted center to position icon at 70% from top, zoom: 15');
              
              // Set up zoom protection BEFORE starting animation
              if (zoomProtectionRef.current) {
                clearInterval(zoomProtectionRef.current);
              }
              
              let protectionActive = true;
              let protectionStartTime = Date.now();
              
              // Store original minZoom to restore later
              const originalMinZoom = map.getMinZoom && typeof map.getMinZoom === 'function' ? map.getMinZoom() : (isSmallScreen ? 12 : 13);
              
              // Temporarily set minZoom to 15 to prevent zoom out during animation
              if (map.setMinZoom && typeof map.setMinZoom === 'function') {
                map.setMinZoom(15);
              }
              
              console.log('[Map] Calling setView with center:', adjustedCenter, 'zoom: 15');
              
              // Use setView instead of flyTo for more control - no animation conflicts
              map.setView(adjustedCenter, 15, { animate: false });
              
              // Verify it worked
              setTimeout(() => {
                if (mapRef.current) {
                  const actualZoom = mapRef.current.getZoom();
                  const actualCenter = mapRef.current.getCenter();
                  console.log('[Map] After setView - zoom:', actualZoom, 'center:', actualCenter);
                }
              }, 50);
              
              // Start protection immediately - keep it active indefinitely
              zoomProtectionRef.current = setInterval(() => {
                if (!mapRef.current || !mapRef.current.getZoom || typeof mapRef.current.getZoom !== 'function') {
                  if (zoomProtectionRef.current) {
                    clearInterval(zoomProtectionRef.current);
                    zoomProtectionRef.current = null;
                  }
                  return;
                }
                
                // Keep protection active as long as flyToLocation is set
                // Only disable if flyToLocation is cleared (handled in cleanup)
                
                try {
                  const currentZoom = mapRef.current.getZoom();
                  const elapsed = Date.now() - protectionStartTime;
                  const protectionWindow = 2000; // 2 seconds - only protect against automatic resets during this window
                  
                  // Only protect against zoom changes if within protection window
                  // After that, allow user to zoom manually
                  if (elapsed < protectionWindow && currentZoom !== 15) {
                    console.log(`[Map] Zoom was changed to ${currentZoom} after ${elapsed}ms (within protection window) - forcing back to 15`);
                    if (mapRef.current.setZoom && typeof mapRef.current.setZoom === 'function') {
                      mapRef.current.setZoom(15, { animate: false });
                    }
                    if (mapRef.current.setView && typeof mapRef.current.setView === 'function') {
                      mapRef.current.setView(adjustedCenter, 15, { animate: false });
                    }
                  } else if (elapsed >= protectionWindow) {
                    // After protection window, disable protection to allow user control
                    console.log('[Map] Protection window expired - allowing user zoom control');
                    if (zoomProtectionRef.current) {
                      clearInterval(zoomProtectionRef.current);
                      zoomProtectionRef.current = null;
                    }
                  }
                } catch (error) {
                  console.error('[Map] Error in zoom protection interval:', error);
                  // Clear interval on error to prevent repeated errors
                  if (zoomProtectionRef.current) {
                    clearInterval(zoomProtectionRef.current);
                    zoomProtectionRef.current = null;
                  }
                }
              }, 25) as any; // Check every 25ms for faster response
              
              // Keep protection active indefinitely until user manually zooms or navigates away
              // Only disable protection if flyToLocation changes or is cleared
              // Don't restore minZoom - keep it at 15 to prevent zoom out
              
              // After a delay, re-enable zoomend state updates, restore minZoom, but KEEP protection active
              setTimeout(() => {
                isAnimatingRef.current = false;
                skipZoomEndUpdateRef.current = false; // Re-enable zoomend state updates
                
                // Force zoom to 15 one more time to ensure it's correct
                if (mapRef.current) {
                  const currentZoom = mapRef.current.getZoom();
                  if (currentZoom !== 15) {
                    console.log('[Map] Final zoom check - forcing to 15 (current:', currentZoom, ')');
                    if (mapRef.current.setZoom && typeof mapRef.current.setZoom === 'function') {
                      mapRef.current.setZoom(15, { animate: false });
                    }
                    if (mapRef.current.setView && typeof mapRef.current.setView === 'function') {
                      mapRef.current.setView(adjustedCenter, 15, { animate: false });
                    }
                  }
                  
                  // Restore original minZoom to allow manual zoom out
                  if (mapRef.current.setMinZoom && typeof mapRef.current.setMinZoom === 'function') {
                    mapRef.current.setMinZoom(originalMinZoom);
                    console.log('[Map] Restored minZoom to', originalMinZoom, '- user can now zoom out manually');
                  }
                }
                
                console.log('[Map] Zoom protection will remain active to prevent automatic zoom resets, but user can zoom manually');
                // Keep protection active - don't disable it automatically
                // It will be cleared when flyToLocation changes or is cleared
              }, 100); // Small delay to ensure setView completed
            }, 300); // Wait 300ms for bottom sheet to open/resize
            
            // Store timeout for cleanup
            panTimeoutRef.current = flyToTimeout as any;
          } else {
            // Default behavior for desktop or non-events/excursions
            // Stop any ongoing animations first
            map.stop();
        map.flyTo([flyToLocation.lat, flyToLocation.lng], 13, { animate: true, duration: 1.5 });
    }
        }
    } else {
      // Reset the ref when flyToLocation is cleared
      lastFlyToLocationRef.current = null;
      hasPerformedFitBoundsRef.current = false;
      
      // Clear zoom protection when flyToLocation is cleared
      if (zoomProtectionRef.current) {
        clearInterval(zoomProtectionRef.current);
        zoomProtectionRef.current = null;
        console.log('[Map] Zoom protection cleared - flyToLocation cleared');
      }
      isAnimatingRef.current = false;
      skipZoomEndUpdateRef.current = false;
    }
    
    // Cleanup function - clear any pending timeouts and intervals
    return () => {
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
        panTimeoutRef.current = null;
      }
      // Don't clear zoom protection in cleanup - let it run until flyToLocation changes
      // This prevents zoom resets when the effect re-runs
    };
  }, [flyToLocation, flyToFromEventsOrExcursions, isSmallScreen]);

  

  // Separate effect for manual pin - only runs when manualPinLocation changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove existing pin
    if (pinMarkerRef.current) {
        map.removeLayer(pinMarkerRef.current);
        pinMarkerRef.current = null;
    }

    // Add new pin if location is valid
    if (isValidLatLng(manualPinLocation)) {
        const pinHtml = `<div class="pin-animator"><div class="pin-circle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" /></svg></div><div class="pin-tail"></div></div>`;
        const pinIcon = L.divIcon({ className: 'leaflet-pin-container', html: pinHtml, iconSize: [44, 59], iconAnchor: [22, 59] });
        pinMarkerRef.current = L.marker([manualPinLocation.lat, manualPinLocation.lng], { icon: pinIcon, zIndexOffset: 2000 }).addTo(map);
        pinMarkerRef.current.bindPopup(`<b>Custom Location</b><br/>Searching around this pin.<br/><button id="remove-pin-btn" class="remove-pin-button">Remove Pin</button>`).on('popupopen', () => {
            document.getElementById('remove-pin-btn')?.addEventListener('click', () => { map.closePopup(); onRemovePin(); });
        });
    }
  }, [manualPinLocation, onRemovePin]);

  // Main effect for places and other markers - runs when places or other data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
    
    // Only remove markers if places array actually changed (not on every render)
    const placesChanged = placeMarkersRef.current.length !== places.length || 
      placeMarkersRef.current.some((m, i) => (m as any).placeId !== places[i]?.id);
    
    if (placesChanged) {
      placeMarkersRef.current.forEach(marker => marker.remove());
      placeMarkersRef.current = [];
    }
    
    // Village labels don't change often, only recreate if needed
    const shouldRecreateVillageLabels = villageLabelMarkersRef.current.length === 0;
    if (shouldRecreateVillageLabels) {
      villageLabelMarkersRef.current.forEach(marker => marker.remove());
      villageLabelMarkersRef.current = [];
    }

    // If weather menu or user alarms are open, don't show default markers to avoid clutter
    if (showWaves || showUserAlarms) {
      console.log('Weather menu or user alarms are open - hiding default map markers');
      return;
    }

    if (viewingTrip) {
        if (userMarkerRef.current) userMarkerRef.current.setOpacity(0);
        const validTripPlaces = viewingTrip.places.filter(p => isValidLatLng(p.coordinates));
        if (validTripPlaces.length > 0) {
            validTripPlaces.forEach((place, index) => {
                const isHovered = place.id === hoveredTripPlaceId;
                const tripIconSize = getIconSize(36);
                const markerHtml = `<div style="background-color: #0ea5e9; color: white; width: ${tripIconSize}px; height: ${tripIconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(12, tripIconSize * 0.4)}px; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: ${isHovered ? 'scale(1.2)' : 'scale(1)'}; transition: transform 0.2s ease-out;">${index + 1}</div>`;
                const markerIcon = L.divIcon({ className: 'custom-div-icon', html: markerHtml, iconSize: [tripIconSize + 6, tripIconSize + 6], iconAnchor: [(tripIconSize + 6) / 2, (tripIconSize + 6) / 2] });
                const marker = L.marker([place.coordinates.lat, place.coordinates.lng], { icon: markerIcon }).addTo(map);
                (marker as any).placeId = place.id;
                placeMarkersRef.current.push(marker);
            });
            const routeCoords = activeTravelMode ? viewingTrip.routeInfo?.[activeTravelMode]?.coordinates : null;
            const latLngs = (routeCoords || validTripPlaces.map(p => p.coordinates)).filter(isValidLatLng).map(c => [c.lat, c.lng]);
            if (latLngs.length > 1) {
                const polyline = L.polyline(latLngs, { color: '#0891b2', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);
                routeLayerRef.current = polyline;
            }
        }
    } else {
        if (userMarkerRef.current) userMarkerRef.current.setOpacity(1);
        if (isValidLatLng(userLocation)) {
            if (!userMarkerRef.current) {
                const userMarkerHtml = `<div class="w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white"></div>`;
                const userIcon = L.divIcon({ className: 'custom-user-marker', html: userMarkerHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
                userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map).bindPopup('Your Location');
            } else {
                userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
            }
        } else if (userMarkerRef.current) {
            map.removeLayer(userMarkerRef.current);
            userMarkerRef.current = null;
        }

        // Only create village labels if they don't exist
        if (villageLabelMarkersRef.current.length === 0) {
            const villageLabelMarkers = createVillageLabelMarkers(L);
            villageLabelMarkers.forEach(marker => {
                marker.addTo(map);
                villageLabelMarkersRef.current.push(marker);
            });
        }

        // Tour layers are now handled separately - don't clear them here

        let allMarkersDataRaw;
        if (selectedBusRoute) {
            allMarkersDataRaw = places;
        } else {
            allMarkersDataRaw = [...places, ...busStopClusters];
        }
        const allMarkersData = Array.from(new Map(allMarkersDataRaw.map(item => [item.id, item])).values());

        // Filter out dynamic places - they will be handled by ferry markers
        allMarkersData.filter(p => 
          isValidLatLng(p.coordinates) && 
          p.category !== PlaceCategory.TOURS && 
          p.category !== PlaceCategory.HIKING_TRAIL && 
          p.category !== PlaceCategory.BUS_ROUTE &&
          !(p.is_dynamic_location === 1 || p.is_dynamic_location === true) // Exclude dynamic places
        ).forEach((place) => {
            const isSelected = selectedPlace?.id === place.id || selectedGroupedBusStop?.id === place.id;
            const isHovered = hoveredPlaceId === place.id;
            
            // Check if marker already exists
            const existingMarker = placeMarkersRef.current.find(m => (m as any).placeId === place.id);
            if (existingMarker && !placesChanged) {
                // Update existing marker's icon and style when selection changes
                const currentIsSelected = (existingMarker as any).isSelected;
                const currentIsHovered = (existingMarker as any).isHovered;
                
                // Only update if selection state changed
                if (currentIsSelected !== isSelected || currentIsHovered !== isHovered) {
                    (existingMarker as any).isSelected = isSelected;
                    (existingMarker as any).isHovered = isHovered;
                    
                    // Rebuild icon with updated selection state - SIMPLE LOGIC matching backend
                    const iconSize = getIconSize(place.iconSize || 32);
                    const iconValueUpdate = place.icon ? String(place.icon).trim() : '';
                    const hasCustomImageIcon = iconValueUpdate.startsWith('/uploads/');
                    
                    // Use icon exactly as stored - don't replace variants
                    let customIconUrl = hasCustomImageIcon ? iconValueUpdate : null;
                    
                    // Get category icon - ALWAYS use this if no custom image
                    const customCat = customCategories.find(cat => cat.name === place.category);
                    const categoryEmoji = customCat?.icon || CATEGORY_INFO[place.category]?.icon || '📍';
                    
                    let markerHtml, iconOptions;
                    if (customIconUrl) {
                        // Custom image icon
                        const iconSrc = `${getApiBaseUrl()}${customIconUrl}`;
                        const offset = iconOffsets[place.id] || { x: 0, y: 0 };
                        const translate = `translate(${offset.x}px, ${offset.y}px)`;
                        const scale = `scale(${isSelected || isHovered ? 1.2 : 1})`;
                        const escapedEmoji = categoryEmoji.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                        markerHtml = `<div style="position: relative; display: inline-block; width: ${iconSize + 12}px; height: ${iconSize + 12}px; transform: ${translate} ${scale}; transition: transform 0.2s ease-out;">
                            <div class="icon-fallback-${place.id}" style="display: none; background-color: white; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; position: absolute; top: 6px; left: 6px; align-items: center; justify-content: center; font-size: 20px; z-index: 10;">${escapedEmoji}</div>
                            ${isSelected ? `
                                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, rgba(147, 197, 253, 0.8) 0%, rgba(96, 165, 250, 0.6) 50%, rgba(59, 130, 246, 0.3) 100%); box-shadow: 0 4px 15px rgba(147, 197, 253, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);"></div>
                                <img src="${iconSrc}" alt="${place.name}" onerror="this.style.display='none'; const fallback=this.parentElement.querySelector('.icon-fallback-${place.id}'); if(fallback) fallback.style.display='flex';" crossorigin="anonymous" style="position: relative; z-index: 1; width: ${iconSize}px; height: ${iconSize}px; object-fit: contain; display: block; border-radius: 50%; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); margin: 6px;">
                            ` : `
                                <img src="${iconSrc}" alt="${place.name}" onerror="this.style.display='none'; const fallback=this.parentElement.querySelector('.icon-fallback-${place.id}'); if(fallback) fallback.style.display='flex';" crossorigin="anonymous" style="width: ${iconSize}px; height: ${iconSize}px; object-fit: contain; display: block; border-radius: 50%; margin: 6px;">
                            `}
                        </div>`;
                        iconOptions = { className: 'custom-image-icon', html: markerHtml, iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize * 0.5] };
                    } else {
                        // No custom image - ALWAYS use category emoji
                        markerHtml = `<div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transform: ${isSelected || isHovered ? 'scale(1.15)' : 'scale(1)'}; transition: all 0.2s ease-out;">
                            ${isSelected ? `
                                <div style="position: absolute; top: 2px; left: 2px; width: 36px; height: 36px; border-radius: 50%; background: radial-gradient(circle, rgb(147, 197, 253) 0%, rgb(96, 165, 250) 50%, rgb(59, 130, 246) 100%); box-shadow: 0 4px 15px rgba(147, 197, 253, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);"></div>
                                <div style="position: relative; z-index: 1; font-size: 24px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">${categoryEmoji}</div>
                            ` : `
                                <div style="background-color: white; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">${categoryEmoji}</div>
                            `}
                        </div>`;
                        iconOptions = { className: 'custom-div-icon', html: markerHtml, iconSize: [46, 46], iconAnchor: [23, 23] };
                    }
                    
                    existingMarker.setIcon(L.divIcon(iconOptions));
                    existingMarker.setOpacity(isSelected ? 1.0 : 0.9);
                    existingMarker.setZIndexOffset(isSelected ? 500 : (isHovered ? 400 : (customIconUrl?.startsWith('/uploads/') ? 100 : 0)));
                }
                return; // Marker already exists and updated, skip creation
            }
            
            // Check if this place's category is currently selected
            const isCategorySelected = safeSelectedCategories.length > 0 && 
                safeSelectedCategories.some(cat => cat === place.category);
            
            // Check if custom icon should be used
            // Logic:
            // 1. If isDefaultIcon = 1 (checked): Always show place with custom icon
            // 2. If isDefaultIcon = 0 (unchecked) AND has custom icon: Only show when category is selected
            // 3. If isDefaultIcon is undefined/null (old data): Show custom icon always (backward compatibility)
            const hasIsDefaultIconField = place.isDefaultIcon !== undefined && place.isDefaultIcon !== null;
            // Check if icon is a custom image (starts with /uploads/, is an http URL, or contains file extension)
            const hasCustomIcon = place.icon && (
                place.icon.startsWith('/uploads/') || 
                place.icon.startsWith('http') || 
                place.icon.includes('.png') || 
                place.icon.includes('.jpg') || 
                place.icon.includes('.jpeg') || 
                place.icon.includes('.webp') || 
                place.icon.includes('.gif') || 
                place.icon.includes('.svg')
            );
            
            // Determine if this place should be shown at all
            let shouldShowPlace = true;
            let shouldUseCustomIcon;
            
            if (hasIsDefaultIconField && hasCustomIcon) {
                if (place.isDefaultIcon === 1 || place.isDefaultIcon === true) {
                    // Checkbox checked: always show with custom icon
                    shouldShowPlace = true;
                    shouldUseCustomIcon = true;
                } else {
                    // Checkbox unchecked: only show when category is selected
                    shouldShowPlace = isCategorySelected;
                    shouldUseCustomIcon = isCategorySelected;
                }
            } else if (hasCustomIcon && !hasIsDefaultIconField) {
                // Old data without field: always show custom icon (backward compatibility)
                shouldShowPlace = true;
                shouldUseCustomIcon = true;
            } else {
                // No custom icon: always show with category icon
                shouldShowPlace = true;
                shouldUseCustomIcon = false;
            }
            
            // Skip this place if it shouldn't be shown
            if (!shouldShowPlace) {
                return;
            }
            
            // SIMPLE LOGIC: Match backend admin exactly
            // If icon exists and starts with /uploads/ → use as image, otherwise → use category icon
            // IGNORE shouldUseCustomIcon - that's for visibility, not icon display
            // Check if icon is a string and starts with /uploads/ (trim whitespace first)
            const iconValue = place.icon ? String(place.icon).trim() : '';
            const hasCustomImageIcon = iconValue.startsWith('/uploads/');
            
            // Debug logging
            if (place.icon) {
                console.log('🔍 ICON DEBUG for', place.name, ':', {
                    rawIcon: place.icon,
                    iconValue: iconValue,
                    iconType: typeof place.icon,
                    startsWithUploads: iconValue.startsWith('/uploads/'),
                    hasCustomImageIcon,
                    shouldUseCustomIcon,
                    category: place.category
                });
            }
            
            // Use the icon EXACTLY as stored - don't try to replace variants
            // The backend stores the correct path, we should use it as-is
            // BUT: If the icon fails, immediately fallback to category icon (don't wait for error)
            let customIconUrl = hasCustomImageIcon ? iconValue : null;
            if (customIconUrl) {
              console.log('✅ Using custom icon URL (as stored):', customIconUrl, 'for', place.name);
            } else {
              console.log('❌ NO custom icon URL for', place.name, '- will use category emoji:', categoryEmoji);
            }
            
            // Get category icon - ALWAYS use this if no custom image icon
            const customCat = customCategories.find(cat => cat.name === place.category);
            const categoryEmoji = customCat?.icon || CATEGORY_INFO[place.category]?.icon || '📍';
            
            const iconSize = getIconSize(place.iconSize || 32);
            let markerHtml, iconOptions;

            // Tour routes are now handled in a separate useEffect
            
            // Handle Bus Routes
            if (place.category === PlaceCategory.BUS_ROUTE && place.routeCoordinates && place.routeCoordinates.length > 1) {
                const polyline = L.polyline(place.routeCoordinates, {
                    color: '#22c55e', // Green for bus routes
                    weight: 4,
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(map);
                tourRouteLayersRef.current.push(polyline);

                // Add a popup with the route name and description
                polyline.bindPopup(`<b>${place.name}</b><br>${place.shortDescription || ''}`).on('click', (e) => {
                    e.target.openPopup();
                });

                // Add a bus route icon marker at the start of the route
                if (place.coordinates && isValidLatLng(place.coordinates)) {
                    const busIconSize = getIconSize(place.iconSize || 32);
                    const busMarkerHtml = `<div style="background-color: #22c55e; color: white; width: ${busIconSize}px; height: ${busIconSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${Math.max(16, busIconSize * 0.6)}px; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25); transform: scale(1.1);">${place.icon || '🚌'}</div>`;
                    const busIconOptions = { 
                        className: 'custom-bus-route-icon', 
                        html: busMarkerHtml, 
                        iconSize: [busIconSize + 6, busIconSize + 6], 
                        iconAnchor: [(busIconSize + 6) / 2, (busIconSize + 6) / 2] 
                    };
                    
                    const busMarker = L.marker([place.coordinates.lat, place.coordinates.lng], { 
                        icon: L.divIcon(busIconOptions),
                        zIndexOffset: 300
                    }).addTo(map);
                    
                    busMarker.bindPopup(`<b>${place.name}</b><br>${place.shortDescription || ''}`).on('click', () => {
                        // Handle bus route selection if needed
                    });
                    
                    tourRouteLayersRef.current.push(busMarker);
                }
            }

            // SIMPLE LOGIC: If icon starts with /uploads/ → use image, else → use category emoji
            if (customIconUrl && customIconUrl.trim() !== '') {
                // Custom image icon - construct full URL with API base
                const iconSrc = `${getApiBaseUrl()}${customIconUrl}`;
                console.log('🖼️ Creating marker with custom icon:', iconSrc, 'for', place.name);
                
                const offset = iconOffsets[place.id] || { x: 0, y: 0 };
                const translate = `translate(${offset.x}px, ${offset.y}px)`;
                const scale = `scale(${isSelected || isHovered ? 1.2 : 1})`;
                const escapedEmoji = categoryEmoji.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const escapedPlaceId = String(place.id).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                
                // Create fallback that will show category icon if image fails
                // Use a more reliable error handler that properly replaces the content
                markerHtml = `<div style="position: relative; display: inline-block; width: ${iconSize + 12}px; height: ${iconSize + 12}px; transform: ${translate} ${scale}; transition: transform 0.2s ease-out;">
                    ${isSelected ? `
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, rgba(147, 197, 253, 0.8) 0%, rgba(96, 165, 250, 0.6) 50%, rgba(59, 130, 246, 0.3) 100%); box-shadow: 0 4px 15px rgba(147, 197, 253, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);"></div>
                        <img src="${iconSrc}" alt="${place.name}" onerror="this.onerror=null; console.error('Icon failed, showing category emoji:', '${escapedEmoji}'); const parent=this.parentElement; if(parent){parent.innerHTML='<div style=\\'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, rgba(147, 197, 253, 0.8) 0%, rgba(96, 165, 250, 0.6) 50%, rgba(59, 130, 246, 0.3) 100%); box-shadow: 0 4px 15px rgba(147, 197, 253, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);\\'></div><div style=\\'position: relative; z-index: 1; font-size: 24px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;\\'>${escapedEmoji}</div>';}" crossorigin="anonymous" style="position: relative; z-index: 1; width: ${iconSize}px; height: ${iconSize}px; object-fit: contain; display: block; border-radius: 50%; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); margin: 6px;">
                    ` : `
                        <img src="${iconSrc}" alt="${place.name}" onerror="this.onerror=null; console.error('Icon failed, showing category emoji:', '${escapedEmoji}'); const parent=this.parentElement; if(parent){parent.innerHTML='<div style=\\'background-color: white; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);\\'>${escapedEmoji}</div>';}" crossorigin="anonymous" style="width: ${iconSize}px; height: ${iconSize}px; object-fit: contain; display: block; border-radius: 50%; margin: 6px;">
                    `}
                </div>`;
                iconOptions = { className: 'custom-image-icon', html: markerHtml, iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize * 0.5] };
            } else {
                // No custom image - ALWAYS use category emoji
                console.log('📍 Using category emoji:', categoryEmoji, 'for', place.name);
                markerHtml = `<div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transform: ${isSelected || isHovered ? 'scale(1.15)' : 'scale(1)'}; transition: all 0.2s ease-out;">
                    ${isSelected ? `
                        <div style="position: absolute; top: 2px; left: 2px; width: 36px; height: 36px; border-radius: 50%; background: radial-gradient(circle, rgb(147, 197, 253) 0%, rgb(96, 165, 250) 50%, rgb(59, 130, 246) 100%); box-shadow: 0 4px 15px rgba(147, 197, 253, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);"></div>
                        <div style="position: relative; z-index: 1; font-size: 24px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">${categoryEmoji}</div>
                    ` : `
                        <div style="background-color: white; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">${categoryEmoji}</div>
                    `}
                </div>`;
                iconOptions = { className: 'custom-div-icon', html: markerHtml, iconSize: [46, 46], iconAnchor: [23, 23] };
            }

            const routeDisplayName = place.routeId ? (routeNamesMap[place.routeId] || place.routeId) : null;
            const popupContent = `<b>${place.name}</b>${routeDisplayName ? `<br/>Route: ${routeDisplayName}` : ''}`;
            const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
                icon: L.divIcon(iconOptions),
                opacity: isSelected ? 1.0 : 0.9,
                zIndexOffset: isSelected ? 500 : (isHovered ? 400 : (customIconUrl?.startsWith('/uploads/') ? 100 : 0))
            }).addTo(map).bindPopup(popupContent, {
                autoClose: false,
                closeOnClick: false
            }).on('click', () => {
                // Close any open popup to prevent message bubbles
                map.closePopup();
                // Highlight the icon instead
                onMarkerClick(place);
            }).on('mouseover', () => onPlaceHover(place.id)).on('mouseout', () => onPlaceHover(null));
            (marker as any).placeId = place.id;
            (marker as any).isSelected = isSelected;
            (marker as any).isHovered = isHovered;
            placeMarkersRef.current.push(marker);
        });

        // Add label markers for GO mode - show names and thumbnails above nearby places
        if (isGoModeActive && userLocation && isValidLatLng(userLocation)) {
            // Clear existing label markers
            labelMarkersRef.current.forEach(labelMarker => {
                if (mapRef.current) {
                    mapRef.current.removeLayer(labelMarker);
                }
            });
            labelMarkersRef.current = [];

            // Filter places within range and matching selected categories
            const radiusInMeters = searchRadius * 1000;
            const nearbyPlaces = allMarkersData.filter(p => {
                if (!isValidLatLng(p.coordinates) || p.category === PlaceCategory.TOURS || p.category === PlaceCategory.HIKING_TRAIL || p.category === PlaceCategory.BUS_ROUTE) {
                    return false;
                }
                
                // Check if category is selected
                const isCategorySelected = safeSelectedCategories.length === 0 || 
                    safeSelectedCategories.some(cat => cat === p.category);
                if (!isCategorySelected) return false;

                // Check distance
                const distance = getDistance(userLocation, p.coordinates);
                return distance <= radiusInMeters;
            });

            // Create label markers for nearby places
            nearbyPlaces.forEach(place => {
                const imageUrl = place.mainImage || place.imageUrl || place.galleryImages?.[0];
                const imageSrc = imageUrl ? (imageUrl.startsWith('/uploads/') ? `${getApiBaseUrl()}${imageUrl}` : imageUrl) : null;
                
                const labelHtml = `
                    <div style="
                        background: rgba(184, 180, 180, 0.75);
                        border-radius: 6px;
                        padding: 2px 0;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        display: flex;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 2px;
                        pointer-events: none;
                        width: 80px;
                    ">
                        ${imageSrc ? `
                            <img src="${imageSrc}" 
                                 alt="${place.name}" 
                                 style="width: 100%; height: 45px; object-fit: cover; border-radius: 4px; flex-shrink: 0; display: block;" 
                                 onerror="this.style.display='none'"
                            />
                        ` : ''}
                        <span style="
                            font-size: 10px;
                            font-weight: 600;
                            color: #1f2937;
                            text-align: center;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            width: 100%;
                            padding: 0;
                        ">${place.name}</span>
                    </div>
                `;

                const labelHeight = imageSrc ? 55 : 20; // Height depends on whether image exists
                // Calculate offset based on marker icon size (typically 46px for default markers)
                const markerIconHeight = 46; // Height of the place marker icon
                const spacing = 5; // Spacing between label and marker in pixels
                const totalOffset = labelHeight + spacing + (markerIconHeight / 2);
                
                const labelIcon = L.divIcon({
                    className: 'place-label-marker',
                    html: labelHtml,
                    iconSize: [80, labelHeight],
                    iconAnchor: [40, totalOffset], // Anchor at bottom center, offset to appear above marker
                });

                // Position label at exact same coordinates as place marker (no lat/lng offset)
                const labelMarker = L.marker([place.coordinates.lat, place.coordinates.lng], {
                    icon: labelIcon,
                    zIndexOffset: 600,
                    interactive: false,
                }).addTo(map);
                
                labelMarkersRef.current.push(labelMarker);
            });
        } else {
            // Clear label markers when GO mode is off
            labelMarkersRef.current.forEach(labelMarker => {
                if (mapRef.current) {
                    mapRef.current.removeLayer(labelMarker);
                }
            });
            labelMarkersRef.current = [];
        }
    }
  }, [userLocation, places, onMarkerClick, selectedPlace, viewingTrip, hoveredTripPlaceId, activeTravelMode, selectedGroupedBusStop, safeSelectedCategories, busStopClusters, iconOffsets, showWaves, isGoModeActive, searchRadius]);

  // AIS tracking for dynamic ferry markers
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Connect to AIS service
    aisService.connect();

    // Handle position updates
    const unsubscribe = aisService.onPositionUpdate((position: AISPosition) => {
      console.log('📍 AIS position update received:', position.mmsi, position.latitude, position.longitude);
      setAisPositions(prev => {
        const newMap = new Map(prev);
        newMap.set(position.mmsi, position);
        return newMap;
      });
    });

    // Find places with dynamic location enabled
    const dynamicPlaces = places.filter(place => 
      place.is_dynamic_location === 1 || place.is_dynamic_location === true
    );
    
    console.log('🚢 Dynamic places found:', dynamicPlaces.length, dynamicPlaces.map(p => ({ name: p.name, mmsi: p.ais_mmsi, isDynamic: p.is_dynamic_location })));

    // Create or update ferry markers for dynamic places
    dynamicPlaces.forEach(place => {
      if (!place.ais_mmsi) {
        console.warn('🚢 Place has dynamic location but no MMSI:', place.name);
        return;
      }

      // Parse MMSI numbers (comma-separated)
      const mmsiList = place.ais_mmsi.split(',').map(m => m.trim()).filter(m => m);
      console.log(`🚢 Creating markers for ${place.name} with MMSI:`, mmsiList);
      
      mmsiList.forEach(mmsi => {
        // Get position from both service and React state (service is source of truth)
        const positionFromService = aisService.getPosition(mmsi);
        const positionFromState = aisPositions.get(mmsi);
        const position = positionFromService || positionFromState;
        
        const markerKey = `${place.id}-${mmsi}`;
        const existingMarkerData = ferryMarkersRef.current.get(markerKey);
        
        // Use AIS position if available, otherwise use place's initial coordinates
        const currentCoords: Coordinates = position 
          ? { lat: position.latitude, lng: position.longitude }
          : place.coordinates;

        if (existingMarkerData) {
          // Update existing marker with interpolation
          if (position) {
            const oldPos = existingMarkerData.marker.getLatLng();
            const newPos: Coordinates = { lat: position.latitude, lng: position.longitude };
            
            // Only update if position actually changed
            if (oldPos.lat !== newPos.lat || oldPos.lng !== newPos.lng) {
              console.log(`🚢 Updating ferry marker for ${place.name} (MMSI ${mmsi}):`, oldPos, '->', newPos);
              // Update target position and animation start
              existingMarkerData.targetPosition = newPos;
              existingMarkerData.animationStartPos = { lat: oldPos.lat, lng: oldPos.lng };
              existingMarkerData.animationStartTime = Date.now();
            }
          }
        } else {
          // Create new ferry marker
          const ferryIconHtml = `<div style="
            background-color: #3b82f6;
            color: white;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: bold;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            transform: scale(1.1);
          ">🚢</div>`;
          
          const ferryIcon = L.divIcon({
            className: 'ferry-marker',
            html: ferryIconHtml,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
          });

          const marker = L.marker([currentCoords.lat, currentCoords.lng], {
            icon: ferryIcon,
            zIndexOffset: 700
          }).addTo(map);

          marker.bindPopup(`<b>${place.name}</b><br/>MMSI: ${mmsi}${position ? '<br/>📍 Live position' : '<br/>⏳ Waiting for position data'}`).on('click', () => {
            map.closePopup();
            onMarkerClick(place);
          });

          ferryMarkersRef.current.set(markerKey, {
            marker,
            placeId: place.id,
            targetPosition: currentCoords,
            animationStartTime: Date.now(),
            animationStartPos: currentCoords
          });
          
          console.log(`🚢 Created ferry marker for ${place.name} at initial position:`, currentCoords, position ? '(with AIS data)' : '(using place coordinates)');
        }
      });
    });

    // Remove markers for places that are no longer dynamic
    ferryMarkersRef.current.forEach((markerData, key) => {
      const [placeId] = key.split('-');
      const place = places.find(p => String(p.id) === placeId);
      
      if (!place || !(place.is_dynamic_location === 1 || place.is_dynamic_location === true)) {
        map.removeLayer(markerData.marker);
        ferryMarkersRef.current.delete(key);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      ferryMarkersRef.current.forEach((markerData) => {
        if (mapRef.current) {
          mapRef.current.removeLayer(markerData.marker);
        }
      });
      ferryMarkersRef.current.clear();
    };
  }, [places, onMarkerClick, aisPositions]); // Added aisPositions to dependencies!

  // Animation loop for smooth ferry movement
  useEffect(() => {
    if (!mapRef.current) return;

    const animate = () => {
      const now = Date.now();
      const animationDuration = 2000; // 2 seconds

      ferryMarkersRef.current.forEach((markerData) => {
        const elapsed = now - markerData.animationStartTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // Easing function for smooth animation
        const easeProgress = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentLat = markerData.animationStartPos.lat + 
          (markerData.targetPosition.lat - markerData.animationStartPos.lat) * easeProgress;
        const currentLng = markerData.animationStartPos.lng + 
          (markerData.targetPosition.lng - markerData.animationStartPos.lng) * easeProgress;

        markerData.marker.setLatLng([currentLat, currentLng]);
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [aisPositions]);

  // Stabilize tour data to prevent unnecessary re-renders
  const stableTourData = useMemo(() => {
    return {
      tourRoutes: safeTourRoutes,
      hikingTrails: safeHikingTrails,
      selectedTour: safeSelectedTour,
      selectedCategories: safeSelectedCategories
    };
  }, [safeTourRoutes, safeHikingTrails, safeSelectedTour, safeSelectedCategories]);



  // Tour effect - handle both selectedTour and category-based rendering
  useEffect(() => {
    console.log('=== TOUR EFFECT RUNNING ===');
    console.log('selectedTour:', safeSelectedTour);
    console.log('selectedCategories:', safeSelectedCategories);
    
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Clear existing tour layers
    tourRouteLayersRef.current.forEach(layer => map.removeLayer(layer));
    tourRouteLayersRef.current = [];
    
    // If a specific tour is selected, show only that tour
    if (safeSelectedTour) {
      console.log('Rendering selected tour:', safeSelectedTour.id);
      const allTours = [...safeTourRoutes, ...safeHikingTrails];
      let tour = allTours.find(t => t.id === safeSelectedTour.id);
      
      // If tour not found in tourRoutes, use selectedTour directly if it has routeCoordinates
      if (!tour && safeSelectedTour.routeCoordinates && safeSelectedTour.routeCoordinates.length > 1) {
        tour = safeSelectedTour;
        console.log('Using selectedTour directly as it has routeCoordinates');
      }
      
      if (tour && tour.routeCoordinates && tour.routeCoordinates.length > 1) {
        // Render selected tour route
        const polyline = L.polyline(tour.routeCoordinates, {
          color: tour.polylineColor || '#8A2BE2',
          weight: 6,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        
        (polyline as any)._tourId = tour.id;
        tourRouteLayersRef.current.push(polyline);
        console.log('Added selected tour polyline to map');
        
        // Add tour marker and stops
        addTourMarkerAndPoints(tour, map, L);
      } else {
        console.warn('Selected tour does not have valid routeCoordinates:', safeSelectedTour);
      }
    }
    // If no specific tour is selected but Tours category is selected, show all tours
    else if (safeSelectedCategories.includes(PlaceCategory.TOURS)) {
      console.log('No specific tour selected, but Tours category active - showing all tours');
      const allTours = [...safeTourRoutes, ...safeHikingTrails];
      
      allTours.forEach(tour => {
        if (tour.routeCoordinates && tour.routeCoordinates.length > 1) {
          const polyline = L.polyline(tour.routeCoordinates, {
            color: tour.polylineColor || '#8A2BE2',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
          
          (polyline as any)._tourId = tour.id;
          tourRouteLayersRef.current.push(polyline);
          console.log('Added tour polyline to map:', tour.id);
          
          // Add tour marker and stops
          addTourMarkerAndPoints(tour, map, L);
        }
      });
      console.log('Total tour layers on map:', tourRouteLayersRef.current.length);
    }
  }, [safeSelectedTour, safeSelectedCategories, safeTourRoutes, safeHikingTrails]);







  // Effect for drawing bus route polyline
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear existing bus route polyline
    if (busRoutePolylineRef.current) {
      map.removeLayer(busRoutePolylineRef.current);
      busRoutePolylineRef.current = null;
    }

    if (selectedBusRouteCoordinates && selectedBusRouteCoordinates.length > 1) {
      const latLngs = selectedBusRouteCoordinates.map(c => [c.lat, c.lng]);
      const polyline = L.polyline(latLngs, {
        color: '#0ea5e9', // A distinct color for bus routes
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      busRoutePolylineRef.current = polyline;

      // Optionally fit map to polyline bounds
      try {
        map.fitBounds(polyline.getBounds());
      } catch (error) {
        console.warn("Could not fit bounds for bus route polyline:", error);
      }
    }

    // Cleanup function
    return () => {
      if (busRoutePolylineRef.current) {
        map.removeLayer(busRoutePolylineRef.current);
        busRoutePolylineRef.current = null;
      }
    };
  }, [selectedBusRouteCoordinates, mapRef.current]);

  useEffect(() => {
    if (viewingTrip) return;
    
    const map = mapRef.current;
    if (!map) return;

    const customIconPlaces = places.filter(p => p.icon && p.icon.startsWith('/uploads/'));
    const markersInfo = customIconPlaces.map(place => {
        const marker = placeMarkersRef.current.find(m => (m as any).placeId === place.id);
        if (!marker) return null;
        const point = map.latLngToContainerPoint(marker.getLatLng());
        const isSelected = selectedPlace?.id === place.id;
        const isHovered = hoveredPlaceId === place.id;
        const iconSize = getIconSize(place.iconSize || 32);
        return { id: place.id, marker, x: point.x, y: point.y, width: iconSize * (isSelected || isHovered ? 1.2 : 1), height: iconSize * (isSelected || isHovered ? 1.2 : 1), offsetX: 0, offsetY: 0 };
    }).filter((p): p is NonNullable<typeof p> => p !== null);

    // Icon overlap prevention disabled - icons will now appear at their original positions
    // if (markersInfo.length > 1) {
    //     for (let i = 0; i < 200; i++) {
    //         let collisions = 0;
    //         for (let j = 0; j < markersInfo.length; j++) {
    //             for (let k = j + 1; k < markersInfo.length; k++) {
    //                 const m1 = markersInfo[j];
    //                 const m2 = markersInfo[k];
    //                 const r1 = { left: m1.x - m1.width / 2 + m1.offsetX, right: m1.x + m1.width / 2 + m1.offsetX, top: m1.y - m1.height + m1.offsetY, bottom: m1.y + m1.offsetY };
    //                 const r2 = { left: m2.x - m2.width / 2 + m2.offsetX, right: m2.x + m2.width / 2 + m2.offsetX, top: m2.y - m2.height + m2.offsetY, bottom: m2.y + m2.offsetY };
    //                 if (r1.right > r2.left && r1.left < r2.right && r1.bottom > r2.top && r1.top < r2.bottom) {
    //                     collisions++;
    //                     const dx = (r1.left + r1.right) / 2 - (r2.left + r2.right) / 2;
    //                     const dy = (r1.top + r1.bottom) / 2 - (r2.top + r2.bottom) / 2;

    //                     const minDistance = (m1.width + m2.width) / 2 + 2; // Still a base separation

    //                     let pushX = 0;
    //                     let pushY = 0;

    //                     // Calculate overlap in both dimensions
    //                     const currentOverlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    //                     const currentOverlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));

    //                     // Determine the direction of push based on relative position
    //                     // If dx is positive, m1 is to the right of m2, so m1 moves right, m2 moves left
    //                     // If dy is positive, m1 is below m2, so m1 moves down, m2 moves up

    //                     if (Math.abs(dx) > Math.abs(dy)) { // Primarily horizontal overlap
    //                         const totalPush = currentOverlapX / 2 + 0; // Half overlap + margin
    //                         pushX = dx > 0 ? totalPush : -totalPush;
    //                         // Optional: a small push in Y to ensure vertical separation if needed
    //                         // pushY = dy > 0 ? 1 : -1; // A very small constant push
    //                     } else { // Primarily vertical overlap or equal
    //                         const totalPush = currentOverlapY / 2 + 0; // Half overlap + margin
    //                         pushY = dy > 0 ? totalPush : -totalPush;
    //                         // Optional: a small push in X to ensure horizontal separation if needed
    //                         // pushX = dx > 0 ? 1 : -1; // A very small constant push
    //                     }

    //                     m1.offsetX += pushX;
    //                     m1.offsetY += pushY;
    //                     m2.offsetX -= pushX;
    //                     m2.offsetY -= pushY;
    //                 }
    //             }
    //         }
    //         if (collisions === 0) break;
    //     }
    // }

    const newOffsets: { [key: string]: { x: number, y: number } } = {};
    markersInfo.forEach(info => {
        newOffsets[info.id] = { x: info.offsetX, y: info.offsetY };
    });
    setIconOffsets(newOffsets);
  }, [hoveredPlace, hoveredTripPlace]);

  const hoveredTripPlaceIndex = useMemo(() => {
      if (!viewingTrip || !hoveredTripPlace) return -1;
      return viewingTrip.places.findIndex(p => p.id === hoveredTripPlace.id);
  }, [viewingTrip, hoveredTripPlace]);

  // Show alarm context menu for quick alarm creation
  const showAlarmContextMenu = (lat: number, lng: number, containerPoint: { x: number, y: number }) => {
    // Remove existing context menu
    const existingMenu = document.getElementById('alarm-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.id = 'alarm-context-menu';
    contextMenu.style.cssText = `
      position: absolute;
      left: ${containerPoint.x}px;
      top: ${containerPoint.y}px;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 8px;
      z-index: 10000;
      min-width: 200px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;
    
    contextMenu.innerHTML = `
      <div style="color: white; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
        Add Alarm at Location
      </div>
      <div style="color: rgba(255, 255, 255, 0.7); font-size: 11px; margin-bottom: 12px; font-family: monospace;">
        ${lat.toFixed(6)}, ${lng.toFixed(6)}
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button class="context-menu-btn" data-action="new-alarm" style="
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: #6366f1;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        ">
          ➕ New Alarm (Copy Coords)
        </button>
        <div style="height: 1px; background: rgba(255, 255, 255, 0.2); margin: 4px 0;"></div>
        <button class="context-menu-btn" data-type="jellyfish" style="
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #10b981;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🪼 Jellyfish Alert
        </button>
        <button class="context-menu-btn" data-type="tsunami" style="
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🌊 Tsunami Warning
        </button>
        <button class="context-menu-btn" data-type="shark" style="
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #f59e0b;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🦈 Shark Alert
        </button>
        <button class="context-menu-btn" data-type="storm" style="
          background: rgba(139, 69, 19, 0.2);
          border: 1px solid rgba(139, 69, 19, 0.4);
          color: #8b4513;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          ⛈️ Storm Warning
        </button>
        <button class="context-menu-btn" data-type="current" style="
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #3b82f6;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          🌊 Strong Current
        </button>
        <button class="context-menu-btn" data-type="other" style="
          background: rgba(107, 114, 128, 0.2);
          border: 1px solid rgba(107, 114, 128, 0.4);
          color: #6b7280;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          ⚠️ Other Alert
        </button>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <button id="close-context-menu" style="
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #ef4444;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          width: 100%;
        ">
          Cancel
        </button>
      </div>
    `;
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .context-menu-btn:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);
    
    // Add to map container
    document.getElementById('map')?.appendChild(contextMenu);
    
    // Bind events
    contextMenu.querySelectorAll('.context-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const alarmType = target.dataset.type;
        const action = target.dataset.action;
        
        if (action === 'new-alarm') {
          // Copy coordinates to clipboard and show message
          navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).then(() => {
            alert(`Coordinates copied to clipboard!\n${lat.toFixed(6)}, ${lng.toFixed(6)}\n\nYou can now paste them into the admin form.`);
          }).catch(() => {
            // Fallback for browsers that don't support clipboard API
            prompt('Copy these coordinates:', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          });
        } else if (alarmType) {
          quickAddAlarm(lat, lng, alarmType);
        }
        contextMenu.remove();
      });
    });
    
    contextMenu.querySelector('#close-context-menu')?.addEventListener('click', () => {
      contextMenu.remove();
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  };

  // Quick add alarm function
  const quickAddAlarm = async (lat: number, lng: number, type: string) => {
    const alarmData = {
      type,
      title: getDefaultAlarmTitle(type),
      description: getDefaultAlarmDescription(type),
      severity: 'medium',
      coordinates: { lat, lng },
      isActive: true
    };
    
    try {
      const response = await fetch('/api/weather/condition-alarms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alarmData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Quick alarm added successfully');
        // Refresh wave data to show the new alarm
        refreshWaveData();
      } else {
        console.error('Error adding alarm:', result.error);
      }
    } catch (error) {
      console.error('Error adding quick alarm:', error);
    }
  };

  // Helper functions for default alarm values
  const getDefaultAlarmTitle = (type: string) => {
    const titles: { [key: string]: string } = {
      'jellyfish': 'Jellyfish Spotted',
      'tsunami': 'Tsunami Warning',
      'shark': 'Shark Alert',
      'storm': 'Storm Warning',
      'current': 'Strong Current',
      'other': 'Safety Alert'
    };
    return titles[type] || 'Safety Alert';
  };

  const getDefaultAlarmDescription = (type: string) => {
    const descriptions: { [key: string]: string } = {
      'jellyfish': 'Jellyfish have been spotted in this area. Please exercise caution when swimming.',
      'tsunami': 'Tsunami warning issued for this coastal area. Please move to higher ground.',
      'shark': 'Shark activity reported in this area. Swimming not recommended.',
      'storm': 'Severe weather conditions expected. Avoid water activities.',
      'current': 'Strong underwater currents detected. Swim with caution.',
      'other': 'Safety alert for this location. Please be aware of local conditions.'
    };
    return descriptions[type] || 'Safety alert for this location.';
  };

  // User alarm functions
  const handleCreateUserAlarm = async (alarmData: any) => {
    if (!user) {
      console.error('User not authenticated');
      alert('Please log in to create alarms');
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user-alarms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          ...alarmData,
          createdBy: user.id,
          createdByEmail: user.email,
          createdByUsername: user.username
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('User alarm created successfully');
        // Refresh user alarms
        const fetchResponse = await fetch(`${getApiBaseUrl()}/api/user-alarms`, {
          credentials: 'include'
        });
        if (fetchResponse.ok) {
          const userAlarmData = await fetchResponse.json();
          setUserAlarms(userAlarmData);
        }
      } else {
        console.error('Error creating user alarm:', result.error);
        // Show politeness scoring information if available
        if (result.politenessScore !== undefined) {
          alert(`Alarm creation failed: ${result.error}\n\nPoliteness Score: ${result.politenessScore}/100\nModeration Reasons: ${result.moderationReasons ? JSON.parse(result.moderationReasons).join(', ') : 'None'}`);
        } else {
          alert('Failed to create alarm: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Error creating user alarm:', error);
      alert('Failed to create alarm. Please try again.');
    }
  };

  const handleDeactivateUserAlarm = async (alarmId: string) => {
    // Funny but serious confirmation messages
    const confirmations = [
      "🚨 Hold up! Are you absolutely sure this danger is gone? \n\nYour fellow adventurers are counting on accurate alerts!",
      "⚠️ Wait a minute, brave soul! \n\nDouble-check: Is this alarm really no longer needed? Better safe than sorry! 🛡️"
    ];
    
    // Pick a random confirmation message
    const randomConfirmation = confirmations[Math.floor(Math.random() * confirmations.length)];
    
    const isConfirmed = window.confirm(randomConfirmation);
    
    if (!isConfirmed) {
      console.log('User cancelled alarm deactivation');
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user-alarms/${alarmId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: false,
          deactivatedBy: user?.email || user?.id || 'anonymous-user',
          createdBy: user?.id,
          createdByEmail: user?.email
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('User alarm deactivated successfully');
        alert('✅ Alert deactivated! You\'ve helped keep the community safe! 🛡️');
        // Refresh user alarms
        const fetchResponse = await fetch(`${getApiBaseUrl()}/api/user-alarms`, {
          credentials: 'include'
        });
        if (fetchResponse.ok) {
          const userAlarmData = await fetchResponse.json();
          setUserAlarms(userAlarmData);
        }
      } else {
        console.error('Error deactivating user alarm:', result.error);
        alert('❌ Failed to deactivate alarm: ' + result.error);
      }
    } catch (error) {
      console.error('Error deactivating user alarm:', error);
      alert('❌ Failed to deactivate alarm. Please try again.');
    }
  };


  // Expose deactivate function to global scope for popup buttons
  useEffect(() => {
    (window as any).deactivateUserAlarm = handleDeactivateUserAlarm;
    return () => {
      delete (window as any).deactivateUserAlarm;
    };
  }, []);

  // Add custom CSS for alarm popups to remove white frame
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-alarm-popup .leaflet-popup-content-wrapper {
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      
      .custom-alarm-popup .leaflet-popup-content {
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
      }
      
      .custom-alarm-popup .leaflet-popup-tip {
        background: rgba(17, 24, 39, 0.95) !important;
        border: 1px solid rgba(75, 85, 99, 0.3) !important;
        box-shadow: none !important;
      }
      
      .custom-alarm-popup .leaflet-popup-close-button {
        color: #d1d5db !important;
        font-size: 18px !important;
        padding: 8px !important;
        background: rgba(55, 65, 81, 0.8) !important;
        border-radius: 50% !important;
        width: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s !important;
      }
      
      .custom-alarm-popup .leaflet-popup-close-button:hover {
        background: rgba(75, 85, 99, 0.9) !important;
        color: #f3f4f6 !important;
        transform: scale(1.1) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full" data-map-component>
      <style>
        {`
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
          @keyframes userAlarmPulse {
            0% { 
              transform: scale(1);
              opacity: 0.9;
            }
            50% { 
              transform: scale(1.15);
              opacity: 0.6;
            }
            100% { 
              transform: scale(1);
              opacity: 0.9;
            }
          }
          .alarm-marker {
            animation: pulse 2s infinite;
          }
          .user-alarm-marker div {
            animation: userAlarmPulse 1.5s infinite;
          }
          .alarm-icon-container {
            pointer-events: auto !important;
            visibility: visible !important;
            opacity: 1 !important;
            display: flex !important;
            position: relative !important;
          }
          .alarm-icon-container * {
            pointer-events: none !important;
          }
          .leaflet-marker-icon.alarm-marker {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .map-control-button.treasure-hunt-control {
            width: 72px !important;
            height: 72px !important;
            min-width: 72px !important;
            min-height: 72px !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .map-control-button.treasure-hunt-control:hover {
            background: transparent !important;
            transform: scale(1.1) !important;
          }
          .map-control-button.treasure-hunt-control img {
            cursor: pointer !important;
          }
        `}
      </style>
      <div id="map" className="w-full h-full z-0" style={{ touchAction: 'manipulation' }}></div>
      
      {/* Wave Overlay */}
      {showWaves && waveData && mapBounds && (
        <WaveOverlay
          isVisible={showWaves}
          mapCenter={mapCenter}
          mapZoom={mapZoom}
          mapBounds={mapBounds}
          waveData={waveData}
          coastlineData={coastlineData}
          onMinimizedChange={setIsWeatherMinimized}
          onClose={onToggleWaves}
        />
      )}

      
      {!viewingTrip && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-center">
            <div className="flex flex-col gap-0.5 bg-slate-200/50 rounded-full p-0.5 shadow-lg backdrop-blur-sm" data-onboarding="zoom-controls">
                <button onClick={handleZoomIn} className="map-control-button zoom-control" aria-label="Zoom in" title="Zoom in"><span className="text-2xl font-light pb-0.5">+</span></button>
                <button onClick={handleZoomOut} className="map-control-button zoom-control" aria-label="Zoom out" title="Zoom out"><span className="text-3xl font-light pb-1">-</span></button>
            </div>
            <div className="flex flex-col gap-2 mt-2 items-center">
                <button onClick={onToggleLocationTracking} className={`map-control-button gps-control ${isLocationTrackingEnabled ? 'active' : ''}`} aria-label={isLocationTrackingEnabled ? 'Disable location tracking' : 'Enable location tracking'} title={isLocationTrackingEnabled ? 'Disable location tracking' : 'Enable location tracking'}>
                    <img src={`${getApiBaseUrl()}/satelite.png`} alt="Toggle satellite view" className="w-8 h-8" crossOrigin="anonymous" />
                </button>
                <button onClick={handleGoToUserLocation} className="map-control-button center-control" aria-label="Go to my location" title="Go to my location" disabled={!userLocation}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
                </button>
                {(isLocationTrackingEnabled || isOnboardingActive) && (
                    <button onClick={() => {
                        const newState = !isGoModeActive;
                        setIsGoModeActive(newState);
                        onGoModeChange?.(newState);
                    }} className={`map-control-button go-control ${isGoModeActive ? 'active' : ''}`} aria-label={isGoModeActive ? 'Stop continuous tracking' : 'Start continuous tracking'} title={isGoModeActive ? 'Stop continuous tracking' : 'Start continuous tracking'}>
                        GO
                    </button>
                )}
                <button 
                    onClick={onToggleWaves} 
                    className={`map-control-button wave-control ${showWaves ? 'active' : ''}`} 
                    aria-label={showWaves ? 'Hide weather & waves' : 'Show weather & waves'} 
                    title={showWaves ? 'Hide weather & waves' : 'Show weather & waves'}
                >
                    <img 
                        src="/weather-icon.png?v=2" 
                        alt="Weather & Waves" 
                        className="w-7 h-7"
                    />
                </button>
                <button 
                    onClick={() => setShowUserAlarms(!showUserAlarms)} 
                    className={`map-control-button user-alarm-control ${showUserAlarms ? 'active' : ''}`} 
                    aria-label={showUserAlarms ? 'Hide user alerts' : 'Show user alerts'} 
                    title={showUserAlarms ? 'Hide user alerts' : 'Show user alerts'}
                >
                    <img 
                        src="/user-alarms.png" 
                        alt="User Alerts" 
                        className="w-7 h-7"
                    />
                </button>
                {(user || isOnboardingActive) && (
                    <button 
                        onClick={() => {
                            if (!user && isOnboardingActive) {
                                // During onboarding, just highlight - don't open modal
                                return;
                            }
                            setSelectedHuntIdForModal(null); // Clear any preselected hunt - show list view
                            setIsTreasureHuntModalOpen(true);
                        }}
                        className="map-control-button treasure-hunt-control"
                        aria-label="Treasure Hunt"
                        title="Treasure Hunt"
                        style={{ 
                            padding: '0', 
                            width: '72px', 
                            height: '72px', 
                            minWidth: '72px',
                            minHeight: '72px',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: 'none',
                            background: 'transparent',
                            boxShadow: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <img 
                            src="/treasuregif.gif"
                            alt="Treasure Hunt" 
                            style={{ 
                                width: '72px', 
                                height: '72px', 
                                objectFit: 'contain', 
                                display: 'block', 
                                pointerEvents: 'none',
                                userSelect: 'none',
                                WebkitUserSelect: 'none'
                            }}
                        />
                    </button>
                )}
                 {!userLocation && !manualPinLocation && (
                    <button
                        onClick={() => onMapLongPress(mapCenter)}
                        className="map-control-button manual-pin-button"
                        aria-label="Manually set location"
                        title="Manually set location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M13.05 22.35a.75.75 0 01-1.08 0l-6.75-6.75a.75.75 0 011.08-1.08l6.22 6.22 6.22-6.22a.75.75 0 011.08 1.08l-6.75 6.75z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M12.75 2.25a.75.75 0 01.75.75v14.5a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
      )}

      {hoveredPlace && !viewingTrip && previewPosition && !isSidebarOpen && (
        <MapImagePreview place={hoveredPlace} position={previewPosition}/>
      )}
      
      {hoveredTripPlace && viewingTrip && previewPosition && (
        <TripMapPreview place={hoveredTripPlace} position={previewPosition} index={hoveredTripPlaceIndex} />
      )}


      {/* User Alarm Modal */}
      {isUserAlarmModalOpen && userAlarmCoordinates && (
        <UserAlarmModal
          isOpen={isUserAlarmModalOpen}
          onClose={() => {
            console.log('UserAlarmModal closing');
            setIsUserAlarmModalOpen(false);
            setUserAlarmCoordinates(null);
          }}
          coordinates={userAlarmCoordinates}
          onCreateAlarm={handleCreateUserAlarm}
          isAuthenticated={!!user}
          theme={theme}
             userEmail={user?.email}
             username={user?.username}
        />
      )}

      {/* Treasure Hunt Modal */}
      {isTreasureHuntModalOpen && (
        <TreasureHuntModal
          isOpen={isTreasureHuntModalOpen}
          onClose={() => {
            setIsTreasureHuntModalOpen(false);
            setSelectedHuntIdForModal(null);
            // Reload active treasure hunt when modal closes, keeping the currently selected active hunt
            // Use the ref to get the latest value (avoids stale closure issues)
            const currentActiveHuntId = selectedActiveHuntIdRef.current;
            if (currentActiveHuntId) {
              loadActiveTreasureHunt(currentActiveHuntId);
            } else {
              // If no active hunt ID is set, reload to find the first available hunt
              loadActiveTreasureHunt();
            }
          }}
          onHuntStarted={(huntId) => {
            // Set the selected active hunt ID immediately to persist across modal close
            if (huntId !== null && huntId !== undefined) {
              setSelectedActiveHuntId(huntId);
              selectedActiveHuntIdRef.current = huntId;
              // Persist to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('selectedActiveHuntId', huntId.toString());
              }
            } else {
              setSelectedActiveHuntId(null);
              selectedActiveHuntIdRef.current = null;
              // Clear from localStorage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('selectedActiveHuntId');
              }
            }
            // Reload active treasure hunt when hunt is started/resumed
            // If huntId is provided, make that hunt active
            loadActiveTreasureHunt(huntId || null);
          }}
          userLocation={userLocation}
          theme={theme}
          preselectedHuntId={selectedHuntIdForModal}
          activeHuntId={activeTreasureHunt?.id || null}
          showTreasureHuntClues={showTreasureHuntClues}
          onToggleTreasureHuntClues={() => setShowTreasureHuntClues(!showTreasureHuntClues)}
        />
      )}
    </div>
  );
};

export default MapComponent;

