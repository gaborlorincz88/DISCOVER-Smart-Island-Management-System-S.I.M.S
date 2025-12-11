const fs = require('fs');
const path = require('path');

const busRoutesPath = __dirname;
const timetablesPath = path.join(__dirname, 'timetables-json');

const standardizeName = (filename) => {
    let newName = filename.toLowerCase();
    // Remove the "route_" prefix
    newName = newName.replace(/^route_/, '');
    // Replace underscores with hyphens for consistency
    newName = newName.replace(/_/g, '-');
    return newName;
};

const renameFiles = (directoryPath) => {
    console.log(`Scanning directory: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath);

    files.forEach(file => {
        if (file.endsWith('.json')) {
            const oldPath = path.join(directoryPath, file);
            const newName = standardizeName(file);
            const newPath = path.join(directoryPath, newName);

            if (oldPath !== newPath) {
                try {
                    fs.renameSync(oldPath, newPath);
                    console.log(`Renamed: ${file} -> ${newName}`);
                } catch (error) {
                    console.error(`Error renaming ${file}:`, error);
                }
            }
        }
    });
};

// --- Main Execution ---
console.log('--- Standardizing Route Filenames ---');
renameFiles(busRoutesPath);

console.log('\n--- Standardizing Timetable Filenames ---');
renameFiles(timetablesPath);

console.log('\n--- File Renaming Complete ---');
