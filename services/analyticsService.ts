import { getApiBaseUrl } from './config';
import { hasLocationAnalyticsConsent } from './consentManager';
const API_BASE_URL = getApiBaseUrl();

// Optional: Import auth context to get authenticated user ID
// This will be set dynamically to avoid circular dependencies
let getAuthenticatedUserId: (() => string | null) | null = null;

// Set the function to get authenticated user ID (called from App.tsx)
export const setAuthenticatedUserIdGetter = (getter: () => string | null) => {
  getAuthenticatedUserId = getter;
};

// Fallback analytics storage in localStorage
const ANALYTICS_STORAGE_KEY = 'discover_gozo_analytics';
const USER_VISIT_HISTORY_KEY = 'discover_gozo_visit_history';

interface AnalyticsEvent {
  event_type: string;
  event_data: object;
  timestamp: number;
  session_id: string;
}

interface DeviceInfo {
  device_type: string;
  browser: string;
  os: string;
  screen_resolution: string;
  viewport: string;
  language: string;
  timezone: string;
}

interface VisitHistory {
  first_visit: string;
  last_visit: string;
  visit_count: number;
  user_id: string | null;
}

// Generate a unique session ID for this user session
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('discover_gozo_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('discover_gozo_session_id', sessionId);
  }
  return sessionId;
};

// Get or create user ID (for return visitor tracking)
// Priority: 1) Authenticated user ID, 2) Browser-based persistent ID
const getUserId = (): string => {
  // First, try to get authenticated user ID if available
  if (getAuthenticatedUserId) {
    const authUserId = getAuthenticatedUserId();
    if (authUserId) {
      // Store authenticated user ID for this session
      sessionStorage.setItem('analytics_auth_user_id', authUserId);
      return authUserId;
    }
  }
  
  // Fall back to browser-based persistent ID for anonymous users
  let userId = localStorage.getItem('discover_gozo_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('discover_gozo_user_id', userId);
  }
  return userId;
};

// Track visit history for return visitor identification
const updateVisitHistory = (): VisitHistory => {
  const now = new Date().toISOString();
  const userId = getUserId();
  
  let history: VisitHistory = {
    first_visit: now,
    last_visit: now,
    visit_count: 1,
    user_id: userId
  };
  
  try {
    const stored = localStorage.getItem(USER_VISIT_HISTORY_KEY);
    if (stored) {
      history = JSON.parse(stored);
      history.last_visit = now;
      history.visit_count = (history.visit_count || 0) + 1;
      history.user_id = userId;
    }
  } catch (e) {
    console.warn('Failed to parse visit history:', e);
  }
  
  localStorage.setItem(USER_VISIT_HISTORY_KEY, JSON.stringify(history));
  return history;
};

// Get device information
const getDeviceInfo = (): DeviceInfo => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Device type
  let deviceType = 'desktop';
  if (/mobile|android|iphone|phone/i.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'tablet';
  }
  
  // Browser
  let browser = 'Unknown';
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    browser = 'Opera';
  }
  
  // OS
  let os = 'Unknown';
  if (userAgent.includes('windows')) {
    os = 'Windows';
  } else if (userAgent.includes('mac')) {
    os = 'macOS';
  } else if (userAgent.includes('linux')) {
    os = 'Linux';
  } else if (userAgent.includes('android')) {
    os = 'Android';
  } else if (userAgent.includes('ios') || /iphone|ipad|ipod/.test(userAgent)) {
    os = 'iOS';
  }
  
  return {
    device_type: deviceType,
    browser: browser,
    os: os,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
};

// Track page view time
let pageViewStartTime: number = Date.now();
let currentPagePath: string = window.location.pathname;

// Initialize session tracking
let sessionStartTime: number = Date.now();
let sessionInitialized = false;

