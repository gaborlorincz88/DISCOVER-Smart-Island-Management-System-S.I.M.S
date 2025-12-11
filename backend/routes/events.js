const express = require('express');
const router = express.Router();
const db = require('../database');
const aisService = require('../services/aisService');
const multer = require('multer');
const path = require('path');
const { imageOptimizer } = require('../middleware/imageOptimizer');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { cacheMiddlewares, cache } = require('../middleware/cache');

// Cache invalidation helper
async function invalidateEventCache(eventId = null) {
  try {
    // Invalidate lightweight events list
    await cache.delPattern('events:lightweight:*');
    // Invalidate all event lists
    await cache.delPattern('cache:/api/events*');
    
    // Invalidate specific event if ID provided
    if (eventId) {
      await cache.del(`event:${eventId}`);
      await cache.del(`cache:/api/events/${eventId}*`);
    }
  } catch (error) {
    console.warn('[Cache] Error invalidating event cache:', error.message);
  }
}

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
       cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all events (with lightweight option)
router.get('/', cacheMiddlewares.eventsLightweight, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM events ORDER BY start_datetime ASC');
        const events = stmt.all();
        
        // If lightweight=true, return minimal data
        if (req.query.lightweight === 'true') {
            const lightweightEvents = events.map(event => {
                // Parse image_urls if it's a string - handle both JSON array and simple path strings
                let imageUrls = [];
                if (event.image_urls) {
                    if (typeof event.image_urls === 'string') {
                        // Check if it's a JSON array string or a simple path string
                        if (event.image_urls.trim().startsWith('[')) {
                            try {
                                imageUrls = JSON.parse(event.image_urls);
                            } catch (e) {
                                // If parsing fails, treat as single path
                                imageUrls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
                            }
                        } else if (event.image_urls.trim().startsWith('/')) {
                            // It's a simple path string like "/uploads/image.jpg"
                            imageUrls = [event.image_urls.trim()];
                        } else {
                            // Try to parse as JSON, fallback to empty array
                            try {
                                imageUrls = JSON.parse(event.image_urls);
                            } catch (e) {
                                imageUrls = [];
                            }
                        }
                    } else if (Array.isArray(event.image_urls)) {
                        imageUrls = event.image_urls;
                    }
                }
                
                return {
                    id: event.id,
                    name: event.name,
                    description: event.description || null,
                    start_date: event.start_datetime || event.start_date || null,
                    end_date: event.end_datetime || event.end_date || null,
                    start_datetime: event.start_datetime || null,
                    end_datetime: event.end_datetime || null,
                    location: event.location || (event.latitude && event.longitude ? `${event.latitude},${event.longitude}` : null),
                    category: event.category,
                    image_url: imageUrls.length > 0 ? imageUrls[0] : null // Only first image for thumbnail
                };
            });
            return res.json(lightweightEvents);
        }
        
        // Full data
        const parsedEvents = events.map(event => {
            // Parse image_urls if it's a string - handle both JSON array and simple path strings
            if (event.image_urls) {
                if (typeof event.image_urls === 'string') {
                    // Check if it's a JSON array string or a simple path string
                    if (event.image_urls.trim().startsWith('[')) {
                        try {
                            event.image_urls = JSON.parse(event.image_urls);
                        } catch (e) {
                            // If parsing fails, treat as single path
                            event.image_urls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
                        }
                    } else if (event.image_urls.trim().startsWith('/')) {
                        // It's a simple path string like "/uploads/image.jpg"
                        event.image_urls = [event.image_urls.trim()];
                    } else {
                        // Try to parse as JSON, fallback to empty array
                        try {
                            event.image_urls = JSON.parse(event.image_urls);
                        } catch (e) {
                            event.image_urls = [];
                        }
                    }
                } else if (!Array.isArray(event.image_urls)) {
                    event.image_urls = [];
                }
            } else {
                event.image_urls = [];
            }
            return event;
        });
        
        res.json(parsedEvents);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single event (full details)
router.get('/:id', cacheMiddlewares.eventDetails, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
        const event = stmt.get(req.params.id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Parse image_urls if it's a string - handle both JSON array and simple path strings
        if (event.image_urls) {
            if (typeof event.image_urls === 'string') {
                // Check if it's a JSON array string or a simple path string
                if (event.image_urls.trim().startsWith('[')) {
                    try {
                        event.image_urls = JSON.parse(event.image_urls);
                    } catch (e) {
                        // If parsing fails, treat as single path
                        event.image_urls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
                    }
                } else if (event.image_urls.trim().startsWith('/')) {
                    // It's a simple path string like "/uploads/image.jpg"
                    event.image_urls = [event.image_urls.trim()];
                } else {
                    // Try to parse as JSON, fallback to empty array
                    try {
                        event.image_urls = JSON.parse(event.image_urls);
                    } catch (e) {
                        event.image_urls = [];
                    }
                }
            } else if (!Array.isArray(event.image_urls)) {
                event.image_urls = [];
            }
        } else {
            event.image_urls = [];
        }
        
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create event
router.post('/', requireAdminAuth, upload.array('images', 5), imageOptimizer, (req, res) => {
    try {
        const { name, description, website, latitude, longitude, start_datetime, end_datetime, category, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location } = req.body;
        
        // Basic validation
        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'Name, latitude, and longitude are required.' });
        }
        
        const isDynamicLocation = is_dynamic_location === '1' || is_dynamic_location === 1 || is_dynamic_location === true ? 1 : 0;
        const aisProvider = ais_provider || null;
        const aisApiKey = ais_api_key || null;
        const aisMmsi = ais_mmsi || null;

        // Use optimized images if available, otherwise fall back to original
        let imageUrls = [];
        
        // Add gallery-selected images (already uploaded images)
        if (req.body.gallerySelectedImages) {
            try {
                const galleryImages = JSON.parse(req.body.gallerySelectedImages);
                console.log('📸 EVENT POST - Adding gallery-selected images:', galleryImages);
                imageUrls = [...imageUrls, ...galleryImages];
            } catch (e) {
                console.error('EVENT POST - Error parsing gallery selected images:', e);
            }
        }
        
        if (req.files && req.files.length > 0) {
            if (req.optimizedImages && req.optimizedImages['images']) {
                // Use main optimized versions
                const optimizedUrls = req.optimizedImages['images']
                    .filter(img => img.size === 'main')
                    .map(img => img.optimized);
                imageUrls = [...imageUrls, ...optimizedUrls];
            } else {
                const newImageUrls = req.files.map(file => `/uploads/${file.filename}`);
                imageUrls = [...imageUrls, ...newImageUrls];
            }
        }
        
        const stmt = db.prepare('INSERT INTO events (name, description, website, latitude, longitude, start_datetime, end_datetime, image_urls, category, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(name, description, website, latitude, longitude, start_datetime, end_datetime, JSON.stringify(imageUrls), category || null, aisProvider, aisApiKey, aisMmsi, isDynamicLocation);
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'EVENT_CREATE',
            `Created event: ${name}`,
            'event',
            info.lastInsertRowid,
            null,
            req
        );
        
        console.log(`Event created successfully with ID: ${info.lastInsertRowid}`);
        
        // Invalidate cache
        invalidateEventCache();
        
        // Fetch and return the complete event object
        const stmtGet = db.prepare('SELECT * FROM events WHERE id = ?');
        const newEvent = stmtGet.get(info.lastInsertRowid);
        
        // Subscribe to AIS if dynamic location is enabled
        if (isDynamicLocation === 1 && aisProvider && aisApiKey && aisMmsi) {
          const eventData = { ...newEvent, ais_provider: aisProvider, ais_api_key: aisApiKey, ais_mmsi: aisMmsi, is_dynamic_location: isDynamicLocation, latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
          aisService.subscribe(info.lastInsertRowid, 'event', eventData);
        }
        
        res.status(201).json(newEvent);

    } catch (error) {
        console.error('Failed to create event:', error);
        res.status(500).json({ error: 'An error occurred on the server while creating the event.' });
    }
});

// Update event
router.put('/:id', requireAdminAuth, upload.array('images', 5), imageOptimizer, (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, website, latitude, longitude, start_datetime, end_datetime, existingImages, category, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'Name, latitude, and longitude are required.' });
        }
        
        // Get existing event to check if AIS settings changed
        const existingEvent = db.prepare('SELECT is_dynamic_location, ais_provider, ais_api_key, ais_mmsi FROM events WHERE id = ?').get(id);
        
        const isDynamicLocation = is_dynamic_location === '1' || is_dynamic_location === 1 || is_dynamic_location === true ? 1 : 0;
        const aisProvider = ais_provider || null;
        const aisApiKey = ais_api_key || null;
        const aisMmsi = ais_mmsi || null;

        // Use optimized images if available, otherwise fall back to original
        let newImageUrls = [];
        
        // Add gallery-selected images (already uploaded images)
        if (req.body.gallerySelectedImages) {
            try {
                const galleryImages = JSON.parse(req.body.gallerySelectedImages);
                console.log('📸 EVENT PUT - Adding gallery-selected images:', galleryImages);
                newImageUrls = [...newImageUrls, ...galleryImages];
            } catch (e) {
                console.error('EVENT PUT - Error parsing gallery selected images:', e);
            }
        }
        
        if (req.files && req.files.length > 0) {
            if (req.optimizedImages && req.optimizedImages['images']) {
                // Use main optimized versions
                const optimizedUrls = req.optimizedImages['images']
                    .filter(img => img.size === 'main')
                    .map(img => img.optimized);
                newImageUrls = [...newImageUrls, ...optimizedUrls];
            } else {
                const uploadedUrls = req.files.map(file => `/uploads/${file.filename}`);
                newImageUrls = [...newImageUrls, ...uploadedUrls];
            }
        }

        const existingImageUrls = existingImages ? JSON.parse(existingImages) : [];
        const allImageUrls = [...existingImageUrls, ...newImageUrls];

        const stmt = db.prepare('UPDATE events SET name = ?, description = ?, website = ?, latitude = ?, longitude = ?, start_datetime = ?, end_datetime = ?, image_urls = ?, category = ?, ais_provider = ?, ais_api_key = ?, ais_mmsi = ?, is_dynamic_location = ? WHERE id = ?');
        const info = stmt.run(name, description, website, latitude, longitude, start_datetime, end_datetime, JSON.stringify(allImageUrls), category || null, aisProvider, aisApiKey, aisMmsi, isDynamicLocation, id);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Event not found or no changes made.' });
        }

        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'EVENT_UPDATE',
            `Updated event: ${name} (ID: ${id})`,
            'event',
            id,
            null,
            req
        );

        // Invalidate cache
        invalidateEventCache(id);
        
        // Update AIS subscription if dynamic location changed
        if (info.changes > 0) {
          const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
          
          if (isDynamicLocation === 1 && aisProvider && aisApiKey && aisMmsi) {
            // Subscribe or update subscription
            const eventData = { ...updatedEvent, ais_provider: aisProvider, ais_api_key: aisApiKey, ais_mmsi: aisMmsi, is_dynamic_location: isDynamicLocation, latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
            aisService.subscribe(id, 'event', eventData);
          } else if (existingEvent && existingEvent.is_dynamic_location === 1) {
            // Unsubscribe if dynamic location was disabled
            aisService.unsubscribe(id);
          }
        }
        
        console.log(`Event ${id} updated successfully.`);
        res.status(200).json({ message: 'Event updated successfully' });

    } catch (error) {
        console.error(`Failed to update event ${req.params.id}:`, error);
        res.status(500).json({ error: 'An error occurred on the server while updating the event.' });
    }
});

// Delete event
router.delete('/:id', requireAdminAuth, (req, res) => {
    try {
        // Get event name before deleting for logging
        const event = db.prepare('SELECT name FROM events WHERE id = ?').get(req.params.id);
        
        // Unsubscribe from AIS if event was being tracked
        aisService.unsubscribe(req.params.id);
        
        const stmt = db.prepare('DELETE FROM events WHERE id = ?');
        const info = stmt.run(req.params.id);
        
        if (info.changes > 0 && event) {
            // Log admin activity
            logAdminActivity(
                req.admin.id,
                req.admin.email,
                'EVENT_DELETE',
                `Deleted event: ${event.name} (ID: ${req.params.id})`,
                'event',
                req.params.id,
                null,
                req
            );
            
            // Invalidate cache
            invalidateEventCache(req.params.id);
        }
        
        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error('Failed to delete event:', error);
        res.status(500).json({ error: 'An error occurred while deleting the event.' });
    }
});

module.exports = router;
