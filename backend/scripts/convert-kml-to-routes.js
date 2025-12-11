const fs = require('fs');
const path = require('path');

// Set up a dummy process.env.VITE_API_BASE_URL for the regex to work
// In a real scenario, this script might be run with the actual env variable
process.env.VITE_API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3002';

const KML_SOURCE_DIR = path.join(__dirname, '../../backend/hiking_trails'); // Corrected path
const JSON_DEST_BASE_DIR = path.join(__dirname, '../../backend/routes-data');

const convertKmlToRouteJson = async () => {
    try {
        const files = await fs.promises.readdir(KML_SOURCE_DIR);
        const kmlFiles = files.filter(file => file.endsWith('.kml'));

        if (kmlFiles.length === 0) {
            console.log(`No KML files found in ${KML_SOURCE_DIR}`);
            return;
        }

        console.log(`Found ${kmlFiles.length} KML files to convert.`);

        for (const file of kmlFiles) {
            console.log(`Processing file: ${file}`);
            const filePath = path.join(KML_SOURCE_DIR, file);
            const kmlContent = await fs.promises.readFile(filePath, 'utf8');

            // --- KML Parsing Logic (copied from hikingTrails.js) ---
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
                    const encodedUrl = encodeURIComponent(srcUrl);
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
            }

            // Process walking path placemarks for LineStrings and Points of Interest
            for (const placemarkContent of walkingPathPlacemarks) {
                // Extract name
                const nameMatch = placemarkContent.match(/<name>(.*?)<\/name>/);
                const placemarkName = nameMatch && nameMatch[1] ? nameMatch[1] : 'Unnamed';

                // Extract description
                const descMatch = placemarkContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s); // Adjusted regex for CDATA
                const placemarkDescription = descMatch && descMatch[1] ? descMatch[1] : 'No description available.';

                // Extract LineString coordinates
                const lineStringMatch = placemarkContent.match(/<LineString>\s*<tessellate>.*?<\/tessellate>\s*<coordinates>(.*?)<\/coordinates>\s*<\/LineString>/s);
                if (lineStringMatch && lineStringMatch[1]) {
                    const coordsStr = lineStringMatch[1];
                    const segmentCoords = coordsStr.trim().split(/\s+/).map(coord => {
                        const [lon, lat, alt] = coord.split(',').map(Number);
                        return [lat, lon]; // Leaflet expects [lat, lon]
                    });
                    coordinates.push(...segmentCoords);
                }

                // Extract Point data (for points of interest on the trail)
                const pointMatch = placemarkContent.match(/<Point>\s*<coordinates>(.*?)<\/coordinates>\s*<\/Point>/s);
                if (pointMatch && pointMatch[1]) {
                    const pointCoordsStr = pointMatch[1];
                    const [lon, lat, alt] = pointCoordsStr.split(',').map(Number);

                    pointsOfInterest.push({
                        name: placemarkName,
                        description: placemarkDescription,
                        coordinates: [lat, lon] // Leaflet expects [lat, lon]
                    });
                }
            }
            // --- End KML Parsing Logic ---

            if (coordinates.length > 0) {
                const routeId = trailName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const routeData = {
                    id: routeId,
                    name: trailName,
                    type: 'hiking', // Fixed type for hiking trails
                    description: processedDescription,
                    coordinates: coordinates,
                    pointsOfInterest: pointsOfInterest
                };

                const destPath = path.join(JSON_DEST_BASE_DIR, 'hiking');
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                const destFile = path.join(destPath, `${routeId}.json`);

                await fs.promises.writeFile(destFile, JSON.stringify(routeData, null, 2), 'utf8');
                console.log(`Successfully converted and saved: ${destFile}`);
            } else {
                console.log(`No coordinates found for trail "${trailName}". Skipping conversion.`);
            }
        }
        console.log('KML to Route JSON conversion complete.');
    } catch (error) {
        console.error('Error during KML to Route JSON conversion:', error);
    }
};

convertKmlToRouteJson();
