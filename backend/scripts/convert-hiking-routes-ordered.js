const fs = require('fs');
const path = require('path');

const hikingRoutesPath = path.join(__dirname, '../routes-data/hiking');

const files = fs.readdirSync(hikingRoutesPath);

files.forEach(file => {
    if (file.endsWith('.json')) {
        const filePath = path.join(hikingRoutesPath, file);
        const data = fs.readFileSync(filePath, 'utf8');
        try {
            const oldRoute = JSON.parse(data);
            let pointIdCounter = 0;
            const newRoute = {
                id: oldRoute.id,
                name: oldRoute.name,
                type: oldRoute.type,
                description: oldRoute.description,
                points: []
            };

            if (oldRoute.coordinates) {
                oldRoute.coordinates.forEach(coord => {
                    const poi = oldRoute.pointsOfInterest ? oldRoute.pointsOfInterest.find(p => p.coordinates[0] === coord[0] && p.coordinates[1] === coord[1]) : null;
                    if (poi) {
                        newRoute.points.push({
                            id: `stop_${pointIdCounter++}`,
                            type: 'stop',
                            lat: coord[0],
                            lng: coord[1],
                            name: poi.name,
                            description: poi.description
                        });
                    } else {
                        newRoute.points.push({
                            id: `shape_${pointIdCounter++}`,
                            type: 'shape',
                            lat: coord[0],
                            lng: coord[1]
                        });
                    }
                });
            }

            fs.writeFileSync(filePath, JSON.stringify(newRoute, null, 2));
            console.log(`Successfully converted ${file}`);
        } catch (e) {
            console.error(`Failed to parse or convert file ${file}:`, e);
        }
    }
});
