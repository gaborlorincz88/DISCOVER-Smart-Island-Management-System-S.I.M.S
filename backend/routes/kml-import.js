const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { createSecureKMLUpload } = require('../middleware/secureUpload');

// Configure secure multer for KML file uploads
const upload = createSecureKMLUpload('temp-kml-uploads');

// POST /api/kml-import/parse - Parse uploaded KML file
router.post('/parse', requireAdminAuth, upload.single('kmlFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        console.log('📥 KML Import - File received:', req.file.originalname);
        console.log('📁 File path:', filePath);
        console.log('📏 File size:', req.file.size, 'bytes');

        let kmlContent;

        // Handle KMZ files (zipped KML)
        if (fileExt === '.kmz') {
            // For now, return error asking for KML
            // KMZ support can be added later with unzip library
            fs.unlinkSync(filePath); // Clean up
            return res.status(400).json({ 
                error: 'KMZ files are not yet supported. Please export as KML instead.',
                instructions: 'In Google My Maps: Menu → Export to KML → Uncheck "Export to KMZ" option'
            });
        }

        // Read KML file
        kmlContent = await fs.promises.readFile(filePath, 'utf8');
        console.log('📄 KML content length:', kmlContent.length);

        // Parse KML using same logic as hiking trails
        const tourData = parseGoogleMyMapsKML(kmlContent, req.file.originalname);

        // Validate that we got useful data
        if (!tourData.coordinates || tourData.coordinates.length === 0) {
            fs.unlinkSync(filePath); // Clean up
            return res.status(400).json({ 
                error: 'No route coordinates found in KML file',
                details: 'The KML file must contain at least one path/route (LineString)'
            });
        }

        // Validate coordinates are within reasonable bounds (Malta/Gozo area)
        const isWithinBounds = tourData.coordinates.every(coord => {
            const [lat, lng] = coord;
            return lat >= 35.8 && lat <= 36.1 && lng >= 14.0 && lng <= 14.6;
        });

        if (!isWithinBounds) {
            fs.unlinkSync(filePath); // Clean up
            return res.status(400).json({ 
                error: 'Route coordinates are outside Gozo/Malta area',
                details: 'Please ensure your route is located in Gozo or Malta'
            });
        }

        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'KML_IMPORT_PARSE',
            `Parsed KML file: ${req.file.originalname} (${tourData.coordinates.length} coordinates, ${tourData.stops.length} stops)`,
            'kml_import',
            null,
            { filename: req.file.originalname, coordinatesCount: tourData.coordinates.length, stopsCount: tourData.stops.length },
            req
        );

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Return parsed data for preview
        res.json({
            success: true,
            message: 'KML file parsed successfully',
            tour: tourData
        });

    } catch (error) {
        console.error('❌ Error parsing KML:', error);
        
        // Clean up file if it exists
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ 
            error: 'Failed to parse KML file',
            details: error.message 
        });
    }
});

// Helper function to parse Google My Maps KML
// Reuses logic from hikingTrails.js
function parseGoogleMyMapsKML(kmlContent, filename) {
    // Extract Document name and description
    const docNameMatch = kmlContent.match(/<Document>\s*<name>(.*?)<\/name>/);
    const tourName = docNameMatch && docNameMatch[1] ? docNameMatch[1] : filename.replace(/\.(kml|kmz)$/i, '');

    const docDescMatch = kmlContent.match(/<Document>\s*<name>.*?<\/name>\s*<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
    let tourDescription = docDescMatch && docDescMatch[1] ? docDescMatch[1] : 'Imported from Google My Maps';

    // Process description to handle images
    const imgRegex = /<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1(?:[^>]*?)?>/g;
    tourDescription = tourDescription.replace(imgRegex, (match, quote, srcUrl) => {
        // Note: Images will need to be proxied or downloaded
        if (srcUrl.includes('mymaps.usercontent.google.com/hostedimage/')) {
            const encodedUrl = encodeURIComponent(srcUrl);
            return `<img src="/api/proxy-image?url=${encodedUrl}"`;
        }
        return match;
    });

    // Initialize arrays for coordinates and stops
    let coordinates = [];
    let stops = [];

    // Look for all Placemarks at document level
    const placemarkRegex = /<Placemark>(.*?)<\/Placemark>/gs;
    let match;
    
    while ((match = placemarkRegex.exec(kmlContent)) !== null) {
        const placemarkContent = match[1];
        
        // Extract name
        const nameMatch = placemarkContent.match(/<name>(.*?)<\/name>/);
        const placemarkName = nameMatch && nameMatch[1] ? nameMatch[1] : 'Unnamed';
        
        // Extract description (optional)
        const descMatch = placemarkContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
        const placemarkDescription = descMatch && descMatch[1] ? descMatch[1] : '';

        // Check for LineString (route path)
        const lineStringMatch = placemarkContent.match(/<LineString>(.*?)<\/LineString>/s);
        if (lineStringMatch) {
            const lineStringContent = lineStringMatch[1];
            const coordsMatch = lineStringContent.match(/<coordinates>(.*?)<\/coordinates>/s);
            
            if (coordsMatch && coordsMatch[1]) {
                const coordsStr = coordsMatch[1];
                // Split by whitespace or newlines, filter empty strings
                const pathCoords = coordsStr.trim().split(/[\s\n]+/).filter(c => c.trim()).map(coord => {
                    const parts = coord.trim().split(',');
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    return [lat, lng]; // Leaflet expects [lat, lng]
                });
                coordinates.push(...pathCoords);
                console.log(`✅ Found route path: ${placemarkName} with ${pathCoords.length} coordinates`);
            }
        }

        // Check for Point (tour stop/waypoint)
        const pointMatch = placemarkContent.match(/<Point>(.*?)<\/Point>/s);
        if (pointMatch) {
            const pointContent = pointMatch[1];
            const coordsMatch = pointContent.match(/<coordinates>(.*?)<\/coordinates>/s);
            
            if (coordsMatch && coordsMatch[1]) {
                const pointCoordsStr = coordsMatch[1].trim();
                const parts = pointCoordsStr.split(',');
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                
                stops.push({
                    name: placemarkName,
                    description: placemarkDescription,
                    coordinates: [lat, lng],
                    order: stops.length + 1
                });
                console.log(`✅ Found stop: ${placemarkName} at [${lat}, ${lng}]`);
            }
        }
    }

    console.log(`📊 Import summary: ${coordinates.length} route coordinates, ${stops.length} stops`);

    return {
        name: tourName,
        description: tourDescription,
        coordinates: coordinates,
        stops: stops,
        importedFrom: 'Google My Maps',
        importedFileName: filename
    };
}

module.exports = router;

