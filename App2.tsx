import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth/AuthContext';
import Header from './components/Header';
import SidebarMenu from './components/SidebarMenu';
import MapComponent from './components/MapComponent';
import ForBusinessesPage from './components/ForBusinessesPage';
import TripPlannerPage from './pages/TripPlannerPage';
import EventsPage from './pages/EventsPage';
import ExcursionsPage from './pages/ExcursionsPage';
import ToursPage from './pages/ToursPage';
import TourDetailPage from './pages/TourDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import MyTicketsPage from './pages/MyTicketsPage';
import LoginPage from './components/LoginPage';
import { Place, PlaceCategory, Coordinates, TripPlan, TravelMode, GroupedBusStop, HikingTrail } from './types';
import { CATEGORY_INFO, DEFAULT_INITIAL_COORDS } from './constants';
import { getApiBaseUrl } from './services/config';
import allPlacesData from './backend/places.json';

type Page = 'app' | 'business' | 'trips' | 'events' | 'excursions' | 'tour-detail' | 'checkout' | 'my-tickets';

const App: React.FC = () => {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('app');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isPlacesListCollapsed, setIsPlacesListCollapsed] = useState(false);
  
  // Map and location state
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_INITIAL_COORDS);
  const [flyToLocation, setFlyToLocation] = useState<Coordinates | null>(null);
  const [flyToFromEventsOrExcursions, setFlyToFromEventsOrExcursions] = useState(false);
  const [manualPinLocation, setManualPinLocation] = useState<Coordinates | null>(null);
  const [isLocationTrackingEnabled, setIsLocationTrackingEnabled] = useState(false);
  const [searchCenter, setSearchCenter] = useState<Coordinates | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchRadius, setSearchRadius] = useState(50);
  
  // Places and filtering state
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allEvents, setAllEvents] = useState<Place[]>([]);
  const [tourRoutes, setTourRoutes] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<PlaceCategory[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  
  // Bus route state
  const [selectedBusRoute, setSelectedBusRoute] = useState<string | null>(null);
  const [selectedGroupedBusStop, setSelectedGroupedBusStop] = useState<GroupedBusStop | null>(null);
  const [selectedClusterStops, setSelectedClusterStops] = useState<any[]>([]);
  const [allBusStops, setAllBusStops] = useState<GroupedBusStop[]>([]);
  const [selectedBusRouteCoordinates, setSelectedBusRouteCoordinates] = useState<Coordinates[]>([]);
  
  // Trip planning state
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [viewingTrip, setViewingTrip] = useState<TripPlan | null>(null);
  const [hoveredTripPlaceId, setHoveredTripPlaceId] = useState<string | null>(null);
  const [activeTravelMode, setActiveTravelMode] = useState<TravelMode>('walking');
  
  // Tour state
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [hikingTrails, setHikingTrails] = useState<HikingTrail[]>([]);
  
  // UI state
  const [isLoadingAiDescription, setIsLoadingAiDescription] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showWaves, setShowWaves] = useState(false);
  const [isGoModeActive, setIsGoModeActive] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  
  // Load places data
  useEffect(() => {
    try {
      // Transform places from JSON format (latitude/longitude) to Place format (coordinates: {lat, lng})
      const places = (allPlacesData as any[]).map((place: any) => {
        // If already in correct format, return as is
        if (place.coordinates && place.coordinates.lat !== undefined && place.coordinates.lng !== undefined) {
          return place as Place;
        }
        // Transform from latitude/longitude to coordinates
        if (place.latitude !== undefined && place.longitude !== undefined) {
          return {
            ...place,
            coordinates: { lat: place.latitude, lng: place.longitude },
            shortDescription: place.shortDescription || place.description || '',
          } as Place;
        }
        return null;
      }).filter((p): p is Place => p !== null);
      
      setAllPlaces(places);
      setFilteredPlaces(places);
    } catch (error) {
      console.error('Error loading places:', error);
    }
  }, []);
  
  // Theme management
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  // Screen size management
  useEffect(() => {
    const onResize = () => setIsSmallScreen(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  
  // Handlers
  const handlePageChange = useCallback((page: Page) => {
    setCurrentPage(page);
    if (page !== 'app') {
      setIsSidebarOpen(false);
    }
  }, []);
  
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);
  
  const handleThemeToggle = useCallback(() => {
    document.documentElement.classList.toggle('dark');
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);
  
  const handlePlaceClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    if (place.coordinates && place.coordinates.lat && place.coordinates.lng) {
      setFlyToLocation({ lat: place.coordinates.lat, lng: place.coordinates.lng });
    }
  }, []);
  
  const handleMarkerClick = useCallback((place: Place | GroupedBusStop) => {
    if ('name' in place) {
      handlePlaceClick(place as Place);
    } else {
      setSelectedGroupedBusStop(place);
    }
  }, [handlePlaceClick]);
  
  const handleLocationFound = useCallback((coords: Coordinates) => {
    setSearchCenter(coords);
    setMapCenter(coords);
    setHasSearched(true);
    setFlyToLocation(coords);
  }, []);
  
  const handleMapMove = useCallback((center: Coordinates) => {
    setMapCenter(center);
  }, []);
  
  const handleCategoryChange = useCallback((category: PlaceCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);
  
  const handleRadiusChange = useCallback((radius: number) => {
    setSearchRadius(radius);
  }, []);
  
  const handleShowOnMap = useCallback((item: any) => {
    // Handle both coordinate formats
    if (item.coordinates && item.coordinates.lat && item.coordinates.lng) {
      setFlyToLocation({ lat: item.coordinates.lat, lng: item.coordinates.lng });
      setFlyToFromEventsOrExcursions(true);
      setCurrentPage('app');
    } else if (item.latitude && item.longitude) {
      setFlyToLocation({ lat: item.latitude, lng: item.longitude });
      setFlyToFromEventsOrExcursions(true);
      setCurrentPage('app');
    }
  }, []);
  
  const handleLoginClick = useCallback(() => {
    // Login handled by AuthProvider
  }, []);
  
  // Filter places based on selected categories and search
  useEffect(() => {
    let filtered = allPlaces;
    
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(place => 
        selectedCategories.some(cat => place.category === cat)
      );
    }
    
    if (searchCenter && hasSearched) {
      filtered = filtered.filter(place => {
        if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) return false;
        const distance = getDistance(
          searchCenter.lat,
          searchCenter.lng,
          place.coordinates.lat,
          place.coordinates.lng
        );
        return distance <= searchRadius * 1000; // Convert km to meters
      });
    }
    
    setFilteredPlaces(filtered);
  }, [allPlaces, selectedCategories, searchCenter, hasSearched, searchRadius]);
  
  // Helper function for distance calculation (returns distance in meters)
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // distance in meters
  };
  
  // Render current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'business':
        return <ForBusinessesPage onPageChange={handlePageChange} />;
      case 'trips':
        return (
          <TripPlannerPage
            tripPlans={tripPlans}
            onCreateTrip={() => {}}
            onSelectPlace={handlePlaceClick}
            onViewOnMap={(tripId) => {
              const trip = tripPlans.find(t => t.id === tripId);
              if (trip) setViewingTrip(trip);
            }}
            onEditTrip={() => {}}
            onDeleteTrip={() => {}}
          />
        );
      case 'events':
        return <EventsPage onShowOnMap={handleShowOnMap} />;
      case 'excursions':
        return (
          <ExcursionsPage
            onTourSelect={(tour) => {
              setSelectedTour(tour);
              setCurrentPage('tour-detail');
            }}
            onMyTickets={() => setCurrentPage('my-tickets')}
            onShowOnMap={handleShowOnMap}
          />
        );
      case 'tour-detail':
        return selectedTour ? (
          <TourDetailPage
            tour={selectedTour}
            onBack={() => setCurrentPage('excursions')}
            onBook={() => setCurrentPage('checkout')}
          />
        ) : null;
      case 'checkout':
        return <CheckoutPage onBack={() => setCurrentPage('excursions')} />;
      case 'my-tickets':
        return <MyTicketsPage onBack={() => setCurrentPage('excursions')} />;
      default:
        return null;
    }
  };
  
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <Header
        onLoginClick={handleLoginClick}
        onPageChange={handlePageChange}
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        currentPage={currentPage}
      />
      
      <div className="flex-1 flex relative overflow-hidden">
        {currentPage === 'app' && (
          <>
            <SidebarMenu
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              onPageChange={handlePageChange}
              theme={theme}
              onThemeToggle={handleThemeToggle}
              currentPage={currentPage}
              isControlsCollapsed={isControlsCollapsed}
              onToggleControls={() => setIsControlsCollapsed(prev => !prev)}
              isPlacesListCollapsed={isPlacesListCollapsed}
              onTogglePlacesList={() => setIsPlacesListCollapsed(prev => !prev)}
              allPlaces={allPlaces}
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
              onPlaceClick={handlePlaceClick}
              onLocationFound={handleLocationFound}
              onSuggestionSelect={handlePlaceClick}
              onGenerateDescription={() => {}}
              onSendMessage={() => {}}
              onClosePlaceDetail={() => setSelectedPlace(null)}
              onOpenGallery={() => {}}
              onEditPlace={() => {}}
              onAddToTrip={() => {}}
              selectedBusRoute={selectedBusRoute}
              onBusRouteChange={setSelectedBusRoute}
              selectedClusterStops={selectedClusterStops}
              selectedGroupedBusStop={selectedGroupedBusStop}
              selectedTour={selectedTour}
              onCloseTour={() => setSelectedTour(null)}
              onLoginClick={handleLoginClick}
              isSmallScreen={isSmallScreen}
              isGoModeActive={isGoModeActive}
            />
            
            <div className="flex-1 relative">
              <MapComponent
                flyToLocation={flyToLocation}
                flyToFromEventsOrExcursions={flyToFromEventsOrExcursions}
                userLocation={userLocation}
                places={filteredPlaces}
                onMarkerClick={handleMarkerClick}
                onClusterClick={(stops) => setSelectedClusterStops(stops)}
                selectedPlace={selectedPlace}
                hoveredPlaceId={hoveredPlaceId}
                onPlaceHover={setHoveredPlaceId}
                viewingTrip={viewingTrip}
                hoveredTripPlaceId={hoveredTripPlaceId}
                activeTravelMode={activeTravelMode}
                isLocationTrackingEnabled={isLocationTrackingEnabled}
                onToggleLocationTracking={() => setIsLocationTrackingEnabled(prev => !prev)}
                onMapMove={handleMapMove}
                onMapBoundsChange={() => {}}
                manualPinLocation={manualPinLocation}
                onMapLongPress={(coords) => setManualPinLocation(coords)}
                onRemovePin={() => setManualPinLocation(null)}
                isSidebarOpen={isSidebarOpen}
                selectedBusRoute={selectedBusRoute}
                mapCenter={mapCenter}
                selectedGroupedBusStop={selectedGroupedBusStop}
                selectedCategories={selectedCategories}
                isSmallScreen={isSmallScreen}
                tourRoutes={tourRoutes}
                selectedTour={selectedTour}
                hikingTrails={hikingTrails}
                allBusStops={allBusStops}
                selectedBusRouteCoordinates={selectedBusRouteCoordinates}
                showWaves={showWaves}
                onToggleWaves={() => setShowWaves(prev => !prev)}
                theme={theme}
                searchRadius={searchRadius}
                onGoModeChange={setIsGoModeActive}
              />
            </div>
          </>
        )}
        
        {currentPage !== 'app' && (
          <div className="flex-1 overflow-y-auto">
            {renderCurrentPage()}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

