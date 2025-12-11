import { Place, Coordinates, TravelMode, RouteInfo } from '../types';
import polyline from '@mapbox/polyline';

const ROUTING_API_URL_BASE = "https://api.openrouteservice.org/v2/directions/";

const isValidCoord = (c: Coordinates | undefined): c is Coordinates => {
    return !!c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng);
}

/**
 * Fetches a route between a series of places for a specific travel mode.
 * This function requires an API key for OpenRouteService to be set in the environment variables.
 * If the key is not available, it will return null, and the app should handle the fallback.
 */
// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (coord1.lat * Math.PI) / 180;
    const lat2Rad = (coord2.lat * Math.PI) / 180;
    const deltaLatRad = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const deltaLngRad = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Calculate estimated duration based on travel mode
const calculateDuration = (distance: number, mode: TravelMode): number => {
    const averageSpeed = mode === 'driving-car' ? 50 : 5; // km/h
    return (distance / 1000) / averageSpeed * 3600; // Duration in seconds
};

export const fetchRoute = async (places: Place[], mode: TravelMode): Promise<RouteInfo | null> => {
    const apiKey = import.meta.env.VITE_OPENROUTESERVICE_API_KEY;

    const validPlaces = places.filter(p => isValidCoord(p.coordinates));
    
    if (validPlaces.length < 2) {
        return null;
    }

    // If no API key, use fallback calculation
    if (!apiKey) {
        console.warn("OpenRouteService API key not found. Using fallback distance calculation.");
        
        // Calculate total distance by summing distances between consecutive places
        let totalDistance = 0;
        for (let i = 0; i < validPlaces.length - 1; i++) {
            totalDistance += calculateDistance(validPlaces[i].coordinates, validPlaces[i + 1].coordinates);
        }
        
        const duration = calculateDuration(totalDistance, mode);
        
        // Generate simple route coordinates (straight lines between places)
        const routeCoordinates: Coordinates[] = [];
        for (let i = 0; i < validPlaces.length - 1; i++) {
            const start = validPlaces[i].coordinates;
            const end = validPlaces[i + 1].coordinates;
            
            // Add start point
            routeCoordinates.push(start);
            
            // Add intermediate points for smoother line
            const steps = 10;
            for (let j = 1; j < steps; j++) {
                const ratio = j / steps;
                routeCoordinates.push({
                    lat: start.lat + (end.lat - start.lat) * ratio,
                    lng: start.lng + (end.lng - start.lng) * ratio
                });
            }
        }
        // Add last point
        routeCoordinates.push(validPlaces[validPlaces.length - 1].coordinates);

        return {
            coordinates: routeCoordinates,
            distance: totalDistance,
            duration: duration
        };
    }

    // Use OpenRouteService API if key is available
    const coordinates = validPlaces.map(p => [p.coordinates.lng, p.coordinates.lat]);
    const apiUrl = `${ROUTING_API_URL_BASE}${mode}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify({ coordinates, radiuses: coordinates.map(() => -1) })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Routing API Error:", JSON.stringify(errorData));
            throw new Error(`Routing service responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        const route = data?.routes?.[0];
        if (route?.geometry && route?.summary) {
            const decodedGeometry = polyline.decode(route.geometry);
            const routeCoordinates: Coordinates[] = decodedGeometry
                .map((coord: number[]) => ({ lat: coord[0], lng: coord[1] }))
                .filter((c: Coordinates) => isValidCoord(c));
            
            const summary = route.summary;

            return {
                coordinates: routeCoordinates,
                distance: summary.distance || 0,
                duration: summary.duration || 0
            };
        } else {
            console.warn(`OpenRouteService did not return a valid route for mode ${mode}.`);
            console.log("OpenRouteService response:", data);
            if (data?.routes?.[0]) {
                console.log("Inspecting route object:", data.routes[0]);
            }
            return null;
        }

    } catch (error) {
        console.error(`Error fetching ${mode} route from OpenRouteService:`, error);
        return null; 
    }
};