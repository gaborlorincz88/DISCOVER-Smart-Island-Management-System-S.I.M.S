
const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const QRCode = require('qrcode');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');

// Helper function to hash passwords using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// --- Multer Setup for Generic Image Uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Support folder parameter for organized uploads
    const folder = req.body.folder || '';
    const uploadDir = path.resolve(__dirname, '../uploads/', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// --- Helper Functions ---

// Helper function to get tour's mainImage from JSON file by tour name, tour ID, and category
// Uses the SAME directory structure and logic as readTourDataFromFile in tours.js
function getTourImageFromFile(tourName, category, tourId = null) {
  try {
    console.log(`\n=== getTourImageFromFile: Looking for tour image ===`);
    console.log(`Tour Name: "${tourName}"`);
    console.log(`Category: "${category}"`);
    console.log(`Tour ID: "${tourId || 'none'}"`);
    
    const routesDataDir = path.join(__dirname, '..', 'routes-data');
    console.log(`Routes data directory: ${routesDataDir}`);
    
    // Map category names to directory names - EXACTLY as readTourDataFromFile does
    let categoryDir = null;
    let categoryPath = null;
    
    if (category === 'sightseeing') {
      categoryDir = 'sightseeing';
    } else if (category === 'jeep-tour' || category === 'jeep-tours') {
      categoryDir = 'jeep-tours'; // Always use jeep-tours directory
    } else if (category === 'quad-tours') {
      categoryDir = 'quad-tours';
    } else if (category === 'boat-tour') {
      categoryDir = 'boat-tour';
    } else if (category === 'parasailing') {
      categoryDir = 'parasailing';
    } else if (category === 'hiking') {
      categoryDir = 'hiking';
    } else {
      // Try the category name as-is
      categoryDir = category;
    }
    
    if (categoryDir) {
      categoryPath = path.join(routesDataDir, categoryDir);
      console.log(`Category directory: ${categoryPath}`);
      console.log(`Directory exists: ${fs.existsSync(categoryPath)}`);
      
      // Try alternate jeep directory if needed
      if (!fs.existsSync(categoryPath) && (category === 'jeep-tour' || category === 'jeep-tours')) {
        const alternateDir = category === 'jeep-tour' ? 'jeep-tours' : 'jeep-tour';
        const alternatePath = path.join(routesDataDir, alternateDir);
        if (fs.existsSync(alternatePath)) {
          categoryDir = alternateDir;
          categoryPath = alternatePath;
          console.log(`Using alternate jeep directory: ${categoryDir}`);
        }
      }
    }
    
    if (!categoryPath || !fs.existsSync(categoryPath)) {
      console.log(`❌ Category directory not found: ${categoryPath || 'null'}`);
      return null;
    }
    
    // Get all JSON files in the category directory
    const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.json'));
    console.log(`Found ${files.length} JSON files in category directory:`, files);
    
    // FIRST: Try to find by tourId (exact filename match)
    if (tourId) {
      const tourIdFile = path.join(categoryPath, `${tourId}.json`);
      console.log(`Checking for tour file by ID: ${tourIdFile}`);
      if (fs.existsSync(tourIdFile)) {
        try {
          const tourData = JSON.parse(fs.readFileSync(tourIdFile, 'utf8'));
          console.log(`Found tour file by ID, tour name in file: "${tourData.name}"`);
          // Check mainImage first, then fall back to images array (same as ExcursionsPage)
          let imageUrl = tourData.mainImage && tourData.mainImage.trim() !== '' ? tourData.mainImage : null;
          if (!imageUrl && tourData.images && Array.isArray(tourData.images) && tourData.images.length > 0) {
            imageUrl = tourData.images[0];
            console.log(`Using first image from images array: ${imageUrl}`);
          }
          if (imageUrl && imageUrl.trim() !== '') {
            console.log(`✅ Found tour image by ID "${tourId}": ${imageUrl}`);
            return imageUrl;
          } else {
            console.log(`⚠️ Tour "${tourId}" has empty mainImage and no images in array`);
          }
        } catch (error) {
          console.error(`Error reading tour file by ID ${tourId}:`, error);
        }
      } else {
        console.log(`Tour file not found by ID: ${tourIdFile}`);
      }
    }
    
    // SECOND: Search through all files for name or ID match
    for (const file of files) {
      try {
        const filePath = path.join(categoryPath, file);
        const tourData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`Checking file ${file}: id="${tourData.id}", name="${tourData.name}"`);
        
        // Match by tour ID (if provided and matches)
        if (tourId && tourData.id) {
          const tourIdLower = tourData.id.toLowerCase().trim();
          const searchIdLower = tourId.toLowerCase().trim();
          if (tourIdLower === searchIdLower) {
            // Check mainImage first, then fall back to images array (same as ExcursionsPage)
            let imageUrl = tourData.mainImage && tourData.mainImage.trim() !== '' ? tourData.mainImage : null;
            if (!imageUrl && tourData.images && Array.isArray(tourData.images) && tourData.images.length > 0) {
              imageUrl = tourData.images[0];
              console.log(`Using first image from images array: ${imageUrl}`);
            }
            if (imageUrl && imageUrl.trim() !== '') {
              console.log(`✅ Found tour image by ID match in file "${file}": ${imageUrl}`);
              return imageUrl;
            } else {
              console.log(`⚠️ Tour ID match found but mainImage and images array are empty`);
            }
          }
        }
        
        // Match by tour name (case-insensitive, partial match)
        if (tourData.name && tourName) {
          const tourNameLower = tourData.name.toLowerCase().trim();
          const searchNameLower = tourName.toLowerCase().trim();
          
          // Exact match
          if (tourNameLower === searchNameLower) {
            // Check mainImage first, then fall back to images array (same as ExcursionsPage)
            let imageUrl = tourData.mainImage && tourData.mainImage.trim() !== '' ? tourData.mainImage : null;
            if (!imageUrl && tourData.images && Array.isArray(tourData.images) && tourData.images.length > 0) {
              imageUrl = tourData.images[0];
              console.log(`Using first image from images array: ${imageUrl}`);
            }
            if (imageUrl && imageUrl.trim() !== '') {
              console.log(`✅ Found tour image by exact name match: ${imageUrl}`);
              return imageUrl;
            } else {
              console.log(`⚠️ Exact name match found but mainImage and images array are empty`);
            }
          }
          // Partial match - check if key words match (more flexible)
          else {
            // Extract key words from both names (remove common words like "tour", "bus", etc.)
            const commonWords = ['tour', 'bus', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'];
            const tourWords = tourNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
            const searchWords = searchNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
            
            // Check if significant words match
            const matchingWords = tourWords.filter(w => searchWords.includes(w));
            const hasSignificantMatch = matchingWords.length > 0 && matchingWords.length >= Math.min(2, Math.min(tourWords.length, searchWords.length));
            
            // Also check if one contains the other (for cases like "Gozo Jeep Tour" vs "Gozo Adventure Jeep Tour")
            const containsMatch = tourNameLower.includes(searchNameLower) || searchNameLower.includes(tourNameLower);
            
            if (hasSignificantMatch || containsMatch) {
              // Check mainImage first, then fall back to images array (same as ExcursionsPage)
              let imageUrl = tourData.mainImage && tourData.mainImage.trim() !== '' ? tourData.mainImage : null;
              if (!imageUrl && tourData.images && Array.isArray(tourData.images) && tourData.images.length > 0) {
                imageUrl = tourData.images[0];
                console.log(`Using first image from images array: ${imageUrl}`);
              }
              if (imageUrl && imageUrl.trim() !== '') {
                console.log(`✅ Found tour image by name match (${hasSignificantMatch ? 'word match' : 'contains match'}): ${imageUrl}`);
                return imageUrl;
              } else {
                console.log(`⚠️ Name match found but mainImage and images array are empty`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading tour file ${file}:`, error);
        continue;
      }
    }
    
    console.log(`❌ No tour image found for "${tourName}"${tourId ? ` (ID: ${tourId})` : ''} in category "${category}"`);
    return null;
  } catch (error) {
    console.error(`❌ Error in getTourImageFromFile for "${tourName}":`, error);
    return null;
  }
}
const TILE_SERVER_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILES_DIR = path.join(__dirname, '..', 'tiles');

if (!fs.existsSync(TILES_DIR)) {
    fs.mkdirSync(TILES_DIR, { recursive: true });
}

// --- State for Download Progress ---
let downloadStatus = {
    inProgress: false,
    region: '',
    progress: 0,
    total: 0,
    message: 'Idle'
};

const regions = {
    gozo: { 
        minLat: 35.975284577825576, maxLat: 36.1086346549051, minLon: 14.150075660104186, maxLon: 14.396510748133954,
        bbox: '35.975284577825576,14.150075660104186,36.1086346549051,14.396510748133954' 
    },
    comino: { 
        minLat: 36.00, maxLat: 36.02, minLon: 14.32, maxLon: 14.35,
        bbox: '36.00,14.32,36.02,14.35' 
    }
};

const overpassCategoryQuery = {
    'Viewpoint': '[tourism=viewpoint]',
    'Historical Building': '[historic]',
    'Beach': '[natural=beach],[leisure=beach_resort]',
    'Diving Site': '[sport=scuba_diving]',
    'Nature Spot': '[leisure=nature_reserve],[leisure=park],[natural=wood],[natural=spring]',
    'Landscape': '[natural=peak],[natural=cliff],[natural=valley],[natural=rock]',
    'Food & Drink': '[amenity=restaurant],[amenity=cafe],[amenity=pub],[amenity=bar]',
    'Ferry Terminal': '[amenity=ferry_terminal]',
    'Boat Tour': '[tourism=boat_rental],[tour=boat]',
    'Bus Terminus': '[amenity=bus_station]',
    'Public Toilet': '[amenity=toilets]',
    'Art & Culture': '[amenity=theatre],[amenity=arts_centre],[tourism=museum]',
    'Shopping': '[shop]',
};

// Function to download a single tile
const downloadTile = async (z, x, y, dir) => {
    const tilePath = path.join(dir, `${z}`, `${x}`);
    const tileFile = path.join(tilePath, `${y}.png`);

    if (fs.existsSync(tileFile)) {
        return 'skipped';
    }

    fs.mkdirSync(tilePath, { recursive: true });
    const url = TILE_SERVER_URL.replace('{z}', z).replace('{y}', y).replace('{x}', x);
    
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: { 'User-Agent': 'DiscoverGozoApp/1.0' }
        });
        
        const writer = fs.createWriteStream(tileFile);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve('downloaded'));
            writer.on('error', (err) => {
                console.error(`Failed to write tile ${z}/${x}/${y}:`, err.message);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`Failed to download tile ${z}/${x}/${y}:`, error.message);
        return 'failed';
    }
};

// --- Route Handlers ---

// Test route to verify admin routes are working
router.get('/test', (req, res) => {
  console.log('=== ADMIN TEST ROUTE HIT ===');
  res.json({ message: 'Admin routes are working!' });
});

// --- Master Password Verification ---
router.post('/verify-master-password', requireAdminAuth, (req, res) => {
  try {
    const { password } = req.body;
    const MASTER_PASSWORD = 'admin123@@@'; // You can change this or make it configurable
    
    console.log('Master password verification attempt');
    console.log('Admin info:', req.admin);
    
    if (password === MASTER_PASSWORD) {
      // Log admin activity
      try {
        logAdminActivity(
          req.admin.id,
          req.admin.email,
          'ADMIN_TOOLS_UNLOCK',
          'Unlocked admin tools with master password',
          'admin_tools',
          null,
          null,
          req
        );
      } catch (logError) {
        console.error('Error logging activity:', logError);
        // Continue even if logging fails
      }
      
      res.json({ success: true, message: 'Master password verified' });
    } else {
      console.log('Incorrect password attempt');
      res.status(401).json({ success: false, message: 'Incorrect master password' });
    }
  } catch (error) {
    console.error('Error in verify-master-password:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Endpoint to start downloading map tiles
router.post('/download-tiles', requireAdminAuth, async (req, res) => {
    if (downloadStatus.inProgress) {
        return res.status(409).send('A tile download process is already in progress.');
    }

    const { region, minZoom, maxZoom } = req.body;
    if (!region || !minZoom || !maxZoom) {
        return res.status(400).send('Missing parameters: region, minZoom, maxZoom are required.');
    }

    const bounds = regions[region];
    if (!bounds) {
        return res.status(400).send('Invalid region specified.');
    }

    // Log admin activity
    logAdminActivity(
        req.admin.id,
        req.admin.email,
        'TILES_DOWNLOAD_START',
        `Started downloading tiles for ${region} (zoom ${minZoom}-${maxZoom})`,
        'tiles',
        region,
        { region, minZoom, maxZoom },
        req
    );

    res.status(202).send(`Started downloading tiles for ${region}. You can monitor the progress below.`);

    // Perform download in the background
    (async () => {
        downloadStatus = {
            inProgress: true,
            region: region,
            progress: 0,
            total: 0,
            message: `Calculating total tiles for ${region}...`
        };

        const tilesToDownload = [];
        for (let z = minZoom; z <= maxZoom; z++) {
            const startX = Math.floor((bounds.minLon + 180) / 360 * Math.pow(2, z));
            const endX = Math.floor((bounds.maxLon + 180) / 360 * Math.pow(2, z));
            const startY = Math.floor((1 - Math.log(Math.tan(bounds.maxLat * Math.PI / 180) + 1 / Math.cos(bounds.maxLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
            const endY = Math.floor((1 - Math.log(Math.tan(bounds.minLat * Math.PI / 180) + 1 / Math.cos(bounds.minLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
            
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    tilesToDownload.push({ z, x, y });
                }
            }
        }
        
        downloadStatus.total = tilesToDownload.length;
        console.log(`Starting tile download for ${region} (zooms ${minZoom}-${maxZoom}). Total tiles: ${downloadStatus.total}`);
        const regionDir = path.join(TILES_DIR, region);

        for (const tile of tilesToDownload) {
            downloadStatus.message = `Downloading tile ${tile.z}/${tile.x}/${tile.y}...`;
            await downloadTile(tile.z, tile.x, tile.y, regionDir);
            downloadStatus.progress++;
        }

        console.log(`All tiles for ${region} downloaded successfully.`);
        downloadStatus = {
            inProgress: false,
            progress: downloadStatus.total,
            total: downloadStatus.total,
            message: `Download for ${region} complete. ${downloadStatus.total} tiles processed.`
        };
    })();
});

// Endpoint to get the current download status
router.get('/download-status', (req, res) => {
    res.json(downloadStatus);
});


// Endpoint to export all places as a JSON file
router.get('/export-places', requireAdminAuth, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM places');
        const places = stmt.all();
        places.forEach(place => {
            if (place.image_urls) place.image_urls = JSON.parse(place.image_urls);
        });
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'PLACES_EXPORT',
            `Exported ${places.length} places to JSON file`,
            'places',
            null,
            { count: places.length },
            req
        );
        
        res.setHeader('Content-Disposition', 'attachment; filename=places.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(places, null, 2));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to import places from an uploaded JSON file
router.post('/import-places', requireAdminAuth, (req, res) => {
    // This requires a file upload middleware, like multer
    // For simplicity, we'll assume the file is sent in the body, which is not ideal for large files.
    // A better implementation would use multer.
    const { places } = req.body;

    if (!places || !Array.isArray(places)) {
        return res.status(400).json({ error: 'Invalid JSON format. Expected an array of places.' });
    }

    const insertStmt = db.prepare('INSERT OR REPLACE INTO places (id, name, description, latitude, longitude, category, image_urls, aiGeneratedDescription, sources) VALUES (@id, @name, @description, @latitude, @longitude, @category, @image_urls, @aiGeneratedDescription, @sources)');

    const transaction = db.transaction((items) => {
        for (const place of items) {
            insertStmt.run({
                id: place.id || null,
                name: place.name,
                description: place.description,
                latitude: place.latitude,
                longitude: place.longitude,
                category: place.category || null,
                image_urls: JSON.stringify(place.image_urls || []),
                aiGeneratedDescription: place.aiGeneratedDescription || null,
                sources: JSON.stringify(place.sources || [])
            });
        }
    });

    try {
        // Clear the table first to avoid conflicts and duplicates
        db.exec('DELETE FROM places');
        transaction(places);
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'PLACES_IMPORT',
            `Imported ${places.length} places from JSON file`,
            'places',
            null,
            { count: places.length },
            req
        );
        
        res.status(200).json({ message: `${places.length} places imported successfully.` });
    } catch (error) {
        res.status(500).json({ error: `Database error: ${error.message}` });
    }
});

// --- New Endpoint to Discover Places from OpenStreetMap ---
router.post('/discover-places', requireAdminAuth, async (req, res) => {
    const { category, region } = req.body;
    if (!category || !region) {
        return res.status(400).json({ error: 'Category and region are required.' });
    }

    const queryTags = overpassCategoryQuery[category].split(',');
    if (!queryTags || queryTags.length === 0 || queryTags[0] === '') {
        return res.status(400).json({ error: `The category "${category}" is not configured or is too generic to search for automatically.` });
    }

    const bbox = regions[region].bbox;
    
    const queryParts = queryTags.map(tag => `
        node${tag}(${bbox});
        way${tag}(${bbox});
        relation${tag}(${bbox});
    `);

    const overpassQuery = `
        [out:json][timeout:25];
        (
          ${queryParts.join('')}
        );
        out center;
    `;

    try {
        console.log(`Executing Overpass query for [${category}] in [${region}]...`);
        console.log('Query:', overpassQuery); // Log the actual query for debugging

        const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const places = response.data.elements;
        if (places.length === 0) {
            return res.json({ message: `No new places found for "${category}" in ${region}.` });
        }

        const insertStmt = db.prepare('INSERT OR IGNORE INTO places (id, name, description, latitude, longitude, category, image_urls, aiGeneratedDescription, sources) VALUES (@id, @name, @description, @latitude, @longitude, @category, @image_urls, @aiGeneratedDescription, @sources)');
        const transaction = db.transaction((items) => {
            let count = 0;
            for (const place of items) {
                if (!place.lat && !place.center) continue; // Skip if no coordinates

                const info = insertStmt.run({
                    id: place.id,
                    name: place.tags.name || `${category} Location`,
                    description: place.tags.description || `An interesting place of category: ${category}.`,
                    latitude: place.center ? place.center.lat : place.lat,
                    longitude: place.center ? place.center.lon : place.lon,
                    category: category,
                    image_urls: '[]',
                    aiGeneratedDescription: null,
                    sources: '[]'
                });
                if (info.changes > 0) count++;
            }
            return count;
        });

        const addedCount = transaction(places);
        console.log(`Found ${places.length} places, added ${addedCount} new ones to the database.`);
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'PLACES_DISCOVER',
            `Discovered ${places.length} places from OSM, added ${addedCount} new ones`,
            'places',
            null,
            { category, region, found: places.length, added: addedCount },
            req
        );
        
        res.json({ message: `Search complete. Found ${places.length} places and added ${addedCount} new ones to your database.` });

    } catch (error) {
        console.error('Overpass API error. The server returned:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Request:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
        }
        console.error('Failed Query:', overpassQuery);
        res.status(500).json({ error: 'Failed to fetch data from OpenStreetMap Overpass API. Check server logs for details.' });
    }
});

// --- New Endpoint to Discover Places from ALL Categories ---
router.post('/discover-all-places', requireAdminAuth, async (req, res) => {
    const { region } = req.body;
    if (!region) {
        return res.status(400).json({ error: 'Region is required.' });
    }

    res.status(202).send(`Started discovering all places for ${region}. This is a long process. Check the server console for progress.`);

    // Run discovery in the background
    // Log admin activity
    logAdminActivity(
        req.admin.id,
        req.admin.email,
        'PLACES_DISCOVER_ALL',
        `Started full discovery for ${region} (all categories)`,
        'places',
        region,
        { region, categories: Object.keys(overpassCategoryQuery) },
        req
    );

    (async () => {
        console.log(`--- Starting full discovery for ${region} ---`);
        let totalFound = 0;
        let totalAdded = 0;

        for (const category of Object.keys(overpassCategoryQuery)) {
            const queryTags = overpassCategoryQuery[category].split(',');
            if (!queryTags || queryTags.length === 0 || queryTags[0] === '') {
                console.log(`Skipping generic category: ${category}`);
                continue;
            }

            const bbox = regions[region].bbox;
            const queryParts = queryTags.map(tag => `
                node${tag}(${bbox});
                way${tag}(${bbox});
                relation${tag}(${bbox});
            `);
            const overpassQuery = `[out:json][timeout:90];(${queryParts.join('')});out center;`;

            try {
                console.log(`Discovering: ${category}...`);
                const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const places = response.data.elements;
                if (places.length > 0) {
                    const transaction = db.transaction((items) => {
                        let count = 0;
                        for (const place of items) {
                            if (!place.lat && !place.center) continue;
                            const info = db.prepare('INSERT OR REPLACE INTO places (id, name, description, latitude, longitude, category, image_urls, aiGeneratedDescription, sources) VALUES (@id, @name, @description, @latitude, @longitude, @category, @image_urls, @aiGeneratedDescription, @sources)').run({
                                id: place.id,
                                name: place.tags.name || `${category} Location`,
                                description: place.tags.description || `An interesting place of category: ${category}.`,
                                latitude: place.center ? place.center.lat : place.lat,
                                longitude: place.center ? place.center.lon : place.lon,
                                category: category,
                                image_urls: '[]',
                                aiGeneratedDescription: null,
                                sources: '[]'
                            });
                            if (info.changes > 0) count++;
                        }
                        return count;
                    });
                    const addedCount = transaction(places);
                    console.log(`  -> Found ${places.length}, added ${addedCount} new.`);
                    totalFound += places.length;
                    totalAdded += addedCount;
                }
                 await new Promise(resolve => setTimeout(resolve, 2000)); // Increased pause to 2 seconds
            } catch (error) {
                console.error(`Failed to discover ${category}. Error: ${error.message}. Skipping this category.`);
            }
        }
        console.log(`--- Full discovery for ${region} complete. Found ${totalFound} total places, added ${totalAdded} new ones to the database. ---`);
    })();
});

// --- Endpoint to fetch images for a place ---
router.post('/fetch-images/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body; // We only need the name for a better query
    const apiKey = process.env.PEXELS_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Pexels API key is not configured on the server.' });
    }

    // Check if the place already has images
    const place = db.prepare('SELECT image_urls FROM places WHERE id = ?').get(id);
    if (place && place.image_urls && JSON.parse(place.image_urls).length > 0) {
        // This part is tricky without direct user interaction. We'll proceed but a full implementation
        // might have a query parameter like ?overwrite=true
        console.log(`Place ${id} already has images. The new images will be appended.`);
    }

    // A more focused query is often better.
    const query = `${name} Gozo`;
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;

    try {
        console.log(`Fetching Pexels images for query: "${query}"`);
        const response = await axios.get(url, {
            headers: { 'Authorization': apiKey }
        });

        const newImageUrls = response.data.photos.map(photo => photo.src.large);
        if (newImageUrls.length === 0) {
            return res.status(404).json({ error: `No images found on Pexels for the query "${query}".` });
        }

        // Append new images to existing ones
        const existingImageUrls = place && place.image_urls ? JSON.parse(place.image_urls) : [];
        const allImageUrls = [...existingImageUrls, ...newImageUrls];
        
        // Remove duplicates
        const uniqueImageUrls = [...new Set(allImageUrls)];

        db.prepare('UPDATE places SET image_urls = ? WHERE id = ?').run(JSON.stringify(uniqueImageUrls), id);
        
        res.json({ message: `Found and saved ${newImageUrls.length} new images. Total images: ${uniqueImageUrls.length}.`, images: uniqueImageUrls });

    } catch (error) {
        console.error('Pexels API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch images from Pexels.' });
    }
});

// --- Endpoint to SEARCH for Wikipedia pages ---
router.post('/search-wiki-pages', async (req, res) => {
    const { name } = req.body;
    const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';
    const searchTerm = `${name} Gozo`;

    try {
        const searchParams = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: searchTerm,
            format: 'json',
            srlimit: 5 // Return up to 5 results for the user to choose from
        });
        const searchResponse = await axios.get(`${WIKI_API_URL}?${searchParams.toString()}`);
        const searchResults = searchResponse.data.query.search;

        if (searchResults.length === 0) {
            return res.status(404).json({ error: `No Wikipedia pages found for "${searchTerm}".` });
        }
        
        // Return just the titles
        const titles = searchResults.map(item => item.title);
        res.json({ titles });

    } catch (error) {
        console.error('Wikipedia search error:', error.message);
        res.status(500).json({ error: 'Failed to search Wikipedia. Check server logs.' });
    }
});

// --- Endpoint to fetch an image from a CONFIRMED Wikipedia page ---
router.post('/fetch-wiki-image/:id', async (req, res) => {
    const { id } = req.params;
    const { pageTitle } = req.body; // Now expects a specific page title
    const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';
    console.log(`[Wiki Fetch] Starting process for place ID: ${id}, Page: "${pageTitle}"`);

    if (!pageTitle) {
        return res.status(400).json({ error: 'A pageTitle is required.' });
    }

    try {
        // 1. Get the main image from the confirmed page
        const imageParams = new URLSearchParams({
            action: 'query',
            titles: pageTitle,
            prop: 'pageimages',
            pithumbsize: 1000, // Get a good resolution image
            format: 'json'
        });
        const imageResponse = await axios.get(`${WIKI_API_URL}?${imageParams.toString()}`);
        const pages = imageResponse.data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (!pages[pageId].thumbnail || !pages[pageId].thumbnail.source) {
            console.log(`[Wiki Fetch] Could not find a main image on the Wikipedia page for "${pageTitle}".`);
            return res.status(404).json({ error: `Could not find a main image on the Wikipedia page for "${pageTitle}".` });
        }
        const imageUrl = pages[pageId].thumbnail.source;
        console.log(`[Wiki Fetch] Found image URL: ${imageUrl}`);

        // 2. Download the image
        const imageFileName = `${Date.now()}-${path.basename(imageUrl).split('?')[0]}`;
        const localImagePath = path.join(__dirname, '..', 'uploads', imageFileName);
        const writer = fs.createWriteStream(localImagePath);
        
        console.log(`[Wiki Fetch] Downloading image to: ${localImagePath}`);
        const downloadResponse = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream'
        });

        downloadResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.log(`[Wiki Fetch] Image downloaded successfully.`);

        // 3. Update the database
        const localUrl = `/uploads/${imageFileName}`;
        const place = db.prepare('SELECT image_urls FROM places WHERE id = ?').get(id);
        const existingImageUrls = place && place.image_urls ? JSON.parse(place.image_urls) : [];
        const uniqueImageUrls = [...new Set([localUrl, ...existingImageUrls])]; // Add new image to the front

        db.prepare('UPDATE places SET image_urls = ? WHERE id = ?').run(JSON.stringify(uniqueImageUrls), id);
        console.log(`[Wiki Fetch] Database updated for place ID: ${id}`);

        res.json({ message: `Successfully fetched and saved image from Wikipedia page "${pageTitle}".`, images: uniqueImageUrls });

    } catch (error) {
        console.error('[Wiki Fetch] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch image from Wikipedia. Check server logs.' });
    }
});

// --- Endpoint to get all users with search, pagination, and sorting ---
router.get('/users', (req, res) => {
  console.log('=== ADMIN API: Getting users with filters ===');
  
  try {
    // Extract query parameters
    const {
      search = '',
      sortBy = 'created_at',
      sortOrder = 'DESC',
      page = 1,
      limit = 10
    } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    console.log('Received params:', { search, sortBy, sortOrder, page, limit });
    console.log('Calculated values:', { pageNum, limitNum, offset });
    
    // Validate sortBy parameter
    const allowedSortFields = ['email', 'created_at', 'last_login', 'role', 'total_trips', 'total_reservations'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    console.log('Valid sort field:', validSortBy, 'Order:', validSortOrder);
    
    // Build search condition
    let searchCondition = '';
    let searchParams = [];
    
    if (search.trim()) {
      searchCondition = 'WHERE email LIKE ? OR role LIKE ?';
      const searchTerm = `%${search.trim()}%`;
      searchParams = [searchTerm, searchTerm];
    }
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users 
      ${searchCondition}
    `;
    const totalResult = db.prepare(countQuery).get(...searchParams);
    const totalUsers = totalResult.total;
    const totalPages = Math.ceil(totalUsers / limitNum);
    
    // Get users with pagination and sorting - handle calculated fields
    let orderByClause;
    if (validSortBy === 'total_trips') {
      orderByClause = `(SELECT COUNT(*) FROM trips t WHERE t.user_id = u.id) ${validSortOrder}`;
    } else if (validSortBy === 'total_reservations') {
      orderByClause = `(SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) ${validSortOrder}`;
    } else {
      orderByClause = `u.${validSortBy} ${validSortOrder}`;
    }

    const usersQuery = `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.created_at, 
        u.last_login, 
        u.updated_at,
        (SELECT COUNT(*) FROM trips t WHERE t.user_id = u.id) as total_trips,
        (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) as total_reservations
      FROM users u
      ${searchCondition}
      ORDER BY ${orderByClause}
      LIMIT ? OFFSET ?
    `;
    
    console.log('ORDER BY clause:', orderByClause);
    
    let users;
    try {
      console.log('Executing query with params:', [...searchParams, limitNum, offset]);
      console.log('Query:', usersQuery);
      
      users = db.prepare(usersQuery).all(...searchParams, limitNum, offset);
      console.log(`Found ${users.length} users (page ${pageNum}/${totalPages})`);
      console.log('Users data:', users);
    } catch (sqlError) {
      console.error('SQL Error:', sqlError);
      console.error('Query:', usersQuery);
      console.error('Params:', [...searchParams, limitNum, offset]);
      
      // Fallback to simple query without joins
      const simpleQuery = `
        SELECT id, email, role, created_at, last_login, updated_at, 
               (SELECT COUNT(*) FROM trips t WHERE t.user_id = users.id) as total_trips, 
               (SELECT COUNT(*) FROM reservations r WHERE r.user_id = users.id) as total_reservations
        FROM users 
        ${searchCondition}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      console.log('Trying fallback query:', simpleQuery);
      users = db.prepare(simpleQuery).all(...searchParams, limitNum, offset);
      console.log(`Fallback query found ${users.length} users`);
    }
    
    res.json({ 
      users,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users', details: error.message });
  }
});

// --- Endpoint to migrate trips between users ---
router.post('/migrate-trips', (req, res) => {
  console.log('=== ADMIN API: Migrate trips ===');
  console.log('Request body:', req.body);
  
  const { oldUserId, newUserId } = req.body;
  
  if (!oldUserId || !newUserId) {
    return res.status(400).json({ error: 'Old user ID and new user ID are required' });
  }
  
  try {
    // Check if both users exist
    const oldUser = db.prepare('SELECT id FROM users WHERE id = ?').get(oldUserId);
    const newUser = db.prepare('SELECT id FROM users WHERE id = ?').get(newUserId);
    
    if (!oldUser || !newUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Update trips to use new user ID
    const stmt = db.prepare('UPDATE trips SET user_id = ? WHERE user_id = ?');
    const result = stmt.run(newUserId, oldUserId);
    
    console.log('Migrated trips:', result.changes);
    
    res.json({ 
      message: 'Trips migrated successfully', 
      tripsMigrated: result.changes 
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error migrating trips:', error);
    res.status(500).json({ error: 'Failed to migrate trips', details: error.message });
  }
});

// --- Endpoint to get all trips (admin only) ---
router.get('/trips', (req, res) => {
  console.log('=== ADMIN API: Getting all trips ===');
  
  try {
    const trips = db.prepare(`
      SELECT * FROM trips 
      ORDER BY updated_at DESC
    `).all();
    
    console.log('Found trips:', trips.length);
    
    // Parse JSON fields
    const parsedTrips = trips.map(trip => ({
      ...trip,
      places: JSON.parse(trip.places || '[]'),
      routeInfo: trip.route_info ? JSON.parse(trip.route_info) : {}
    }));
    
    res.json({ trips: parsedTrips });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting trips:', error);
    res.status(500).json({ error: 'Failed to get trips', details: error.message });
  }
});

// --- Endpoint to bulk migrate orphaned trips to a specific user ---
router.post('/bulk-migrate-orphaned', (req, res) => {
  console.log('=== ADMIN API: Bulk migrate orphaned trips ===');
  console.log('Request body:', req.body);
  
  const { targetUserId, orphanedUserIds } = req.body;
  
  if (!targetUserId || !orphanedUserIds || !Array.isArray(orphanedUserIds)) {
    return res.status(400).json({ 
      error: 'targetUserId and orphanedUserIds array are required' 
    });
  }
  
  try {
    // Verify target user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    
    let totalMigrated = 0;
    const migrationResults = [];
    
    // Migrate trips from each orphaned user ID
    for (const orphanedUserId of orphanedUserIds) {
      try {
        const result = db.prepare('UPDATE trips SET user_id = ? WHERE user_id = ?').run(targetUserId, orphanedUserId);
        
        if (result.changes > 0) {
          totalMigrated += result.changes;
          migrationResults.push({
            fromUserId: orphanedUserId,
            toUserId: targetUserId,
            tripsMigrated: result.changes,
            status: 'success'
          });
        }
      } catch (migrationError) {
        migrationResults.push({
          fromUserId: orphanedUserId,
          toUserId: targetUserId,
          tripsMigrated: 0,
          status: 'error',
          error: migrationError.message
        });
      }
    }
    
    console.log(`Bulk migration completed. Total trips migrated: ${totalMigrated}`);
    
    res.json({ 
      message: 'Bulk migration completed', 
      totalTripsMigrated: totalMigrated,
      migrationResults
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error bulk migrating trips:', error);
    res.status(500).json({ error: 'Failed to bulk migrate trips', details: error.message });
  }
});

// --- Endpoint to get migration history ---
router.get('/migration-history', (req, res) => {
  console.log('=== ADMIN API: Getting migration history ===');
  
  try {
    // This would typically be stored in a separate table
    // For now, we'll return a summary of current state
    const allTrips = db.prepare('SELECT user_id, COUNT(*) as trip_count FROM trips GROUP BY user_id').all();
    const allUsers = db.prepare('SELECT id, email, role FROM users').all();
    
    const migrationSummary = allTrips.map(trip => {
      const user = allUsers.find(u => u.id === trip.user_id);
      return {
        userId: trip.user_id,
        tripCount: trip.trip_count,
        userExists: !!user,
        userEmail: user ? user.email : 'Unknown',
        userRole: user ? user.role : 'Unknown',
        status: user ? 'valid' : 'orphaned'
      };
    });
    
    res.json({ migrationSummary });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting migration history:', error);
    res.status(500).json({ error: 'Failed to get migration history', details: error.message });
  }
});

// --- Endpoint to get trip analytics data ---
router.get('/trip-analytics', (req, res) => {
  console.log('=== ADMIN API: Getting trip analytics ===');
  
  try {
    // Time period filter (default: last 30 days)
    const { period = '30d' } = req.query;
    let dateFilter = '';
    
    if (period === '7d') {
      dateFilter = 'AND t.created_at >= datetime(\'now\', \'-7 days\')';
    } else if (period === '30d') {
      dateFilter = 'AND t.created_at >= datetime(\'now\', \'-30 days\')';
    } else if (period === '90d') {
      dateFilter = 'AND t.created_at >= datetime(\'now\', \'-90 days\')';
    } else if (period === '1y') {
      dateFilter = 'AND t.created_at >= datetime(\'now\', \'-1 year\')';
    }

    // Get most added places to trips
    const popularPlacesInTrips = db.prepare(`
      SELECT 
        p.name as place_name,
        p.category as place_category,
        COUNT(*) as trip_count,
        COUNT(DISTINCT t.user_id) as unique_users
      FROM trips t
      JOIN json_each(t.places) as place_data
      JOIN places p ON p.id = CAST(json_extract(place_data.value, '$.id') AS INTEGER)
      WHERE 1=1 ${dateFilter}
      GROUP BY p.id, p.name, p.category
      ORDER BY trip_count DESC
      LIMIT 10
    `).all();
    
    // Get user trip statistics
    const userTripStats = db.prepare(`
      SELECT 
        u.email,
        COUNT(t.id) as total_trips,
        SUM(json_array_length(t.places)) as total_places,
        AVG(json_array_length(t.places)) as avg_places_per_trip,
        MAX(t.created_at) as last_trip_date
      FROM users u
      LEFT JOIN trips t ON u.id = t.user_id AND (1=1 ${dateFilter})
      GROUP BY u.id, u.email
      ORDER BY total_trips DESC
      LIMIT 10
    `).all();
    
    // Get trip creation trends (by month)
    const tripCreationTrends = db.prepare(`
      SELECT 
        strftime('%Y-%m', t.created_at) as month,
        COUNT(*) as trips_created,
        COUNT(DISTINCT t.user_id) as active_users
      FROM trips t
      WHERE t.created_at IS NOT NULL ${dateFilter}
      GROUP BY strftime('%Y-%m', t.created_at)
      ORDER BY month DESC
      LIMIT 12
    `).all();
    
    // Get place category popularity in trips
    const tripCategoryPopularity = db.prepare(`
      SELECT 
        p.category,
        COUNT(*) as times_added_to_trips,
        COUNT(DISTINCT t.user_id) as unique_users
      FROM trips t
      JOIN json_each(t.places) as place_data
      JOIN places p ON p.id = CAST(json_extract(place_data.value, '$.id') AS INTEGER)
      WHERE 1=1 ${dateFilter}
      GROUP BY p.category
      ORDER BY times_added_to_trips DESC
    `).all();
    
    res.json({
      popularPlacesInTrips,
      userTripStats,
      tripCreationTrends,
      tripCategoryPopularity
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting trip analytics:', error);
    res.status(500).json({ error: 'Failed to get trip analytics', details: error.message });
  }
});

// --- Ticket Management Endpoints ---

// Get all tickets
router.get('/tickets', (req, res) => {
  console.log('=== ADMIN API: Getting all tickets ===');
  
  try {
    const tickets = db.prepare(`
      SELECT * FROM tickets 
      ORDER BY created_at DESC
    `).all();
    
    console.log('Found tickets:', tickets.length);
    res.json({ tickets });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting tickets:', error);
    res.status(500).json({ error: 'Failed to get tickets', details: error.message });
  }
});

// Update a ticket
router.put('/tickets/:ticketId', (req, res) => {
  console.log('=== ADMIN API: Updating ticket ===');
  
  const { ticketId } = req.params;
  const { main_image } = req.body;
  
  try {
    const result = db.prepare(`
      UPDATE tickets 
      SET main_image = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(main_image, ticketId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({ 
      message: 'Ticket updated successfully'
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket', details: error.message });
  }
});

// Get all reservations with filtering, search, and pagination
router.get('/reservations', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Getting reservations with filters ===');
  
  try {
    const {
      search = '',
      status = '',
      date = '',
      page = 1,
      limit = 20
    } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    console.log('Received params:', { search, status, date, page, limit });
    
    // Build search conditions
    let whereConditions = [];
    let params = [];
    
    if (search.trim()) {
      whereConditions.push(`(r.customer_name LIKE ? OR u.username LIKE ? OR r.contact_email LIKE ? OR r.tour_name LIKE ? OR u.email LIKE ?)`);
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (status) {
      whereConditions.push(`r.status = ?`);
      params.push(status);
    }
    
    if (date) {
      whereConditions.push(`DATE(r.reservation_date) = ?`);
      params.push(date);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN tickets t ON r.ticket_id = t.id
      ${whereClause}
    `;
    const totalResult = db.prepare(countQuery).get(...params);
    const totalReservations = totalResult.total;
    const totalPages = Math.ceil(totalReservations / limitNum);
    
    // Get reservations with pagination
    const reservationsQuery = `
      SELECT 
        r.*,
        u.email as user_email,
        COALESCE(r.customer_name, u.username) as customer_name,
        t.name as ticket_name,
        t.category as ticket_category,
        t.price as ticket_price
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN tickets t ON r.ticket_id = t.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const reservations = db.prepare(reservationsQuery).all(...params, limitNum, offset);
    
    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_price ELSE 0 END) as revenue
      FROM reservations
    `;
    const stats = db.prepare(statsQuery).get();
    
    console.log(`Found ${reservations.length} reservations (page ${pageNum}/${totalPages})`);
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATIONS_VIEW',
      `Viewed reservations page (${reservations.length} results)`,
      'reservations',
      null,
      { search, status, date, page: pageNum },
      req
    );
    
    res.json({ 
      reservations,
      total: totalReservations,
      totalPages,
      currentPage: pageNum,
      stats
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting reservations:', error);
    res.status(500).json({ error: 'Failed to get reservations', details: error.message });
  }
});

// Get user details with trips and reservations
router.get('/user/:userId', (req, res) => {
  console.log('=== ADMIN API: Getting user details ===');
  console.log('User ID:', req.params.userId);
  
  const { userId } = req.params;
  
  try {
    // Get user basic info
    console.log('Getting user basic info...');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User found:', user.email);
    
    // Get user trips
    console.log('Getting user trips...');
    const trips = db.prepare(`
      SELECT * FROM trips 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    
    console.log('Found trips:', trips.length);
    
    // Parse JSON fields in trips
    const parsedTrips = trips.map(trip => {
      try {
        return {
          ...trip,
          places: JSON.parse(trip.places || '[]'),
          routeInfo: trip.route_info ? JSON.parse(trip.route_info) : {}
        };
      } catch (parseError) {
        console.error('Error parsing trip JSON:', parseError);
        return {
          ...trip,
          places: [],
          routeInfo: {}
        };
      }
    });
    
    // Get user reservations
    console.log('Getting user reservations...');
    let reservations = [];
    try {
      // Check if reservations table exists
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'").get();
      if (tableExists) {
        reservations = db.prepare(`
          SELECT 
            r.*,
            t.name as ticket_name,
            t.category as ticket_category,
            t.price as ticket_price
          FROM reservations r
          JOIN tickets t ON r.ticket_id = t.id
          WHERE r.user_id = ?
          ORDER BY r.created_at DESC
        `).all(userId);
        console.log('Found reservations:', reservations.length);
      } else {
        console.log('Reservations table does not exist yet');
      }
    } catch (reservationError) {
      console.error('Error getting reservations:', reservationError);
      reservations = [];
    }
    
    console.log('Sending response...');
    res.json({
      user,
      trips: parsedTrips,
      reservations
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting user details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to get user details', details: error.message });
  }
});

// Update reservation status
router.put('/reservations/:reservationId/status', (req, res) => {
  console.log('=== ADMIN API: Updating reservation status ===');
  
  const { reservationId } = req.params;
  const { status, validation_status } = req.body;
  
  if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: pending, confirmed, cancelled, or completed' });
  }
  
  try {
    // Update both status and validation_status if provided
    let updateQuery = 'UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP';
    let params = [status, reservationId];
    
    if (validation_status) {
      updateQuery += ', validation_status = ?';
      params = [status, validation_status, reservationId];
    }
    
    updateQuery += ' WHERE id = ?';
    
    const result = db.prepare(updateQuery).run(...params);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json({ 
      message: 'Reservation status updated successfully',
      status: status
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error updating reservation status:', error);
    res.status(500).json({ error: 'Failed to update reservation status', details: error.message });
  }
});

// Update reservation details
router.put('/reservations/:reservationId', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Updating reservation details ===');
  
  const { reservationId } = req.params;
  const { 
    customer_name, 
    contact_email, 
    contact_phone, 
    quantity, 
    total_price, 
    status,
    reservation_date, 
    reservation_time, 
    special_requests 
  } = req.body;
  
  try {
    // Get current reservation for logging
    const currentReservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
    
    if (!currentReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    const result = db.prepare(`
      UPDATE reservations 
      SET customer_name = ?, contact_email = ?, contact_phone = ?, quantity = ?, 
          total_price = ?, status = ?, reservation_date = ?, reservation_time = ?, 
          special_requests = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      customer_name, contact_email, contact_phone, quantity, 
      total_price, status, reservation_date, reservation_time, 
      special_requests, reservationId
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATION_UPDATE',
      `Updated reservation: ${customer_name || 'Unknown'} - ${currentReservation.tour_name || 'Unknown'}`,
      'reservations',
      reservationId,
      { 
        customer_name,
        contact_email,
        quantity,
        total_price,
        status,
        changes: {
          customer_name: currentReservation.customer_name !== customer_name,
          contact_email: currentReservation.contact_email !== contact_email,
          quantity: currentReservation.quantity !== quantity,
          total_price: currentReservation.total_price !== total_price,
          status: currentReservation.status !== status
        }
      },
      req
    );
    
    res.json({ 
      message: 'Reservation updated successfully'
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Failed to update reservation', details: error.message });
  }
});

// Process refund for reservation
router.post('/reservations/:reservationId/refund', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Processing refund ===');
  
  const { reservationId } = req.params;
  const { amount, reason, notes } = req.body;
  
  try {
    // Get reservation details
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Update reservation status to cancelled
    const updateResult = db.prepare(`
      UPDATE reservations 
      SET status = 'cancelled', 
          updated_at = CURRENT_TIMESTAMP,
          refund_amount = ?,
          refund_reason = ?,
          refund_notes = ?,
          refund_processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(amount, reason, notes, reservationId);
    
    if (updateResult.changes === 0) {
      return res.status(500).json({ error: 'Failed to process refund' });
    }
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATION_REFUND',
      `Processed refund for reservation ${reservationId} (€${amount})`,
      'reservations',
      reservationId,
      { amount, reason, notes },
      req
    );
    
    res.json({ 
      message: 'Refund processed successfully',
      refundAmount: amount,
      reason: reason
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund', details: error.message });
  }
});

// Delete reservation
router.delete('/reservations/:reservationId', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Deleting reservation ===');
  
  const { reservationId } = req.params;
  
  try {
    // Get reservation details for logging
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    const result = db.prepare('DELETE FROM reservations WHERE id = ?').run(reservationId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATION_DELETE',
      `Deleted reservation: ${reservation.tour_name || 'Unknown'} (${reservation.customer_name || 'Unknown'})`,
      'reservations',
      reservationId,
      { 
        tour_name: reservation.tour_name,
        customer_name: reservation.customer_name,
        total_price: reservation.total_price
      },
      req
    );
    
    res.json({ 
      message: 'Reservation deleted successfully'
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: 'Failed to delete reservation', details: error.message });
  }
});

// Reset user password (admin only)
router.post('/users/:userId/reset-password', (req, res) => {
  console.log('=== ADMIN API: Resetting user password ===');
  
  const { userId } = req.params;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  try {
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    
    const result = db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(passwordHash, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Update user role (admin only)
router.put('/users/:userId/role', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Updating user role ===');
  console.log('Request body:', req.body);
  console.log('Admin info:', req.admin);
  
  const { userId } = req.params;
  const { role } = req.body;
  const admin = req.admin;
  
  if (!admin) {
    console.error('Admin info is missing from request!');
    return res.status(500).json({ error: 'Authentication error: admin info missing' });
  }
  
  // Validation
  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
  }
  
  try {
    // Check if user exists
    const user = db.prepare('SELECT id, email, username, role FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent changing your own role (security measure)
    if (user.id === admin.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    
    // Update user role
    const result = db.prepare(`
      UPDATE users 
      SET role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(role, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Log admin activity
    logAdminActivity(
      admin.id,
      admin.email,
      'USER_ROLE_UPDATE',
      `Updated role for user: ${user.email || user.username} (${user.id}) from ${user.role} to ${role}`,
      'user',
      userId,
      {
        old_role: user.role,
        new_role: role,
        user_email: user.email,
        user_username: user.username
      },
      req
    );
    
    console.log(`Updated user role: ${userId} from ${user.role} to ${role}`);
    res.json({ 
      message: 'User role updated successfully',
      user: {
        id: userId,
        role: role
      }
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role', details: error.message });
  }
});

// Create new user (admin only)
router.post('/users/create', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Creating new user ===');
  console.log('Request body:', req.body);
  console.log('Admin info:', req.admin);
  
  const { email, username, password, location, role } = req.body;
  const admin = req.admin;
  
  if (!admin) {
    console.error('Admin info is missing from request!');
    return res.status(500).json({ error: 'Authentication error: admin info missing' });
  }
  
  // Validation
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
  }
  
  try {
    const crypto = require('crypto');
    
    // NOTE: Email can be duplicated in admin UI (for testing purposes)
    // This allows creating admin accounts with same email as regular users
    
    // Check if username already exists (usernames must still be unique)
    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create user
    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, location, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, email, username, passwordHash, location || null, role || 'user');
    
    console.log('User created successfully:', userId);
    
    // Log activity
    logAdminActivity(
      admin.id,
      admin.email,
      'USER_CREATE',
      `Created new ${role || 'user'} account: ${username}`,
      'user',
      userId,
      { email, username, role: role || 'user', location },
      req
    );
    
    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        email,
        username,
        role: role || 'user'
      }
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Get orphaned trips
router.get('/orphaned-trips', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Getting orphaned trips ===');
  
  try {
    // Find trips whose user_id doesn't exist in users table
    const orphanedTrips = db.prepare(`
      SELECT t.* 
      FROM trips t 
      LEFT JOIN users u ON t.user_id = u.id 
      WHERE u.id IS NULL
      ORDER BY t.created_at DESC
    `).all();
    
    console.log('Found orphaned trips:', orphanedTrips.length);
    
    res.json({
      success: true,
      trips: orphanedTrips
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting orphaned trips:', error);
    res.status(500).json({ error: 'Failed to get orphaned trips', details: error.message });
  }
});

// Migrate orphaned trip to a user
router.post('/orphaned-trips/:tripId/migrate', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Migrating orphaned trip ===');
  
  const { tripId } = req.params;
  const { userId } = req.body;
  const admin = req.admin;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Verify user exists
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get trip info
    const trip = db.prepare('SELECT name FROM trips WHERE id = ?').get(tripId);
    
    // Update trip
    const result = db.prepare(`
      UPDATE trips 
      SET user_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(userId, tripId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    console.log(`Trip ${tripId} migrated to user ${userId}`);
    
    // Log activity
    logAdminActivity(
      admin.id,
      admin.email,
      'TRIP_MIGRATE',
      `Migrated orphaned trip "${trip?.name || tripId}" to user ${user.email}`,
      'trip',
      tripId,
      { from_user: 'orphaned', to_user: userId, trip_name: trip?.name },
      req
    );
    
    res.json({
      success: true,
      message: `Trip migrated to user ${user.email}`
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error migrating trip:', error);
    res.status(500).json({ error: 'Failed to migrate trip', details: error.message });
  }
});

// Delete orphaned trip
router.delete('/orphaned-trips/:tripId', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Deleting orphaned trip ===');
  
  const { tripId } = req.params;
  const admin = req.admin;
  
  try {
    // Get trip info before deletion
    const trip = db.prepare('SELECT name, user_id FROM trips WHERE id = ?').get(tripId);
    
    const result = db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    console.log(`Orphaned trip ${tripId} deleted`);
    
    // Log activity
    logAdminActivity(
      admin.id,
      admin.email,
      'TRIP_DELETE',
      `Deleted orphaned trip "${trip?.name || tripId}"`,
      'trip',
      tripId,
      { trip_name: trip?.name, was_orphaned: true },
      req
    );
    
    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip', details: error.message });
  }
});

// Get admin activity logs
router.get('/activity-logs', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Getting activity logs ===');
  
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const logs = db.prepare(`
      SELECT * FROM admin_activity_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));
    
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM admin_activity_logs').get().count;
    
    console.log('Found activity logs:', logs.length);
    
    res.json({
      success: true,
      logs,
      totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting activity logs:', error);
    res.status(500).json({ error: 'Failed to get activity logs', details: error.message });
  }
});

// --- Frontend Ticket Management Endpoints ---

// Create a new reservation (for frontend)
router.post('/reservations', (req, res) => {
  console.log('=== FRONTEND API: Creating reservation ===');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
  const { 
    userId, 
    ticketId, 
    tourName,
    originalTourId, // Original tour ID before mapping (e.g., 'comino-tour')
    quantity, 
    totalPrice, 
    reservationDate, 
    reservationTime, 
    specialRequests, 
    contactEmail, 
    contactPhone,
    customerName,
    adults,
    children,
    seniors
  } = req.body;
  
  if (!userId || !ticketId || !quantity || !totalPrice || !reservationDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Generate GOZO-format reservation ID: GOZO-YYYYMMDD-XXXXX
    // Use Malta timezone for date consistency
    const now = new Date();
    const maltaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Malta' }); // YYYY-MM-DD
    const dateStr = maltaDateStr.replace(/-/g, ''); // YYYYMMDD
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    const reservationId = `GOZO-${dateStr}-${randomStr}`;
    
    // Get ticket category from tickets table
    const ticket = db.prepare('SELECT category, main_image FROM tickets WHERE id = ?').get(ticketId);
    const ticketCategory = ticket?.category || null;
    
    // Reverse mapping: map category ticket ID back to original tour ID if not provided
    const ticketToTourMapping = {
      'ticket-1': 'gozo-bus-tour', // Default sightseeing, but will be overridden by actual tour
      'ticket-2': 'comino-tour',
      'ticket-3': 'hiking-tour', // Default hiking, but will be overridden by actual trail
      'ticket-4': 'coastal-explorer',
      'ticket-5': 'parasailing-1'
    };
    
    // Also try to detect tour ID from tour name if originalTourId not provided
    let detectedTourId = originalTourId;
    if (!detectedTourId && tourName) {
      const tourNameLower = tourName.toLowerCase();
      // Detect jeep tours
      if (tourNameLower.includes('jeep') || tourNameLower.includes('gozo adventure')) {
        detectedTourId = 'gozo-adventure';
        console.log(`Detected jeep tour ID from name "${tourName}": gozo-adventure`);
      }
      // Detect sightseeing bus tours
      else if (tourNameLower.includes('green bus') || tourNameLower === 'green bus') {
        detectedTourId = 'green-bus';
        console.log(`Detected green bus from name "${tourName}"`);
      }
      else if (tourNameLower.includes('sightseeing bus') || tourNameLower === 'sightseeing bus') {
        detectedTourId = 'sightseeing-bus';
        console.log(`Detected sightseeing bus from name "${tourName}"`);
      }
      else if (tourNameLower.includes('orange bus') || tourNameLower === 'orange bus') {
        detectedTourId = 'orange-bus';
        console.log(`Detected orange bus from name "${tourName}"`);
      }
      // Detect hiking trails
      else if (tourNameLower.includes('comino walk') || tourNameLower === 'comino walk') {
        detectedTourId = 'comino-walk';
        console.log(`Detected hiking trail from name "${tourName}": comino-walk`);
      }
      else if (tourNameLower.includes('dwejra walk') || tourNameLower === 'dwejra walk') {
        detectedTourId = 'dwejra-walk';
        console.log(`Detected hiking trail from name "${tourName}": dwejra-walk`);
      }
      // Detect quad tours
      else if (tourNameLower.includes('coastal explorer') || tourNameLower.includes('quad')) {
        detectedTourId = 'coastal-explorer';
        console.log(`Detected quad tour from name "${tourName}": coastal-explorer`);
      }
      // Detect parasailing
      else if (tourNameLower.includes('parasailing')) {
        detectedTourId = 'parasailing-1';
        console.log(`Detected parasailing from name "${tourName}": parasailing-1`);
      }
      // Detect boat tours
      else if (tourNameLower.includes('comino') && tourNameLower.includes('tour')) {
        detectedTourId = 'comino-tour';
        console.log(`Detected boat tour from name "${tourName}": comino-tour`);
      }
    }
    
    const actualTourId = detectedTourId || ticketToTourMapping[ticketId] || null;
    
    // Map tour ID to actual category (not ticket category, which might be wrong)
    const tourToCategoryMapping = {
      'gozo-adventure': 'jeep-tour',
      'comino-tour': 'boat-tour',
      'gozo-bus-tour': 'sightseeing',
      'green-bus': 'sightseeing',
      'sightseeing-bus': 'sightseeing',
      'orange-bus': 'sightseeing',
      'hiking-tour': 'hiking',
      'comino-walk': 'hiking',
      'dwejra-walk': 'hiking',
      'coastal-explorer': 'quad-tours',
      'parasailing-1': 'parasailing'
    };
    
    // Detect category from tour name if category is wrong
    let detectedCategory = ticketCategory;
    if (tourName) {
      const tourNameLower = tourName.toLowerCase();
      if (tourNameLower.includes('jeep') || tourNameLower.includes('gozo adventure')) {
        detectedCategory = 'jeep-tour';
        console.log(`Detected jeep tour from name "${tourName}", using category: jeep-tour`);
      }
      else if (tourNameLower.includes('walk') || tourNameLower.includes('hiking') || tourNameLower.includes('trail')) {
        detectedCategory = 'hiking';
        console.log(`Detected hiking from name "${tourName}", using category: hiking`);
      }
      else if (tourNameLower.includes('quad') || tourNameLower.includes('coastal explorer')) {
        detectedCategory = 'quad-tours';
        console.log(`Detected quad tour from name "${tourName}", using category: quad-tours`);
      }
      else if (tourNameLower.includes('parasailing')) {
        detectedCategory = 'parasailing';
        console.log(`Detected parasailing from name "${tourName}", using category: parasailing`);
      }
      else if ((tourNameLower.includes('comino') || tourNameLower.includes('boat')) && !tourNameLower.includes('walk')) {
        detectedCategory = 'boat-tour';
        console.log(`Detected boat tour from name "${tourName}", using category: boat-tour`);
      }
      else if (tourNameLower.includes('bus') || tourNameLower.includes('sightseeing')) {
        detectedCategory = 'sightseeing';
        console.log(`Detected sightseeing from name "${tourName}", using category: sightseeing`);
      }
    }
    
    // Use the tour's actual category, not the ticket category (which might be wrong)
    const actualCategory = actualTourId ? (tourToCategoryMapping[actualTourId] || detectedCategory) : detectedCategory;
    
    // Try to get the actual tour's image from JSON file first
    let ticketImage = null;
    if ((tourName || actualTourId) && actualCategory) {
      ticketImage = getTourImageFromFile(tourName, actualCategory, actualTourId);
      console.log(`Tour image lookup for "${tourName || actualTourId}" in category "${actualCategory}": ${ticketImage || 'not found'}`);
    }
    
    // Fall back to category ticket image if tour image not found
    if (!ticketImage && ticket?.main_image) {
      ticketImage = ticket.main_image;
      console.log(`Using category ticket image as fallback: ${ticketImage}`);
    }
    
    const result = db.prepare(`
      INSERT INTO reservations (
        id, user_id, ticket_id, tour_name, quantity, total_price, currency, 
        status, reservation_date, reservation_time, special_requests, 
        contact_email, contact_phone, customer_name, ticket_image, adults, children, seniors, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      reservationId, userId, ticketId, tourName || null, quantity, totalPrice, 'EUR',
      'confirmed', reservationDate, reservationTime || null, specialRequests || null,
      contactEmail || null, contactPhone || null, customerName || null, ticketImage, adults || 0, children || 0, seniors || 0
    );
    
    res.json({ 
      message: 'Reservation created successfully',
      reservationId: reservationId
    });
    
  } catch (error) {
    console.error('=== FRONTEND API ERROR ===');
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation', details: error.message });
  }
});

// Get user reservations (for frontend)
router.get('/user/:userId/reservations', (req, res) => {
  console.log('=== FRONTEND API: Getting user reservations ===');
  
  const { userId } = req.params;
  
  try {
    const reservations = db.prepare(`
      SELECT 
        r.*,
        t.name as ticket_name,
        t.category as ticket_category,
        t.price as ticket_price,
        COALESCE(r.ticket_image, t.main_image) as ticket_image
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);
    
    // Map validation_status to display status and update ticket_image with tour image if needed
    const mappedReservations = reservations.map(reservation => {
      console.log(`\n=== Processing reservation: ${reservation.id} ===`);
      console.log(`Tour name: ${reservation.tour_name}`);
      console.log(`Ticket ID: ${reservation.ticket_id}`);
      console.log(`Ticket category: ${reservation.ticket_category}`);
      console.log(`Current ticket_image: ${reservation.ticket_image}`);
      
      // Reverse mapping: map category ticket ID back to original tour ID
      const ticketToTourMapping = {
        'ticket-1': 'gozo-bus-tour', // Default sightseeing
        'ticket-2': 'comino-tour',
        'ticket-3': 'hiking-tour', // Default hiking
        'ticket-4': 'coastal-explorer',
        'ticket-5': 'parasailing-1'
      };
      
      // Also try to detect tour ID from tour name
      let detectedTourId = ticketToTourMapping[reservation.ticket_id] || null;
      if (reservation.tour_name) {
        const tourNameLower = reservation.tour_name.toLowerCase();
        // Detect jeep tours - check for "Gozo Jeep Tour" or "Gozo Adventure Jeep Tour"
        if (tourNameLower.includes('jeep') || tourNameLower.includes('gozo adventure')) {
          detectedTourId = 'gozo-adventure';
          console.log(`✅ Detected jeep tour ID from name "${reservation.tour_name}": gozo-adventure`);
        }
        // Also check for "Gozo Jeep Tour" specifically (without "Adventure")
        if (tourNameLower === 'gozo jeep tour' || tourNameLower.includes('gozo jeep tour')) {
          detectedTourId = 'gozo-adventure';
          console.log(`✅ Detected "Gozo Jeep Tour" specifically: gozo-adventure`);
        }
        // Detect sightseeing bus tours
        else if (tourNameLower.includes('green bus') || tourNameLower === 'green bus') {
          detectedTourId = 'green-bus';
          console.log(`✅ Detected green bus from name "${reservation.tour_name}"`);
        }
        else if (tourNameLower.includes('sightseeing bus') || tourNameLower === 'sightseeing bus') {
          detectedTourId = 'sightseeing-bus';
          console.log(`✅ Detected sightseeing bus from name "${reservation.tour_name}"`);
        }
        else if (tourNameLower.includes('orange bus') || tourNameLower === 'orange bus') {
          detectedTourId = 'orange-bus';
          console.log(`✅ Detected orange bus from name "${reservation.tour_name}"`);
        }
        // Detect hiking trails
        else if (tourNameLower.includes('comino walk') || tourNameLower === 'comino walk') {
          detectedTourId = 'comino-walk';
          console.log(`✅ Detected hiking trail from name "${reservation.tour_name}": comino-walk`);
        }
        else if (tourNameLower.includes('dwejra walk') || tourNameLower === 'dwejra walk') {
          detectedTourId = 'dwejra-walk';
          console.log(`✅ Detected hiking trail from name "${reservation.tour_name}": dwejra-walk`);
        }
        // Detect quad tours
        else if (tourNameLower.includes('coastal explorer') || tourNameLower.includes('quad')) {
          detectedTourId = 'coastal-explorer';
          console.log(`✅ Detected quad tour from name "${reservation.tour_name}": coastal-explorer`);
        }
        // Detect parasailing
        else if (tourNameLower.includes('parasailing')) {
          detectedTourId = 'parasailing-1';
          console.log(`✅ Detected parasailing from name "${reservation.tour_name}": parasailing-1`);
        }
        // Detect boat tours
        else if (tourNameLower.includes('comino') && tourNameLower.includes('tour') && !tourNameLower.includes('walk')) {
          detectedTourId = 'comino-tour';
          console.log(`✅ Detected boat tour from name "${reservation.tour_name}": comino-tour`);
        }
      }
      
      const actualTourId = detectedTourId;
      console.log(`Actual tour ID: ${actualTourId}`);
      
      // Map tour ID to actual category (not ticket category, which might be wrong)
      const tourToCategoryMapping = {
        'gozo-adventure': 'jeep-tour',
        'comino-tour': 'boat-tour',
        'gozo-bus-tour': 'sightseeing',
        'green-bus': 'sightseeing',
        'sightseeing-bus': 'sightseeing',
        'orange-bus': 'sightseeing',
        'hiking-tour': 'hiking',
        'comino-walk': 'hiking',
        'dwejra-walk': 'hiking',
        'coastal-explorer': 'quad-tours',
        'parasailing-1': 'parasailing'
      };
      
      // Detect category from tour name if category is wrong
      let detectedCategory = reservation.ticket_category;
      if (reservation.tour_name) {
        const tourNameLower = reservation.tour_name.toLowerCase();
        if (tourNameLower.includes('jeep') || tourNameLower.includes('gozo adventure')) {
          detectedCategory = 'jeep-tour';
          console.log(`✅ Detected jeep tour from name "${reservation.tour_name}", using category: jeep-tour`);
        }
        else if (tourNameLower.includes('walk') || tourNameLower.includes('hiking') || tourNameLower.includes('trail')) {
          detectedCategory = 'hiking';
          console.log(`✅ Detected hiking from name "${reservation.tour_name}", using category: hiking`);
        }
        else if (tourNameLower.includes('quad') || tourNameLower.includes('coastal explorer')) {
          detectedCategory = 'quad-tours';
          console.log(`✅ Detected quad tour from name "${reservation.tour_name}", using category: quad-tours`);
        }
        else if (tourNameLower.includes('parasailing')) {
          detectedCategory = 'parasailing';
          console.log(`✅ Detected parasailing from name "${reservation.tour_name}", using category: parasailing`);
        }
        else if ((tourNameLower.includes('comino') || tourNameLower.includes('boat')) && !tourNameLower.includes('walk')) {
          detectedCategory = 'boat-tour';
          console.log(`✅ Detected boat tour from name "${reservation.tour_name}", using category: boat-tour`);
        }
        else if (tourNameLower.includes('bus') || tourNameLower.includes('sightseeing')) {
          detectedCategory = 'sightseeing';
          console.log(`✅ Detected sightseeing from name "${reservation.tour_name}", using category: sightseeing`);
        }
      }
      
      // Use the tour's actual category, not the ticket category (which might be wrong)
      const actualCategory = actualTourId ? (tourToCategoryMapping[actualTourId] || detectedCategory) : detectedCategory;
      console.log(`Actual category: ${actualCategory}`);
      
      // ALWAYS try to get the tour image first, even if ticket_image exists (it might be wrong)
      let ticketImage = null;
      if ((reservation.tour_name || actualTourId) && actualCategory) {
        console.log(`\n🔍 Looking for tour image:`);
        console.log(`  Tour name: "${reservation.tour_name}"`);
        console.log(`  Tour ID: "${actualTourId}"`);
        console.log(`  Category: "${actualCategory}"`);
        
        // Try with the detected tour ID first
        if (actualTourId) {
          ticketImage = getTourImageFromFile(reservation.tour_name, actualCategory, actualTourId);
          if (ticketImage && ticketImage.trim() !== '') {
            console.log(`✅ Found tour image by tour ID "${actualTourId}": ${ticketImage}`);
          }
        }
        
        // If not found, try without tour ID (just by name and category)
        if (!ticketImage || ticketImage.trim() === '') {
          ticketImage = getTourImageFromFile(reservation.tour_name, actualCategory, null);
          if (ticketImage && ticketImage.trim() !== '') {
            console.log(`✅ Found tour image by name only: ${ticketImage}`);
          }
        }
        
        // Filter out empty strings
        if (ticketImage && (ticketImage.trim() === '' || ticketImage === 'null' || ticketImage === 'undefined')) {
          ticketImage = null;
        }
        
        if (ticketImage) {
          console.log(`✅✅✅ FINAL: Using tour image: ${ticketImage}`);
        } else {
          console.log(`❌❌❌ FAILED: No tour image found for "${reservation.tour_name || actualTourId}" in category "${actualCategory}"`);
          console.log(`   Will fall back to stored/category ticket image: ${reservation.ticket_image || 'none'}`);
        }
      }
      
      // Fall back to stored ticket_image or category ticket image if tour image not found
      // BUT ONLY if it's a valid tour-specific image, not a generic category image
      if (!ticketImage && reservation.ticket_image) {
        // Filter out empty strings from stored image too
        if (reservation.ticket_image.trim() !== '' && reservation.ticket_image !== 'null' && reservation.ticket_image !== 'undefined') {
          // Check if it's a generic category image (like bus-tour.jpg, quad-bike.jpg, comino-boat.jpg)
          const genericImages = ['bus-tour.jpg', 'quad-bike.jpg', 'comino-boat.jpg', 'hiking-trail.jpg', 'parasailing.jpg'];
          const isGenericImage = genericImages.some(gen => reservation.ticket_image.includes(gen));
          
          if (isGenericImage) {
            console.log(`⚠️ Stored ticket_image is a generic category image (${reservation.ticket_image}), NOT using it. Tour-specific image lookup failed.`);
            // Don't use generic category images - return null so frontend can use tourData fallback
            ticketImage = null;
          } else {
            ticketImage = reservation.ticket_image;
            console.log(`✅ Using stored/category ticket image (not generic): ${ticketImage}`);
          }
        } else {
          console.log(`Stored ticket_image is empty, skipping fallback`);
        }
      }
      
      const result = {
        ...reservation,
        ticket_image: ticketImage,
        display_status: reservation.validation_status === 'completed' ? 'Completed' : 
                      reservation.validation_status === 'pending' ? 'Pending' : 
                      reservation.validation_status || 'Pending'
      };
      
      console.log(`Final ticket_image for reservation ${reservation.id}: ${result.ticket_image || 'NULL/EMPTY'}`);
      
      return result;
    });
    
    console.log(`\n=== Returning ${mappedReservations.length} reservations ===`);
    mappedReservations.forEach((r, i) => {
      console.log(`Reservation ${i + 1}: "${r.tour_name}" - ticket_image: ${r.ticket_image || 'NULL/EMPTY'}`);
    });
    
    res.json({ reservations: mappedReservations });
    
  } catch (error) {
    console.error('=== FRONTEND API ERROR ===');
    console.error('Error getting user reservations:', error);
    res.status(500).json({ error: 'Failed to get reservations', details: error.message });
  }
});

// --- MERCHANT MANAGEMENT ENDPOINTS ---

// Get available tours for merchant assignment
router.get('/tours/available', (req, res) => {
  console.log('=== ADMIN API: Getting available tours for assignment ===');
  
  try {
    // Get all tickets from the database (including inactive ones for admin visibility)
    const tickets = db.prepare(`
      SELECT id, name, category, price, currency, is_active
      FROM tickets 
      ORDER BY category, name
    `).all();
    
    console.log(`Found ${tickets.length} total category tickets:`, tickets.map(t => `${t.id}: ${t.name} (${t.category}) - Active: ${t.is_active}`));
    
    // Load individual tours from JSON files
    const routesDataDir = path.join(__dirname, '..', 'routes-data');
    const toursByCategory = {};
    
    // Process each category
    tickets.forEach(ticket => {
      const categoryDir = path.join(routesDataDir, ticket.category);
      
      if (fs.existsSync(categoryDir)) {
        const tourFiles = fs.readdirSync(categoryDir).filter(file => file.endsWith('.json'));
        console.log(`Found ${tourFiles.length} tour files in ${ticket.category}:`, tourFiles);
        
        toursByCategory[ticket.category] = [];
        
        tourFiles.forEach(file => {
          try {
            const filePath = path.join(categoryDir, file);
            const tourData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Extract pricing information
            let price = ticket.price; // Default to category price
            let currency = ticket.currency; // Default to category currency
            
            if (tourData.prices && tourData.prices.adult) {
              price = tourData.prices.adult;
            }
            if (tourData.currency) {
              currency = tourData.currency;
            }
            
            toursByCategory[ticket.category].push({
              id: tourData.id,
              name: tourData.name,
              category: ticket.category,
              price: price,
              currency: currency,
              is_active: ticket.is_active,
              description: tourData.description || '',
              duration: tourData.duration || '',
              mainImage: tourData.mainImage || ''
            });
          } catch (error) {
            console.error(`Error reading tour file ${file}:`, error);
          }
        });
      } else {
        // If no individual tours exist, use the category ticket
        toursByCategory[ticket.category] = [{
          id: ticket.id,
          name: ticket.name,
          category: ticket.category,
          price: ticket.price,
          currency: ticket.currency,
          is_active: ticket.is_active,
          description: '',
          duration: '',
          mainImage: ''
        }];
      }
    });
    
    console.log(`Grouped into ${Object.keys(toursByCategory).length} categories:`, Object.keys(toursByCategory));
    res.json(toursByCategory);
  } catch (error) {
    console.error('Error getting available tours:', error);
    res.status(500).json({ error: 'Failed to get available tours', details: error.message });
  }
});

// Get all merchants
router.get('/merchants', (req, res) => {
  console.log('=== ADMIN API: Getting all merchants ===');
  
  try {
    const merchants = db.prepare(`
      SELECT id, name, email, business_name, location, assigned_tours, is_active, created_at, updated_at
      FROM merchants 
      ORDER BY created_at DESC
    `).all();
    
    // Parse assigned_tours JSON for each merchant
    const merchantsWithParsedTours = merchants.map(merchant => ({
      ...merchant,
      assigned_tours: merchant.assigned_tours ? JSON.parse(merchant.assigned_tours) : []
    }));
    
    console.log(`Found ${merchants.length} merchants`);
    res.json(merchantsWithParsedTours);
  } catch (error) {
    console.error('Error getting merchants:', error);
    res.status(500).json({ error: 'Failed to get merchants', details: error.message });
  }
});

// Get single merchant
router.get('/merchants/:merchantId', (req, res) => {
  console.log('=== ADMIN API: Getting merchant details ===');
  
  const { merchantId } = req.params;
  
  try {
    const merchant = db.prepare(`
      SELECT id, name, email, business_name, location, assigned_tours, is_active, created_at, updated_at
      FROM merchants 
      WHERE id = ?
    `).get(merchantId);
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Get validation history for this merchant
    const validations = db.prepare(`
      SELECT tv.*, r.tour_name, r.contact_email
      FROM ticket_validations tv
      LEFT JOIN reservations r ON tv.reservation_id = r.id
      WHERE tv.merchant_id = ?
      ORDER BY tv.scanned_at DESC
      LIMIT 50
    `).all(merchantId);
    
    // Parse assigned_tours JSON
    const merchantWithParsedTours = {
      ...merchant,
      assigned_tours: merchant.assigned_tours ? JSON.parse(merchant.assigned_tours) : [],
      validations
    };
    
    console.log(`Found merchant: ${merchant.name}`);
    res.json(merchantWithParsedTours);
  } catch (error) {
    console.error('Error getting merchant:', error);
    res.status(500).json({ error: 'Failed to get merchant', details: error.message });
  }
});

// Create new merchant
router.post('/merchants', (req, res) => {
  console.log('=== ADMIN API: Creating new merchant ===');
  
  const { name, email, password, business_name, location, assigned_tours } = req.body;
  
  if (!name || !email || !password || !business_name) {
    return res.status(400).json({ 
      error: 'Missing required fields: name, email, password, business_name' 
    });
  }
  
  try {
    // Check if email already exists
    const existingMerchant = db.prepare('SELECT id FROM merchants WHERE email = ?').get(email);
    if (existingMerchant) {
      return res.status(400).json({ error: 'Merchant with this email already exists' });
    }
    
    // Hash password
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    // Create merchant
    const merchantId = 'merchant-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const assignedToursJson = assigned_tours ? JSON.stringify(assigned_tours) : '[]';
    
    const result = db.prepare(`
      INSERT INTO merchants (id, name, email, password_hash, business_name, location, assigned_tours, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(merchantId, name, email, passwordHash, business_name, location || '', assignedToursJson);
    
    console.log(`Created merchant: ${name} (${email})`);
    res.json({ 
      id: merchantId, 
      name, 
      email, 
      business_name, 
      location: location || '',
      message: 'Merchant created successfully' 
    });
  } catch (error) {
    console.error('Error creating merchant:', error);
    res.status(500).json({ error: 'Failed to create merchant', details: error.message });
  }
});

// Update merchant
router.put('/merchants/:merchantId', async (req, res) => {
  console.log('=== ADMIN API: Updating merchant ===');
  console.log('Request body:', { ...req.body, password: req.body.password ? '***' : undefined });
  
  const { merchantId } = req.params;
  const { name, email, business_name, location, is_active, assigned_tours, password } = req.body;
  
  try {
    // Check if merchant exists
    const existingMerchant = db.prepare('SELECT id FROM merchants WHERE id = ?').get(merchantId);
    if (!existingMerchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Check if email is being changed and if it already exists
    if (email) {
      const emailCheck = db.prepare('SELECT id FROM merchants WHERE email = ? AND id != ?').get(email, merchantId);
      if (emailCheck) {
        return res.status(400).json({ error: 'Email already in use by another merchant' });
      }
    }
    
    // Hash password if provided
    let passwordHash = null;
    if (password && password.trim() !== '') {
      try {
        passwordHash = await hashPassword(password);
        console.log('Password hashed successfully');
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.status(500).json({ error: 'Failed to hash password', details: hashError.message });
      }
    }
    
    // Update merchant
    const assignedToursJson = assigned_tours ? JSON.stringify(assigned_tours) : null;
    
    // Build update query dynamically based on what's provided
    let updateFields = [];
    let updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (business_name !== undefined) {
      updateFields.push('business_name = ?');
      updateValues.push(business_name);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (assignedToursJson !== undefined) {
      updateFields.push('assigned_tours = ?');
      updateValues.push(assignedToursJson);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (passwordHash !== null) {
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }
    
    // Always update updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updateFields.length === 1) {
      // Only updated_at, nothing to update
      return res.json({ message: 'Merchant updated successfully (no changes)' });
    }
    
    updateValues.push(merchantId);
    
    const updateQuery = `
      UPDATE merchants 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    console.log('Update query:', updateQuery);
    console.log('Update values count:', updateValues.length);
    
    const result = db.prepare(updateQuery).run(...updateValues);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    console.log(`Updated merchant: ${merchantId}`);
    res.json({ message: 'Merchant updated successfully' });
  } catch (error) {
    console.error('Error updating merchant:', error);
    res.status(500).json({ error: 'Failed to update merchant', details: error.message });
  }
});

// Delete merchant
router.delete('/merchants/:merchantId', (req, res) => {
  console.log('=== ADMIN API: Deleting merchant ===');
  
  const { merchantId } = req.params;
  
  try {
    // Check if merchant exists
    const existingMerchant = db.prepare('SELECT name FROM merchants WHERE id = ?').get(merchantId);
    if (!existingMerchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Delete merchant (this will cascade delete validations due to foreign key)
    const result = db.prepare('DELETE FROM merchants WHERE id = ?').run(merchantId);
    
    console.log(`Deleted merchant: ${existingMerchant.name}`);
    res.json({ message: 'Merchant deleted successfully' });
  } catch (error) {
    console.error('Error deleting merchant:', error);
    res.status(500).json({ error: 'Failed to delete merchant', details: error.message });
  }
});

// Reset merchant password
router.put('/merchants/:merchantId/reset-password', (req, res) => {
  console.log('=== ADMIN API: Resetting merchant password ===');
  
  const { merchantId } = req.params;
  const { new_password } = req.body;
  
  if (!new_password) {
    return res.status(400).json({ error: 'New password is required' });
  }
  
  try {
    // Check if merchant exists
    const existingMerchant = db.prepare('SELECT name FROM merchants WHERE id = ?').get(merchantId);
    if (!existingMerchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Hash new password
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(new_password).digest('hex');
    
    // Update password
    const result = db.prepare(`
      UPDATE merchants 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, merchantId);
    
    console.log(`Reset password for merchant: ${existingMerchant.name}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Generate QR code for reservation
router.get('/reservations/:reservationId/qr', async (req, res) => {
  console.log('=== ADMIN API: Generating QR code ===');
  
  const { reservationId } = req.params;
  
  try {
    // Check if reservation exists
    const reservation = db.prepare(`
      SELECT id, tour_name, customer_name, contact_email, reservation_date, reservation_time
      FROM reservations 
      WHERE id = ?
    `).get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Generate QR code data
    const qrData = {
      reservationId: reservation.id,
      tourName: reservation.tour_name,
      customerName: reservation.customer_name,
      email: reservation.contact_email,
      date: reservation.reservation_date,
      time: reservation.reservation_time
    };
    
    // Generate QR code as PNG
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    console.log(`Generated QR code for reservation: ${reservationId}`);
    res.json({ 
      qrCode: qrCodeDataURL,
      reservationId: reservationId,
      data: qrData
    });
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
  }
});

// Generate QR code for reservation (simple text version)
router.get('/reservations/:reservationId/qr-simple', async (req, res) => {
  console.log('=== ADMIN API: Generating simple QR code ===');
  
  const { reservationId } = req.params;
  
  try {
    // Check if reservation exists
    const reservation = db.prepare('SELECT id FROM reservations WHERE id = ?').get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Generate QR code with just the reservation ID
    const qrCodeDataURL = await QRCode.toDataURL(reservationId, {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    console.log(`Generated simple QR code for reservation: ${reservationId}`);
    res.json({ 
      qrCode: qrCodeDataURL,
      reservationId: reservationId
    });
    
  } catch (error) {
    console.error('Error generating simple QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
  }
});

// Get validation statistics
router.get('/statistics/validations', (req, res) => {
  console.log('=== ADMIN API: Getting validation statistics ===');
  
  try {
    // Get total count of validations
    const totalValidations = db.prepare(`
      SELECT COUNT(*) as count 
      FROM ticket_validations
    `).get();
    
    console.log(`Total validations: ${totalValidations.count}`);
    
    res.json({
      totalValidations: totalValidations.count
    });
    
  } catch (error) {
    console.error('Error getting validation statistics:', error);
    res.status(500).json({ error: 'Failed to get validation statistics', details: error.message });
  }
});

// ORPHANED RESERVATIONS ENDPOINTS
// ==========================================

// GET /api/admin/orphaned-reservations - Get orphaned reservations
router.get('/orphaned-reservations', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Getting orphaned reservations ===');
  
  try {
    // Find reservations where the user_id doesn't exist in the users table
    const orphanedReservations = db.prepare(`
      SELECT 
        r.*,
        t.name as ticket_name,
        t.category as ticket_category,
        t.price as ticket_price
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN tickets t ON r.ticket_id = t.id
      WHERE u.id IS NULL
      ORDER BY r.created_at DESC
    `).all();
    
    console.log(`Found ${orphanedReservations.length} orphaned reservations`);
    
    res.json({
      reservations: orphanedReservations,
      total: orphanedReservations.length
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error getting orphaned reservations:', error);
    res.status(500).json({ error: 'Failed to get orphaned reservations', details: error.message });
  }
});

// POST /api/admin/orphaned-reservations/:reservationId/migrate - Migrate orphaned reservation to user
router.post('/orphaned-reservations/:reservationId/migrate', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Migrating orphaned reservation ===');
  
  const { reservationId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Check if the target user exists
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    
    // Check if the reservation exists and is orphaned
    const reservation = db.prepare(`
      SELECT r.*, u.id as user_exists
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    if (reservation.user_exists) {
      return res.status(400).json({ error: 'Reservation is not orphaned' });
    }
    
    // Migrate the reservation
    const result = db.prepare('UPDATE reservations SET user_id = ? WHERE id = ?').run(userId, reservationId);
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to migrate reservation' });
    }
    
    console.log(`Migrated reservation ${reservationId} to user ${userId} (${user.email})`);
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATION_MIGRATE',
      `Migrated orphaned reservation ${reservationId} to user ${user.email}`,
      'reservations',
      reservationId,
      { targetUserId: userId, targetUserEmail: user.email },
      req
    );
    
    res.json({
      message: `Reservation migrated successfully to ${user.email}`,
      reservationId,
      targetUser: {
        id: user.id,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error migrating reservation:', error);
    res.status(500).json({ error: 'Failed to migrate reservation', details: error.message });
  }
});

// DELETE /api/admin/orphaned-reservations/:reservationId - Delete orphaned reservation
router.delete('/orphaned-reservations/:reservationId', requireAdminAuth, (req, res) => {
  console.log('=== ADMIN API: Deleting orphaned reservation ===');
  
  const { reservationId } = req.params;
  
  try {
    // Check if the reservation exists and is orphaned
    const reservation = db.prepare(`
      SELECT r.*, u.id as user_exists
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    if (reservation.user_exists) {
      return res.status(400).json({ error: 'Reservation is not orphaned' });
    }
    
    // Delete the reservation
    const result = db.prepare('DELETE FROM reservations WHERE id = ?').run(reservationId);
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete reservation' });
    }
    
    console.log(`Deleted orphaned reservation ${reservationId}`);
    
    // Log admin activity
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'RESERVATION_DELETE',
      `Deleted orphaned reservation ${reservationId}`,
      'reservations',
      reservationId,
      { reservationData: { tour_name: reservation.tour_name, total_price: reservation.total_price } },
      req
    );
    
    res.json({
      message: 'Orphaned reservation deleted successfully',
      reservationId
    });
    
  } catch (error) {
    console.error('=== ADMIN API ERROR ===');
    console.error('Error deleting orphaned reservation:', error);
    res.status(500).json({ error: 'Failed to delete orphaned reservation', details: error.message });
  }
});

// Get custom categories (public endpoint for frontend)
router.get('/custom-categories', (req, res) => {
  try {
    // Read custom categories from a shared file instead of localStorage
    const fs = require('fs');
    const path = require('path');
    const customCategoriesFile = path.join(__dirname, '..', 'custom-categories.json');
    
    if (fs.existsSync(customCategoriesFile)) {
      const data = fs.readFileSync(customCategoriesFile, 'utf8');
      const customCategories = JSON.parse(data);
      console.log('Serving custom categories:', customCategories);
      res.json(customCategories);
    } else {
      console.log('No custom categories file found, returning empty array');
      res.json([]);
    }
  } catch (error) {
    console.error('Error getting custom categories:', error);
    res.status(500).json({ error: 'Failed to get custom categories' });
  }
});

// Save custom categories
router.post('/custom-categories', requireAdminAuth, (req, res) => {
  try {
    const { categories } = req.body;
    const fs = require('fs');
    const path = require('path');
    const customCategoriesFile = path.join(__dirname, '..', 'custom-categories.json');
    
    fs.writeFileSync(customCategoriesFile, JSON.stringify(categories, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving custom categories:', error);
    res.status(500).json({ error: 'Failed to save custom categories' });
  }
});

// Update static file for frontend
router.post('/update-static-categories', requireAdminAuth, (req, res) => {
  try {
    const { categories } = req.body;
    const fs = require('fs');
    const path = require('path');
    const staticFile = path.join(__dirname, '..', '..', 'public', 'custom-categories.json');
    
    fs.writeFileSync(staticFile, JSON.stringify(categories, null, 2));
    console.log('Static file updated with categories:', categories);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating static file:', error);
    res.status(500).json({ error: 'Failed to update static file' });
  }
});

// Generic image upload endpoint for admin use
router.post('/upload-image', requireAdminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Return the URL path to the uploaded image (including folder if specified)
    const folder = req.body.folder || '';
    const imageUrl = folder ? `/uploads/${folder}/${req.file.filename}` : `/uploads/${req.file.filename}`;
    
    console.log(`✅ Image uploaded successfully: ${imageUrl}`);
    
    res.json({ 
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      folder: folder
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
