const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const { kml } = require('@tmcw/togeojson');

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
            const kmlDom = new DOMParser().parseFromString(kmlContent);
            const geoJSON = kml(kmlDom);

            const newRoute = {
                id: path.basename(file, '.kml').toLowerCase().replace(/\s+/g, '-'),
                name: geoJSON.features[0].properties.name,
                type: 'hiking',
                description: geoJSON.features[0].properties.description,
                points: []
            };

            let pointIdCounter = 0;

            geoJSON.features.forEach(feature => {
                if (feature.geometry.type === 'LineString') {
                    feature.geometry.coordinates.forEach(coord => {
                        newRoute.points.push({
                            id: `shape_${pointIdCounter++}`,
                            type: 'shape',
                            lat: coord[1],
                            lng: coord[0]
                        });
                    });
                } else if (feature.geometry.type === 'Point') {
                    newRoute.points.push({
                        id: `stop_${pointIdCounter++}`,
                        type: 'stop',
                        lat: feature.geometry.coordinates[1],
                        lng: feature.geometry.coordinates[0],
                        name: feature.properties.name,
                        description: feature.properties.description
                    });
                }
            });

            const outputFilePath = path.join(outputDir, `${newRoute.id}.json`);
            fs.writeFileSync(outputFilePath, JSON.stringify(newRoute, null, 2));
            console.log(`Successfully converted ${file} to ${newRoute.id}.json`);
        }
    });
});
