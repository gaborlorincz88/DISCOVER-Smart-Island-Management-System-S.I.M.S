const fs = require('fs');
const path = require('path');

const routeType = process.argv[2];

if (!routeType) {
    console.error('Please provide a route type as a command-line argument.');
    process.exit(1);
}

const routesPath = path.join(__dirname, '../routes-data', routeType);
const convertedPath = path.join(__dirname, '../routes-data', routeType, 'converted');

if (!fs.existsSync(convertedPath)) {
    fs.mkdirSync(convertedPath);
}

fs.readdir(routesPath, (err, files) => {
    if (err) {
        console.error(`Failed to read routes directory for type ${routeType}:`, err);
        return;
    }

    files.forEach(file => {
        if (file.endsWith('.json')) {
            const filePath = path.join(routesPath, file);
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Failed to read file ${file}:`, err);
                    return;
                }

                try {
                    const oldRoute = JSON.parse(data);
                    const newRoute = {
                        id: oldRoute.id,
                        name: oldRoute.name,
                        type: oldRoute.type,
                        description: oldRoute.description,
                        points: []
                    };

                    let pointIdCounter = 0;

                    if (oldRoute.pointsOfInterest) {
                        oldRoute.pointsOfInterest.forEach(poi => {
                            newRoute.points.push({
                                id: `stop_${pointIdCounter++}`,
                                type: 'stop',
                                lat: poi.coordinates[0],
                                lng: poi.coordinates[1],
                                name: poi.name,
                                description: poi.description
                            });
                        });
                    }

                    if (oldRoute.coordinates) {
                        oldRoute.coordinates.forEach(coord => {
                            newRoute.points.push({
                                id: `shape_${pointIdCounter++}`,
                                type: 'shape',
                                lat: coord[0],
                                lng: coord[1]
                            });
                        });
                    }

                    const convertedFilePath = path.join(convertedPath, file);
                    fs.writeFile(convertedFilePath, JSON.stringify(newRoute, null, 2), (err) => {
                        if (err) {
                            console.error(`Failed to write converted file ${file}:`, err);
                        } else {
                            console.log(`Successfully converted ${file}`);
                        }
                    });
                } catch (e) {
                    console.error(`Failed to parse or convert file ${file}:`, e);
                }
            });
        }
    });
});
