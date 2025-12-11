export enum PlaceCategory {
  // Existing Categories
  LANDSCAPE = "Landscape",
  VIEWPOINT = "Viewpoint",
  HISTORICAL = "Historical Building",
  NATURE = "Nature Spot",
  ART_CULTURE = "Art & Culture",
  FOOD_DRINK = "Food & Drink",
  SHOPPING = "Shopping",
  DIVING = "Diving Site",
  BEACH = "Beach",
  PUBLIC_TOILET = "Public Toilet",
  FERRY_TERMINAL = "Ferry Terminal",
  BUS_TERMINUS = "Bus Terminus",
  BUS_STOP = "BUS_STOP",
  BUS_ROUTE = "Bus Route",
  
  // New Categories
  EVENT = "Event",
  TOURS = "Tours",
  SIGHTSEEING_ROUTE = "sightseeing",
  PUBLIC_TRANSPORT_ROUTE = "Public Transport Route",
  HIKING_TRAIL = "hiking",
  HIKING_TRAIL_POINT = "Hiking Trail Point",
  JEEP_TOUR = "jeep-tour",
  QUAD_TOUR = "quad-tour",
  BOAT_TOUR = "boat-tour",
  CUSTOM_TOUR = "custom",
  CITIES_TOWNS = "Cities/Towns",

  OTHER = "Other Site",
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  coordinates: Coordinates;
  shortDescription: string;
  imageUrl?: string;
  image_urls?: string[]; // Added to match backend data
  aiGeneratedDescription?: string;
  chatHistory?: ChatMessage[];
  distance?: number;
  sources?: GroundingChunk[];
  wikipediaUrl?: string;
  galleryImages?: string[];
  routeId?: string; // To identify the bus route for stops
  // Admin-editable properties for featured businesses
  icon?: string;
  iconSize?: number;
  isDefaultIcon?: number | boolean; // 0/false = show category icon, 1/true = show custom icon
  showOnMainScreen?: number | boolean | null; // 0/false = hide on main screen, 1/true = show on main screen, null = field doesn't exist (old data)
  showWhenCategorySelected?: number | boolean | null; // 0/false = hide when category selected, 1/true = show when category selected, null = field doesn't exist (old data)
  businessUrl?: string;
  website?: string; // General website URL for any place type
  jsonFileName?: string; // Added for bus stop JSON file name
  timetable_file?: string; // Added for place timetable JSON file name (like Ferries)
  isGrouped?: boolean; // Indicates if this place represents a grouped bus stop
  // Tour-specific properties
  mainImage?: string; // Main tour image
  points?: any[]; // Tour points/stops
  type?: string; // Type of place (tour, tour-stop, tour-deselect, etc.)
  tourId?: string; // ID of the tour this stop belongs to
  tourName?: string; // Name of the tour this stop belongs to
  tourStopContext?: {
    stopId: string;
    stopName: string;
    stopDescription: string;
    stopCoordinates: Coordinates;
    stopImages: string[];
  };
  // Event-specific properties
  start_datetime?: string; // Event start date and time
  end_datetime?: string; // Event end date and time
  // AIS tracking properties
  ais_provider?: string; // AIS provider (e.g., "AisStream", "VesselFinder")
  ais_api_key?: string; // AIS API key (stored in backend, not sent to frontend)
  ais_mmsi?: string; // Comma-separated MMSI numbers
  is_dynamic_location?: number | boolean; // 0/false = static location, 1/true = dynamic (tracked via AIS)
}

export interface Review {
  id: number;
  user_id: string;
  place_id?: number;
  tour_id?: number;
  rating: number;
  title?: string;
  comment?: string;
  is_approved: boolean;
  is_visible: boolean;
  politeness_score?: number;
  moderation_reasons?: string;
  created_at: string;
  updated_at: string;
  username?: string;
  email?: string;
  place_name?: string;
  place_category?: string;
  tour_name?: string;
  tour_category?: string;
}

export interface ReviewStats {
  item_name: string;
  item_category: string;
  item_type: 'place' | 'tour';
  item_id: number;
  total_reviews: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  approved_reviews: number;
  pending_reviews: number;
  last_review_date: string;
}

export interface CreateReviewData {
  place_id?: number;
  tour_id?: number;
  rating: number;
  title?: string;
  comment?: string;
}

export interface GroupedBusStop extends Place {
  stops: Place[]; // Array of individual bus stops within this group
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of chunks can be added here if needed
}

export interface CountryData {
  name: string;
  code: string;
  coordinates: Coordinates;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  location?: string;
  role: 'user' | 'admin';
}

export type TravelMode = 'driving-car' | 'foot-walking';

export interface RouteInfo {
  coordinates: Coordinates[];
  distance: number; // in meters
  duration: number; // in seconds
}

export interface TripPlan {
  id: string;
  name: string;
  icon: string;
  places: Place[];
  routeInfo?: {
    [key in TravelMode]?: RouteInfo;
  };
}

export interface NotificationMessage {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface HikingTrail {
  name: string;
  description: string;
  coordinates: [number, number][]; // Array of [latitude, longitude] pairs
  pointsOfInterest: HikingTrailPoint[];
}

export interface HikingTrailPoint {
  name: string;
  description: string;
  coordinates: [number, number]; // [latitude, longitude]
}