const initializeSession = async () => {
  if (sessionInitialized) return;
  
  sessionStartTime = Date.now();
  const sessionId = getSessionId();
  const userId = getUserId();
  const deviceInfo = getDeviceInfo();
  const visitHistory = updateVisitHistory();
  
  // Track session start
  try {
    await fetch(`${API_BASE_URL}/api/analytics/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        device_info: deviceInfo,
        location_info: {}, // Will be populated if geolocation is available
        start_time: new Date().toISOString(),
        is_return_visitor: visitHistory.visit_count > 1,
        visit_count: visitHistory.visit_count
      })
    });
    sessionInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize session tracking:', error);
  }
  
  // Track page view
  trackPageView(window.location.pathname);
  
  // Track session end on page unload
  window.addEventListener('beforeunload', () => {
    const duration = Math.round((Date.now() - sessionStartTime) / 1000);
    navigator.sendBeacon(`${API_BASE_URL}/api/analytics/session`, JSON.stringify({
      session_id: sessionId,
      user_id: userId,
      device_info: deviceInfo,
      end_time: new Date().toISOString(),
      duration: duration
    }));
  });
};

// Track page view with time-on-page
export const trackPageView = async (pagePath: string) => {
  const now = Date.now();
  const timeOnPreviousPage = currentPagePath !== pagePath ? 
    Math.round((now - pageViewStartTime) / 1000) : 0;
  
  if (timeOnPreviousPage > 0 && currentPagePath !== pagePath) {
    // Track time spent on previous page
    await logAnalyticsEvent('page_time', {
      page: currentPagePath,
      time_spent_seconds: timeOnPreviousPage
    });
  }
  
  currentPagePath = pagePath;
  pageViewStartTime = now;
  
  await logAnalyticsEvent('page_view', {
    page: pagePath,
    referrer: document.referrer,
    timestamp: new Date().toISOString()
  });
};

// Initialize on module load
if (typeof window !== 'undefined') {
  initializeSession();
  
  // Track route changes (for SPA)
  let lastPath = window.location.pathname;
  const checkRouteChange = () => {
    if (window.location.pathname !== lastPath) {
      trackPageView(window.location.pathname);
      lastPath = window.location.pathname;
    }
  };
  
  // Check for route changes periodically
  setInterval(checkRouteChange, 1000);
  
  // Also listen to popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    trackPageView(window.location.pathname);
  });
}

// Store analytics event locally as fallback
const storeAnalyticsLocally = (eventType: string, eventData: object) => {
  try {
    const event: AnalyticsEvent = {
      event_type: eventType,
      event_data: eventData,
      timestamp: Date.now(),
      session_id: getSessionId()
    };

    const existingEvents = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) || '[]');
    existingEvents.push(event);
    
    // Keep only last 1000 events to prevent localStorage from getting too large
    if (existingEvents.length > 1000) {
      existingEvents.splice(0, existingEvents.length - 1000);
    }
    
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(existingEvents));
  } catch (error) {
    console.warn('Failed to store analytics locally:', error);
  }
};

// Get all stored analytics events
export const getStoredAnalytics = (): AnalyticsEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) || '[]');
  } catch (error) {
    console.warn('Failed to retrieve stored analytics:', error);
    return [];
  }
};

// Clear stored analytics
export const clearStoredAnalytics = (): void => {
  localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  localStorage.removeItem('discover_gozo_session_id');
};

// Track tour view on excursions page
export const trackTourView = async (tourId: string, tourName: string, category?: string) => {
  await logAnalyticsEvent('view_tour', {
    tour_id: tourId,
    tour_name: tourName,
    category: category || null,
    page: 'excursions'
  });
};

// Track tour detail view
export const trackTourDetailView = async (tourId: string, tourName: string, category?: string) => {
  await logAnalyticsEvent('view_tour_detail', {
    tour_id: tourId,
    tour_name: tourName,
    category: category || null,
    page: 'tour_detail'
  });
};

// Track checkout start
export const trackCheckoutStart = async (tourId: string, tourName: string, quantity: number, totalPrice: number) => {
  await logAnalyticsEvent('start_checkout', {
    tour_id: tourId,
    tour_name: tourName,
    quantity: quantity,
    total_price: totalPrice,
    checkout_started_at: new Date().toISOString(),
    page: 'checkout'
  });
};

// Track booking completion
export const trackBookingComplete = async (tourId: string, tourName: string, reservationId: string, quantity: number, totalPrice: number) => {
  await logAnalyticsEvent('complete_booking', {
    tour_id: tourId,
    tour_name: tourName,
    reservation_id: reservationId,
    quantity: quantity,
    total_price: totalPrice,
    page: 'checkout'
  });
};

// Track checkout abandonment
export const trackCheckoutAbandon = async (tourId: string, tourName: string, timeSpent: number) => {
  await logAnalyticsEvent('abandon_checkout', {
    tour_id: tourId,
    tour_name: tourName,
    time_spent_seconds: timeSpent,
    abandoned_at: new Date().toISOString(),
    page: 'checkout'
  });
};

export const logAnalyticsEvent = async (eventType: string, eventData: object) => {
  const sessionId = getSessionId();
  const userId = getUserId();
  const deviceInfo = getDeviceInfo();
  
  // Enhance event data with device info, session, and user info
  const enhancedEventData = {
    ...eventData,
    device_info: deviceInfo,
    session_id: sessionId,
    user_id: userId,
    page: window.location.pathname,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
  
  // Always store locally as backup
  storeAnalyticsLocally(eventType, enhancedEventData);

  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        event_type: eventType, 
        event_data: enhancedEventData,
        session_id: sessionId,
        user_id: userId,
        timestamp: new Date().toISOString()
      }),
    });
    
    if (response.ok) {
      console.log('Analytics event sent successfully:', eventType);
    } else {
      console.warn('Analytics server returned error:', response.status);
    }
  } catch (error) {
    console.warn('Analytics event failed to send to server, stored locally instead:', error);
    // Event is already stored locally, so no data is lost
  }
};

// Track user journey/flow (sequence of actions)
export const trackUserJourney = async (action: string, context?: object) => {
  const journeyStep = {
    action: action,
    context: context || {},
    sequence: getJourneySequence(),
    timestamp: new Date().toISOString()
  };
  
  await logAnalyticsEvent('user_journey', journeyStep);
};

// Get current journey sequence from session storage
const getJourneySequence = (): string[] => {
  try {
    const journey = sessionStorage.getItem('discover_gozo_journey');
    if (journey) {
      return JSON.parse(journey);
    }
  } catch (e) {
    console.warn('Failed to get journey sequence:', e);
  }
  return [];
};

// Add step to journey sequence
const addJourneyStep = (action: string) => {
  try {
    let journey = getJourneySequence();
    journey.push(action);
    // Keep only last 20 steps to prevent storage bloat
    if (journey.length > 20) {
      journey = journey.slice(-20);
    }
    sessionStorage.setItem('discover_gozo_journey', JSON.stringify(journey));
  } catch (e) {
    console.warn('Failed to add journey step:', e);
  }
};

// Track geographic location (user's location, not just places viewed)
// Only tracks if user has given consent
export const trackUserLocation = async (latitude: number, longitude: number, accuracy?: number) => {
  // Check consent before tracking
  if (!hasLocationAnalyticsConsent()) {
    // User hasn't consented, don't track location
    return;
  }
  
  // Reduce precision for privacy (round to ~100m accuracy)
  const roundedLat = Math.round(latitude * 100) / 100;
  const roundedLng = Math.round(longitude * 100) / 100;
  
  await logAnalyticsEvent('user_location', {
    latitude: roundedLat,
    longitude: roundedLng,
    accuracy: accuracy,
    timestamp: new Date().toISOString(),
    precision_reduced: true // Flag that precision was reduced for privacy
  });
};

// Enhanced conversion tracking
export const trackConversion = async (conversionType: string, conversionData: object) => {
  await logAnalyticsEvent('conversion', {
    conversion_type: conversionType,
    ...conversionData,
    timestamp: new Date().toISOString()
  });
  
  // Also track as specific conversion type
  await logAnalyticsEvent(`conversion_${conversionType}`, conversionData);
};

// Track bookmark with enhanced data
export const trackBookmark = async (placeId: string, placeName: string, action: 'add' | 'remove', category?: string) => {
  await logAnalyticsEvent('bookmark_place', {
    place_id: placeId,
    place_name: placeName,
    action: action,
    category: category,
    timestamp: new Date().toISOString()
  });
  
  if (action === 'add') {
    await trackConversion('bookmark', { place_id: placeId, place_name: placeName });
    addJourneyStep('bookmark_add');
  } else {
    addJourneyStep('bookmark_remove');
  }
};

// Track trip creation with enhanced data
export const trackTripCreation = async (tripName: string, placesCount: number, tripId?: string) => {
  await logAnalyticsEvent('create_trip', {
    trip_name: tripName,
    trip_id: tripId,
    places_count: placesCount,
    timestamp: new Date().toISOString()
  });
  
  await trackConversion('trip_creation', { 
    trip_name: tripName, 
    trip_id: tripId,
    places_count: placesCount 
  });
  
  addJourneyStep('trip_create');
};
