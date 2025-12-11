
import { PlaceCategory } from './types';
import { Coordinates } from './types';

export const APP_TITLE = "Discover Gozo";

export const DEFAULT_INITIAL_COORDS: Coordinates = { lat: 36.045, lng: 14.26 }; // Center on Gozo & Comino

export const CATEGORIES: PlaceCategory[] = [
  PlaceCategory.VIEWPOINT,
  PlaceCategory.HISTORICAL,
  PlaceCategory.BEACH,
  PlaceCategory.DIVING,
  PlaceCategory.NATURE,
  PlaceCategory.LANDSCAPE,
  PlaceCategory.FOOD_DRINK,
  PlaceCategory.FERRY_TERMINAL,
  PlaceCategory.TOURS,
  PlaceCategory.BUS_TERMINUS,
  PlaceCategory.BUS_STOP,
  PlaceCategory.PUBLIC_TOILET,
  PlaceCategory.ART_CULTURE,
  PlaceCategory.SHOPPING,
  PlaceCategory.EVENT,
  PlaceCategory.CITIES_TOWNS,
];

export const CATEGORY_INFO: { readonly [key: string]: { readonly icon: string } } = {
  [PlaceCategory.VIEWPOINT]: { icon: '🔭' },
  [PlaceCategory.HISTORICAL]: { icon: '🏛️' },
  [PlaceCategory.NATURE]: { icon: '🌳' },
  [PlaceCategory.LANDSCAPE]: { icon: '🌄' },
  [PlaceCategory.ART_CULTURE]: { icon: '🎭' },
  [PlaceCategory.FOOD_DRINK]: { icon: '🍔' },
  [PlaceCategory.SHOPPING]: { icon: '🛍️' },
  [PlaceCategory.DIVING]: { icon: '🤿' },
  [PlaceCategory.BEACH]: { icon: '🏖️' },
  [PlaceCategory.PUBLIC_TOILET]: { icon: '🚽' },
  [PlaceCategory.FERRY_TERMINAL]: { icon: '⛴️' },
  [PlaceCategory.TOURS]: { icon: '🗺️' },
  [PlaceCategory.BUS_TERMINUS]: { icon: '🚌' },
  [PlaceCategory.BUS_STOP]: { icon: '🚏' },
  'Bus Stop': { icon: '🚏' }, // Legacy support for old category name
  'TOUR_STOP': { icon: '🗺️' }, // Tour stops
  [PlaceCategory.EVENT]: { icon: '🎉' },
  [PlaceCategory.PUBLIC_TRANSPORT_ROUTE]: { icon: '🚍' },
  [PlaceCategory.CITIES_TOWNS]: { icon: '🏘️' },
  [PlaceCategory.OTHER]: { icon: '📍' },
};

export const DEFAULT_RADIUS = 50; // in km (All range)

export const SEARCH_RADIUS_OPTIONS = [
    { label: '100m', value: 0.1 },
    { label: '200m', value: 0.2 },
    { label: '300m', value: 0.3 },
    { label: '500m', value: 0.5 },
    { label: '1 km', value: 1 },
    { label: '5 km', value: 5 },
    { label: 'All', value: 50 }, // 50km is enough to cover Gozo and Comino
];

export const GEMINI_MODEL_TEXT = "gemini-2.5-flash";
