const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const KML_DIR = path.join(__dirname, '../hiking_trails'); // Correct path to the hiking_trails folder

// Helper function to load categories
function loadCategories() {
    const categoriesPath = path.join(__dirname, '../routes-data/categories.json');
    if (fs.existsSync(categoriesPath)) {
        const data = fs.readFileSync(categoriesPath, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

router.get('/', async (req, res) => {
    console.log('Backend: Received request for hiking trails.');
    console.log('Backend: KML_DIR resolved to:', KML_DIR);
    try {
        const files = await fs.promises.readdir(KML_DIR);
        const kmlFiles = files.filter(file => file.endsWith('.kml'));
        console.log('Backend: Found KML files:', kmlFiles);

        const hikingTrails = [];

        for (const file of kmlFiles) {
            console.log(`Backend: Processing file: ${file}`);
            const filePath = path.join(KML_DIR, file);
            const kmlContent = await fs.promises.readFile(filePath, 'utf8');
            console.log(`Backend: KML content length for ${file}: ${kmlContent.length}`);

                        // Direct string parsing for KML content
            // Extract Document name and description
            const docNameMatch = kmlContent.match(/<Document>\s*<name>(.*?)<\/name>/);
            const trailName = docNameMatch && docNameMatch[1] ? docNameMatch[1] : file.replace('.kml', '');

            const docDescMatch = kmlContent.match(/<Document>\s*<name>.*?<\/name>\s*<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
            const trailDescription = docDescMatch && docDescMatch[1] ? docDescMatch[1] : 'No description available.';
            let processedDescription = trailDescription;

            // Regex to find img tags and capture their src attribute
            const imgRegex = /<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1(?:[^>]*?)?>/g;
            processedDescription = processedDescription.replace(imgRegex, (match, quote, srcUrl) => {
                // Only proxy Google My Maps hosted images
                if (srcUrl.includes('mymaps.usercontent.google.com/hostedimage/')) {
                    console.log('Backend: Rewriting image URL. VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL);
                    const encodedUrl = encodeURIComponent(srcUrl);
                    // Reconstruct the img tag with the proxied URL, preserving other attributes
                    return `<img src="${process.env.VITE_API_BASE_URL}/api/proxy-image?url=${encodedUrl}"`;
                }
                return match; // Return original if not a Google hosted image
            });

            // Initialize for each file
            let coordinates = [];
            let pointsOfInterest = [];
            let walkingPathPlacemarks = []; // Placemarks specifically from 'Walking Path' folder

            // Extract Placemarks from 'Walking Path' folder using regex
            const walkingPathFolderMatch = kmlContent.match(/<Folder>\s*<name>Walking Path<\/name>(.*?)<\/Folder>/s);
            if (walkingPathFolderMatch && walkingPathFolderMatch[1]) {
                const walkingPathContent = walkingPathFolderMatch[1];
                const placemarkRegex = /<Placemark>(.*?)<\/Placemark>/gs; // 's' flag for dotall
                let match;
                while ((match = placemarkRegex.exec(walkingPathContent)) !== null) {
                    walkingPathPlacemarks.push(match[1]); // Store inner content of Placemark
                }
                console.log(`Backend: Added ${walkingPathPlacemarks.length} placemarks from 'Walking Path' folder.`);
            } else {
                console.log(`Backend: 'Walking Path' folder not found or empty.`);
            }
            console.log(`Backend: Total walking path placemarks collected for ${file}: ${walkingPathPlacemarks.length}.`);

            // Process walking path placemarks for LineStrings and Points of Interest
            for (const placemarkContent of walkingPathPlacemarks) {
                // Extract name
                const nameMatch = placemarkContent.match(/<name>(.*?)<\/name>/);
                const placemarkName = nameMatch && nameMatch[1] ? nameMatch[1] : 'Unnamed';
                console.log(`Backend: Processing walking path placemark: ${placemarkName}`);

                // Extract description
                const descMatch = placemarkContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
                const placemarkDescription = descMatch && descMatch[1] ? descMatch[1] : 'No description available.';

                // Extract LineString coordinates
                const lineStringMatch = placemarkContent.match(/<LineString>\s*<tessellate>.*?<\/tessellate>\s*<coordinates>(.*?)<\/coordinates>\s*<\/LineString>/s);
                if (lineStringMatch && lineStringMatch[1]) {
                    console.log(`Backend: Found LineString in walking path placemark: ${placemarkName}`);
                    const coordsStr = lineStringMatch[1];
                    const segmentCoords = coordsStr.trim().split(/\s+/).map(coord => {
                        const [lon, lat, alt] = coord.split(',').map(Number);
                        return [lat, lon]; // Leaflet expects [lat, lon]
                    });
                    coordinates.push(...segmentCoords);
                    console.log(`Backend: Added ${segmentCoords.length} coordinates to trail.`);
                }

                // Extract Point data (for points of interest on the trail)
                const pointMatch = placemarkContent.match(/<Point>\s*<coordinates>(.*?)<\/coordinates>\s*<\/Point>/s);
                if (pointMatch && pointMatch[1]) {
                    console.log(`Backend: Found Point in walking path placemark: ${placemarkName}`);
                    const pointCoordsStr = pointMatch[1];
                    const [lon, lat, alt] = pointCoordsStr.split(',').map(Number);

                    pointsOfInterest.push({
                        name: placemarkName,
                        description: placemarkDescription,
                        coordinates: [lat, lon] // Leaflet expects [lat, lon]
                    });
                    console.log(`Backend: Added point of interest: ${placemarkName}`);
                }
            }
            console.log(`Backend: Final coordinates count for ${file}: ${coordinates.length}`);
            console.log(`Backend: Final points of interest count for ${file}: ${pointsOfInterest.length}`);

            if (coordinates.length > 0) {
                // Load hiking category icon from categories.json
                const categories = loadCategories();
                const hikingCategory = categories.find(cat => cat.id === 'hiking');
                const hikingIcon = hikingCategory?.icon || '🏃';
                const hikingIconSize = hikingCategory?.iconSize || 32;
                
                hikingTrails.push({
                    name: trailName,
                    description: processedDescription,
                    coordinates: coordinates,
                    pointsOfInterest: pointsOfInterest,
                    icon: hikingIcon,
                    iconSize: hikingIconSize
                });
                console.log(`Backend: Trail "${trailName}" added to hikingTrails array with icon: ${hikingIcon}`);
            } else {
                console.log(`Backend: No coordinates found for trail "${trailName}". Not added to hikingTrails array.`);
            }
            
        }

        res.json(hikingTrails);

    } catch (error) {
        console.error('Error fetching hiking trails:', error);
        res.status(500).json({ error: 'Failed to fetch hiking trails' });
    }
});

module.exports = router;
