const fs = require('fs');
const path = require('path');

const kmlDir = path.join(__dirname, '../hiking_trails');
const outputDir = path.join(__dirname, '../routes-data/hiking');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.readdir(kmlDir, (err, files) => {
    if (err) {
        console.error('Failed to read KML directory:', err);
        return;
    }

    files.forEach(file => {
        if (file.endsWith('.kml')) {
            const kmlPath = path.join(kmlDir, file);
            const kmlContent = fs.readFileSync(kmlPath, 'utf8');

            const newRoute = {
                id: path.basename(file, '.kml').toLowerCase().replace(/\s+/g, '-'),
                name: '',
                type: 'hiking',
                description: '',
                points: []
            };

            const nameMatch = kmlContent.match(/<name>(.*?)<\/name>/);
            if (nameMatch) {
                newRoute.name = nameMatch[1];
            }

            const descriptionMatch = kmlContent.match(/<description>(.*?)<\/description>/);
            if (descriptionMatch) {
                newRoute.description = descriptionMatch[1];
            }

            let pointIdCounter = 0;

            const placemarkMatches = kmlContent.matchAll(/<Placemark>.*?<name>(.*?)<\/name>.*?<description>(.*?)<\/description>.*?<Point>.*?<coordinates>(.*?)<\/coordinates>.*?<\/Point>.*?<\/Placemark>/gs);
            for (const match of placemarkMatches) {
                const coords = match[3].trim().split(',');
                newRoute.points.push({
                    id: `stop_${pointIdCounter++}`,
                    type: 'stop',
                    lat: parseFloat(coords[1]),
                    lng: parseFloat(coords[0]),
                    name: match[1],
                    description: match[2]
                });
            }

            const lineStringMatches = kmlContent.matchAll(/<LineString>.*?<coordinates>(.*?)<\/coordinates>.*?<\/LineString>/gs);
            for (const match of lineStringMatches) {
                const coordsArray = match[1].trim().split(/\s+/);
                coordsArray.forEach(coordString => {
                    const coords = coordString.split(',');
                    if (coords.length >= 2) {
                        newRoute.points.push({
                            id: `shape_${pointIdCounter++}`,
                            type: 'shape',
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0])
                        });
                    }
                });
            }

            const outputFilePath = path.join(outputDir, `${newRoute.id}.json`);
            fs.writeFileSync(outputFilePath, JSON.stringify(newRoute, null, 2));
            console.log(`Successfully converted ${file} to ${newRoute.id}.json`);
        }
    });
});
