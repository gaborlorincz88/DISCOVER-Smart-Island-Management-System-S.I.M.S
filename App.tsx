import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './styles.css';
import { useTranslation } from 'react-i18next';
import { Coordinates, Place, TripPlan, TravelMode, GroupedBusStop, PlaceCategory } from './types';
import { APP_TITLE, DEFAULT_RADIUS, DEFAULT_INITIAL_COORDS, CATEGORY_INFO } from './constants';
import { watchUserPosition, calculateDistance, geocodeLocation } from './services/locationService';
import { generatePlaceInfo, getChatResponse } from './services/geminiService';
import { aiMemoryService } from './services/aiMemoryService';
import { fetchPlacesFromServer, fetchEventsFromServer, fetchPlaceById } from './services/backendService';
import { fetchRoute } from './services/routingService';
import { useAuth } from './auth/AuthContext';
import { tripsService } from './services/tripsService';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import ImageGalleryModal from './components/ImageGalleryModal';
import LoginPage from './components/LoginPage';
import EmailVerificationPage from './components/EmailVerificationPage';
import ForBusinessesPage from './components/ForBusinessesPage';
import EditPlaceModal from './components/EditPlaceModal';
import TripPlannerPage from './pages/TripPlannerPage';
import CreateTripModal from './modals/CreateTripModal';
import AddToTripModal from './modals/AddToTripModal';
import TripSidebar from './components/TripSidebar';
import NotificationContainer from './components/NotificationContainer';
import EventsPage from './pages/EventsPage';
import ExcursionsPage from './pages/ExcursionsPage';
import SidebarMenu from './components/SidebarMenu';
import BottomSheet from './components/BottomSheet';
import { logAnalyticsEvent, trackTripCreation, trackUserLocation, trackUserJourney, setAuthenticatedUserIdGetter } from './services/analyticsService';
import LocationAnalyticsConsent from './components/LocationAnalyticsConsent';
import { cacheManager } from './services/cacheManager';
import { useIconPreloading } from './hooks/useIconPreloading';
import TourDetailPage from './pages/TourDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import MyTicketsPage from './pages/MyTicketsPage';
import { getApiBaseUrl } from './services/config';
import OfflineDownloadModal from './components/OfflineDownloadModal';
import { isOfflineDataAvailable, getCachedPlacesData } from './services/offlineDataManager';
import OnboardingFlow from './components/OnboardingFlow';
import { MapBounds } from './components/MapComponent';

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const API_BASE = getApiBaseUrl();
  
  // Preload critical icons on app initialization
  useIconPreloading(['/icon-192x192.png', '/icon-512x512.png', '/tours.svg']);
  
  // Preload emoji icons for instant rendering
  useEffect(() => {
    const commonEmojis = Object.values(CATEGORY_INFO).map(cat => cat.icon);
    const uniqueEmojis = [...new Set(commonEmojis)];
    
    // Flag emojis for language selector
    const flagEmojis = ['🇬🇧', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇵🇱', '🇭🇺'];
    
    // Combine all emojis to preload
    const allEmojis = [...uniqueEmojis, ...flagEmojis];
    
    // Create invisible divs to preload emoji fonts
    allEmojis.forEach(emoji => {
      const preloadDiv = document.createElement('div');
      preloadDiv.style.position = 'absolute';
      preloadDiv.style.left = '-9999px';
      preloadDiv.style.fontSize = '24px';
      preloadDiv.style.fontFamily = 'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, Android Emoji, EmojiSymbols, EmojiOne Mozilla, Twemoji Mozilla, Noto Emoji, Noto Color Emoji Compat, Twemoji, EmojiOne, sans-serif';
      preloadDiv.className = 'emoji-flag';
      preloadDiv.textContent = emoji;
      document.body.appendChild(preloadDiv);
      
      // Remove after a short delay
      setTimeout(() => {
        if (preloadDiv.parentNode) {
          preloadDiv.parentNode.removeChild(preloadDiv);
        }
      }, 100);
    });
  }, []);

  
  // Helper function to validate coordinates
  const isValidLatLng = (coords: any): coords is Coordinates => {
    return coords && 
           typeof coords.lat === 'number' && 
           typeof coords.lng === 'number' && 
           !isNaN(coords.lat) && 
           !isNaN(coords.lng) &&
           coords.lat >= -90 && coords.lat <= 90 &&
           coords.lng >= -180 && coords.lng <= 180;
  };
  // Page and Auth State
  const [currentPage, setCurrentPage] = useState<'app' | 'business' | 'trips' | 'events' | 'excursions' | 'tour-detail' | 'checkout' | 'my-tickets'>('app');
  const [previousPageBeforeMapView, setPreviousPageBeforeMapView] = useState<'events' | 'excursions' | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSlowConnectionWarning, setShowSlowConnectionWarning] = useState(false);
  
  // Onboarding state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  // Tour booking state
  const [selectedTourForBooking, setSelectedTourForBooking] = useState<any>(null);
  const [bookingData, setBookingData] = useState<any>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    
    // If opening sidebar, close bottom menu to avoid conflicts
    if (newState) {
      setIsBottomSheetOpen(false);
    }
    
    // If opening sidebar on small screen, ensure controls are not collapsed
    if (newState && isSmallScreen) {
      setIsControlsCollapsed(false);
    }
  };

  // Trip Planner State
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [isCreateTripModalOpen, setIsCreateTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripPlan | null>(null);
  const [isAddToTripModalOpen, setIsAddToTripModalOpen] = useState(false);
  const [placeToAdd, setPlaceToAdd] = useState<Place | null>(null);
  const [viewingTrip, setViewingTrip] = useState<TripPlan | null>(null);
  const [hoveredTripPlaceId, setHoveredTripPlaceId] = useState<string | null>(null);
  const [activeTravelMode, setActiveTravelMode] = useState<TravelMode>('driving-car');
  const [selectedBusRoute, setSelectedBusRoute] = useState<string | null>(null);
  const [selectedBusRouteCoordinates, setSelectedBusRouteCoordinates] = useState<Coordinates[] | null>(null);

  const [tourRoutes, setTourRoutes] = useState<any[]>([]); // State to store fetched tour routes
  
  // Debug effect to track tourRoutes changes (disabled for production)
  // useEffect(() => {
  //   console.log('=== tourRoutes CHANGED ===');
  //   console.log('New tourRoutes length:', tourRoutes.length);
  //   console.log('New tourRoutes:', tourRoutes.map(t => ({ id: t.id, name: t.name })));
  //   console.log('Timestamp:', new Date().toISOString());
  //   console.log('Stack trace:', new Error().stack);
  //   
  //   // Check if tours are being cleared unexpectedly
  //   if (tourRoutes.length === 0) {
  //     console.warn('⚠️ tourRoutes was cleared to empty array!');
  //     console.warn('Stack trace for clearing:', new Error().stack);
  //   }
  // }, [tourRoutes]);

  const [hikingTrails, setHikingTrails] = useState<Place[]>([]); // State to store hiking trails
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Location State
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_INITIAL_COORDS);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [manualPinLocation, setManualPinLocation] = useState<Coordinates | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<Coordinates | null>(null);
  const [flyToFromEventsOrExcursions, setFlyToFromEventsOrExcursions] = useState(false);
  const [isLocationTrackingEnabled, setIsLocationTrackingEnabled] = useState(false); // Start disabled until permission is granted

  // Derived state for the effective search center
  const searchCenter = useMemo(() => manualPinLocation || (isLocationTrackingEnabled ? userLocation : null), [manualPinLocation, isLocationTrackingEnabled, userLocation]);


  // Places State
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allEvents, setAllEvents] = useState<Place[]>([]);
  
  // Frontend cache for full place details (loaded on-demand)
  const placeDetailsCacheRef = useRef<Map<string, Place>>(new Map());
  const eventDetailsCacheRef = useRef<Map<string, Place>>(new Map());
  const justCameFromShowOnMap = useRef(false); // Track if we just came from "Show on Map" to prevent clearing previousPageBeforeMapView
  const previousCurrentPageRef = useRef<string | null>(null); // Track previous currentPage to detect manual navigation
  const [isLoadingPlaces, setIsLoadingPlaces] = useState<boolean>(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingIcons, setIsLoadingIcons] = useState(true);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Progressive loading: Delay ALL non-essential data until map tiles and icons are loaded
  useEffect(() => {
    if (allPlaces && allPlaces.length > 0) {
      console.log('🚀 Initial places loaded, prioritizing map tiles and icons...');
      
      // Detect connection quality
      const connection = navigator.connection;
      const isSlowConnection = connection && 
        (connection.effectiveType === 'slow-2g' || 
         connection.effectiveType === '2g' ||
         connection.effectiveType === '3g');
      
      // Show slow connection warning and auto-hide after 5 seconds (1s longer)
      if (isSlowConnection) {
        setShowSlowConnectionWarning(true);
        setTimeout(() => {
          setShowSlowConnectionWarning(false);
        }, 5000);
      }
      
      // AGGRESSIVE delays - wait for tiles and icons to fully load first
      const backgroundDelay = isSlowConnection ? 15000 : 10000; // 10-15 seconds delay
      
      console.log(`📡 Connection quality: ${connection?.effectiveType || 'unknown'}`);
      console.log(`⏱️ Background loading delayed: ${backgroundDelay}ms to prioritize tiles/icons`);
      
      // Phase 1: Wait for map tiles and icons to load BEFORE loading anything else
      setTimeout(() => {
        console.log('🔄 Now loading tours and additional data in background...');
        // Tours and other heavy data will be loaded here
        setTimeout(() => {
          console.log('✅ Background data loading completed');
        }, 2000);
      }, backgroundDelay);
    }
  }, [allPlaces]);

  // Monitor icon loading completion (fixed to prevent infinite loop)
  useEffect(() => {
    let hasHidden = false;
    
    const checkIconsLoaded = () => {
      if (hasHidden) return; // Already hidden, don't check again
      
      const customIconsLoaded = localStorage.getItem('customIconsLoaded');
      if (customIconsLoaded) {
        console.log('✅ Icons loading complete, hiding loading indicator');
        setIsLoadingIcons(false);
        // Dispatch event to notify HTML loading screen that icons are ready
        window.dispatchEvent(new CustomEvent('icons-loaded'));
        hasHidden = true;
      }
    };

    // Check initially
    checkIconsLoaded();

    // Check periodically (reduce frequency to avoid spam)
    const interval = setInterval(checkIconsLoaded, 2000);

    // Auto-hide after maximum expected time (2 seconds - show content ASAP!)
    const timeout = setTimeout(() => {
      if (!hasHidden) {
        console.log('⏱️ Max icon loading time reached, hiding indicator');
        setIsLoadingIcons(false);
        // Dispatch event to notify HTML loading screen that icons are ready
        window.dispatchEvent(new CustomEvent('icons-loaded'));
        hasHidden = true;
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
  
  // Auth State
  const { user } = useAuth();
  
  // Set authenticated user ID getter for analytics
  useEffect(() => {
    setAuthenticatedUserIdGetter(() => user?.id || null);
  }, [user]);

  // Check for first visit and trigger onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed') === 'true';
    const shouldShowOnboarding = !hasCompletedOnboarding && currentPage === 'app';
    
    // Wait for app to be fully loaded before showing onboarding
    if (shouldShowOnboarding) {
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1500); // Small delay to ensure UI is ready
      
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // Expose function to restart onboarding (for manual trigger)
  useEffect(() => {
    (window as any).startOnboarding = () => {
      // Close sidebar if open
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        // Wait for sidebar to close before starting onboarding
        setTimeout(() => {
          setIsOnboardingOpen(true);
        }, 300);
      } else {
        setIsOnboardingOpen(true);
      }
    };
    return () => {
      delete (window as any).startOnboarding;
    };
  }, [isSidebarOpen]);

  const handleOnboardingComplete = () => {
    setIsOnboardingOpen(false);
    localStorage.setItem('onboarding_completed', 'true');
  };

  const handleOnboardingSkip = () => {
    setIsOnboardingOpen(false);
    localStorage.setItem('onboarding_completed', 'true');
  };
  
  // Debug: Log user authentication state (disabled for production)
  // useEffect(() => {
  //   console.log('=== USER AUTH STATE ===');
  //   console.log('User object:', user);
  //   console.log('User ID:', user?.id);
  //   console.log('User email:', user?.email);
  //   console.log('User role:', user?.role);
  //   console.log('Timestamp:', new Date().toISOString());
  // }, [user]);
  
  // UI Interaction State
  // selectedCategories can include both PlaceCategory enum values and custom category name strings
  const [selectedCategories, setSelectedCategories] = useState<Array<PlaceCategory | string>>([]);
  const originalCategoriesRef = useRef<PlaceCategory[]>([]);
  
  // Debug effect to track selectedCategories changes (disabled for production)
  // useEffect(() => {
  //   console.log('=== selectedCategories CHANGED ===');
  //   console.log('New selectedCategories:', selectedCategories);
  //   console.log('Timestamp:', new Date().toISOString());
  //   console.log('Stack trace:', new Error().stack);
  //   
  //   // Check if Tours category is being cleared unexpectedly
  //   if (selectedCategories.length === 0) {
  //     console.warn('⚠️ selectedCategories was cleared to empty array!');
  //     console.warn('Stack trace for clearing:', new Error().stack);
  //   }
  // }, [selectedCategories]);
  
  const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_RADIUS);
  const [isGoModeActive, setIsGoModeActive] = useState<boolean>(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // When GO mode is activated, limit range to 500m max
  useEffect(() => {
    if (isGoModeActive && searchRadius > 0.5) {
      setSearchRadius(0.5); // Set to 500m
    }
  }, [isGoModeActive]);
  
  // Debug effect to track selectedPlace changes (disabled for production)
  // useEffect(() => {
  //   console.log('=== selectedPlace CHANGED ===');
  //   console.log('New selectedPlace:', selectedPlace);
  //   console.log('Previous selectedPlace:', selectedPlace);
  //   console.log('Timestamp:', new Date().toISOString());
  //   if (selectedPlace === null) {
  //     console.log('⚠️ selectedPlace was cleared to null!');
  //     console.log('Stack trace for clearing:', new Error().stack);
  //   }
  // }, [selectedPlace]);
  
  // Create a wrapper for setSelectedPlace to track who's calling it
  const setSelectedPlaceWithDebug = useCallback((newValue: Place | null) => {
    if (newValue === null && selectedPlace !== null) {
      console.log('🚨 setSelectedPlace called with null!');
      console.log('Previous value:', selectedPlace);
      console.log('Stack trace:', new Error().stack);
    }
    setSelectedPlace(newValue);
  }, [selectedPlace]);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isPlacesListCollapsed, setIsPlacesListCollapsed] = useState(false);
  const [activeSidebarDropdown, setActiveSidebarDropdown] = useState<'searchFilter' | 'nearbyPlaces' | null>('searchFilter');
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [selectedClusterStops, setSelectedClusterStops] = useState<Place[] | GroupedBusStop[]>([]);
  const [busStopToRouteMap, setBusStopToRouteMap] = useState<Map<string, string>>(new Map());
  const [selectedGroupedBusStop, setSelectedGroupedBusStop] = useState<GroupedBusStop | null>(null);
  const [showWaves, setShowWaves] = useState(false);
  // Note: selectedHikingTrail state removed - hiking trails now use selectedTour state for consistency
  const [selectedTour, setSelectedTour] = useState<Place | null>(null);
  
  // Debug effect to track selectedTour changes
  useEffect(() => {
    console.log('=== selectedTour CHANGED ===');
    console.log('New selectedTour:', selectedTour);
    console.log('Previous selectedTour:', selectedTour);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Stack trace:', new Error().stack);
  }, [selectedTour]);

  // AI & Media Loading State
  const [isLoadingAiDescription, setIsLoadingAiDescription] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768); // Initial check for small screen
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [suppressNextDetailOpen, setSuppressNextDetailOpen] = useState(false);
  
  // Debug effect to track bottom sheet state changes
  useEffect(() => {
    console.log('=== BOTTOM SHEET STATE CHANGED ===');
    console.log('isBottomSheetOpen:', isBottomSheetOpen);
    console.log('isSmallScreen:', isSmallScreen);
    console.log('selectedTour:', selectedTour);
    console.log('selectedPlace:', selectedPlace);
    console.log('Timestamp:', new Date().toISOString());
  }, [isBottomSheetOpen, isSmallScreen, selectedTour, selectedPlace]);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (searchQuery) {
      logAnalyticsEvent('search_query', { query: searchQuery });
      trackUserJourney('search', { query: searchQuery });
    }
  }, [searchQuery]);

  // Effect to load user trips from backend
  useEffect(() => {
    const loadUserTrips = async () => {
      console.log('=== LOADING USER TRIPS ===');
      console.log('User ID:', user?.id);
      console.log('User object:', user);
      console.log('Timestamp:', new Date().toISOString());
      
      if (user?.id) {
        try {
          console.log('Calling tripsService.getUserTrips with user ID:', user.id);
          const trips = await tripsService.getUserTrips(user.id);
          console.log('Trips loaded from backend:', trips);
          console.log('Setting tripPlans state to:', trips);
          setTripPlans(trips);
        } catch (error) {
          console.error('Error loading user trips:', error);
          // Don't show error notification for trips loading failure
        }
      } else {
        console.log('No user ID, clearing trips');
        // Clear trips when user logs out
        setTripPlans([]);
      }
    };

    console.log('=== TRIPS LOADING EFFECT TRIGGERED ===');
    console.log('User state when effect runs:', user);
    loadUserTrips();
  }, [user?.id]);

  // Debug: Log whenever user state changes
  useEffect(() => {
    console.log('=== USER STATE CHANGED ===');
    console.log('New user state:', user);
    console.log('User ID:', user?.id);
    console.log('Timestamp:', new Date().toISOString());
  }, [user]);

  // --- Notification Handler ---
  const addNotification = useCallback((message: string, type: NotificationMessage['type'] = 'success') => {
    const newNotification = { id: Date.now() + Math.random(), message, type };
    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const handleClusterClick = (stops: any[]) => {
    setSelectedClusterStops(stops);
    // Only open sidebar on large screens
    if (!isSmallScreen) {
      console.log('Cluster click: Opening sidebar on large screen');
      setIsSidebarOpen(true);
    } else {
      console.log('Cluster click: Opening BottomSheet on small screen');
      setIsBottomSheetOpen(true);
    }
  };

  // Effect to load bus route data and create a mapping of stop IDs to route IDs
  useEffect(() => {
    const loadBusRouteData = async () => {
      // Re-calculate combinedItems here to ensure it's up-to-date within this effect
      const currentCombinedItems = [...allPlaces, ...allEvents.map(event => {
        // Handle image_urls - can be array, JSON string, or single path string
        let imageUrls: string[] = [];
        if (event.image_urls) {
          if (Array.isArray(event.image_urls)) {
            // Already an array
            imageUrls = event.image_urls;
          } else if (typeof event.image_urls === 'string') {
            // Try to parse as JSON, fallback to single item array
            try {
              const parsed = JSON.parse(event.image_urls);
              imageUrls = Array.isArray(parsed) ? parsed : [event.image_urls];
            } catch {
              // If parsing fails, treat as single path string
              imageUrls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
            }
          }
        }
        
        return {
            ...event,
            id: event.id?.toString().startsWith('event-') ? event.id : `event-${event.id}`, // Ensure unique ID
            category: PlaceCategory.EVENT,
            shortDescription: event.description || event.shortDescription || '',
            coordinates: { 
              lat: event.latitude || event.coordinates?.lat || 0, 
              lng: event.longitude || event.coordinates?.lng || 0 
            },
            image_urls: imageUrls,
            galleryImages: imageUrls.map((url: string) => {
              // Handle both absolute URLs and relative paths
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
              }
              return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
            }),
            imageUrl: imageUrls.length > 0 ? (imageUrls[0].startsWith('http://') || imageUrls[0].startsWith('https://') 
              ? imageUrls[0] 
              : `${API_BASE}${imageUrls[0].startsWith('/') ? imageUrls[0] : `/${imageUrls[0]}`}`) : undefined
        };
      })];

      // Only proceed if combinedItems has been populated
      if (currentCombinedItems.length === 0) return;

      try {
        const apiBaseA = API_BASE;
        const response = await fetch(`${apiBaseA}/api/bus-routes`);
        if (!response.ok) {
          throw new Error('Failed to fetch bus routes');
        }
        const routeList = await response.json();
        const newMap = new Map<string, string>();

        // Create a temporary map for quick lookup of all bus stop Places by coordinates
        const allBusStopPlaces = new Map<string, Place>();
        currentCombinedItems.forEach(p => {
          if ((p.category === PlaceCategory.BUS_STOP || p.category === PlaceCategory.BUS_TERMINUS) && p.coordinates) {
            allBusStopPlaces.set(`${p.coordinates.lat},${p.coordinates.lng}`, p);
          }
        });

        for (const routeMeta of routeList) {
          const apiBaseB = API_BASE;
          const routeDataResponse = await fetch(`${apiBaseB}/api/bus-routes/${routeMeta.id}`);
          if (routeDataResponse.ok) {
            const routeData = await routeDataResponse.json();
            if (routeData && Array.isArray(routeData.points)) {
              routeData.points.forEach((point: any) => {
                if (point.type === 'stop' && point.lat && point.lng) {
                  const key = `${point.lat},${point.lng}`;
                  const matchingPlace = allBusStopPlaces.get(key);
                  if (matchingPlace) {
                    newMap.set(matchingPlace.id, routeMeta.id);
                  }
                }
              });
            }
          }
        }
        setBusStopToRouteMap(newMap);
      } catch (error) {
        console.error('Error loading bus route data:', error);
        addNotification('Failed to load bus route data.', 'error');
      }
    };
    loadBusRouteData();
  }, [addNotification, allPlaces, allEvents]);

  // Effect to clear tour routes on mount and when selectedTourCategory changes
  useEffect(() => {
    let isMounted = true;
    let hasFetched = false; // Prevent multiple fetches
    
    // Load all tours on mount instead of waiting for category selection
    const fetchAllTourRoutes = async () => {
      if (hasFetched || !isMounted) return; // Prevent multiple fetches
      hasFetched = true;
      
      try {
        // Load tours from each category
        const categories = ['sightseeing', 'jeep-tour', 'quad-tour', 'boat-tour', 'custom'];
        let allTours: Place[] = [];
        
        for (const category of categories) {
          if (!isMounted) break; // Stop if component unmounted
          
          try {
            const apiBase = API_BASE;
            const url = `${apiBase}/api/tours/${category}`;
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              
              // Convert tour routes to Place objects that the MapComponent can display
              const tourPlaces = data.map((tour: any) => {
                console.log('Processing tour data:', tour);
                console.log('tour.mainImage:', tour.mainImage);
                console.log('tour.mainImage type:', typeof tour.mainImage);
                
                const place = {
                  id: tour.id,
                  name: tour.name,
                  shortDescription: tour.description,
                  description: tour.description,
                  category: PlaceCategory.TOURS,
                  coordinates: tour.coordinates && tour.coordinates.length > 0 ? { lat: tour.coordinates[0][0], lng: tour.coordinates[0][1] } : { lat: 36.046, lng: 14.26 },
                  routeCoordinates: tour.coordinates ? tour.coordinates.map((coord: [number, number]) => ({ lat: coord[0], lng: coord[1] })) : [],
                  icon: tour.icon ? (tour.icon.startsWith('/uploads/') ? `${API_BASE}${tour.icon}` : tour.icon) : '/tours.svg',
                  iconSize: tour.iconSize || 32,
                  polylineColor: tour.polylineColor || '#8A2BE2',
                  mainImage: tour.mainImage ? (tour.mainImage.startsWith('/uploads/') ? `${API_BASE}${tour.mainImage}` : tour.mainImage) : '',
                  points: tour.points || [],
                  type: 'tour'
                };
                console.log('Created place object:', place);
                console.log('place.mainImage:', place.mainImage);
                return place;
              });
              
              allTours = [...allTours, ...tourPlaces];
            }
          } catch (error) {
            // Error loading tours
          }
        }
        
        if (isMounted) {
          console.log('Setting tour routes with', allTours.length, 'tours');
          setTourRoutes(allTours);
        }
      } catch (error) {
        console.error('Error fetching all tour routes:', error);
        if (isMounted) {
          addNotification('Failed to load tour routes.', 'error');
          setTourRoutes([]);
        }
      }
    };
    
    // Delay tour loading to prioritize map tiles and icons
    setTimeout(() => {
      console.log('🔄 Now loading tours (delayed to prioritize tiles/icons)...');
    fetchAllTourRoutes();
    }, 10000); // Wait 10 seconds for tiles and icons to load first
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount



  // Cleanup effect to clear tour routes when component unmounts
  useEffect(() => {
    return () => {
      setTourRoutes([]);
    };
  }, []);







  

  // --- Auth Handlers (Mock) ---
  const handleLogin = (user: User) => {
    // This function is now handled by AuthProvider
    // We keep it for backward compatibility but it's not used
  };
  const handleLogout = () => {
    // This function is now handled by AuthProvider
    // We keep it for backward compatibility but it's not used
  };

  const handleSavePlace = useCallback((updatedPlace: Place) => {
    console.log('=== handleSavePlace called ===');
    console.log('Updated place:', updatedPlace);
    console.log('Current selectedPlace before update:', selectedPlace);
    
    // Ensure icon URL is absolute if it's an uploaded image
    const processedPlace = { ...updatedPlace };
    if (processedPlace.icon && processedPlace.icon.startsWith('/uploads/')) {
      processedPlace.icon = `${API_BASE}${processedPlace.icon}`;
    }

    // Update the master list of all places
    setAllPlaces(prev => prev.map(p => p.id === processedPlace.id ? { ...p, ...processedPlace } : p));
    
    // If the updated place is the one currently selected, update its state
    if (selectedPlace?.id === processedPlace.id) {
      const newSelectedPlace = { ...selectedPlace, ...processedPlace };
      console.log('Updating selectedPlace to:', newSelectedPlace);
      setSelectedPlaceWithDebug(newSelectedPlace);
    } else {
      console.log('Not updating selectedPlace - IDs don\'t match or no place selected');
      
      // If no place is selected but this place has AI content, select it
      if (!selectedPlace && (processedPlace.aiGeneratedDescription || processedPlace.chatHistory)) {
        console.log('No place selected but place has AI content, selecting it');
        setSelectedPlaceWithDebug(processedPlace);
      }
    }

    // Also ensure the place is updated if it exists in any trip plan
    setTripPlans(prevPlans => prevPlans.map(plan => ({
        ...plan,
        places: plan.places.map(p => p.id === processedPlace.id ? { ...p, ...processedPlace } : p)
    })));
    
    console.log('handleSavePlace completed');
  }, []);

  // Check GPS permission status
  const checkLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      return false;
    }
    
    // Check if permission API is available
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state === 'granted';
      } catch (e) {
        console.log('Permission API not fully supported, will try geolocation directly');
      }
    }
    
    // Fallback: try to get position (will prompt if needed)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 100 }
      );
    });
  }, []);

  // Request GPS permission
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      addNotification('Geolocation is not supported by your browser.', 'error');
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          console.log('✅ GPS permission granted');
          setIsLocationTrackingEnabled(true);
          resolve(true);
        },
        (error) => {
          console.log('❌ GPS permission denied:', error);
          setIsLocationTrackingEnabled(false);
          if (error.code === 1) {
            addNotification('Location permission denied. You can enable it in your browser settings.', 'info');
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [addNotification]);

  // Check permission status on mount and update icon state
  useEffect(() => {
    checkLocationPermission().then((hasPermission: boolean) => {
      setIsLocationTrackingEnabled(hasPermission);
    });
  }, [checkLocationPermission]);

  // --- Location Effects ---
  useEffect(() => {
    let watchId: number | null = null;
    
    const handleSuccess = (position: GeolocationPosition) => {
      const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      // This ONLY updates the blue dot's position. It does NOT move the map view.
      setUserLocation(newLocation);
      // Track user location for analytics
      if (newLocation) {
        trackUserLocation(newLocation.lat, newLocation.lng);
      }
    };
    
    const handleError = (error: any) => {
      console.error("Geolocation error:", error);
      // Update state based on error
      if (error && typeof error.code === 'number') {
        if (error.code === 1) {
          // Permission denied - turn off tracking
          setIsLocationTrackingEnabled(false);
        }
      }
      
      // Only show notification if tracking was enabled (user expects it)
      if (isLocationTrackingEnabled) {
      let message = "Could not get your location. You can still search or select a country to explore.";
      if (error && typeof error.code === 'number') {
        switch (error.code) {
          case 1: message = "Location permission denied. Explore freely or enable it in your browser settings."; break;
          case 2: message = "Your location is unavailable. No problem, the world is your oyster!"; break;
          case 3: message = "GPS request timed out. You can still explore the map manually."; break;
        }
      }
      addNotification(message, 'info');
      }
    };

    if (isLocationTrackingEnabled) {
      setManualPinLocation(null); // Clear pin when GPS is turned on
      watchId = watchUserPosition(handleSuccess, handleError);
    } else {
      setUserLocation(null);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    }

    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [isLocationTrackingEnabled, addNotification]);
  
  const toggleLocationTracking = useCallback(async () => {
    if (!isLocationTrackingEnabled) {
      // If turning on, request permission first
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        // Permission denied, keep it off
        return;
      }
    } else {
      // Turning off
      setIsLocationTrackingEnabled(false);
    }
  }, [isLocationTrackingEnabled, requestLocationPermission]);
  
  const toggleWaves = () => setShowWaves(prev => !prev);

  // --- Data Fetching & Map Interaction Handlers ---
  const handleMapMove = useCallback((center: Coordinates) => {
      setMapCenter(center);
      // If a grouped bus stop is selected, deselect it when the map moves
      setSelectedGroupedBusStop(null);
  }, []);

  // Debounced handler for map bounds changes (for bus stop viewport filtering)
  const boundsChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleMapBoundsChange = useCallback((bounds: MapBounds | null) => {
    // Debounce bounds updates to avoid excessive re-renders
    if (boundsChangeTimeoutRef.current) {
      clearTimeout(boundsChangeTimeoutRef.current);
    }
    boundsChangeTimeoutRef.current = setTimeout(() => {
      setMapBounds(bounds);
    }, 150); // 150ms debounce
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoadingPlaces(true);
    setPlacesError(null);
    try {
      // Check if we're offline and have cached data
      const isOffline = !navigator.onLine;
      const hasCachedData = await isOfflineDataAvailable();
      
      if (isOffline && hasCachedData) {
        console.log('📴 Offline mode: Using cached data');
        // Use cached places data
        const cachedPlaces = await getCachedPlacesData();
        if (cachedPlaces && cachedPlaces.length > 0) {
          const mappedPlaces = cachedPlaces.map(place => ({
            ...place,
            shortDescription: place.description || place.shortDescription || ''
          }));
          setAllPlaces(mappedPlaces);
          setAllEvents([]); // Events might not be cached, that's okay
          setIsLoadingPlaces(false);
          return; // Exit early, don't try to fetch from server
        }
      }
      
      // Online or no cached data - fetch from server
      const apiBaseC = API_BASE;
      const [serverPlaces, serverEvents, busRouteListResponse, hikingTrailsResponse] = await Promise.all([
        fetchPlacesFromServer().catch(() => []), // Don't fail completely if one request fails
        fetchEventsFromServer().catch(() => []),
        fetch(`${apiBaseC}/api/bus-routes`).catch(() => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
        fetch(`${apiBaseC}/api/hiking-trails`).catch(() => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
      ]);

      const mappedPlaces = serverPlaces.map(place => ({
        ...place,
        shortDescription: place.description || place.shortDescription || ''
      }));

      let allBusStops: Place[] = [];
      const newBusStopToRouteMap = new Map<string, string>();

      if (busRouteListResponse.ok) {
        const routeList = await busRouteListResponse.json();
        for (const routeMeta of routeList) {
          const apiBaseD = API_BASE;
          const routeDataResponse = await fetch(`${apiBaseD}/api/bus-routes/${routeMeta.id}`);
          if (routeDataResponse.ok) {
            const routeData = await routeDataResponse.json();
            if (routeData && Array.isArray(routeData.points)) {
              routeData.points.forEach((point: any) => {
                if (point.type === 'stop' && point.lat && point.lng) {
                  const stopId = `bus-stop-${routeMeta.id}-${point.id || `${point.lat}-${point.lng}`}`;
                  if (!allBusStops.some(s => s.id === stopId)) { // Prevent duplicates
                    allBusStops.push({
                      id: stopId,
                      name: point.name || 'Bus Stop',
                      coordinates: { lat: point.lat, lng: point.lng },
                      category: PlaceCategory.BUS_STOP,
                      shortDescription: point.description || '',
                      icon: '🚌',
                      routeId: routeMeta.id, // Add routeId for easy lookup
                      mainImage: routeData.mainImage || '',
                      imageUrl: routeData.mainImage || ''
                    });
                  }
                  newBusStopToRouteMap.set(stopId, routeMeta.id);
                }
              });
              
              // Create bus route place for display on map
              const busRoutePlace: Place = {
                id: `bus-route-${routeMeta.id}`,
                name: routeMeta.name,
                category: PlaceCategory.BUS_ROUTE,
                coordinates: { lat: routeData.points[0]?.lat || 36.046, lng: routeData.points[0]?.lng || 14.26 },
                shortDescription: `Bus route ${routeMeta.name}`,
                routeCoordinates: routeData.points.map((p: any) => ({ lat: p.lat, lng: p.lng })),
                icon: '🚌',
                iconSize: 32,
                type: 'bus-route',
                routeId: routeMeta.id,
                mainImage: routeData.mainImage || '',
                imageUrl: routeData.mainImage || ''
              };
              allBusStops.push(busRoutePlace);
            }
          } else {
            console.warn(`Failed to fetch details for route ${routeMeta.id}`);
          }
        }
      }
      setBusStopToRouteMap(newBusStopToRouteMap);

      let hikingTrails: Place[] = [];
      if (hikingTrailsResponse.ok) {
        const hikingTrailsData = await hikingTrailsResponse.json();
        
        hikingTrails = hikingTrailsData.map((trail: any) => {
          // Convert hiking trail coordinates to the same format as tours
          const routeCoordinates = trail.coordinates ? trail.coordinates.map((coord: [number, number]) => ({ 
            lat: coord[0], 
            lng: coord[1] 
          })) : [];
          
          const processedTrail = {
            id: trail.name.replace(/\s+/g, '-').toLowerCase(),
            name: trail.name,
            category: PlaceCategory.HIKING_TRAIL,
            coordinates: trail.coordinates && trail.coordinates.length > 0 ? { lat: trail.coordinates[0][0], lng: trail.coordinates[0][1] } : { lat: 36.046, lng: 14.26 },
            shortDescription: trail.description || '',
            description: trail.description || '',
            routeCoordinates: routeCoordinates, // Use the converted format
            points: trail.pointsOfInterest ? trail.pointsOfInterest.map((point: any, index: number) => ({
              placeId: point.placeId || `hiking-stop-${trail.name}-${point.name}`.replace(/[^a-zA-Z0-9-]/g, ''),
              order: index + 1,
              name: point.name,
              coordinates: point.coordinates || [point.lat || 0, point.lng || 0],
              type: 'stop',
              lat: point.lat || point.coordinates?.[0] || 0,
              lng: point.lng || point.coordinates?.[1] || 0,
              description: point.description || '',
              images: point.images || []
            })) : [],
            pointsOfInterest: trail.pointsOfInterest,
            icon: trail.icon || '🥾',
            iconSize: trail.iconSize || 32,
            polylineColor: trail.polylineColor || '#8A2BE2', // Use tour's default color
            mainImage: trail.mainImage || '',
            type: 'hiking-trail'
          };
          
          return processedTrail;
        });
      }

              setAllPlaces([...mappedPlaces, ...allBusStops, ...hikingTrails]);

        setHikingTrails(hikingTrails); // Store hiking trails separately for MapComponent
      setAllEvents(serverEvents);

      // Notifications removed - using loading indicator instead
    } catch (error: any) {
      setPlacesError(error.message);
      addNotification(error.message, 'error');
    } finally {
      setIsLoadingPlaces(false);
      setHasSearched(true);
    }
  }, []); // Empty dependency array - only run once on mount

  // Fetch all data from the server when the component mounts
  useEffect(() => {
    fetchAllData();
  }, []); // Empty dependency array - only run once on mount

  // Initialize service worker and caching
  useEffect(() => {
    const initializeCaching = async () => {
      try {
        // Register service worker
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration);
          
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready;
          
          // Send message to service worker to cache URLs
          if (registration.active) {
            registration.active.postMessage({
              type: 'CACHE_URLS',
              urls: ['/tours.svg', '/locales/en/translation.json']
            });
          }
        }
        
        // Initialize cache manager
        await cacheManager.initialize();
        
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    };

    initializeCaching();
  }, []);

  // Check if offline data should be shown on first launch
  // DISABLED: Download modal deactivated per user request
  // useEffect(() => {
  //   const checkOfflineData = async () => {
  //     // Wait a bit for the app to load
  //     await new Promise(resolve => setTimeout(resolve, 2000));
  //     
  //     // Check if user has already downloaded or skipped
  //     const downloaded = localStorage.getItem('offlineDataDownloaded');
  //     const skipped = localStorage.getItem('offlineDownloadSkipped');
  //     
  //     if (!downloaded && !skipped) {
  //       // Check if offline data is available
  //       const hasOfflineData = await isOfflineDataAvailable();
  //       if (!hasOfflineData) {
  //         // Show modal after places are loaded
  //         if (allPlaces.length > 0) {
  //           setShowOfflineModal(true);
  //         }
  //       }
  //     }
  //   };
  //   
  //   checkOfflineData();
  // }, [allPlaces.length]);



  const handleManualLocationSelect = (coordinates: Coordinates) => {
    setFlyToLocation(coordinates);
    setManualPinLocation(null);
    
    // Find the nearest place to the searched coordinates and select it using existing logic
    if (combinedItems.length > 0) {
      const nearestPlace = combinedItems.reduce((nearest, place) => {
        if (!place.coordinates) return nearest;
        
        const distance = calculateDistance(coordinates, place.coordinates);
        if (!nearest || distance < nearest.distance) {
          return { place, distance };
        }
        return nearest;
      }, null as { place: Place; distance: number } | null);
      
      if (nearestPlace && nearestPlace.distance <= 2) { // Only select if within 2km
        console.log(`Auto-selecting nearest place: ${nearestPlace.place.name} (${nearestPlace.distance.toFixed(2)}km away)`);
        // Use the existing place selection logic which properly handles UI state
        handlePlaceSelect(nearestPlace.place);
      } else {
        // Clear selected place if no nearby place found
        setSelectedPlace(null);
      }
    }
  };
  
  const handleManualPinDrop = useCallback((coords: Coordinates) => {
      setIsLocationTrackingEnabled(false); // Dropping a pin disables GPS tracking mode.
      setManualPinLocation(coords);
      addNotification('Pin dropped! GPS tracking is now off.', 'info');
  }, [addNotification]);

  const handleRemovePin = useCallback(() => {
      setManualPinLocation(null);
      setSelectedPlace(null);
      addNotification('Pin removed.', 'info');
  }, [addNotification]);

  const combinedItems = useMemo(() => {
    const eventsAsPlaces: Place[] = allEvents.map(event => {
        // Handle image_urls - can be array, JSON string, or single path string
        let imageUrls: string[] = [];
        if (event.image_urls) {
          if (Array.isArray(event.image_urls)) {
            // Already an array
            imageUrls = event.image_urls;
          } else if (typeof event.image_urls === 'string') {
            // Try to parse as JSON, fallback to single item array
            try {
              const parsed = JSON.parse(event.image_urls);
              imageUrls = Array.isArray(parsed) ? parsed : [event.image_urls];
            } catch {
              // If parsing fails, treat as single path string
              imageUrls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
            }
          }
        }
        
        return {
            ...event,
            id: event.id?.toString().startsWith('event-') ? event.id : `event-${event.id}`, // Ensure unique ID
            category: PlaceCategory.EVENT,
            shortDescription: event.description || event.shortDescription || '',
            coordinates: { 
              lat: event.latitude || event.coordinates?.lat || 0, 
              lng: event.longitude || event.coordinates?.lng || 0 
            },
            image_urls: imageUrls,
            galleryImages: imageUrls.map((url: string) => {
              // Handle both absolute URLs and relative paths
              if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
              }
              return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
            }),
            imageUrl: imageUrls.length > 0 ? (imageUrls[0].startsWith('http://') || imageUrls[0].startsWith('https://') 
              ? imageUrls[0] 
              : `${API_BASE}${imageUrls[0].startsWith('/') ? imageUrls[0] : `/${imageUrls[0]}`}`) : undefined
        };
      });
    return [...allPlaces, ...eventsAsPlaces];
  }, [allPlaces, allEvents, API_BASE]);
  
  
  
  // Helper function to check if coordinates are within viewport bounds
  const isWithinBounds = useCallback((coords: Coordinates, bounds: MapBounds | null): boolean => {
    if (!bounds) return true; // If no bounds, show all (fallback)
    return coords.lat >= bounds.south && 
           coords.lat <= bounds.north && 
           coords.lng >= bounds.west && 
           coords.lng <= bounds.east;
  }, []);

  const filteredPlaces = useMemo(() => {
    // Only include hiking trails when Tours category is selected
    let allItems = combinedItems;
    
    // Always include tour routes - they're now loaded by default
    allItems = [...combinedItems, ...tourRoutes];
    
    
    // Filter out hiking trails unless Tours category is selected
    if (!selectedCategories.includes(PlaceCategory.TOURS)) {
      allItems = allItems.filter(place => place.category !== PlaceCategory.HIKING_TRAIL);
    }
    
    const placesToFilter = allItems.filter(place => place.coordinates);
    


    // If a bus route is selected, show ONLY the stops on that route.
    if (selectedBusRoute) {
      return placesToFilter.filter(p => 
        (p.category === PlaceCategory.BUS_STOP || p.category === PlaceCategory.BUS_TERMINUS) && 
        busStopToRouteMap.get(p.id) === selectedBusRoute
      );
    }

    // Tour routes are now always included, no need for category-specific filtering

    // Tours are now always included, so this logic is simplified

    // If we are focused on a specific place, only show that place.
    if (isFocusModeActive && selectedPlace) {
        return [selectedPlace];
    }
    
    // If a specific tour is selected, show only that tour and its points
    if (selectedTour) {
        const tourWithPoints = [selectedTour];
        
        // Add tour points if they exist
        if (selectedTour.points && selectedTour.points.length > 0) {
            const tourPoints = selectedTour.points.map((point: any, index: number) => ({
                id: `tour-point-${selectedTour.id}-${index}`,
                name: point.name || `Point ${index + 1}`,
                category: PlaceCategory.TOURS,
                coordinates: { lat: point.lat || point.coordinates[0], lng: point.lng || point.coordinates[1] },
                shortDescription: point.description || '',
                icon: '📍',
                iconSize: 24,
                type: 'tour-point'
            }));
            tourWithPoints.push(...tourPoints);
        }
        
        return tourWithPoints;
    }

    // --- Normal Filtering Logic (when no bus route is selected) ---

    // If no categories are selected, show only places with a custom icon (featured places).
    // Exclude Cities/Towns category as it should only show when explicitly selected.
    if (selectedCategories.length === 0) {
        const featuredPlaces = placesToFilter.filter(p => 
            p.icon && p.icon.startsWith('/uploads/') && p.category !== PlaceCategory.CITIES_TOWNS
        );
        
        // Apply radius filtering even when no categories are selected
        const locationForRadius = searchCenter || userLocation || mapCenter;
        // Debug logging (disabled for production)
        // console.log('=== NO CATEGORIES SELECTED - RADIUS FILTERING ===');
        // console.log('featuredPlaces.length:', featuredPlaces.length);
        // console.log('locationForRadius:', locationForRadius);
        // console.log('searchRadius:', searchRadius);
        
        if (locationForRadius) {
            const placesWithDistance = featuredPlaces
                .map(place => ({ ...place, distance: calculateDistance(locationForRadius, place.coordinates) }));
            
            // Debug logging (disabled for production)
            // console.log('Places with distances (first 5):', placesWithDistance.slice(0, 5).map(p => ({ 
            //     name: p.name, 
            //     distance: p.distance?.toFixed(3) + 'km',
            //     coords: p.coordinates 
            // })));
            
            const filteredByRadius = placesWithDistance
                .filter(place => place.distance <= searchRadius)
                .sort((a, b) => a.distance! - b.distance!);
            
            // Debug logging (disabled for production)
            // console.log('Filtered by radius:', filteredByRadius.length);
            // console.log('Places within radius:', filteredByRadius.map(p => ({ 
            //     name: p.name, 
            //     distance: p.distance?.toFixed(3) + 'km' 
            // })));
            
            // Return only places within radius, no fallback
            return filteredByRadius;
        }
        
        return featuredPlaces;
    }

    // If categories ARE selected, filter by category.
    // Handle both PlaceCategory enum values and custom category name strings
    let categoryFilteredPlaces = placesToFilter.filter(place => 
        place.category && selectedCategories.some(selected => 
          String(selected) === String(place.category)
        )
    );
    
    // Note: Viewport filtering removed - using radius-based filtering instead for better UX
    // Bus stops are now filtered by 1km radius when BUS_STOP category is selected
    
    // Special handling for Tours category - include all tour routes AND hiking trails
    if (selectedCategories.includes(PlaceCategory.TOURS)) {
      // Get all tour places that have coordinates
      const tourPlaces = tourRoutes.filter(place => place.coordinates);
      
      // Also include any places from allItems that are tours (regardless of their category value)
      const allTourPlaces = allItems.filter(place => 
        place.type === 'tour' || place.category === PlaceCategory.TOURS
      );
      
      // Combine all tour-related places
      const allTours = [...new Set([...tourPlaces, ...allTourPlaces])];
      
      // IMPORTANT: Also include hiking trails when Tours category is selected
      const hikingTrailPlaces = hikingTrails.filter(place => place.coordinates);
      
      // Add tours AND hiking trails to the filtered places
      categoryFilteredPlaces = [...categoryFilteredPlaces, ...allTours, ...hikingTrailPlaces];
      
      // Remove duplicates based on ID
      const uniquePlaces = new Map();
      categoryFilteredPlaces.forEach(place => {
        uniquePlaces.set(place.id, place);
      });
      categoryFilteredPlaces = Array.from(uniquePlaces.values());
      

    }

    // If a search center or user location is available, filter by radius and sort by distance.
    // If filtering yields no results, fall back to unfiltered to avoid empty UI.
    const locationForRadius = searchCenter || userLocation || mapCenter;
    console.log('=== RADIUS FILTERING DEBUG ===');
    console.log('searchCenter:', searchCenter);
    console.log('userLocation:', userLocation);
    console.log('mapCenter:', mapCenter);
    console.log('locationForRadius:', locationForRadius);
    console.log('searchRadius:', searchRadius);
    console.log('categoryFilteredPlaces.length:', categoryFilteredPlaces.length);
    
    if (locationForRadius) {
        console.log('🔍 Starting radius filtering...');
        console.log('Location for radius:', locationForRadius);
        console.log('Search radius:', searchRadius, 'km');
        console.log('Category filtered places count:', categoryFilteredPlaces.length);
        
        const placesWithDistance = categoryFilteredPlaces
            .map(place => ({ ...place, distance: calculateDistance(locationForRadius, place.coordinates) }));
        
        console.log('Places with distances (first 5):', placesWithDistance.slice(0, 5).map(p => ({ 
            name: p.name, 
            distance: p.distance?.toFixed(3) + 'km',
            coords: p.coordinates 
        })));
        
        const filteredByRadius = placesWithDistance
            .filter(place => place.distance <= searchRadius)
            .sort((a, b) => a.distance! - b.distance!);
            
        console.log('Places within radius:', filteredByRadius.length);
        console.log('Filtered places (first 5):', filteredByRadius.slice(0, 5).map(p => ({ 
            name: p.name, 
            distance: p.distance?.toFixed(3) + 'km' 
        })));
        
        // If no places found within radius, show a helpful message in console
        if (filteredByRadius.length === 0) {
            console.log(`⚠️ No places found within ${searchRadius}km of ${locationForRadius.lat}, ${locationForRadius.lng}`);
            console.log('Showing no places (no fallback)');
        }
        
        // Return only places within radius, no fallback
        return filteredByRadius;
    }
    
    console.log('No location available for radius filtering');
    
    return categoryFilteredPlaces;
  }, [combinedItems, selectedCategories, searchCenter, userLocation, mapCenter, searchRadius, selectedPlace, isFocusModeActive, selectedBusRoute, busStopToRouteMap, tourRoutes, hikingTrails, selectedTour, mapBounds, isWithinBounds]);



  useEffect(() => {
    // Only clear selectedPlace if it's not found in filteredPlaces AND it doesn't have AI content
    // This prevents the AI response from being cleared due to timing issues with filteredPlaces updates
    if (selectedPlace && !filteredPlaces.find(p => p.id === selectedPlace.id)) {
      // Don't clear if the place has AI-generated content or chat history
      if (selectedPlace.aiGeneratedDescription || selectedPlace.chatHistory) {
        console.log('Place has AI content, not clearing selection despite not being in filteredPlaces');
        return;
      }
      
      // Add a small delay to prevent clearing places that were just updated
      const timer = setTimeout(() => {
        // Check again after the delay to see if the place is now in filteredPlaces
        if (selectedPlace && !filteredPlaces.find(p => p.id === selectedPlace.id)) {
          // Don't clear bus stops or bus routes - they might be filtered out when categories change
          if (selectedPlace.category === PlaceCategory.BUS_STOP || 
              selectedPlace.category === PlaceCategory.BUS_TERMINUS ||
              selectedPlace.category === PlaceCategory.BUS_ROUTE) {
            console.log('Keeping bus stop/route selected even though not in filteredPlaces:', selectedPlace.name);
            return;
          }
          console.log('Clearing selectedPlace because not found in filteredPlaces:', selectedPlace.name);
          setSelectedPlace(null);
        }
      }, 100); // 100ms delay
      
      return () => clearTimeout(timer);
    }
  }, [filteredPlaces, selectedPlace]);

  useEffect(() => {
    if (flyToLocation) {
      // After flying to the location, reset it to null so it doesn't re-trigger
      // Use a longer delay to allow the map animation to complete
      // For events/excursions on mobile, wait longer for pan animation (1600ms + 500ms = 2100ms)
      const delay = flyToFromEventsOrExcursions && isSmallScreen ? 2100 : 1500;
      const timer = setTimeout(() => {
        setFlyToLocation(null);
        setFlyToFromEventsOrExcursions(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [flyToLocation, flyToFromEventsOrExcursions, isSmallScreen]);
  
  // Clear previousPageBeforeMapView when manually navigating BETWEEN events/excursions pages
  // This ensures we only track navigation from "Show on Map" clicks, not manual navigation
  useEffect(() => {
    const prevPage = previousCurrentPageRef.current;
    previousCurrentPageRef.current = currentPage;
    
    if (currentPage === 'events' || currentPage === 'excursions') {
      // Only clear if we manually navigated BETWEEN events and excursions
      // (i.e., from 'events' to 'excursions' or vice versa, not from 'app' or other pages)
      if (prevPage === 'events' || prevPage === 'excursions') {
        // We came from events or excursions
        if (prevPage !== currentPage && !justCameFromShowOnMap.current) {
          // This is a manual navigation between events/excursions, clear the old value
          console.log('[Navigation] Manually navigated from', prevPage, 'to', currentPage, ', clearing previousPageBeforeMapView');
          setPreviousPageBeforeMapView(null);
        }
      }
      // Reset flag after a short delay to allow "Show on Map" handler to set it first
      const resetTimer = setTimeout(() => {
        justCameFromShowOnMap.current = false;
      }, 200);
      return () => clearTimeout(resetTimer);
    } else if (currentPage === 'app') {
      // When on map view, don't clear previousPageBeforeMapView - it should persist
      // Just reset the flag
      justCameFromShowOnMap.current = false;
    } else {
      // Reset flag when leaving events/excursions pages to other pages
      justCameFromShowOnMap.current = false;
    }
  }, [currentPage, previousPageBeforeMapView]);
  
  // Debug effect to monitor previousPageBeforeMapView changes
  useEffect(() => {
    console.log('[Navigation] previousPageBeforeMapView changed to:', previousPageBeforeMapView);
  }, [previousPageBeforeMapView]);
  
  // Debug effect to monitor selectedTour changes
  useEffect(() => {
    console.log('selectedTour changed to:', selectedTour);
    if (selectedTour) {
      console.log('Tour selected - ID:', selectedTour.id, 'Name:', selectedTour.name);
    } else {
      console.log('Tour deselected');
    }
  }, [selectedTour]);

  // Handle bottom sheet and sidebar logic when selection changes
  useEffect(() => {
    console.log('=== BOTTOM SHEET LOGIC ===');
    console.log('Screen size check - isSmallScreen:', isSmallScreen);
    console.log('selectedPlace:', selectedPlace);
    console.log('selectedTour:', selectedTour);
    console.log('Window width:', window.innerWidth);
    console.log('768 breakpoint check:', window.innerWidth < 768);
    
    if (isSmallScreen) {
      console.log('Small screen detected, checking if should open bottom sheet...');
      // Open bottom sheet for both places and tours
      if (selectedPlace || selectedTour) {
        if (suppressNextDetailOpen) {
          console.log('Suppressed next detail open - keeping BottomSheet closed');
          setSuppressNextDetailOpen(false);
          setIsBottomSheetOpen(false);
        } else {
          console.log('Opening BottomSheet on small screen');
          setIsBottomSheetOpen(true);
        }
        setIsSidebarOpen(false); // Ensure sidebar is closed on small screens
      } else {
        console.log('No place or tour selected, not opening bottom sheet');
      }
    } else {
      // Only open sidebar on large screens
      console.log('Large screen detected, opening sidebar');
      setIsSidebarOpen(true);
      setIsBottomSheetOpen(false); // Ensure bottom sheet is closed on large screens
    }
  }, [selectedTour, selectedPlace, isSmallScreen]);

  // Browser back button blocking with confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Your progress may be lost.';
      return 'Are you sure you want to leave? Your progress may be lost.';
    };

    // Add the event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // --- UI Handlers ---
  

  
  const handleCategoryChange = useCallback((category: PlaceCategory | string) => {
    console.log('=== handleCategoryChange called ===');
    console.log('category:', category);
    console.log('current selectedCategories:', selectedCategories);
    
    if (category === PlaceCategory.BUS_STOP) {
      handleBusRouteChange(null); // Clear bus route and polyline
    }
    
    setSelectedCategories(prev => {
      // Use string comparison to handle both enum values and custom category strings
      const isCurrentlySelected = prev.some(c => String(c) === String(category));
      const newCategories = isCurrentlySelected 
        ? prev.filter(c => String(c) !== String(category)) 
        : [...prev, category];
      console.log('Setting selectedCategories from', prev, 'to', newCategories);
      
      // If BUS_STOP category is being selected, set radius to 1km
      if (!isCurrentlySelected && category === PlaceCategory.BUS_STOP) {
        setSearchRadius(1); // Set to 1km
      }
      
      // If BUS_STOP category is being deselected, restore default radius if it was set to 1km
      if (isCurrentlySelected && category === PlaceCategory.BUS_STOP && searchRadius === 1) {
        setSearchRadius(DEFAULT_RADIUS);
      }
      
      // If Tours category is being deselected, clear selected tour (which includes hiking trails)
      if (prev.some(c => String(c) === String(PlaceCategory.TOURS)) && 
          !newCategories.some(c => String(c) === String(PlaceCategory.TOURS))) {
        setSelectedTour(null);
      }
      
      return newCategories;
    });
  }, [selectedCategories, searchCenter, selectedBusRoute, searchRadius, addNotification]); // Add dependencies

  const handleRadiusChange = (newRadius: number) => {
    setSearchRadius(newRadius);
  };
  
  const handlePlaceHover = useCallback((placeId: string | null) => {
      // Turn off hover preview on small screens
      if (isSmallScreen) {
          setHoveredPlaceId(null); // Ensure no lingering hover state
          return;
      }
      setHoveredPlaceId(placeId);
  }, [isSmallScreen]);

  const handlePlaceSelect = useCallback(async (place: Place | GroupedBusStop) => {
            // selectedHikingTrail removed - using unified tour system
    
    // Add debugging for tour selection
    if ((place as Place).type === 'tour' || (place as Place).category === PlaceCategory.TOURS) {
      console.log('Tour marker clicked - about to set selectedTour to:', place);
    }
    
    logAnalyticsEvent('view_place', { 
      place_id: place.id, 
      place_name: place.name, 
      category: place.category,
      latitude: place.coordinates?.lat,
      longitude: place.coordinates?.lng
    });
    // Track user journey step
    trackUserJourney('view_place', { place_id: place.id, place_name: place.name });
    
    // CRITICAL: Handle tour deselection FIRST - when a tour is clicked again
    if ((place as Place).type === 'tour-deselect') {
      console.log('Tour deselection requested for:', place.name);
      setSelectedTour(null);
      setSelectedPlace(null);
      // Keep the Tours category selected so other tours remain visible
      return;
    }
    
    console.log('=== PLACE TYPE CHECK ===');
    console.log('place.type:', (place as Place).type);
    console.log('place.category:', (place as Place).category);
    console.log('Is this a tour?', (place as Place).type === 'tour' || (place as Place).category === PlaceCategory.TOURS);
    
    // CRITICAL: Handle tour stops FIRST, before any other place selection logic
    // This prevents the tour route from being cleared when tour stops are clicked
    if ((place as Place).type === 'tour-stop' || (place as Place).type === 'hiking-stop') {
      const placeAsPlace = place as Place;
      console.log('Tour/Hiking stop clicked - processing FIRST to prevent tour clearing:', placeAsPlace);
      
      // Check if the same stop is already selected - if so, just hide the stop details
      if (selectedPlace && selectedPlace.id === placeAsPlace.id) {
        setSelectedPlace(null);
        return;
      }
      
      // IMPORTANT: First, ensure the parent tour/hiking trail is selected so the route stays visible
      console.log('Processing tour/hiking stop with tourId:', placeAsPlace.tourId);
      if (placeAsPlace.tourId) {
        if (placeAsPlace.type === 'hiking-stop') {
          // For hiking trail stops, find and select the hiking trail using the unified tour system
          const hikingTrailToSelect = hikingTrails.find(trail => trail.id === placeAsPlace.tourId);
          console.log('Looking for hiking trail with ID:', placeAsPlace.tourId, 'Found:', hikingTrailToSelect);
          if (hikingTrailToSelect) {
            setSelectedTour(hikingTrailToSelect); // Use selectedTour for consistency
            console.log('Hiking trail stop clicked - selecting parent trail:', hikingTrailToSelect.name);
            
            // Ensure Tours category is selected so hiking trails are visible
            if (!selectedCategories.includes(PlaceCategory.TOURS)) {
              setSelectedCategories([PlaceCategory.TOURS]);
            }
          }
        } else {
          // For tour stops, find and select the parent tour
          const tourToSelect = tourRoutes.find(tour => tour.id === placeAsPlace.tourId);
          console.log('Looking for tour with ID:', placeAsPlace.tourId, 'Found:', tourToSelect);
          if (tourToSelect) {
            setSelectedTour(tourToSelect);
            console.log('Tour stop clicked - selecting parent tour:', tourToSelect.name);
            
            // Ensure Tours category is selected so tour routes are visible
            if (!selectedCategories.includes(PlaceCategory.TOURS)) {
              setSelectedCategories([PlaceCategory.TOURS]);
            }
          }
        }
      } else {
        console.warn('Tour stop clicked but no tourId found:', placeAsPlace);
      }
      
      // Now set the selected place to show the stop details
      setSelectedPlace(placeAsPlace);
      
      console.log('After processing tour stop - selectedTour:', selectedTour, 'selectedPlace:', placeAsPlace.name);
      
      // Return early - don't process tour stops as regular places
      return;
    }
    
    if (place.id === selectedPlace?.id) {
      // Don't deselect if the place has AI-generated content or chat history
      // This prevents the AI response from being cleared when the place is updated
      if (place.aiGeneratedDescription || place.chatHistory || selectedPlace.aiGeneratedDescription || selectedPlace.chatHistory) {
        console.log('Place has AI content, updating instead of deselecting');
        setSelectedPlaceWithDebug(place as Place);
        return;
      }
      
      // If this was a bus stop or bus route, restore original categories BEFORE clearing selectedPlace
      if (place.category === PlaceCategory.BUS_STOP || 
          place.category === PlaceCategory.BUS_TERMINUS || 
          place.category === PlaceCategory.BUS_ROUTE) {
        setSelectedCategories([...originalCategoriesRef.current]);
      }
      
      setSelectedPlace(null);
      handleBusRouteChange(null); // Clear bus route and polyline if same place is unselected
      setSelectedGroupedBusStop(null);
              // No need to clear hiking trail - unified system handles this

      return;
    }

    if ((place as GroupedBusStop).isGrouped) {
      setSelectedGroupedBusStop(place as GroupedBusStop);
      setSelectedPlace(null);
      setSelectedBusRoute(null);
    } else {
      const placeAsPlace = place as Place;
      
      // Check if we need to load full details (if place is lightweight)
      const needsFullDetails = !placeAsPlace.description && !placeAsPlace.galleryImages?.length && !placeAsPlace.mainImage;
      
      let finalPlace = placeAsPlace;
      
      if (needsFullDetails) {
        // Check cache first
        const cachedPlace = placeDetailsCacheRef.current.get(placeAsPlace.id);
        if (cachedPlace) {
          console.log('Using cached full details for place:', placeAsPlace.id);
          finalPlace = cachedPlace;
        } else {
          // Fetch full details
          console.log('Loading full details for place:', placeAsPlace.id);
          try {
            const fullPlace = await fetchPlaceById(placeAsPlace.id);
            if (fullPlace) {
              console.log('🚢 Fetched full place details:', {
                name: fullPlace.name,
                id: fullPlace.id,
                timetable_file: fullPlace.timetable_file,
                hasTimetableFile: !!fullPlace.timetable_file
              });
              // Cache it for future use
              placeDetailsCacheRef.current.set(fullPlace.id, fullPlace);
              finalPlace = fullPlace;
            }
          } catch (error) {
            console.error('Error fetching full place details:', error);
            // Continue with lightweight data if fetch fails
            finalPlace = placeAsPlace;
          }
        }
      } else {
        // Place already has full details, cache it
        placeDetailsCacheRef.current.set(placeAsPlace.id, placeAsPlace);
      }
      
      setSelectedPlaceWithDebug(finalPlace);
      setSelectedGroupedBusStop(null);
      setSelectedClusterStops([]); // Clear cluster when a place is selected

      // If the selected place is a bus stop, set the selected bus route and adjust categories
      if (finalPlace.category === PlaceCategory.BUS_STOP || finalPlace.category === PlaceCategory.BUS_TERMINUS) {
        const routeId = busStopToRouteMap.get(finalPlace.id);
        handleBusRouteChange(routeId || null);
  
        // Store original categories before changing them
        originalCategoriesRef.current = [...selectedCategories];
        
        // When a bus route is selected, we want to show bus-related categories BUT keep Tours if it was selected
        setSelectedCategories(prev => {
          const newCategories = [PlaceCategory.BUS_STOP, PlaceCategory.BUS_TERMINUS];
          // Keep Tours category if it was previously selected
          if (prev.includes(PlaceCategory.TOURS)) {
            newCategories.push(PlaceCategory.TOURS);
          }
          return newCategories;
        });
        // No need to clear hiking trail - unified system handles this
        setSelectedTour(null); // Clear any selected tour when bus stop is selected
      } else if (placeAsPlace.category === PlaceCategory.HIKING_TRAIL) {
        // Handle hiking trail selection the same way as tours - use selectedTour state
        if (selectedTour && selectedTour.id === placeAsPlace.id) {
          // Hiking trail is already selected, deselect it
          console.log('Hiking trail already selected, deselecting it');
          setSelectedTour(null);
          setSelectedPlace(null);
          // Keep the Tours category selected so other tours remain visible
          return;
        }
        
        console.log('Hiking trail selected:', placeAsPlace);
        
        // Use the same logic as tours - set selectedTour for hiking trails too
        setSelectedTour(placeAsPlace);
        setSelectedPlace(null); // Clear selected place when hiking trail is selected
        
        // Ensure Tours category is selected so hiking trails are visible
        if (!selectedCategories.includes(PlaceCategory.TOURS)) {
          setSelectedCategories([PlaceCategory.TOURS]);
        }
        
        // Fly to the hiking trail's location to center it on the map
        if (placeAsPlace.coordinates && isValidLatLng(placeAsPlace.coordinates)) {
          setFlyToLocation(placeAsPlace.coordinates);
        }
            } else if ((placeAsPlace.type === 'tour' || 
                   placeAsPlace.category === PlaceCategory.TOURS ||
                   placeAsPlace.category === PlaceCategory.SIGHTSEEING_ROUTE ||
                   placeAsPlace.category === PlaceCategory.JEEP_TOUR ||
                   placeAsPlace.category === PlaceCategory.QUAD_TOUR ||
                   placeAsPlace.category === PlaceCategory.BOAT_TOUR ||
                   placeAsPlace.category === PlaceCategory.CUSTOM_TOUR) && 
                   placeAsPlace.type !== 'tour-stop' && 
                   placeAsPlace.type !== 'hiking-stop') {
          // If the same tour is already selected, deselect it
          if (selectedTour && selectedTour.id === placeAsPlace.id) {
            console.log('Tour already selected, deselecting it');
            setSelectedTour(null);
            setSelectedPlace(null);
            // Keep the Tours category selected so other tours remain visible
            return;
          }
          
          // Handle tour selection (but NOT tour stops)
          console.log('Tour selected:', placeAsPlace);
          console.log('Tour selected mainImage:', placeAsPlace.mainImage);
          console.log('Tour selected object keys:', Object.keys(placeAsPlace));
          
          // Set tour immediately
          console.log('=== TOUR SELECTION ===');
          console.log('About to set selectedTour to:', placeAsPlace);
          setSelectedTour(placeAsPlace);
          setSelectedPlace(null); // Clear selected place when tour is selected
          console.log('Tour selection completed');
          
          // Ensure Tours category is selected so tour routes are visible
          if (!selectedCategories.includes(PlaceCategory.TOURS)) {
            setSelectedCategories([PlaceCategory.TOURS]);
          }
          
          // Open sidebar on large screens to show tour details with close button
          if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
          }
          
          // Fly to the tour's location to center it on the map
          if (placeAsPlace.coordinates && isValidLatLng(placeAsPlace.coordinates)) {
            setFlyToLocation(placeAsPlace.coordinates);
          }
        
        // Let user manually control category selection
      } else if (placeAsPlace.type === 'bus-route' || placeAsPlace.category === PlaceCategory.BUS_ROUTE) {
        // Handle bus route selection from search
        console.log('🚌 === BUS ROUTE SELECTED FROM SEARCH ===');
        console.log('Bus route:', placeAsPlace.name);
        console.log('Route ID:', placeAsPlace.routeId);
        console.log('Place object:', placeAsPlace);
        
        // Store original categories before changing them
        originalCategoriesRef.current = [...selectedCategories];
        console.log('Stored original categories:', originalCategoriesRef.current);
        
        // Set the place to show details in sidebar FIRST
        console.log('Setting selectedPlace to bus route...');
        setSelectedPlaceWithDebug(placeAsPlace);
        
        // Set the selected bus route to display it on the map
        if (placeAsPlace.routeId) {
          console.log('Calling handleBusRouteChange with:', placeAsPlace.routeId);
          handleBusRouteChange(placeAsPlace.routeId);
        }
        
        // Ensure BUS_STOP and BUS_ROUTE categories are selected so both routes and stops are visible
        console.log('Setting categories to show bus stops and routes...');
        setSelectedCategories([PlaceCategory.BUS_STOP, PlaceCategory.BUS_TERMINUS, PlaceCategory.BUS_ROUTE]);
        
        // Clear any selected tour
        setSelectedTour(null);
        console.log('🚌 === BUS ROUTE SELECTION COMPLETE ===');
      } else {
        // Handle regular place selection (not tour, not hiking trail, not bus stop, not bus route)
        console.log('Regular place clicked:', placeAsPlace);
        console.log('placeAsPlace.type:', placeAsPlace.type);
        console.log('placeAsPlace.category:', placeAsPlace.category);
        console.log('This should NOT clear tours!');
        
        // Check if we need to load full details (if place is lightweight)
        let finalPlace: Place = placeAsPlace;
        const needsFullDetails = !finalPlace.description && !finalPlace.galleryImages?.length && !finalPlace.mainImage;
        
        if (needsFullDetails) {
          // Check cache first
          const cachedPlace = placeDetailsCacheRef.current.get(finalPlace.id);
          if (cachedPlace) {
            console.log('Using cached full details for place:', finalPlace.id);
            finalPlace = cachedPlace;
          } else {
            // Fetch full details
            console.log('Loading full details for place:', finalPlace.id);
            try {
              const fullPlace = await fetchPlaceById(finalPlace.id);
              if (fullPlace) {
                // Cache it for future use
                placeDetailsCacheRef.current.set(fullPlace.id, fullPlace);
                finalPlace = fullPlace;
              }
            } catch (error) {
              console.error('Error fetching full place details:', error);
              // Continue with lightweight data if fetch fails
            }
          }
        } else {
          // Place already has full details, cache it
          placeDetailsCacheRef.current.set(finalPlace.id, finalPlace);
        }
        
        // If we had bus categories selected (from a previous bus route/stop selection), restore original categories
        if (selectedCategories.includes(PlaceCategory.BUS_STOP) || 
            selectedCategories.includes(PlaceCategory.BUS_ROUTE)) {
          console.log('Restoring original categories after bus route/stop was selected');
          console.log('Original categories:', originalCategoriesRef.current);
          
          if (originalCategoriesRef.current.length > 0) {
            // Restore to what was there before
            setSelectedCategories([...originalCategoriesRef.current]);
          } else {
            // If no original categories, just remove bus categories
            setSelectedCategories(prev => prev.filter(cat => 
              cat !== PlaceCategory.BUS_STOP && 
              cat !== PlaceCategory.BUS_TERMINUS && 
              cat !== PlaceCategory.BUS_ROUTE
            ));
          }
        }
        
        handleBusRouteChange(null); // Clear bus route and polyline if a non-bus stop place is selected
        // Don't clear hiking trail or tour selections - let user control them manually
        
        // Use finalPlace with full details
        setSelectedPlaceWithDebug(finalPlace);
      }
    }
    
    setAiError(null);

    // Note: Bottom sheet logic moved to useEffect to ensure it runs after state updates
    setIsControlsCollapsed(true);
    setIsPlacesListCollapsed(true);
  }, [busStopToRouteMap, tourRoutes, hikingTrails, selectedPlace, selectedCategories, selectedTour, placeDetailsCacheRef]);

  const handleBusRouteChange = useCallback(async (routeId: string | null) => {
    setSelectedBusRoute(routeId);
    setSelectedClusterStops([]); // Clear cluster when a new route is selected
    

    if (routeId) {
      try {
        const apiBaseE = API_BASE;
        const response = await fetch(`${apiBaseE}/api/bus-routes/${routeId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch bus route ${routeId}`);
        }
        const routeData = await response.json();
        if (routeData && Array.isArray(routeData.points)) {
          const polylineCoordinates = routeData.points
            .filter((p: any) => p.lat && p.lng)
            .map((p: any) => ({ lat: p.lat, lng: p.lng }));
          setSelectedBusRouteCoordinates(polylineCoordinates);
        } else {
          setSelectedBusRouteCoordinates(null);
        }
      } catch (error) {
        console.error(`Error fetching bus route ${routeId} details:`, error);
        addNotification(`Failed to load bus route ${routeId} details.`, 'error');
        setSelectedBusRouteCoordinates(null);
      }
    } else {
      setSelectedBusRouteCoordinates(null);
    }
  }, [addNotification]);



  // Note: handleShowTrailOnMap is no longer needed since hiking trails now use the unified tour system
  // Hiking trails are handled the same way as tours through setSelectedTour

  const handleCloseTour = () => {
    // Just close - don't navigate (X button behavior)
    setSelectedTour(null);
  };

  const handleSuggestionSelect = useCallback((place: Place) => {
    console.log('=== SUGGESTION SELECTED ===');
    console.log('Selected place:', place.name, 'Category:', place.category);
    
    // Fly to the place location
    setFlyToLocation(place.coordinates);
    
    // Ensure the place's category is selected so it appears on the map
    if (place.category && !selectedCategories.includes(place.category)) {
      console.log('Adding category to selected categories:', place.category);
      setSelectedCategories(prev => [...prev, place.category]);
    }
    
    // Select the place to show its details
    handlePlaceSelect(place);
  }, [handlePlaceSelect, selectedCategories]);

  const handleShowItemOnMap = useCallback((item: any) => {
    try {
      // Prepare image URLs - handle both array and string formats
      let imageUrls: string[] = [];
      if (item?.image_urls) {
        if (Array.isArray(item.image_urls)) {
          // Already an array
          imageUrls = item.image_urls;
        } else if (typeof item.image_urls === 'string') {
          // Try to parse as JSON, fallback to single item array
          try {
            const parsed = JSON.parse(item.image_urls);
            imageUrls = Array.isArray(parsed) ? parsed : [item.image_urls];
          } catch {
            // If parsing fails, treat as single path string
            imageUrls = item.image_urls.trim() ? [item.image_urls.trim()] : [];
          }
        }
      }

      // Validate coordinates
      if (!item.latitude || !item.longitude) {
        console.error('Event missing coordinates:', item);
        alert('This event does not have location information.');
        return;
      }

      const eventId = `event-${item.id}`;

      // Ensure the item has the 'coordinates' object the app expects
      const placeToShow: Place = {
        ...item,
        id: eventId, // Ensure unique ID for events
        category: PlaceCategory.EVENT,
        shortDescription: item.description || '',
        description: item.description || '',
        coordinates: {
          lat: Number(item.latitude),
          lng: Number(item.longitude)
        },
        image_urls: imageUrls,
        galleryImages: imageUrls.map((url: string) => {
          // Handle both absolute URLs and relative paths
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
          }
          return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
        }),
        imageUrl: imageUrls.length > 0 ? (imageUrls[0].startsWith('http://') || imageUrls[0].startsWith('https://') 
          ? imageUrls[0] 
          : `${API_BASE}${imageUrls[0].startsWith('/') ? imageUrls[0] : `/${imageUrls[0]}`}`) : undefined
      };

      // Add event to allEvents if it's not already there
      setAllEvents(prev => {
        const existingIndex = prev.findIndex(e => e.id === eventId);
        if (existingIndex >= 0) {
          // Update existing event
          const updated = [...prev];
          updated[existingIndex] = placeToShow;
          return updated;
        } else {
          // Add new event
          return [...prev, placeToShow];
        }
      });

      // Store the previous page before navigating to map view
      // Always update to the current page, so it reflects the most recent page the user was on
      // IMPORTANT: Check currentPage BEFORE changing it to 'app'
      const pageBeforeMap = currentPage;
      console.log('[Navigation] handleShowItemOnMap - currentPage:', pageBeforeMap, 'previousPageBeforeMapView before:', previousPageBeforeMapView);
      if (pageBeforeMap === 'events' || pageBeforeMap === 'excursions') {
        console.log('[Navigation] Setting previousPageBeforeMapView to:', pageBeforeMap, '(overwriting previous value:', previousPageBeforeMapView, ')');
        justCameFromShowOnMap.current = true; // Set flag to prevent clearing
        // Always set to the current page, overwriting any previous value
        setPreviousPageBeforeMapView(pageBeforeMap);
        setFlyToFromEventsOrExcursions(true);
      } else {
        // If we're not on events/excursions, clear it to avoid confusion
        console.log('[Navigation] Not on events/excursions, clearing previousPageBeforeMapView');
        setPreviousPageBeforeMapView(null);
      }
      
      // Close UI chrome and focus map on the item
      setIsSidebarOpen(false);
      setCurrentPage('app');
      setFlyToLocation(placeToShow.coordinates);
      setIsFocusModeActive(true); // Activate focus mode
      // A brief delay ensures the page transition completes before selection
      setTimeout(() => {
        // Clear suppress flag so bottom sheet can open on small screens
        setSuppressNextDetailOpen(false);
        handlePlaceSelect(placeToShow);
      }, 100);
    } catch (error) {
      console.error('Error showing event on map:', error, item);
      alert('Failed to show event on map. Please try again.');
    }
  }, [currentPage, previousPageBeforeMapView, handlePlaceSelect, API_BASE]);

  const handleGenerateDescription = useCallback(async (place: Place) => {
    console.log('=== handleGenerateDescription called ===');
    console.log('Place:', place);
    console.log('Place has aiGeneratedDescription:', !!place.aiGeneratedDescription);
    console.log('Place has chatHistory:', !!place.chatHistory);
    
    if (!place || place.aiGeneratedDescription) {
      console.log('Early return - place is null or already has AI description');
      return;
    }
    
    console.log('Setting loading state to true');
    setIsLoadingAiDescription(true);
    setAiError(null);
    
    try {
      console.log('Calling generatePlaceInfo...');
      const {description: aiText, sources} = await generatePlaceInfo(place.name, place.category, place.coordinates, language);
      console.log('AI response received:', { aiText, sources });
      
      const chatHistory: ChatMessage[] = [{ role: 'model', text: aiText }];
      const newPlaceData = { ...place, aiGeneratedDescription: aiText, sources, chatHistory };
      console.log('Saving updated place data:', newPlaceData);
      
      handleSavePlace(newPlaceData);
      console.log('Place saved successfully');
    } catch (error: any) {
      console.error('Error in handleGenerateDescription:', error);
      setAiError(error.message || "Could not fetch AI insights.");
    } finally { 
      console.log('Setting loading state to false');
      setIsLoadingAiDescription(false); 
    }
  }, [handleSavePlace, language]);
  
  const handleSendMessage = useCallback(async (place: Place, message: string) => {
      // Initialize chatHistory if it doesn't exist
      if (!place?.chatHistory) {
          place.chatHistory = [];
      }
      
      const newUserMessage: ChatMessage = { role: 'user', text: message };
      const updatedHistory = [...place.chatHistory, newUserMessage];

      // Update UI immediately with user's message
      handleSavePlace({ ...place, chatHistory: updatedHistory });
      
      setIsLoadingAiDescription(true);
      setAiError(null);
      
      try {
          // First, try to find answer in AI memory
          const memoryAnswer = await aiMemoryService.findAnswer(place.id, message);
          
          let aiResponseText: string;
          
          if (memoryAnswer) {
              // Use memory answer
              console.log('Using AI memory answer for question:', message);
              aiResponseText = memoryAnswer;
          } else {
              // Get response from AI API
              console.log('No memory found, calling AI API for question:', message);
              aiResponseText = await getChatResponse(updatedHistory, place.name, language);
              
              // Save the Q&A pair to memory with variations
              const variations = aiMemoryService.generateAnswerVariations(aiResponseText);
              await aiMemoryService.addMemoryEntry(place.id, place.name, message, aiResponseText);
              
              // Add variations to memory for future use
              for (let i = 1; i < variations.length; i++) {
                  await aiMemoryService.addMemoryEntry(place.id, place.name, message, variations[i]);
              }
          }
          
          const newAiMessage: ChatMessage = { role: 'model', text: aiResponseText };
          const finalHistory = [...updatedHistory, newAiMessage];
          handleSavePlace({ ...place, chatHistory: finalHistory });
      } catch (error: any) {
          setAiError(error.message || 'Could not get a response from the AI assistant.');
          // Optional: remove the user's message if the call fails
          handleSavePlace({ ...place, chatHistory: place.chatHistory });
      } finally {
          setIsLoadingAiDescription(false);
      }
  }, [handleSavePlace, language]);

  const handleOpenGallery = useCallback((place: Place, imageIndex: number = 0) => {
    if (place?.galleryImages?.length || place?.images?.length || place?.mainImage) {
      setSelectedPlace(place);
      setIsGalleryOpen(true);
    }
  }, []);

  // --- Trip Planner Handlers ---
  const handleSaveTrip = async (name: string, icon: string, tripId?: string) => {
    console.log('=== HANDLE SAVE TRIP CALLED ===');
    console.log('Current user state:', user);
    console.log('User ID:', user?.id);
    console.log('User authenticated:', !!user);
    console.log('Trip data:', { name, icon, tripId });
    
    if (!user?.id) {
      console.log('No user ID found, showing login message');
      addNotification('Please login to create a trip', 'error');
      return;
    }

    const placesCount = tripId ? tripPlans.find(t => t.id === tripId)?.places.length || 0 : 0;
    trackTripCreation(name, placesCount, tripId);
    
    try {
      if (tripId) { // Editing existing trip
        const updatedTrip = tripPlans.find(t => t.id === tripId);
        if (updatedTrip) {
          await tripsService.updateTrip(tripId, { name, icon, places: updatedTrip.places, routeInfo: updatedTrip.routeInfo });
          setTripPlans(prev => prev.map(t => t.id === tripId ? { ...t, name, icon } : t));
          addNotification('Trip updated successfully!');
        }
      } else { // Creating new trip
        const newTrip: TripPlan = { id: `trip-${Date.now()}`, name, icon, places: [] };
        await tripsService.createTrip({
          id: newTrip.id,
          userId: user.id,
          name: newTrip.name,
          icon: newTrip.icon,
          places: newTrip.places,
          routeInfo: newTrip.routeInfo
        });
        setTripPlans(prev => [...prev, newTrip]);
        addNotification('New trip created!');
      }
      
    } catch (error) {
      console.error('Error saving trip:', error);
      addNotification('Failed to save trip. Please try again.', 'error');
      return;
    }
    
    setIsCreateTripModalOpen(false);
    setEditingTrip(null);
  };
  
  const handleDeleteTrip = async (tripId: string) => {
    if (!user?.id) {
      addNotification('Please log in to delete trips.', 'error');
      return;
    }

    if (window.confirm("Are you sure you want to delete this trip plan?")) {
      try {
        await tripsService.deleteTrip(tripId);
        setTripPlans(prev => prev.filter(t => t.id !== tripId));
        if (viewingTrip?.id === tripId) setViewingTrip(null);
        addNotification('Trip deleted.', 'info');
      } catch (error) {
        console.error('Error deleting trip:', error);
        addNotification('Failed to delete trip. Please try again.', 'error');
      }
    }
  };

  const handleAddToTripClick = (place: Place) => {
    // We'll handle authentication check in the component using useAuth
    if (tripPlans.length === 0) {
      setIsCreateTripModalOpen(true);
    } else if (tripPlans.length === 1) {
      handleAddPlaceToTrip(tripPlans[0].id, place);
    } else {
      setPlaceToAdd(place);
      setIsAddToTripModalOpen(true);
    }
  };

  const handleAddPlaceToTrip = async (tripId: string, place: Place | null = placeToAdd) => {
    if (!place || !user?.id) return;
    
    try {
      const updatedTrip = tripPlans.find(plan => plan.id === tripId);
      if (updatedTrip && !updatedTrip.places.some(p => p.id === place.id)) {
        const newPlaces = [...updatedTrip.places, place];
        const newTrip = { ...updatedTrip, places: newPlaces, routeInfo: {} };
        
        // Save to backend
        await tripsService.updateTrip(tripId, {
          name: updatedTrip.name,
          icon: updatedTrip.icon,
          places: newPlaces,
          routeInfo: {}
        });
        
        // Update local state
        setTripPlans(prevPlans => prevPlans.map(plan => 
          plan.id === tripId ? newTrip : plan
        ));
        
        addNotification(`Added "${place.name}" to your trip.`);
      } else {
        addNotification(`"${place.name}" is already in this trip.`, 'info');
      }
    } catch (error) {
      console.error('Error adding place to trip:', error);
      addNotification('Failed to add place to trip. Please try again.', 'error');
    }
    
    setIsAddToTripModalOpen(false);
    setPlaceToAdd(null);
  };
  
  const handleRemovePlaceFromTrip = useCallback(async (tripId: string, placeId: string) => {
    if (!user?.id) return;
    
    const trip = tripPlans.find(t => t.id === tripId);
    if (!trip) return;

    try {
      const newPlaces = trip.places.filter(p => p.id !== placeId);
      const updatedTrip = { ...trip, places: newPlaces, routeInfo: {} };
      
      if (newPlaces.length > 1) {
        const newRoute = await fetchRoute(newPlaces, activeTravelMode);
        updatedTrip.routeInfo = { [activeTravelMode]: newRoute || undefined };
      }
      
      // Save to backend
      await tripsService.updateTrip(tripId, {
        name: trip.name,
        icon: trip.icon,
        places: newPlaces,
        routeInfo: updatedTrip.routeInfo
      });
      
      // Update local state
      setTripPlans(prev => prev.map(t => t.id === tripId ? updatedTrip : t));
      setViewingTrip(updatedTrip);
    } catch (error) {
      console.error('Error removing place from trip:', error);
      addNotification('Failed to remove place from trip. Please try again.', 'error');
    }
  }, [tripPlans, activeTravelMode, user?.id]);

  const handleSelectPlaceFromTrip = (place: Place) => {
    setCurrentPage('app');
    setViewingTrip(null);
    handlePlaceSelect(place);
    // The line below was removed to stop the map from flying to the location.
    // setSearchResultLocation(place.coordinates); 
  };
  
  const handleViewTripOnMap = useCallback(async (tripId: string) => {
      const tripToView = tripPlans.find(t => t.id === tripId);
      if (tripToView) {
        if (tripToView.id === viewingTrip?.id) {
          setViewingTrip(null); // Toggle off if already viewing
          return;
        }

        const defaultMode: TravelMode = 'driving-car';
        setActiveTravelMode(defaultMode);
        setViewingTrip(tripToView);
        
        if (!tripToView.routeInfo?.[defaultMode] && tripToView.places.length > 1) {
            try {
                const route = await fetchRoute(tripToView.places, defaultMode);
                const updatedTrip = { ...tripToView, routeInfo: { ...tripToView.routeInfo, [defaultMode]: route || undefined } };
                
                // Save to backend if user is authenticated
                if (user?.id) {
                    await tripsService.updateTrip(tripId, {
                        name: tripToView.name,
                        icon: tripToView.icon,
                        places: tripToView.places,
                        routeInfo: updatedTrip.routeInfo
                    });
                }
                
                setTripPlans(prev => prev.map(t => t.id === tripId ? updatedTrip : t));
                setViewingTrip(updatedTrip);
            } catch (error) {
                console.error('Error generating route:', error);
                // Don't show error notification for route generation failure
            }
        }
      }
  }, [tripPlans, viewingTrip, user?.id]);

  const handleTravelModeChange = useCallback(async (mode: TravelMode) => {
    if (!viewingTrip || !user?.id) return;
    setActiveTravelMode(mode);

    const tripToUpdate = tripPlans.find(t => t.id === viewingTrip.id);
    if (tripToUpdate && !tripToUpdate.routeInfo?.[mode] && tripToUpdate.places.length > 1) {
        try {
            const route = await fetchRoute(tripToUpdate.places, mode);
            const updatedTrip = { ...tripToUpdate, routeInfo: { ...tripToUpdate.routeInfo, [mode]: route || undefined } };
            
            // Save to backend
            await tripsService.updateTrip(tripToUpdate.id, {
                name: tripToUpdate.name,
                icon: tripToUpdate.icon,
                places: tripToUpdate.places,
                routeInfo: updatedTrip.routeInfo
            });
            
            // Update local state
            setTripPlans(prev => prev.map(t => t.id === viewingTrip.id ? updatedTrip : t));
            setViewingTrip(updatedTrip);
        } catch (error) {
            console.error('Error updating travel mode:', error);
            addNotification('Failed to update travel mode. Please try again.', 'error');
        }
    }
  }, [viewingTrip, tripPlans, user?.id]);
  
  const handleReorderTripPlaces = useCallback(async (tripId: string, sourceIndex: number, destinationIndex: number) => {
    if (!user?.id) return;
    
    const trip = tripPlans.find(t => t.id === tripId);
    if (!trip) return;

    try {
      const newPlaces = Array.from(trip.places);
      const [removed] = newPlaces.splice(sourceIndex, 1);
      newPlaces.splice(destinationIndex, 0, removed);

      const updatedTrip = { ...trip, places: newPlaces, routeInfo: {} };
      
      if (newPlaces.length > 1) {
          const newRoute = await fetchRoute(newPlaces, activeTravelMode);
          updatedTrip.routeInfo = { [activeTravelMode]: newRoute || undefined };
      }
      
      // Save to backend
      await tripsService.updateTrip(tripId, {
        name: trip.name,
        icon: trip.icon,
        places: newPlaces,
        routeInfo: updatedTrip.routeInfo
      });
      
      // Update local state
      setTripPlans(prev => prev.map(t => t.id === tripId ? updatedTrip : t));
      setViewingTrip(updatedTrip);
    } catch (error) {
      console.error('Error reordering trip places:', error);
      addNotification('Failed to reorder trip places. Please try again.', 'error');
    }
  }, [tripPlans, activeTravelMode, user?.id]);



  // Check if we're on the verification page (token in URL) - render full screen without header/sidebar
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('token')) {
    return <EmailVerificationPage />;
  }

  const renderPage = () => {
    
    if (viewingTrip) {
        return (
          <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
              <TripSidebar
                  trip={viewingTrip}
                  onReorder={handleReorderTripPlaces}
                  onBack={() => setViewingTrip(null)}
                  onRemovePlace={handleRemovePlaceFromTrip}
                  onHoverPlace={setHoveredTripPlaceId}
                  activeTravelMode={activeTravelMode}
                  onTravelModeChange={handleTravelModeChange}
              />
              <div className="flex-1 min-h-0 h-full lg:h-full bg-white rounded-xl shadow-lg overflow-hidden">
                  <MapComponent flyToLocation={null} onMapMove={()=>{}} userLocation={null} places={[]} busStopsAndTerminals={[]} onMarkerClick={()=>{}} selectedPlace={null} hoveredPlaceId={null} onPlaceHover={()=>{}} viewingTrip={viewingTrip} hoveredTripPlaceId={hoveredTripPlaceId} activeTravelMode={activeTravelMode} onToggleLocationTracking={()=>{}} isLocationTrackingEnabled={false} manualPinLocation={null} onMapLongPress={()=>{}} onRemovePin={()=>{}} isSidebarOpen={isSidebarOpen} selectedBusRoute={selectedBusRoute} mapCenter={mapCenter} isSmallScreen={isSmallScreen} theme={theme} />
              </div>
          </main>
        );
    }
    
    if (currentPage === 'app') {
        const busStopsAndTerminals = allPlaces.filter(p => p.category === PlaceCategory.BUS_STOP || p.category === PlaceCategory.BUS_TERMINUS);
        return (
            <div className="flex-1 h-full">
              <div className="w-full h-full lg:rounded-l-xl overflow-hidden">
                <MapComponent 
                  flyToLocation={flyToLocation} 
                  flyToFromEventsOrExcursions={flyToFromEventsOrExcursions}
                  onMapMove={handleMapMove}
                  onMapBoundsChange={handleMapBoundsChange}
                  userLocation={userLocation} 
                  places={filteredPlaces} 
                  onMarkerClick={handlePlaceSelect} 
                  onClusterClick={handleClusterClick}
                  selectedPlace={selectedPlace} 
                  hoveredPlaceId={hoveredPlaceId} 
                  onPlaceHover={handlePlaceHover} 
                  viewingTrip={null} 
                  hoveredTripPlaceId={null} 
                  onToggleLocationTracking={toggleLocationTracking} 
                  isLocationTrackingEnabled={isLocationTrackingEnabled} 
                  manualPinLocation={manualPinLocation} 
                  onMapLongPress={handleManualPinDrop} 
                  onRemovePin={handleRemovePin}
                  isSidebarOpen={isSidebarOpen}
                  selectedBusRoute={selectedBusRoute}
                  mapCenter={mapCenter}
                  selectedGroupedBusStop={selectedGroupedBusStop}
                  selectedCategories={selectedCategories}
                  tourRoutes={tourRoutes}
                  selectedTour={selectedTour}
                  hikingTrails={hikingTrails}
                  allBusStops={busStopsAndTerminals}
                  searchRadius={searchRadius}
                  onGoModeChange={setIsGoModeActive}
                  selectedBusRouteCoordinates={selectedBusRouteCoordinates}
                  isSmallScreen={isSmallScreen}
                  showWaves={showWaves}
                  onToggleWaves={toggleWaves}
                  theme={theme}
                />
              </div>
            </div>
        );
    }

    if (currentPage === 'trips') {
        return <TripPlannerPage tripPlans={tripPlans} onCreateTrip={() => { setEditingTrip(null); setIsCreateTripModalOpen(true); }} onSelectPlace={handleSelectPlaceFromTrip} onViewOnMap={handleViewTripOnMap} onEditTrip={(trip) => { setEditingTrip(trip); setIsCreateTripModalOpen(true); }} onDeleteTrip={handleDeleteTrip} />;
    }
    
    if (currentPage === 'events') {
      return <EventsPage onShowOnMap={handleShowItemOnMap} />;
    }

    if (currentPage === 'excursions') {
      return <ExcursionsPage 
        onTourSelect={(tour) => {
          setSelectedTourForBooking(tour);
          setCurrentPage('tour-detail');
        }} 
        onMyTickets={() => setCurrentPage('my-tickets')}
        onShowOnMap={(tour) => {
          // Use the first coordinate from the tour's coordinates array
          // Tour coordinates are in [lat, lng] format based on fetchAllTourRoutes
          if (tour.coordinates && tour.coordinates.length > 0) {
            const [lat, lng] = tour.coordinates[0];
            const tourLocation: Coordinates = { lat, lng };
            
            // Convert tour to Place format for map display with full route data
            // Convert points to the format expected by MapComponent (with lat/lng and type)
            const convertedPoints = (tour.points || []).map((point: any) => ({
              ...point,
              lat: point.coordinates ? point.coordinates[0] : point.lat,
              lng: point.coordinates ? point.coordinates[1] : point.lng,
              type: point.type || 'stop' // Ensure points are marked as stops
            }));
            
            const tourAsPlace: Place = {
              id: `tour-${tour.id}`,
              name: tour.name,
              category: PlaceCategory.TOURS,
              coordinates: tourLocation,
              routeCoordinates: tour.coordinates ? tour.coordinates.map((coord: [number, number]) => ({ lat: coord[0], lng: coord[1] })) : [],
              shortDescription: tour.description || '',
              description: tour.description || '',
              imageUrl: tour.mainImage || (tour.images && tour.images[0]) || undefined,
              galleryImages: tour.images?.map(img => img.startsWith('/uploads/') ? `${API_BASE}${img}` : img) || [],
              icon: tour.icon ? (tour.icon.startsWith('/uploads/') ? `${API_BASE}${tour.icon}` : tour.icon) : '/tours.svg',
              iconSize: tour.iconSize || 32,
              polylineColor: tour.polylineColor || '#8A2BE2',
              points: convertedPoints,
              type: 'tour'
            };
            
            // Store the previous page before navigating to map view
            // Always update to the current page, so it reflects the most recent page the user was on
            // IMPORTANT: Check currentPage BEFORE changing it to 'app'
            const pageBeforeMap = currentPage;
            console.log('[Navigation] Tour handler - currentPage:', pageBeforeMap, 'previousPageBeforeMapView before:', previousPageBeforeMapView);
            if (pageBeforeMap === 'events' || pageBeforeMap === 'excursions') {
              console.log('[Navigation] Setting previousPageBeforeMapView to:', pageBeforeMap, '(overwriting previous value:', previousPageBeforeMapView, ')');
              justCameFromShowOnMap.current = true; // Set flag to prevent clearing
              // Always set to the current page, overwriting any previous value
              setPreviousPageBeforeMapView(pageBeforeMap);
              setFlyToFromEventsOrExcursions(true);
            } else {
              // If we're not on events/excursions, clear it to avoid confusion
              console.log('[Navigation] Not on events/excursions, clearing previousPageBeforeMapView');
              setPreviousPageBeforeMapView(null);
            }
            
            // Close bottom sheet but keep sidebar open on large screens to show tour details
            setCurrentPage('app');
            setFlyToLocation(tourLocation);
            setIsFocusModeActive(true);
            
            // Select the tour to show it on the map with full route
            setTimeout(() => {
              setSelectedTour(tourAsPlace);
              // Clear suppress flag so bottom sheet can open on small screens
              setSuppressNextDetailOpen(false);
              // Open sidebar on large screens to show tour details with close button
              if (window.innerWidth >= 1024) {
                setIsSidebarOpen(true);
              }
            }, 100);
          }
        }}
      />;
    }
    
    if (currentPage === 'tour-detail') {
      return <TourDetailPage 
        tour={selectedTourForBooking} 
        onBack={() => setCurrentPage('excursions')}
        onBookingComplete={(booking) => {
          setBookingData(booking);
          setCurrentPage('checkout');
        }}
      />;
    }
    
    if (currentPage === 'checkout') {
      return <CheckoutPage 
        booking={bookingData}
        tour={selectedTourForBooking}
        onBack={() => setCurrentPage('tour-detail')}
        onComplete={() => setCurrentPage('excursions')}
        onMyTickets={() => setCurrentPage('my-tickets')}
      />;
    }
    if (currentPage === 'my-tickets') {
        return <MyTicketsPage 
            onBack={() => setCurrentPage('excursions')}
        />;
    }
    
    if (currentPage === 'business') {
        return <ForBusinessesPage onPageChange={setCurrentPage} />;
    }

    return null;
  }

  return (
    <div className="h-screen flex flex-col font-sans bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]" style={{
        // Define CSS variables for theming
        '--bg-light': theme === 'dark' ? '23 23 23' : '248 250 252',
        '--bg-primary': theme === 'dark' ? '23 23 23' : '255 255 255',
        '--card-bg': theme === 'dark' ? '39 39 42' : '255 255 255',
        '--text-primary': theme === 'dark' ? '255 255 255' : '51 65 85',
        '--text-secondary': theme === 'dark' ? '156 163 175' : '100 116 139',
        '--border-color': theme === 'dark' ? '63 63 70' : '226 232 240',
        '--input-bg': theme === 'dark' ? '55 55 55' : '248 250 252',
        '--bg-hover': theme === 'dark' ? '55 55 55' : '241 245 249',
      } as React.CSSProperties}>
        <Header 
          onLoginClick={() => setIsLoginModalOpen(true)} 
          onPageChange={(page) => {setCurrentPage(page); setViewingTrip(null);}}
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          currentPage={currentPage}
        />
        <NotificationContainer notifications={notifications} onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} />
        
        <div className="flex-1 flex flex-row overflow-hidden">
            <SidebarMenu 
              isOpen={isSidebarOpen}
              onClose={toggleSidebar}
              onPageChange={(page) => {
                setCurrentPage(page);
                setIsSidebarOpen(false);
              }}
              theme={theme}
              onThemeToggle={handleThemeToggle}
              currentPage={currentPage}
              isControlsCollapsed={isControlsCollapsed}
              onToggleControls={(shouldCollapse?: boolean) => setIsControlsCollapsed(prev => typeof shouldCollapse === 'boolean' ? shouldCollapse : !prev)}
              
              // Pass all the props for controls and lists
              allPlaces={combinedItems}
              allEvents={allEvents}
              tourRoutes={tourRoutes}
              filteredPlaces={filteredPlaces}
              selectedPlace={selectedPlace}
              isLoadingPlaces={isLoadingPlaces}
              hasSearched={hasSearched}
              searchCenter={searchCenter}
              selectedCategories={selectedCategories}
              searchRadius={searchRadius}
              isLoadingAiDescription={isLoadingAiDescription}
              isLoadingImage={isLoadingImage}
              aiError={aiError}
              
              onCategoryChange={handleCategoryChange}
              onRadiusChange={handleRadiusChange}
              onPlaceClick={handlePlaceSelect}
              onLocationFound={handleManualLocationSelect}
              onSuggestionSelect={handleSuggestionSelect}
              onGenerateDescription={handleGenerateDescription}
              onSendMessage={handleSendMessage}
              onClosePlaceDetail={() => {
                // If closing a bus stop or bus route, restore original categories
                if (selectedPlace && (selectedPlace.category === PlaceCategory.BUS_STOP || 
                    selectedPlace.category === PlaceCategory.BUS_TERMINUS ||
                    selectedPlace.category === PlaceCategory.BUS_ROUTE)) {
                  console.log('Closing bus stop/route, restoring original categories:', originalCategoriesRef.current);
                  
                  if (originalCategoriesRef.current.length > 0) {
                    // Restore to what was there before
                    setSelectedCategories([...originalCategoriesRef.current]);
                  } else {
                    // If no original categories, just remove bus categories
                    setSelectedCategories(prev => prev.filter(cat => 
                      cat !== PlaceCategory.BUS_STOP && 
                      cat !== PlaceCategory.BUS_TERMINUS && 
                      cat !== PlaceCategory.BUS_ROUTE
                    ));
                  }
                  handleBusRouteChange(null); // Clear the route polyline
                }
                
                // Just close - don't navigate (X button behavior)
                setSelectedPlace(null);
                setSelectedGroupedBusStop(null);
                setIsFocusModeActive(false);
                handleBusRouteChange(null); // Clear bus route polyline
                // No need to clear hiking trail - unified system handles this
                setSelectedTour(null); // Clear selected tour
          
                setIsControlsCollapsed(false);
                setIsPlacesListCollapsed(false);
              }}
              onOpenGallery={handleOpenGallery}
              onEditPlace={(place) => { setEditingPlace(place); setIsEditModalOpen(true); }}
              onAddToTrip={handleAddToTripClick}
              selectedBusRoute={selectedBusRoute}
              onBusRouteChange={handleBusRouteChange}
              selectedClusterStops={selectedClusterStops.map(stop => ({ ...stop, routeId: busStopToRouteMap.get(stop.id) }))}
              selectedGroupedBusStop={selectedGroupedBusStop}
              isPlacesListCollapsed={isPlacesListCollapsed}
              onTogglePlacesList={(shouldCollapse?: boolean) => setIsPlacesListCollapsed(prev => typeof shouldCollapse === 'boolean' ? shouldCollapse : !prev)}
              isGoModeActive={isGoModeActive}
    
              
              // Note: onShowTrailOnMap removed - hiking trails now use unified tour system
              selectedTour={selectedTour}
              onCloseTour={handleCloseTour}
              onLoginClick={() => setIsLoginModalOpen(true)}
              isSmallScreen={isSmallScreen}
            />
            <main className={`flex-1 flex flex-col ${viewingTrip ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {renderPage()}
            </main>
        </div>
      
      {/* Modals */}
      <ImageGalleryModal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} images={selectedPlace?.galleryImages || []} placeName={selectedPlace?.name || ''}/>
      {isLoginModalOpen && <LoginPage onClose={() => setIsLoginModalOpen(false)} />}
      {isEditModalOpen && editingPlace && <EditPlaceModal place={editingPlace} onSave={handleSavePlace} onClose={() => setIsEditModalOpen(false)} />}
      {isCreateTripModalOpen && <CreateTripModal onClose={() => {setIsCreateTripModalOpen(false); setEditingTrip(null);}} onSave={handleSaveTrip} tripToEdit={editingTrip} />}
      {isAddToTripModalOpen && <AddToTripModal isOpen={isAddToTripModalOpen} onClose={() => setIsAddToTripModalOpen(false)} tripPlans={tripPlans} onSelectTrip={(tripId) => handleAddPlaceToTrip(tripId)} />}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedPlace={selectedPlace}
        filteredPlaces={filteredPlaces}
        isLoadingPlaces={isLoadingPlaces}
        hasSearched={hasSearched}
        searchCenter={searchCenter}
        isLoadingAiDescription={isLoadingAiDescription}
        isLoadingImage={isLoadingImage}
        aiError={aiError}
        onPlaceClick={handlePlaceSelect}
        onGenerateDescription={handleGenerateDescription}
        onSendMessage={handleSendMessage}
        onClosePlaceDetail={() => {
          // If closing a bus stop or bus route, restore original categories
          if (selectedPlace && (selectedPlace.category === PlaceCategory.BUS_STOP || 
              selectedPlace.category === PlaceCategory.BUS_TERMINUS ||
              selectedPlace.category === PlaceCategory.BUS_ROUTE)) {
            console.log('Closing bus stop/route, restoring original categories:', originalCategoriesRef.current);
            
            if (originalCategoriesRef.current.length > 0) {
              // Restore to what was there before
              setSelectedCategories([...originalCategoriesRef.current]);
            } else {
              // If no original categories, just remove bus categories
              setSelectedCategories(prev => prev.filter(cat => 
                cat !== PlaceCategory.BUS_STOP && 
                cat !== PlaceCategory.BUS_TERMINUS && 
                cat !== PlaceCategory.BUS_ROUTE
              ));
            }
            handleBusRouteChange(null); // Clear the route polyline
          }
          
          // Just close - don't navigate (X button behavior)
          setSelectedPlace(null);
          setSelectedGroupedBusStop(null);
          setIsFocusModeActive(false);
          handleBusRouteChange(null); // Clear bus route polyline
          setSelectedTour(null); // Clear selected tour
          
          // Uncollapse controls and places list to match large screen behavior
          setIsControlsCollapsed(false);
          setIsPlacesListCollapsed(false);
          
          // Close bottom sheet since we're clearing all selections
          setIsBottomSheetOpen(false);
        }}
        onCloseTour={() => {
          // Just close - don't navigate (X button behavior)
          setSelectedTour(null);
          // Close bottom sheet when tour is closed
          setIsBottomSheetOpen(false);
        }}
        onBack={() => {
          // Navigate back to previous page if we came from events/excursions
          const pageToGoBackTo = previousPageBeforeMapView;
          console.log('[Navigation] Back button clicked, going back to:', pageToGoBackTo, 'current previousPageBeforeMapView:', previousPageBeforeMapView);
          if (pageToGoBackTo) {
            // Clear previousPageBeforeMapView FIRST before navigating
            // This prevents stale values from persisting
            setPreviousPageBeforeMapView(null);
            setCurrentPage(pageToGoBackTo);
          }
          // Clear selections
          setSelectedPlace(null);
          setSelectedTour(null);
          setSelectedGroupedBusStop(null);
          setIsFocusModeActive(false);
          handleBusRouteChange(null);
          setIsControlsCollapsed(false);
          setIsPlacesListCollapsed(false);
          setIsBottomSheetOpen(false);
        }}
        showBackButton={(() => {
          const shouldShow = !!previousPageBeforeMapView && !!(selectedPlace || selectedTour) && currentPage === 'app';
          console.log('[Navigation] showBackButton check:', {
            previousPageBeforeMapView,
            hasSelectedPlace: !!selectedPlace,
            hasSelectedTour: !!selectedTour,
            currentPage,
            shouldShow
          });
          return shouldShow;
        })()}
        onOpenGallery={handleOpenGallery}
        onCloseGallery={() => setIsGalleryOpen(false)}
        isGalleryOpen={isGalleryOpen}
        onEditPlace={(place) => { setEditingPlace(place); setIsEditModalOpen(true); }}
        onAddToTrip={handleAddToTripClick}
        onPageChange={(page) => {setCurrentPage(page); setViewingTrip(null);}}
        selectedGroupedBusStop={selectedGroupedBusStop}
        selectedTour={selectedTour}
        isSmallScreen={isSmallScreen}
        onLoginClick={() => setIsLoginModalOpen(true)}
      />

      {/* Subtle Background Loading Indicator - DISABLED for icons */}
      {/* Icons now load silently with aggressive caching */}

      {/* Icon Loading Indicator - REMOVED: Using HTML loading screen instead */}

      {/* Loading Indicator and Slow Connection Warning Container */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-3">
        {isLoadingPlaces && (
          <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <div>Loading Places....</div>
          </div>
        )}

        {showSlowConnectionWarning && (
          <div className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4">📱</div>
              <div>
                <strong>Slow connection detected</strong><br/>
                Map tiles are loading progressively for better performance
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offline Download Modal */}
      <OfflineDownloadModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        places={allPlaces}
        onDownloadComplete={() => {
          setShowOfflineModal(false);
          addNotification('Offline data downloaded successfully! You can now use the app without internet.', 'success');
        }}
      />

      {/* Location Analytics Consent Dialog */}
      <LocationAnalyticsConsent 
        onConsentGiven={async () => {
          // After user accepts privacy consent, request GPS permission
          console.log('Privacy consent accepted, requesting GPS permission...');
          await requestLocationPermission();
        }}
      />

      {/* Onboarding Flow */}
      <OnboardingFlow
        isOpen={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        theme={theme}
      />
    </div>
  );
};

export default App;