const express = require('express');
const router = express.Router();
const db = require('../database');
const aisService = require('../services/aisService');
const path = require('path');
const fs = require('fs');
const { imageOptimizer } = require('../middleware/imageOptimizer');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { createSecureImageUpload } = require('../middleware/secureUpload');
const { cacheMiddlewares, cache } = require('../middleware/cache');

// In-memory cache for bus routes and hiking trails (loaded at startup)
const busRoutesCache = new Map();
const hikingTrailsCache = new Map();

// Load bus routes into memory cache at startup
function loadBusRoutesCache() {
  try {
    const busRoutesPath = path.join(__dirname, '../bus-routes');
    if (!fs.existsSync(busRoutesPath)) {
      console.warn('Bus routes directory not found');
      return;
    }
    
    const routeFiles = fs.readdirSync(busRoutesPath).filter(file => file.endsWith('.json') && !file.startsWith('package'));
    busRoutesCache.clear();
    
    for (const routeFile of routeFiles) {
      try {
        let routeId = path.basename(routeFile, '.json');
        routeId = routeId.replace(/mgarr harbour/g, 'vapur').replace(/--/g, '-');
        const routeData = JSON.parse(fs.readFileSync(path.join(busRoutesPath, routeFile), 'utf-8'));
        // Use routeData.id if available (preferred), otherwise use filename
        const cacheKey = routeData.id || routeId;
        busRoutesCache.set(cacheKey, routeData);
        // Also cache by filename for backward compatibility
        if (routeData.id && routeData.id !== routeId) {
          busRoutesCache.set(routeId, routeData);
        }
      } catch (error) {
        console.error(`Error loading bus route ${routeFile}:`, error.message);
      }
    }
    
    console.log(`✅ Loaded ${busRoutesCache.size} bus routes into memory cache`);
  } catch (error) {
    console.error('Error loading bus routes cache:', error.message);
  }
}

// Load hiking trails into memory cache at startup
function loadHikingTrailsCache() {
  try {
    const hikingTrailsPath = path.join(__dirname, '../hiking-trails');
    if (!fs.existsSync(hikingTrailsPath)) {
      console.warn('Hiking trails directory not found');
      return;
    }
    
    const trailFiles = fs.readdirSync(hikingTrailsPath).filter(file => file.endsWith('.json'));
    hikingTrailsCache.clear();
    
    for (const trailFile of trailFiles) {
      try {
        const trailId = path.basename(trailFile, '.json');
        const trailData = JSON.parse(fs.readFileSync(path.join(hikingTrailsPath, trailFile), 'utf-8'));
        hikingTrailsCache.set(trailId, trailData);
      } catch (error) {
        console.error(`Error loading hiking trail ${trailFile}:`, error.message);
      }
    }
    
    console.log(`✅ Loaded ${hikingTrailsCache.size} hiking trails into memory cache`);
  } catch (error) {
    console.error('Error loading hiking trails cache:', error.message);
  }
}

// Load caches at module initialization
loadBusRoutesCache();
loadHikingTrailsCache();

// Cache invalidation helper
async function invalidatePlaceCache(placeId = null) {
  try {
    // Invalidate lightweight places list
    await cache.delPattern('places:lightweight:*');
    // Invalidate all place lists
    await cache.delPattern('cache:/api/places*');
    
    // Invalidate specific place if ID provided
    if (placeId) {
      await cache.del(`place:${placeId}`);
      await cache.del(`cache:/api/places/${placeId}*`);
    }
    
    // Reload bus routes cache in case files changed
    loadBusRoutesCache();
  } catch (error) {
    console.warn('[Cache] Error invalidating place cache:', error.message);
  }
}

// --- Secure Multer Setup for Image Uploads ---
const upload = createSecureImageUpload('uploads', 25 * 1024 * 1024); // 25MB limit

// Configure multer for multiple file fields
const placeUpload = upload.fields([
  { name: 'images', maxCount: 10 }, // For the gallery
  { name: 'icon', maxCount: 1 }     // For the custom pin icon
]);

// --- API Endpoints for Places ---

