
import { Coordinates } from '../types';
import { APP_TITLE } from '../constants';

export const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
};

export const watchUserPosition = (
  successCallback: (position: GeolocationPosition) => void,
  errorCallback: (error: GeolocationPositionError) => void
): number | null => {
  if (!navigator.geolocation) {
    errorCallback({
      code: 0, // Placeholder for custom error
      message: "Geolocation is not supported by this browser.",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    } as GeolocationPositionError);
    return null;
  }
  return navigator.geolocation.watchPosition(successCallback, errorCallback, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
};

export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLng = deg2rad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1.lat)) * Math.cos(deg2rad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

export const geocodeLocation = async (query: string): Promise<Coordinates> => {
    // Try multiple search variations to handle Maltese characters and improve results
    const searchVariations = [
        query, // Original query
        query.replace(/[ġĠ]/g, 'g').replace(/[ħĤ]/g, 'h').replace(/[ċĊ]/g, 'c').replace(/[żŻ]/g, 'z'), // Normalized Maltese characters
        query.replace(/[-–—]/g, ' ').trim(), // Remove dashes
        query + ', Malta', // Add Malta context
        query + ', Gozo, Malta' // Add Gozo context for better results
    ];

    // Remove duplicates and empty strings
    const uniqueVariations = [...new Set(searchVariations)].filter(v => v.trim().length > 0);

    for (const searchQuery of uniqueVariations) {
        try {
            // Restrict search to Malta with geographic bounds and country filtering
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=mt&viewbox=14.0,36.0,14.5,36.1&bounded=1`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': `${APP_TITLE}/1.0`
                }
            });

            if (!response.ok) {
                continue; // Try next variation
            }

            const data = await response.json();
            if (data && data.length > 0) {
                // Filter results to ensure they're actually in Malta
                const maltaResults = data.filter((result: any) => {
                    // Check if the result has country information and it's Malta
                    if (result.address && result.address.country) {
                        return result.address.country.toLowerCase().includes('malta');
                    }
                    // If no country info, check if coordinates are within Malta bounds
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);
                    return lat >= 36.0 && lat <= 36.1 && lng >= 14.0 && lng <= 14.5;
                });

                if (maltaResults.length > 0) {
                    const lat = parseFloat(maltaResults[0].lat);
                    const lng = parseFloat(maltaResults[0].lon);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        console.log(`Found location for "${query}" using variation "${searchQuery}"`);
                        return { lat, lng };
                    }
                }
            }
        } catch (error) {
            console.warn(`Geocoding failed for variation "${searchQuery}":`, error);
            continue; // Try next variation
        }
    }

    // If all variations failed, throw an error
    throw new Error(`No locations found in Malta for "${query}". Please try a more specific search or select from the suggestions.`);
};