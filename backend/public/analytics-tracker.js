/**
 * Discover Gozo Analytics Tracker
 * Automatically tracks user interactions and sends them to the analytics API
 */

class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.deviceInfo = this.getDeviceInfo();
        this.startTime = new Date().toISOString();
        this.eventQueue = [];
        this.isOnline = navigator.onLine;
        
        this.init();
    }
    
    init() {
        // Track page load
        this.trackEvent('page_load', {
            page: window.location.pathname,
            referrer: document.referrer,
            user_agent: navigator.userAgent
        });
        
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', {});
            } else {
                this.trackEvent('page_visible', {});
            }
        });
        
        // Track before page unload
        window.addEventListener('beforeunload', () => {
            this.trackEvent('page_unload', {
                session_duration: Math.round((Date.now() - new Date(this.startTime).getTime()) / 1000)
            });
            this.flushEvents(); // Send remaining events
        });
        
        // Track online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.flushEvents();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // Periodically flush events
        setInterval(() => {
            this.flushEvents();
        }, 10000); // Every 10 seconds
    }
    
    generateSessionId() {
        // Check if session already exists in localStorage
        let sessionId = localStorage.getItem('gozo_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gozo_session_id', sessionId);
        }
        return sessionId;
    }
    
    getUserId() {
        // Try to get user ID from various sources
        return localStorage.getItem('user_id') || 
               sessionStorage.getItem('user_id') || 
               null;
    }
    
    getDeviceInfo() {
        return {
            device_type: this.getDeviceType(),
            browser: this.getBrowser(),
            os: this.getOS(),
            screen_resolution: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    getDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
            return 'mobile';
        } else if (/tablet|ipad/i.test(userAgent)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }
    
    getBrowser() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Unknown';
    }
    
    getOS() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac')) return 'macOS';
        if (userAgent.includes('Linux')) return 'Linux';
        if (userAgent.includes('Android')) return 'Android';
        if (userAgent.includes('iOS')) return 'iOS';
        return 'Unknown';
    }
    
    trackEvent(eventType, eventData) {
        const event = {
            event_type: eventType,
            event_data: {
                ...eventData,
                timestamp: new Date().toISOString(),
                page: window.location.pathname,
                url: window.location.href
            },
            session_id: this.sessionId,
            user_id: this.userId,
            timestamp: new Date().toISOString()
        };
        
        this.eventQueue.push(event);
        
        // If online, try to send immediately
        if (this.isOnline) {
            this.sendEvent(event);
        }
    }
    
    async sendEvent(event) {
        try {
            const response = await fetch('/api/analytics/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event)
            });
            
            if (!response.ok) {
                throw new Error('Failed to send analytics event');
            }
        } catch (error) {
            console.warn('Analytics tracking failed:', error);
            // Event will be retried later
        }
    }
    
    async flushEvents() {
        if (!this.isOnline || this.eventQueue.length === 0) {
            return;
        }
        
        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];
        
        for (const event of eventsToSend) {
            await this.sendEvent(event);
        }
    }
    
    // Specific tracking methods for common events
    trackPageView(pageName) {
        this.trackEvent('page_view', {
            page_name: pageName,
            page: window.location.pathname
        });
    }
    
    trackPlaceView(placeId, placeName, category, latitude, longitude) {
        this.trackEvent('view_place', {
            place_id: placeId,
            place_name: placeName,
            category: category,
            latitude: latitude,
            longitude: longitude
        });
    }
    
    trackSearch(query, resultsCount) {
        this.trackEvent('search_query', {
            query: query,
            results_count: resultsCount
        });
    }
    
    trackTripCreation(tripName, placesCount) {
        this.trackEvent('create_trip', {
            trip_name: tripName,
            places_count: placesCount
        });
    }
    
    trackPlaceBookmark(placeId, placeName, action) {
        this.trackEvent('bookmark_place', {
            place_id: placeId,
            place_name: placeName,
            action: action // 'add' or 'remove'
        });
    }
    
    trackAddToTrip(placeId, placeName, tripName) {
        this.trackEvent('add_to_trip', {
            place_id: placeId,
            place_name: placeName,
            trip_name: tripName
        });
    }
    
    trackButtonClick(buttonName, context) {
        this.trackEvent('button_click', {
            button_name: buttonName,
            context: context
        });
    }
    
    trackMapInteraction(interactionType, data) {
        this.trackEvent('map_interaction', {
            interaction_type: interactionType,
            ...data
        });
    }
    
    trackError(errorMessage, errorContext) {
        this.trackEvent('error', {
            error_message: errorMessage,
            error_context: errorContext,
            page: window.location.pathname
        });
    }
    
    // Update user ID when user logs in
    setUserId(userId) {
        this.userId = userId;
        localStorage.setItem('user_id', userId);
    }
    
    // Clear user ID when user logs out
    clearUserId() {
        this.userId = null;
        localStorage.removeItem('user_id');
    }
}

// Initialize global analytics tracker
window.analytics = new AnalyticsTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsTracker;
}
