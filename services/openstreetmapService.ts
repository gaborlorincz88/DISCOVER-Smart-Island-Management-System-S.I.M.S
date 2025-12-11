

import { Coordinates, Place, PlaceCategory } from '../types';

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

/**
 * Maps OSM tags to our app's PlaceCategory.
 * The order of checks is crucial for accuracy. We check for the most specific
 * and high-priority categories first, falling back to more general ones.
 * @param tags The 'tags' object from an OSM element.
 * @returns The corresponding PlaceCategory.
 */
const getCategoryFromTags = (tags: any): PlaceCategory => {
  // --- High Priority & Very Specific Categories ---
  if (tags?.amenity === 'ferry_terminal') return PlaceCategory.FERRY_TERMINAL;
  if (tags?.amenity === 'bus_station' || (tags?.public_transport === 'station' && tags?.bus === 'yes')) return PlaceCategory.BUS_TERMINUS;

  if (tags?.amenity === 'boat_rental' || tags?.office === 'boat_charter' || tags?.tourism === 'boat') return PlaceCategory.BOAT_TOUR;

  if (tags?.natural === 'beach') return PlaceCategory.BEACH;
  if (tags?.amenity === 'toilets') return PlaceCategory.PUBLIC_TOILET;
  if (tags?.sport === 'scuba_diving' || tags?.historic === 'wreck') return PlaceCategory.DIVING;
  
  // --- Man-made Cultural, Historical & Entertainment ---
  // Checked before general nature to correctly categorize things like a castle in a park.
  if (tags?.historic && tags.historic !== 'wreck') return PlaceCategory.HISTORICAL;
  if (tags?.amenity === 'place_of_worship') return PlaceCategory.HISTORICAL;
  if (tags?.tourism && ['museum', 'gallery', 'artwork', 'attraction'].includes(tags.tourism)) return PlaceCategory.ART_CULTURE;
  if (tags?.amenity && ['theatre', 'arts_centre', 'cinema'].includes(tags.amenity)) return PlaceCategory.ART_CULTURE;

  // --- Commercial & Services ---
  if (tags?.amenity && ['restaurant', 'cafe', 'pub', 'bar', 'food_court', 'ice_cream'].includes(tags.amenity)) return PlaceCategory.FOOD_DRINK;
  if (tags?.shop && ['mall', 'department_store'].includes(tags.shop)) return PlaceCategory.SHOPPING;
  if (tags?.amenity === 'marketplace') return PlaceCategory.SHOPPING;

  // --- Natural Features & Viewpoints ---
  // These are often primary destinations.
  if (tags?.tourism === 'viewpoint') return PlaceCategory.LANDSCAPE;
  if (tags?.natural && ['peak', 'cliff', 'ridge', 'rock', 'volcano', 'saddle'].includes(tags.natural)) return PlaceCategory.LANDSCAPE;
  if (tags?.natural && ['waterfall', 'spring', 'cave_entrance', 'geyser'].includes(tags.natural)) return PlaceCategory.NATURE;
  
  // --- General Leisure & Nature Areas ---
  // Lower priority, as they often contain other, more specific points of interest.
  if (tags?.leisure && ['park', 'nature_reserve', 'garden', 'marina', 'playground'].includes(tags.leisure)) return PlaceCategory.NATURE;
  
  // --- Fallback Category ---
  return PlaceCategory.OTHER;
};

/**
 * Safely extracts coordinates from an OSM element (node, or center of way/relation).
 * @param element An OSM element from the Overpass API response.
 * @returns A Coordinates object or null if not available.
 */
const getCoordinatesFromElement = (element: any): Coordinates | null => {
    let latStr: string | number | undefined;
    let lonStr: string | number | undefined;

    if (element.type === 'node') {
        latStr = element.lat;
        lonStr = element.lon;
    }
    // For ways and relations, 'center' provides a representative point.
    else if (element.center) { 
        latStr = element.center.lat;
        lonStr = element.center.lon;
    }

    if (latStr === undefined || lonStr === undefined) {
        return null;
    }

    const lat = parseFloat(String(latStr));
    const lon = parseFloat(String(lonStr));

    if (isNaN(lat) || isNaN(lon)) {
        console.warn('Invalid coordinates found in OSM data:', {latStr, lonStr});
        return null;
    }
    
    return { lat: lat, lng: lon };
}

/**
 * Fetches and processes nearby places from the OpenStreetMap Overpass API.
 * @param coordinates The center point for the search.
 * @param radiusInKm The search radius in kilometers.
 * @returns A promise that resolves to an array of unique Place objects.
 */
export const fetchNearbyPlaces = async (coordinates: Coordinates, radiusInKm: number): Promise<Place[]> => {
  const radiusInMeters = radiusInKm * 1000;

  // This unified query is more efficient. It asks for all relevant tags in one go
  // and lets our TypeScript code handle the categorization.
  // We explicitly filter for elements that have a 'name' tag to reduce noise.
  const query = `
    [out:json][timeout:30];
    (
      // --- New Transport & Tours ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["amenity"~"ferry_terminal|bus_station"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["public_transport"="station"]["bus"="yes"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["amenity"~"boat_rental"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["tourism"~"boat"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["office"~"boat_charter"][name];
      
      // --- Natural Features & Landscapes ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["natural"~"beach|peak|cliff|ridge|rock|waterfall|spring|cave_entrance|volcano"][name];
      
      // --- Leisure & Recreation ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["leisure"~"park|nature_reserve|garden|playground|marina"][name];
      
      // --- Tourism & Culture ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["tourism"~"museum|gallery|artwork|attraction|viewpoint"][name];
      
      // --- Historical & Worship ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["historic"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["amenity"~"place_of_worship"][name];

      // --- Food, Drink & Shopping ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["amenity"~"restaurant|cafe|pub|bar|food_court|ice_cream|marketplace|theatre|arts_centre|cinema"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["shop"~"mall|department_store"][name];
      
      // --- Specific Amenities & Sports ---
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["amenity"~"toilets"][name];
      nwr(around:${radiusInMeters},${coordinates.lat},${coordinates.lng})["sport"~"scuba_diving"][name];
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error("Overpass API request failed with non-OK status:", response.status, responseText);
        throw new Error(`The map data service is currently unavailable (Status: ${response.status}).`);
    }

    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse Overpass API response as JSON. The service might be overloaded. Response received:", responseText);
        throw new Error("The map data service seems to be under heavy load. Please wait a moment and try again.");
    }

    if (data.remark && data.remark.startsWith('Error')) {
      console.error("Overpass API Error:", data.remark);
      throw new Error(`The map data service returned an error: ${data.remark}`);
    }

    const places: Place[] = data.elements
      .map((element: any): Place | null => {
        const coords = getCoordinatesFromElement(element);
        
        if (!element.tags || !element.tags.name || !coords) {
          return null;
        }

        const category = getCategoryFromTags(element.tags);
        
        return {
          id: `${element.type.charAt(0)}${element.id}`,
          name: element.tags.name,
          category: category,
          coordinates: coords,
          shortDescription: element.tags['description:en'] || element.tags.description || `A location of interest.`,
          businessUrl: element.tags.website || element.tags['contact:website'],
        };
      })
      .filter((place): place is Place => place !== null);

    const uniquePlaces = Array.from(new Map(places.map(p => [p.id, p])).values());

    return uniquePlaces;

  } catch (error) {
    console.error("Error fetching or processing Overpass API data:", error);
    // The specific errors thrown above will be caught here and re-thrown with their messages.
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("Could not fetch nearby places. The map data service may be temporarily unavailable.");
  }
};