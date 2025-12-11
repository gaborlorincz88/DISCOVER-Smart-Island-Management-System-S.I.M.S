const fs = require('fs');
const path = require('path');

const routeType = process.argv[2];

if (!routeType) {
    console.error('Please provide a route type as a command-line argument.');
    process.exit(1);
}

const convertedPath = path.join(__dirname, '../routes-data', routeType, 'converted');
const routesPath = path.join(__dirname, '../routes-data', routeType);

fs.readdir(convertedPath, (err, files) => {
    if (err) {
        console.error(`Failed to read converted directory for type ${routeType}:`, err);
        return;
    }

    files.forEach(file => {
        if (file.endsWith('.json')) {
            const sourcePath = path.join(convertedPath, file);
            const destPath = path.join(routesPath, file);
            fs.copyFile(sourcePath, destPath, (err) => {
                if (err) {
                    console.error(`Failed to move file ${file}:`, err);
                } else {
                    console.log(`Successfully moved ${file}`);
                }
            });
        }
    });
});
