
import { Place } from '../types';
import { getApiBaseUrl } from './config';

const API_BASE_URL = getApiBaseUrl();

// Helper function to transform backend place data into the frontend's expected format
const transformPlaceData = (place: any): Place => {
  let galleryImages = [];
  if (typeof place.image_urls === 'string') {
    // Check if it's a JSON array string or just a simple path string
    if (place.image_urls.trim().startsWith('[') || place.image_urls.trim().startsWith('"[')) {
      try {
        galleryImages = JSON.parse(place.image_urls);
      } catch (e) {
        // If parsing fails, treat as single path string
        galleryImages = place.image_urls.trim() ? [place.image_urls.trim()] : [];
      }
    } else if (place.image_urls.trim().startsWith('/')) {
      // It's a simple path string like "/uploads/image.jpg"
      galleryImages = [place.image_urls.trim()];
    } else {
      // Try to parse as JSON, fallback to empty array
      try {
        galleryImages = JSON.parse(place.image_urls);
      } catch (e) {
        // If it's not valid JSON, treat as single path or empty
        galleryImages = place.image_urls.trim() ? [place.image_urls.trim()] : [];
      }
    }
  } else if (Array.isArray(place.image_urls)) {
    galleryImages = place.image_urls;
  }

  // Filter out Unsplash URLs to prevent CORS errors
  galleryImages = galleryImages.filter((url: string) => 
    url && !url.includes('unsplash.com') && !url.includes('source.unsplash')
  );

  let sources = [];
  if (typeof place.sources === 'string') {
    try {
      sources = JSON.parse(place.sources);
    } catch (e) {
       // Ignore parsing errors, default to empty array
    }
  } else if (Array.isArray(place.sources)) {
    sources = place.sources;
  }

  // Ensure sources is an array, as it might be null after parsing "null"
  if (!Array.isArray(sources)) {
    sources = [];
  }

  return {
    ...place,
    coordinates: {
      lat: place.latitude,
      lng: place.longitude,
    },
    sources: sources,
    galleryImages: galleryImages.map((url: string) => 
      url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    ),
    imageUrl: galleryImages.length > 0 
      ? (galleryImages[0].startsWith('http') ? galleryImages[0] : `${API_BASE_URL}${galleryImages[0]}`) 
      : undefined,
    // Preserve AIS tracking fields
    ais_provider: place.ais_provider,
    ais_api_key: place.ais_api_key, // Note: This should not be sent to frontend in production
    ais_mmsi: place.ais_mmsi,
    is_dynamic_location: place.is_dynamic_location,
    // Preserve timetable_file if present
    timetable_file: place.timetable_file || null,
  };
};

/**
 * Fetches lightweight places from the backend server (minimal data for map markers).
 */