// GET lightweight places (minimal data for map markers)
router.get('/lightweight', cacheMiddlewares.placesLightweight, (req, res) => {
  try {
    // 1. Get all places from the database (using index on category)
    const stmt = db.prepare('SELECT * FROM places ORDER BY name ASC');
    const dbPlaces = stmt.all();

    // Create a set of coordinates for places that are already in the database
    const existingCoords = new Set(dbPlaces.map(p => `${p.latitude},${p.longitude}`));
    
    // Map to lightweight format - include essential fields including images
    const finalPlaces = dbPlaces.map(place => {
      // Parse image_urls if it's a string
      let imageUrls = [];
      if (place.image_urls) {
        if (typeof place.image_urls === 'string') {
          try {
            imageUrls = JSON.parse(place.image_urls);
          } catch (e) {
            // If parsing fails, treat as single path
            imageUrls = place.image_urls.trim() ? [place.image_urls.trim()] : [];
          }
        } else if (Array.isArray(place.image_urls)) {
          imageUrls = place.image_urls;
        }
      }
      
      return {
        id: place.id,
        name: place.name,
        coordinates: { lat: place.latitude, lng: place.longitude },
        category: place.category,
        icon: place.icon || null,
        iconSize: (place.icon_size !== undefined ? place.icon_size : (place.iconSize !== undefined ? place.iconSize : 32)) || 32,
        // Include AIS fields for dynamic location tracking
        ais_provider: place.ais_provider || null,
        ais_mmsi: place.ais_mmsi || null,
        is_dynamic_location: place.is_dynamic_location || 0,
        isDefaultIcon: place.isDefaultIcon !== undefined ? place.isDefaultIcon : (place.is_default_icon !== undefined ? place.is_default_icon : null),
        showOnMainScreen: place.showOnMainScreen !== undefined && place.showOnMainScreen !== null ? place.showOnMainScreen : (place.show_on_main_screen !== undefined && place.show_on_main_screen !== null ? place.show_on_main_screen : null), // null means field doesn't exist (old data)
        showWhenCategorySelected: place.showWhenCategorySelected !== undefined && place.showWhenCategorySelected !== null ? place.showWhenCategorySelected : (place.show_when_category_selected !== undefined && place.show_when_category_selected !== null ? place.show_when_category_selected : null), // null means field doesn't exist (old data)
        description: place.description || null,
        shortDescription: place.shortDescription || place.description || null,
        image_urls: imageUrls,
        mainImage: imageUrls.length > 0 ? imageUrls[0] : null,
        timetable_file: place.timetable_file || null // Include timetable file reference
      };
    });

    // 2. Add bus stops from cached bus routes
    for (const [routeId, routeData] of busRoutesCache.entries()) {
      if (routeData && Array.isArray(routeData.points)) {
        for (const point of routeData.points) {
          if (point.type === 'stop') {
            const coordKey = `${point.lat},${point.lng}`;
            if (!existingCoords.has(coordKey)) {
              const stopName = point.name ? point.name.split('BUS_STOP')[0].trim() : `Bus Stop (${routeId})`;
              finalPlaces.push({
                id: `bus-stop-${point.lat}-${point.lng}`,
                name: stopName,
                coordinates: { lat: point.lat, lng: point.lng },
                category: 'BUS_STOP',
                icon: '🚌',
                iconSize: 32,
                routeId: routeId
              });
              existingCoords.add(coordKey);
            }
          }
        }
      }
    }

    // 3. Add tour stops with icons from cached tour data
    const tourDataPath = path.join(__dirname, '..', 'routes-data');
    if (fs.existsSync(tourDataPath)) {
      const tourCategories = ['sightseeing', 'boat-tour', 'jeep-tour', 'quad-tour', 'custom'];
      
      for (const tourCategory of tourCategories) {
        const categoryPath = path.join(tourDataPath, tourCategory);
        if (fs.existsSync(categoryPath)) {
          const tourFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.json'));
          
          for (const tourFile of tourFiles) {
            try {
              const tourData = JSON.parse(fs.readFileSync(path.join(categoryPath, tourFile), 'utf-8'));
              const tourId = path.basename(tourFile, '.json');
              
              if (tourData.icon && tourData.points) {
                const tourStopCoords = tourData.points
                  .filter(p => p.type === 'stop')
                  .map(p => `${p.lat},${p.lng}`);
                
                finalPlaces.forEach(place => {
                  const placeCoord = `${place.coordinates.lat},${place.coordinates.lng}`;
                  if (place.category === 'TOUR_STOP' && tourStopCoords.includes(placeCoord)) {
                    place.icon = tourData.icon;
                    place.iconSize = tourData.iconSize || 32;
                    place.tourId = tourId;
                  }
                });
              }
            } catch (error) {
              console.error(`Error loading tour data from ${tourFile}:`, error.message);
            }
          }
        }
      }
    }

    // Set fallback icon for TOUR_STOP without icon
    finalPlaces.forEach(place => {
      if (place.category === 'TOUR_STOP' && !place.icon) {
        place.icon = '🗺️';
        place.iconSize = 32;
      }
    });

    res.json(finalPlaces);
  } catch (error) {
    console.error('Error fetching lightweight places:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET all places, including all unique bus stops from the route files (full data)
router.get('/', (req, res) => {
  try {
    // 1. Get all places from the database
    const stmt = db.prepare('SELECT * FROM places ORDER BY name ASC');
    const dbPlaces = stmt.all();

    // Create a set of coordinates for places that are already in the database
    // to efficiently check for and prevent duplicates.
    const existingCoords = new Set(dbPlaces.map(p => `${p.latitude},${p.longitude}`));
    
    // The final list of places will start with what's in the DB.
    const finalPlaces = [...dbPlaces];

    // 2. Read bus route files from cache (fallback to file read if cache empty)
    if (busRoutesCache.size === 0) {
      loadBusRoutesCache();
    }

    for (const [routeId, routeData] of busRoutesCache.entries()) {
        if (routeData && Array.isArray(routeData.points)) {
            // Get route main image if it exists
            const routeMainImage = routeData.mainImage || '';
            
            // Debug logging (remove after testing)
            if (routeMainImage) {
                console.log(`Route ${routeId} has image: ${routeMainImage}`);
            }
            
            for (const point of routeData.points) {
                if (point.type === 'stop') {
                    const coordKey = `${point.lat},${point.lng}`;
                    
                    // If a stop at this exact location is NOT already in our set...
                    if (!existingCoords.has(coordKey)) {
                        // ...add it as a new place object.
                        const stopName = point.name ? point.name.split('BUS_STOP')[0].trim() : `Bus Stop (${routeId})`;
                        const stopPlace = {
                            id: `bus-stop-${point.lat}-${point.lng}`, 
                            name: stopName,
                            description: point.description || 'A bus stop on the Gozo public transport network.',
                            latitude: point.lat,
                            longitude: point.lng,
                            category: 'BUS_STOP',
                            image_urls: routeMainImage ? [routeMainImage] : [],
                            imageUrl: routeMainImage, // Add this for compatibility
                            mainImage: routeMainImage,
                            routeId: routeId // Use the clean filename as the routeId
                        };
                        finalPlaces.push(stopPlace);
                        existingCoords.add(coordKey);
                    } else {
                        const existingPlace = finalPlaces.find(p => p.latitude === point.lat && p.longitude === point.lng);
                        if (existingPlace) {
                            existingPlace.routeId = routeId;
                            existingPlace.category = 'BUS_STOP';
                            // Update image fields with route image
                            if (routeMainImage) {
                                existingPlace.image_urls = [routeMainImage];
                                existingPlace.imageUrl = routeMainImage;
                                existingPlace.mainImage = routeMainImage;
                                console.log(`Updated existing stop "${existingPlace.name}" (ID: ${existingPlace.id}) with image: ${routeMainImage}`);
                            }
                            // Update description if a more specific one is provided in the route file
                            if (point.description) {
                                existingPlace.description = point.description;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 3. Load tour data and apply tour-specific icons to TOUR_STOP places
    const tourDataPath = path.join(__dirname, '..', 'routes-data');
    if (fs.existsSync(tourDataPath)) {
      const tourCategories = ['sightseeing', 'boat-tour', 'jeep-tour', 'quad-tour', 'custom'];
      
      for (const tourCategory of tourCategories) {
        const categoryPath = path.join(tourDataPath, tourCategory);
        if (fs.existsSync(categoryPath)) {
          const tourFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.json'));
          
          for (const tourFile of tourFiles) {
            try {
              const tourData = JSON.parse(fs.readFileSync(path.join(categoryPath, tourFile), 'utf-8'));
              const tourId = path.basename(tourFile, '.json');
              
              // Apply tour icon to all tour stops that belong to this tour
              if (tourData.icon && tourData.points) {
                // Get all stop coordinates from this tour
                const tourStopCoords = tourData.points
                  .filter(p => p.type === 'stop')
                  .map(p => `${p.lat},${p.lng}`);
                
                // Apply icon to matching places
                finalPlaces.forEach(place => {
                  const placeCoord = `${place.latitude},${place.longitude}`;
                  if (place.category === 'TOUR_STOP' && tourStopCoords.includes(placeCoord)) {
                    place.icon = tourData.icon;
                    place.iconSize = tourData.iconSize || 32;
                    place.tourId = tourId; // Also set the tourId for future reference
                  }
                });
              }
            } catch (error) {
              console.error(`Error loading tour data from ${tourFile}:`, error);
            }
          }
        }
      }
    }
    
    // Set fallback icon for any TOUR_STOP without an icon
    finalPlaces.forEach(place => {
      if (place.category === 'TOUR_STOP' && !place.icon) {
        place.icon = '🗺️'; // Generic tour marker icon
        place.iconSize = 32;
      }
    });
    
    // Parse image_urls for all places that have them
    finalPlaces.forEach(place => {
      if (place.image_urls && typeof place.image_urls === 'string') {
        try {
          place.image_urls = JSON.parse(place.image_urls);
        } catch (e) {
          place.image_urls = [];
        }
      } else if (!place.image_urls) {
        place.image_urls = [];
      }
      
      // Ensure timetable_file is included in response (for places with timetables like Ferries)
      // This field comes from the database SELECT * query, but we explicitly ensure it's present
      if (place.timetable_file === undefined) {
        place.timetable_file = null;
      }
    });

    res.json(finalPlaces);
  } catch (error) {
    console.error('Error fetching places:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET a single place by ID (full details)
router.get('/:id', cacheMiddlewares.placeDetails, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = stmt.get(req.params.id);
    if (place) {
      if (place.image_urls) {
        try {
          place.image_urls = JSON.parse(place.image_urls);
        } catch (e) {
          place.image_urls = [];
        }
      } else {
        place.image_urls = [];
      }
      res.json(place);
    } else {
      res.status(404).json({ error: 'Place not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new place or update an existing one (upsert)
router.post('/', requireAdminAuth, placeUpload, imageOptimizer, (req, res) => {
  console.log('🎯 POST /places - Files received:', req.files ? Object.keys(req.files) : 'No files');
  console.log('🎯 POST /places - Optimized images:', req.optimizedImages ? Object.keys(req.optimizedImages) : 'No optimization');
  console.log('🎯 POST /places - Full req.files object:', JSON.stringify(req.files, null, 2));
  
  const { id, name, description, latitude, longitude, category, website, iconSize, existingImages, existingIcon, isDefaultIcon, isDefaultIconValue, showOnMainScreen, showOnMainScreenValue, showWhenCategorySelected, showWhenCategorySelectedValue, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location } = req.body;

  console.log('📥 Received form data:', { 
    id,
    name,
    description,
    isDefaultIcon, 
    isDefaultIconValue,
    allBodyKeys: Object.keys(req.body)
  });

  if (!name || !latitude || !longitude || !category) {
    return res.status(400).json({ error: 'Missing required fields: name, latitude, longitude, category.' });
  }
  
  // Normalize description: convert empty string to null
  const normalizedDescription = (description && description.trim() !== '') ? description.trim() : null;
  
  // Check if place has a custom icon
  // CRITICAL: existingIcon might be empty string when icon is removed, treat as no icon
  const hasCustomIcon = (existingIcon && existingIcon.trim() !== '') || (req.files && req.files.icon);
  
  // Convert isDefaultIcon to integer (0 or 1)
  // CRITICAL: If custom icon is added and isDefaultIcon not explicitly set, default to 1 (show custom icon)
  // This ensures custom icons show by default when added
  const isDefaultIconFinal = isDefaultIconValue !== undefined && isDefaultIconValue !== null && isDefaultIconValue !== ''
    ? parseInt(isDefaultIconValue)
    : (hasCustomIcon ? 1 : 0); // Default to 1 (show) if has custom icon, 0 (hide) otherwise
  
    // Convert showOnMainScreen to integer (0 or 1) or null
    // CRITICAL FIX: When custom icon is added, default to 1 (show) so place doesn't disappear
    // If no custom icon, set to NULL (field doesn't exist) so frontend shows always
    let showOnMainScreenFinal = null;
    if (hasCustomIcon) {
      if (showOnMainScreenValue !== undefined && showOnMainScreenValue !== null && showOnMainScreenValue !== '') {
        showOnMainScreenFinal = parseInt(showOnMainScreenValue);
      } else {
        // Default to 1 (show) when custom icon is added - this prevents place from disappearing
        showOnMainScreenFinal = 1;
      }
    }
    // If no custom icon, showOnMainScreenFinal stays null (frontend will show always)
    
    // Convert showWhenCategorySelected to integer (0 or 1) or null
    // CRITICAL FIX: If no custom icon, set to NULL (field doesn't exist) so frontend shows always
    // If has custom icon, use provided value or default to 1 (show when category selected)
    let showWhenCategorySelectedFinal = null;
    if (hasCustomIcon) {
      if (showWhenCategorySelectedValue !== undefined && showWhenCategorySelectedValue !== null && showWhenCategorySelectedValue !== '') {
        showWhenCategorySelectedFinal = parseInt(showWhenCategorySelectedValue);
      } else {
        showWhenCategorySelectedFinal = 1; // Default to show when category selected for backward compatibility
      }
    }
    // If no custom icon, showWhenCategorySelectedFinal stays null (frontend will show always)
  
  console.log('🔍 Icon visibility processing:', { 
    isDefaultIcon, 
    isDefaultIconValue, 
    isDefaultIconFinal,
    showOnMainScreen,
    showOnMainScreenValue,
    showOnMainScreenFinal,
    showWhenCategorySelected,
    showWhenCategorySelectedValue,
    showWhenCategorySelectedFinal
  });

  // Image handling - use optimized images if available
  let updatedImageUrls = existingImages ? JSON.parse(existingImages) : [];
  
  // Add gallery-selected images (already uploaded images)
  if (req.body.gallerySelectedImages) {
      try {
          const galleryImages = JSON.parse(req.body.gallerySelectedImages);
          console.log('📸 Adding gallery-selected images:', galleryImages);
          updatedImageUrls = [...updatedImageUrls, ...galleryImages];
      } catch (e) {
          console.error('Error parsing gallery selected images:', e);
      }
  }
  
  if (req.files['images']) {
      if (req.optimizedImages && req.optimizedImages['images'] && req.optimizedImages['images'].length > 0) {
          // Process each uploaded file separately to get one optimized image per file
          const filesArray = Array.isArray(req.files['images']) ? req.files['images'] : [req.files['images']];
          
          for (const file of filesArray) {
              // Find optimized images for this specific file (match by original filename)
              const fileOptimizedEntries = req.optimizedImages['images'].filter(img => 
                  img.original === `/uploads/${file.filename}`
              );
              
              if (fileOptimizedEntries.length > 0) {
                  // Prefer 'main' size, otherwise pick best mobile size (size800 for good quality on mobile)
                  const selectedImage = fileOptimizedEntries.find(img => img.size === 'main') ||
                                       fileOptimizedEntries.find(img => img.size === 'size800') ||
                                       fileOptimizedEntries.find(img => img.size === 'size1200') ||
                                       fileOptimizedEntries.find(img => img.size === 'size400') ||
                                       fileOptimizedEntries[0];
                  
                  if (selectedImage) {
                      updatedImageUrls.push(selectedImage.optimized);
                  }
              } else {
                  // Fallback to original if no optimized version found
                  updatedImageUrls.push(`/uploads/${file.filename}`);
              }
          }
      } else {
          const newImageUrls = req.files['images'].map(file => `/uploads/${file.filename}`);
          updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
      }
  }

  // Icon handling - use optimized icon if available
  // CRITICAL: If existingIcon is explicitly cleared (empty string), set to null
  let iconUrl = existingIcon;
  if (existingIcon === '' || existingIcon === null || existingIcon === undefined) {
    iconUrl = null; // Explicitly clear icon if removed
  }
  
  if (req.files['icon']) {
      if (req.optimizedImages && req.optimizedImages['icon']) {
          // Use ANY optimized icon (first one available, prefer small variants for icons)
          const optimizedIcon = req.optimizedImages['icon'].find(img => img.size === 'size200') ||
                               req.optimizedImages['icon'].find(img => img.size === 'size400') ||
                               req.optimizedImages['icon'].find(img => img.size === 'main') ||
                               req.optimizedImages['icon'][0];
          iconUrl = optimizedIcon ? optimizedIcon.optimized : `/uploads/${req.files['icon'][0].filename}`;
          console.log('📸 Icon URL to save:', iconUrl);
      } else {
          iconUrl = `/uploads/${req.files['icon'][0].filename}`;
      }
  }
  
  // If icon is removed and no new icon uploaded, ensure it's null
  if (!iconUrl && !req.files['icon']) {
    iconUrl = null;
  }

  try {
    // If an ID is provided, try to update
    if (id) {
      // Get existing place to check if AIS settings changed
      const existingPlace = db.prepare('SELECT is_dynamic_location, ais_provider, ais_api_key, ais_mmsi FROM places WHERE id = ?').get(id);
      
      const isDynamicLocation = is_dynamic_location === '1' || is_dynamic_location === 1 || is_dynamic_location === true ? 1 : 0;
      const aisProvider = ais_provider || null;
      const aisApiKey = ais_api_key || null;
      const aisMmsi = ais_mmsi || null;
      
      const stmt = db.prepare('UPDATE places SET name = ?, description = ?, latitude = ?, longitude = ?, category = ?, website = ?, icon = ?, iconSize = ?, image_urls = ?, isDefaultIcon = ?, showOnMainScreen = ?, showWhenCategorySelected = ?, ais_provider = ?, ais_api_key = ?, ais_mmsi = ?, is_dynamic_location = ? WHERE id = ?');
      const info = stmt.run(name, normalizedDescription, parseFloat(latitude), parseFloat(longitude), category, website || null, iconUrl, iconSize || null, JSON.stringify(updatedImageUrls), isDefaultIconFinal, showOnMainScreenFinal, showWhenCategorySelectedFinal, aisProvider, aisApiKey, aisMmsi, isDynamicLocation, id);

      if (info.changes > 0) {
        const updatedPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
        if (updatedPlace.image_urls) updatedPlace.image_urls = JSON.parse(updatedPlace.image_urls);
        
        // Log admin activity
        logAdminActivity(
          req.admin.id,
          req.admin.email,
          'PLACE_UPDATE',
          `Updated place: ${name}`,
          'place',
          id,
          null,
          req
        );
        
        // Invalidate cache
        invalidatePlaceCache(id);
        
        // Update AIS subscription if dynamic location changed
        if (isDynamicLocation === 1 && aisProvider && aisApiKey && aisMmsi) {
          // Subscribe or update subscription
          const placeData = { ...updatedPlace, ais_provider: aisProvider, ais_api_key: aisApiKey, ais_mmsi: aisMmsi, is_dynamic_location: isDynamicLocation, latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
          aisService.subscribe(id, 'place', placeData);
        } else if (existingPlace && existingPlace.is_dynamic_location === 1) {
          // Unsubscribe if dynamic location was disabled
          aisService.unsubscribe(id);
        }
        
        return res.json(updatedPlace);
      }
      // If no rows were updated, it means the ID didn't exist, so we'll fall through to insert
    }

    // Insert new place
    const isDynamicLocation = is_dynamic_location === '1' || is_dynamic_location === 1 || is_dynamic_location === true ? 1 : 0;
    const aisProvider = ais_provider || null;
    const aisApiKey = ais_api_key || null;
    const aisMmsi = ais_mmsi || null;
    
    const stmt = db.prepare('INSERT INTO places (name, description, latitude, longitude, category, website, icon, iconSize, image_urls, isDefaultIcon, showOnMainScreen, showWhenCategorySelected, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(name, normalizedDescription, parseFloat(latitude), parseFloat(longitude), category, website || null, iconUrl, iconSize || null, JSON.stringify(updatedImageUrls), isDefaultIconFinal, showOnMainScreenFinal, showWhenCategorySelectedFinal, aisProvider, aisApiKey, aisMmsi, isDynamicLocation);
    
    const newPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(info.lastInsertRowid);
    if (newPlace.image_urls) newPlace.image_urls = JSON.parse(newPlace.image_urls);
    
    // Invalidate cache
    invalidatePlaceCache();
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'PLACE_CREATE',
      `Created new place: ${name}`,
      'place',
      info.lastInsertRowid,
      null,
      req
    );
    
    // Subscribe to AIS if dynamic location is enabled
    if (isDynamicLocation === 1 && aisProvider && aisApiKey && aisMmsi) {
      const placeData = { ...newPlace, ais_provider: aisProvider, ais_api_key: aisApiKey, ais_mmsi: aisMmsi, is_dynamic_location: isDynamicLocation, latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
      aisService.subscribe(info.lastInsertRowid, 'place', placeData);
    }
    
    res.status(201).json(newPlace);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT to update a place
router.put('/:id', requireAdminAuth, placeUpload, imageOptimizer, (req, res) => {
    console.log('🎯 PUT /places/:id - Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('🎯 PUT /places/:id - Optimized images:', req.optimizedImages ? Object.keys(req.optimizedImages) : 'No optimization');
    
    const { id } = req.params;
    const { name, description, latitude, longitude, category, website, iconSize, existingImages, existingIcon, isDefaultIcon, isDefaultIconValue, showOnMainScreen, showOnMainScreenValue, showWhenCategorySelected, showWhenCategorySelectedValue, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location } = req.body;

    console.log('📥 PUT - Received form data:', { 
        id,
        name,
        description,
        isDefaultIcon, 
        isDefaultIconValue,
        allBodyKeys: Object.keys(req.body)
    });

    if (!name || !latitude || !longitude || !category) {
        return res.status(400).json({ error: 'Missing required fields: name, latitude, longitude, category.' });
    }
    
    // Normalize description: convert empty string to null
    const normalizedDescription = (description && description.trim() !== '') ? description.trim() : null;
    
  // Convert isDefaultIcon to integer (0 or 1)
  // CRITICAL: If custom icon is added and isDefaultIcon not explicitly set, default to 1 (show custom icon)
  // This ensures custom icons show by default when added
  const isDefaultIconFinal = isDefaultIconValue !== undefined && isDefaultIconValue !== null && isDefaultIconValue !== ''
    ? parseInt(isDefaultIconValue)
    : (hasCustomIcon ? 1 : 0); // Default to 1 (show) if has custom icon, 0 (hide) otherwise
    
    // Check if place has a custom icon
    const hasCustomIcon = existingIcon || (req.files && req.files.icon);
    
    // Convert showOnMainScreen to integer (0 or 1) or null
    // CRITICAL FIX: When custom icon is added, default to 1 (show) so place doesn't disappear
    // If no custom icon, set to NULL (field doesn't exist) so frontend shows always
    let showOnMainScreenFinal = null;
    if (hasCustomIcon) {
      if (showOnMainScreenValue !== undefined && showOnMainScreenValue !== null && showOnMainScreenValue !== '') {
        showOnMainScreenFinal = parseInt(showOnMainScreenValue);
      } else {
        // Default to 1 (show) when custom icon is added - this prevents place from disappearing
        showOnMainScreenFinal = 1;
      }
    }
    // If no custom icon, showOnMainScreenFinal stays null (frontend will show always)
    
    // Convert showWhenCategorySelected to integer (0 or 1) or null
    // CRITICAL FIX: If no custom icon, set to NULL (field doesn't exist) so frontend shows always
    // If has custom icon, use provided value or default to 1 (show when category selected)
    let showWhenCategorySelectedFinal = null;
    if (hasCustomIcon) {
      if (showWhenCategorySelectedValue !== undefined && showWhenCategorySelectedValue !== null && showWhenCategorySelectedValue !== '') {
        showWhenCategorySelectedFinal = parseInt(showWhenCategorySelectedValue);
      } else {
        showWhenCategorySelectedFinal = 1; // Default to show when category selected for backward compatibility
      }
    }
    // If no custom icon, showWhenCategorySelectedFinal stays null (frontend will show always)
    
    console.log('🔍 PUT - Icon visibility processing:', { 
        isDefaultIcon, 
        isDefaultIconValue, 
        isDefaultIconFinal,
        showOnMainScreen,
        showOnMainScreenValue,
        showOnMainScreenFinal,
        showWhenCategorySelected,
        showWhenCategorySelectedValue,
        showWhenCategorySelectedFinal
    });

    // Image handling - use optimized images if available
    let updatedImageUrls = [];
    if (existingImages) {
        try {
            updatedImageUrls = JSON.parse(existingImages);
            if (!Array.isArray(updatedImageUrls)) {
                console.warn('⚠️ PUT - existingImages is not an array, converting:', updatedImageUrls);
                updatedImageUrls = Array.isArray(updatedImageUrls) ? updatedImageUrls : [];
            }
        } catch (e) {
            console.error('❌ PUT - Error parsing existingImages JSON:', e, 'Raw value:', existingImages);
            updatedImageUrls = [];
        }
    }
    
    // Add gallery-selected images (already uploaded images)
    if (req.body.gallerySelectedImages) {
        try {
            const galleryImages = JSON.parse(req.body.gallerySelectedImages);
            if (Array.isArray(galleryImages)) {
                console.log('📸 PUT - Adding gallery-selected images:', galleryImages);
                updatedImageUrls = [...updatedImageUrls, ...galleryImages];
            } else {
                console.warn('⚠️ PUT - gallerySelectedImages is not an array:', galleryImages);
            }
        } catch (e) {
            console.error('❌ PUT - Error parsing gallery selected images:', e);
        }
    }
    
    if (req.files['images']) {
        // Use optimized images if available, otherwise fall back to original
        if (req.optimizedImages && req.optimizedImages['images'] && req.optimizedImages['images'].length > 0) {
            // Process each uploaded file separately to get one optimized image per file
            const filesArray = Array.isArray(req.files['images']) ? req.files['images'] : [req.files['images']];
            
            for (const file of filesArray) {
                // Find optimized images for this specific file (match by original filename)
                const fileOptimizedEntries = req.optimizedImages['images'].filter(img => 
                    img.original === `/uploads/${file.filename}`
                );
                
                if (fileOptimizedEntries.length > 0) {
                    // Prefer 'main' size, otherwise pick best mobile size (size800 for good quality on mobile)
                    const selectedImage = fileOptimizedEntries.find(img => img.size === 'main') ||
                                         fileOptimizedEntries.find(img => img.size === 'size800') ||
                                         fileOptimizedEntries.find(img => img.size === 'size1200') ||
                                         fileOptimizedEntries.find(img => img.size === 'size400') ||
                                         fileOptimizedEntries[0];
                    
                    if (selectedImage) {
                        updatedImageUrls.push(selectedImage.optimized);
                    }
                } else {
                    // Fallback to original if no optimized version found
                    updatedImageUrls.push(`/uploads/${file.filename}`);
                }
            }
        } else {
            const newImageUrls = req.files['images'].map(file => `/uploads/${file.filename}`);
            updatedImageUrls = [...updatedImageUrls, ...newImageUrls];
        }
    }

    // Icon handling - use optimized icon if available
    // CRITICAL: If existingIcon is explicitly cleared (empty string), set to null
    let updatedIconUrl = existingIcon;
    if (existingIcon === '' || existingIcon === null || existingIcon === undefined) {
        updatedIconUrl = null; // Explicitly clear icon if removed
    }
    
    if (req.files['icon']) {
        if (req.optimizedImages && req.optimizedImages['icon']) {
            // Use ANY optimized icon (first one available, prefer small variants for icons)
            const optimizedIcon = req.optimizedImages['icon'].find(img => img.size === 'size200') ||
                                 req.optimizedImages['icon'].find(img => img.size === 'size400') ||
                                 req.optimizedImages['icon'].find(img => img.size === 'main') ||
                                 req.optimizedImages['icon'][0];
            updatedIconUrl = optimizedIcon ? optimizedIcon.optimized : `/uploads/${req.files['icon'][0].filename}`;
            console.log('📸 PUT - Icon URL to save:', updatedIconUrl);
        } else {
            updatedIconUrl = `/uploads/${req.files['icon'][0].filename}`;
        }
    }
    
    // If icon is removed and no new icon uploaded, ensure it's null
    if (!updatedIconUrl && !req.files['icon']) {
        updatedIconUrl = null;
    }

    try {
        // Get existing place to check if AIS settings changed
        const existingPlace = db.prepare('SELECT is_dynamic_location, ais_provider, ais_api_key, ais_mmsi FROM places WHERE id = ?').get(id);
        
        const isDynamicLocation = is_dynamic_location === '1' || is_dynamic_location === 1 || is_dynamic_location === true ? 1 : 0;
        const aisProvider = ais_provider || null;
        const aisApiKey = ais_api_key || null;
        const aisMmsi = ais_mmsi || null;
        
        const stmt = db.prepare('UPDATE places SET name = ?, description = ?, latitude = ?, longitude = ?, category = ?, website = ?, icon = ?, iconSize = ?, image_urls = ?, isDefaultIcon = ?, showOnMainScreen = ?, showWhenCategorySelected = ?, ais_provider = ?, ais_api_key = ?, ais_mmsi = ?, is_dynamic_location = ? WHERE id = ?');
        const info = stmt.run(name, normalizedDescription, parseFloat(latitude), parseFloat(longitude), category, website || null, updatedIconUrl, iconSize || null, JSON.stringify(updatedImageUrls), isDefaultIconFinal, showOnMainScreenFinal, showWhenCategorySelectedFinal, aisProvider, aisApiKey, aisMmsi, isDynamicLocation, id);

        if (info.changes > 0) {
            const updatedPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
            if (updatedPlace && updatedPlace.image_urls) {
                try {
                    updatedPlace.image_urls = JSON.parse(updatedPlace.image_urls);
                } catch (e) {
                    console.error('❌ PUT - Error parsing image_urls from database:', e);
                    updatedPlace.image_urls = [];
                }
            }
            
            // Log admin activity
            logAdminActivity(
              req.admin.id,
              req.admin.email,
              'PLACE_UPDATE',
              `Updated place: ${name} (ID: ${id})`,
              req.ip
            );
            
            // Invalidate cache
            invalidatePlaceCache(id);
            
            // Update AIS subscription if dynamic location changed
            if (isDynamicLocation === 1 && aisProvider && aisApiKey && aisMmsi) {
              // Subscribe or update subscription
              const placeData = { ...updatedPlace, ais_provider: aisProvider, ais_api_key: aisApiKey, ais_mmsi: aisMmsi, is_dynamic_location: isDynamicLocation, latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
              aisService.subscribe(id, 'place', placeData);
            } else if (existingPlace && existingPlace.is_dynamic_location === 1) {
              // Unsubscribe if dynamic location was disabled
              aisService.unsubscribe(id);
            }
            
            res.json(updatedPlace);
        } else {
            res.status(404).json({ error: 'Place not found.' });
        }
    } catch (error) {
        console.error('❌ Error updating place:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});


// DELETE a place
router.delete('/:id', requireAdminAuth, (req, res) => {
  try {
    // Get place name before deleting for logging
    const place = db.prepare('SELECT name FROM places WHERE id = ?').get(req.params.id);
    
    // Unsubscribe from AIS if place was being tracked
    aisService.unsubscribe(req.params.id);
    
    const stmt = db.prepare('DELETE FROM places WHERE id = ?');
    const info = stmt.run(req.params.id);
    if (info.changes > 0) {
      // Log admin activity
      logAdminActivity(
        req.admin.id,
        req.admin.email,
        'PLACE_DELETE',
        `Deleted place: ${place ? place.name : 'Unknown'} (ID: ${req.params.id})`,
        'place',
        req.params.id,
        null,
        req
      );
      
      // Invalidate cache
      invalidatePlaceCache(req.params.id);
      
      res.status(200).json({ message: 'Place deleted successfully' });
    } else {
      res.status(404).json({ error: 'Place not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PLACE TIMETABLE ENDPOINTS
// ============================================

// Directory for place timetables
const placeTimetablesPath = path.join(__dirname, '../place-timetables');

// Ensure directory exists
if (!fs.existsSync(placeTimetablesPath)) {
  fs.mkdirSync(placeTimetablesPath, { recursive: true });
  console.log('✅ Created place-timetables directory');
}

// POST /api/places/:id/timetable - Upload/save timetable JSON file for a place
router.post('/:id/timetable', requireAdminAuth, (req, res) => {
  try {
    const placeId = req.params.id;
    const timetableData = req.body;

    // Validate place exists
    const placeStmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = placeStmt.get(placeId);
    
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Validate timetable data structure
    if (!timetableData || typeof timetableData !== 'object') {
      return res.status(400).json({ error: 'Invalid timetable data. Expected JSON object.' });
    }

    // Generate filename from place name (sanitized)
    const sanitizedPlaceName = place.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const timetableFileName = `${sanitizedPlaceName}-${placeId}.json`;
    
    // Ensure directory exists before saving
    if (!fs.existsSync(placeTimetablesPath)) {
      fs.mkdirSync(placeTimetablesPath, { recursive: true });
      console.log('✅ Created place-timetables directory at:', placeTimetablesPath);
    }
    
    const timetableFilePath = path.join(placeTimetablesPath, timetableFileName);
    console.log('📅 Saving timetable file to:', timetableFilePath);

    // Save timetable JSON file
    fs.writeFileSync(timetableFilePath, JSON.stringify(timetableData, null, 2), 'utf8');
    console.log('✅ Timetable file saved successfully:', timetableFileName);

    // Update place record with timetable filename
    const updateStmt = db.prepare('UPDATE places SET timetable_file = ? WHERE id = ?');
    const updateResult = updateStmt.run(timetableFileName, placeId);
    console.log('📅 Updated database - timetable_file set to:', timetableFileName, 'for place:', placeId, 'Rows affected:', updateResult.changes);
    
    // Verify the update
    const verifyPlace = db.prepare('SELECT id, name, timetable_file FROM places WHERE id = ?').get(placeId);
    console.log('📅 Verified place in database:', JSON.stringify(verifyPlace, null, 2));

    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'PLACE_TIMETABLE_UPLOAD',
      `Uploaded timetable for place: ${place.name} (ID: ${placeId})`,
      'place',
      placeId,
      null,
      req
    );

    // Invalidate cache
    invalidatePlaceCache(placeId);

    res.status(200).json({ 
      success: true, 
      message: 'Timetable saved successfully',
      filename: timetableFileName,
      timetable_file: timetableFileName, // Also include as timetable_file for consistency
      path: `/api/places/${placeId}/timetable`
    });
  } catch (error) {
    console.error('Error saving place timetable:', error);
    res.status(500).json({ error: 'Failed to save timetable: ' + error.message });
  }
});

// GET /api/places/:id/timetable - Get timetable data for a place
router.get('/:id/timetable', (req, res) => {
  try {
    const placeId = req.params.id;

    // Get place to find timetable filename
    const placeStmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = placeStmt.get(placeId);
    
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Check if place has a timetable file
    if (!place.timetable_file) {
      return res.status(404).json({ error: 'No timetable file associated with this place' });
    }

    const timetableFilePath = path.join(placeTimetablesPath, place.timetable_file);

    if (!fs.existsSync(timetableFilePath)) {
      return res.status(404).json({ error: 'Timetable file not found' });
    }

    // Read and return timetable data
    const timetableData = JSON.parse(fs.readFileSync(timetableFilePath, 'utf8'));
    res.json(timetableData);
  } catch (error) {
    console.error('Error reading place timetable:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Timetable file not found' });
    } else {
      res.status(500).json({ error: 'Failed to read timetable: ' + error.message });
    }
  }
});

// GET /api/places/:id/timetable/:stopName - Get timetable times for a specific stop/point (similar to bus stops)
router.get('/:id/timetable/:stopName', (req, res) => {
  try {
    const placeId = req.params.id;
    const stopName = decodeURIComponent(req.params.stopName);

    // Get place to find timetable filename
    const placeStmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = placeStmt.get(placeId);
    
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Check if place has a timetable file
    if (!place.timetable_file) {
      return res.status(404).json({ error: 'No timetable file associated with this place' });
    }

    const timetableFilePath = path.join(placeTimetablesPath, place.timetable_file);

    if (!fs.existsSync(timetableFilePath)) {
      return res.status(404).json({ error: 'Timetable file not found' });
    }

    // Read timetable data
    const timetable = JSON.parse(fs.readFileSync(timetableFilePath, 'utf8'));

    // Normalize stop name: lowercase, remove spaces, remove parentheses and their contents
    const normalizeStopName = (name) => {
      return name.toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents
        .replace(/\s+/g, '') // Remove all spaces
        .trim();
    };

    const requestedStopKey = normalizeStopName(stopName);
    let stopTimes;
    let bestMatch = null;
    let bestMatchLength = 0;

    // Handle different timetable formats:
    // Format 1: Object with stop names as keys (like bus timetables)
    // Format 2: Array with stops objects containing name and times
    if (Array.isArray(timetable)) {
      // Format 2: Array of stop objects
      for (const stop of timetable) {
        if (stop.name) {
          const normalizedKey = normalizeStopName(stop.name);
          // Exact match
          if (normalizedKey === requestedStopKey) {
            stopTimes = stop.times || stop.schedule || [];
            break;
          }
          // Partial match
          if (normalizedKey.includes(requestedStopKey) || requestedStopKey.includes(normalizedKey)) {
            const matchLength = Math.min(normalizedKey.length, requestedStopKey.length);
            if (matchLength > bestMatchLength) {
              bestMatch = stop.times || stop.schedule || [];
              bestMatchLength = matchLength;
            }
          }
        }
      }
    } else {
      // Format 1: Object with stop names as keys
      for (const key in timetable) {
        const normalizedKey = normalizeStopName(key);
        // Exact match - highest priority
        if (normalizedKey === requestedStopKey) {
          stopTimes = timetable[key];
          break;
        }
        // Partial match: check if requested stop name is contained in timetable key or vice versa
        // Prefer longer matches to avoid false positives
        if (normalizedKey.includes(requestedStopKey) || requestedStopKey.includes(normalizedKey)) {
          const matchLength = Math.min(normalizedKey.length, requestedStopKey.length);
          if (matchLength > bestMatchLength) {
            bestMatch = timetable[key];
            bestMatchLength = matchLength;
          }
        }
      }
    }

    // Use best match if no exact match found
    if (!stopTimes && bestMatch) {
      stopTimes = bestMatch;
    }

    if (stopTimes && Array.isArray(stopTimes)) {
      res.json({ times: stopTimes });
    } else {
      console.error(`Stop not found: "${stopName}" (normalized: "${requestedStopKey}") in place ${placeId}. Available stops: ${Array.isArray(timetable) ? timetable.map(s => s.name).join(', ') : Object.keys(timetable).join(', ')}`);
      res.status(404).json({ error: 'Stop not found in this timetable.' });
    }
  } catch (error) {
    console.error('Error reading place timetable:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Timetable file not found' });
    } else {
      res.status(500).json({ error: 'Failed to read timetable: ' + error.message });
    }
  }
});

// DELETE /api/places/:id/timetable - Delete timetable file for a place
router.delete('/:id/timetable', requireAdminAuth, (req, res) => {
  try {
    const placeId = req.params.id;

    // Get place to find timetable filename
    const placeStmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = placeStmt.get(placeId);
    
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    if (!place.timetable_file) {
      return res.status(404).json({ error: 'No timetable file associated with this place' });
    }

    const timetableFilePath = path.join(placeTimetablesPath, place.timetable_file);

    // Delete timetable file if it exists
    if (fs.existsSync(timetableFilePath)) {
      fs.unlinkSync(timetableFilePath);
    }

    // Remove timetable_file reference from place record
    const updateStmt = db.prepare('UPDATE places SET timetable_file = NULL WHERE id = ?');
    updateStmt.run(placeId);

    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'PLACE_TIMETABLE_DELETE',
      `Deleted timetable for place: ${place.name} (ID: ${placeId})`,
      'place',
      placeId,
      null,
      req
    );

    // Invalidate cache
    invalidatePlaceCache(placeId);

    res.status(200).json({ 
      success: true, 
      message: 'Timetable deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting place timetable:', error);
    res.status(500).json({ error: 'Failed to delete timetable: ' + error.message });
  }
});

module.exports = router;