export const fetchPlacesFromServer = async (): Promise<Place[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places/lightweight`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const places: any[] = await response.json();
    if (!Array.isArray(places)) {
      console.error("Backend did not return an array for places:", places);
      return [];
    }
    // Transform lightweight data - coordinates are already in the right format
    // IMPORTANT: Preserve ALL fields from the backend, especially showOnMainScreen and showWhenCategorySelected
    return places.map((place: any) => {
      // Debug log for Kempinski to see what we're receiving from API
      if (place.name && (place.name.includes('Kempinski') || place.name.includes('Hotel'))) {
        console.log('🔍🔍🔍 BACKEND SERVICE - Received place from API:', {
          name: place.name,
          icon: place.icon,
          showOnMainScreen: place.showOnMainScreen,
          showWhenCategorySelected: place.showWhenCategorySelected,
          isDefaultIcon: place.isDefaultIcon,
          allKeys: Object.keys(place),
          rawShowOnMainScreen: place.showOnMainScreen,
          rawShowWhenCategorySelected: place.showWhenCategorySelected
        });
      }
      
      // Transform image_urls to galleryImages if present
      let galleryImages = place.galleryImages || [];
      if (!galleryImages.length && place.image_urls) {
        if (Array.isArray(place.image_urls)) {
          galleryImages = place.image_urls;
        } else if (typeof place.image_urls === 'string') {
          try {
            galleryImages = JSON.parse(place.image_urls);
          } catch (e) {
            galleryImages = place.image_urls.trim() ? [place.image_urls.trim()] : [];
          }
        }
      }
      
      // Filter out Unsplash URLs to prevent CORS errors
      galleryImages = galleryImages.filter((url: string) => 
        url && !url.includes('unsplash.com') && !url.includes('source.unsplash')
      );
      
      const transformed = {
        ...place, // This preserves ALL fields including showOnMainScreen, showWhenCategorySelected, isDefaultIcon, timetable_file, etc.
        coordinates: place.coordinates || { lat: place.latitude, lng: place.longitude },
        // Set defaults for missing fields that might be needed (only if not already present)
        shortDescription: place.shortDescription || '',
        description: place.description || '',
        galleryImages: galleryImages,
        imageUrl: place.imageUrl || place.mainImage || (galleryImages.length > 0 ? galleryImages[0] : null),
        mainImage: place.mainImage || (galleryImages.length > 0 ? galleryImages[0] : null),
        // CRITICAL: Explicitly preserve visibility fields - these MUST be preserved exactly as received
        // Don't convert null to undefined - keep the exact value from backend
        showOnMainScreen: place.showOnMainScreen !== undefined && place.showOnMainScreen !== null ? place.showOnMainScreen : (place.showOnMainScreen === 0 ? 0 : null),
        showWhenCategorySelected: place.showWhenCategorySelected !== undefined && place.showWhenCategorySelected !== null ? place.showWhenCategorySelected : (place.showWhenCategorySelected === 0 ? 0 : null),
        isDefaultIcon: place.isDefaultIcon !== undefined && place.isDefaultIcon !== null ? place.isDefaultIcon : null,
        // Preserve timetable_file if present
        timetable_file: place.timetable_file || null,
      };
      
      // Transform image URLs to full URLs if needed
      if (transformed.galleryImages && transformed.galleryImages.length > 0) {
        transformed.galleryImages = transformed.galleryImages.map((url: string) => 
          url.startsWith('http') ? url : `${API_BASE_URL}${url}`
        );
        if (transformed.imageUrl && !transformed.imageUrl.startsWith('http')) {
          transformed.imageUrl = `${API_BASE_URL}${transformed.imageUrl}`;
        }
        if (transformed.mainImage && !transformed.mainImage.startsWith('http')) {
          transformed.mainImage = `${API_BASE_URL}${transformed.mainImage}`;
        }
      }
      
      // Debug log for Kempinski to see what we're returning
      if (place.name && (place.name.includes('Kempinski') || place.name.includes('Hotel'))) {
        console.log('🔍🔍🔍 BACKEND SERVICE - Returning transformed place:', {
          name: transformed.name,
          icon: transformed.icon,
          showOnMainScreen: transformed.showOnMainScreen,
          showWhenCategorySelected: transformed.showWhenCategorySelected,
          isDefaultIcon: transformed.isDefaultIcon,
          typeShowOnMainScreen: typeof transformed.showOnMainScreen,
          typeShowWhenCategorySelected: typeof transformed.showWhenCategorySelected
        });
      }
      
      return transformed;
    });
  } catch (error) {
    console.error("There was a problem fetching places from the backend:", error);
    throw new Error('Failed to load places from the server. Is the backend running?');
  }
};

/**
 * Fetches a specific place by its ID from the backend.
 */
export const fetchPlaceById = async (id: string): Promise<Place | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Network response was not ok');
    }
    const place: any = await response.json();
    return transformPlaceData(place);
  } catch (error) {
    console.error(`There was a problem fetching the place with ID ${id}:`, error);
    return null;
  }
};

/**
 * Updates a place's data on the backend.
 */
export const updatePlace = async (id: string, updatedData: Partial<Place>): Promise<Place> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedData),
      credentials: 'include', // Include cookies for authentication
    });
    if (!response.ok) {
      throw new Error('Failed to update place');
    }
    const place: any = await response.json();
    return transformPlaceData(place);
  } catch (error) {
    console.error(`Error updating place ${id}:`, error);
    throw error;
  }
};

/**
 * Deletes a place from the backend.
 */
export const deletePlace = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/places/${id}`, {
      method: 'DELETE',
      credentials: 'include', // Include cookies for authentication
    });
    if (!response.ok) {
      throw new Error('Failed to delete place');
    }
  } catch (error) {
    console.error(`Error deleting place ${id}:`, error);
    throw error;
  }
};

/**
 * Uploads an image for a place.
 */
export const uploadImage = async (
  id: string, 
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<Place> => {
  // First, get the current place data
  const place = await fetchPlaceById(id);
  if (!place) {
    throw new Error('Place not found');
  }

  const normalizeImagePath = (url?: string) => {
    if (!url) return '';
    if (url.startsWith(API_BASE_URL)) {
      return url.slice(API_BASE_URL.length);
    }
    return url;
  };

  const formData = new FormData();
  formData.append('id', place.id);
  formData.append('name', place.name);
  const description =
    (place as any).description ??
    place.shortDescription ??
    '';
  formData.append('description', description);
  formData.append('latitude', place.coordinates.lat.toString());
  formData.append('longitude', place.coordinates.lng.toString());
  formData.append('category', place.category);
  formData.append('website', place.businessUrl || '');
  formData.append('iconSize', (place.iconSize || 24).toString());

  const existingImages = Array.isArray(place.galleryImages)
    ? place.galleryImages
        .map(normalizeImagePath)
        .filter((url) => !!url)
    : [];
  formData.append('existingImages', JSON.stringify(existingImages));

  const normalizedIcon = normalizeImagePath(place.icon);
  formData.append('existingIcon', normalizedIcon || place.icon || '');

  const isDefaultIcon = place.isDefaultIcon === 1 || place.isDefaultIcon === true;
  formData.append('isDefaultIconValue', isDefaultIcon ? '1' : '0');

  formData.append('images', imageFile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          const updatedPlace = transformPlaceData(result);
          resolve(updatedPlace);
        } catch (error) {
          reject(new Error('Failed to parse response'));
        }
      } else {
        reject(new Error(`Failed to upload image: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', `${API_BASE_URL}/api/places`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
};

/**
 * Deletes an image from a place's gallery.
 */
export const deletePlaceImage = async (id: string, imageUrl: string): Promise<Place> => {
  const place = await fetchPlaceById(id);
  if (!place) {
    throw new Error('Place not found');
  }

  const normalizeImagePath = (url?: string) => {
    if (!url) return '';
    if (url.startsWith(API_BASE_URL)) {
      return url.slice(API_BASE_URL.length);
    }
    return url;
  };

  const targetImagePath = normalizeImagePath(imageUrl);
  const currentImages = Array.isArray(place.galleryImages)
    ? place.galleryImages
        .map(normalizeImagePath)
        .filter((url) => !!url)
    : [];

  const updatedImages = currentImages.filter((url) => url !== targetImagePath);

  const formData = new FormData();
  formData.append('id', place.id);
  formData.append('name', place.name);
  const description =
    (place as any).description ??
    place.shortDescription ??
    '';
  formData.append('description', description);
  formData.append('latitude', place.coordinates.lat.toString());
  formData.append('longitude', place.coordinates.lng.toString());
  formData.append('category', place.category);
  formData.append('website', place.businessUrl || '');
  formData.append('iconSize', (place.iconSize || 24).toString());
  formData.append('existingImages', JSON.stringify(updatedImages));

  const normalizedIcon = normalizeImagePath(place.icon);
  formData.append('existingIcon', normalizedIcon || place.icon || '');
  
  const isDefaultIcon = place.isDefaultIcon === 1 || place.isDefaultIcon === true;
  formData.append('isDefaultIconValue', isDefaultIcon ? '1' : '0');

  try {
    const response = await fetch(`${API_BASE_URL}/api/places/${id}`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to delete image');
    }
    const result = await response.json();
    return transformPlaceData(result);
  } catch (error) {
    console.error(`Error deleting image for place ${id}:`, error);
    throw error;
  }
};

/**
 * Fetches all events from the backend server.
 */
export const fetchEventsFromServer = async (lightweight: boolean = true): Promise<Place[]> => {
  try {
    const url = lightweight 
      ? `${API_BASE_URL}/api/events?lightweight=true`
      : `${API_BASE_URL}/api/events`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok for events');
    }
    const events: any[] = await response.json();
    
    // If lightweight, transform minimal event data to Place format
    if (lightweight) {
      return events.map((event: any) => ({
        id: `event-${event.id}`,
        name: event.name,
        category: event.category || 'EVENT',
        coordinates: event.location ? { lat: parseFloat(event.location.split(',')[0]), lng: parseFloat(event.location.split(',')[1]) } : { lat: 36.046, lng: 14.26 },
        shortDescription: event.description || '',
        description: event.description || '',
        startDate: event.start_date,
        endDate: event.end_date,
        start_datetime: event.start_datetime || event.start_date,
        end_datetime: event.end_datetime || event.end_date,
        imageUrl: event.image_url || null,
        mainImage: event.image_url || null,
        galleryImages: event.image_url ? [event.image_url] : [],
        type: 'event',
      }));
    }
    
    // Full data - use transformPlaceData
    return events.map(transformPlaceData);
  } catch (error) {
    console.error("There was a problem fetching events from the backend:", error);
    throw new Error('Failed to load events from the server.');
  }
};
