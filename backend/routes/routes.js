const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { imageOptimizer } = require('../middleware/imageOptimizer');
const { createSecureImageUpload } = require('../middleware/secureUpload');

// Configure secure multer for file uploads
const upload = createSecureImageUpload('uploads', 10 * 1024 * 1024, 'route-'); // 10MB limit

const ROUTES_BASE_PATH = path.join(__dirname, '../routes-data');

// Helper function to get the full path for a specific route type and ID
// Maps route types to their actual directory names (handles plural/singular mismatches)
const getRouteFilePath = (type, id) => {
    // Map route types to their actual directory names
    const typeMapping = {
        'jeep-tour': 'jeep-tours',  // API uses 'jeep-tour' but directory is 'jeep-tours'
        'boat-tour': 'boat-tour',    // Keep as is
        'quad-tours': 'quad-tours',  // Keep as is
        'sightseeing': 'sightseeing', // Keep as is
        'hiking': 'hiking',          // Keep as is
        'parasailing': 'parasailing' // Keep as is
    };
    
    const actualType = typeMapping[type] || type;
    const typePath = path.join(ROUTES_BASE_PATH, actualType);
    if (!fs.existsSync(typePath)) {
        fs.mkdirSync(typePath, { recursive: true });
    }
    return path.join(typePath, `${id}.json`);
};

// GET all routes of a specific type, or all types if none specified
router.get('/list', (req, res) => {
    const type = req.query.type; // Optional: filter by type
    const targetPath = type ? path.join(ROUTES_BASE_PATH, type) : ROUTES_BASE_PATH;

    if (!fs.existsSync(targetPath)) {
        return res.json([]); // No routes found for this type/base path
    }

    fs.readdir(targetPath, { withFileTypes: true }, (err, dirents) => {
        if (err) {
            console.error(`Failed to read routes directory ${targetPath}:`, err);
            return res.status(500).json({ error: 'Failed to read routes directory' });
        }

        let routes = [];

        const processDirectory = (currentPath, currentType) => {
            const files = fs.readdirSync(currentPath, { withFileTypes: true });
            files.forEach(dirent => {
                if (dirent.isFile() && dirent.name.endsWith('.json')) {
                    try {
                        const routeId = path.basename(dirent.name, '.json');
                        const fileContent = fs.readFileSync(path.join(currentPath, dirent.name), 'utf-8');
                        const routeData = JSON.parse(fileContent);
                        routes.push({
                            id: routeId,
                            name: routeData.name || routeId,
                            type: routeData.type || currentType || dirent.name, // Use routeData.type first
                            description: routeData.description || '',
                            // Add other relevant metadata for listing
                        });
                    } catch (e) {
                        console.error(`Could not process file ${dirent.name} in ${currentPath}:`, e);
                    }
                } else if (dirent.isDirectory() && !type) { // Recurse into subdirectories if no specific type requested
                    processDirectory(path.join(currentPath, dirent.name), dirent.name);
                }
            });
        };

        processDirectory(targetPath, type);
        console.log('Backend: Routes found for listing:', routes);
        res.json(routes);
    });
});

// POST icon upload endpoint
router.post('/upload-icon', upload.single('icon'), imageOptimizer, (req, res) => {
    console.log('Icon upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Optimized images:', req.optimizedImages);
    
    if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ error: 'No icon file uploaded' });
    }
    
    // Use optimized icon if available, otherwise fall back to original
    let iconUrl = `/uploads/${req.file.filename}`;
    if (req.optimizedImages && req.optimizedImages['icon']) {
        const optimizedIcon = req.optimizedImages['icon'].find(img => img.size === 'main');
        if (optimizedIcon) {
            iconUrl = optimizedIcon.optimized;
        }
    }
    
    console.log('Icon uploaded successfully:', iconUrl);
    res.json({ iconUrl: iconUrl });
});

// POST image upload endpoint for tour main images
router.post('/upload-image', upload.single('image'), imageOptimizer, (req, res) => {
    console.log('Main image upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Optimized images:', req.optimizedImages);
    
    if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // Use optimized image if available, otherwise fall back to original
    let imageUrl = `/uploads/${req.file.filename}`;
    if (req.optimizedImages && req.optimizedImages['image']) {
        const optimizedImage = req.optimizedImages['image'].find(img => img.size === 'main');
        if (optimizedImage) {
            imageUrl = optimizedImage.optimized;
        }
    }
    
    console.log('Image uploaded successfully:', imageUrl);
    res.json({ imageUrl: imageUrl });
});

// GET a specific route's data
router.get('/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const routeFile = getRouteFilePath(type, id);

    fs.readFile(routeFile, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Route not found' });
            }
            return res.status(500).json({ error: 'Failed to read route file.' });
        }
        console.log('Raw data from file:', data.toString());
        res.json(JSON.parse(data));
    });
});

// POST (save) a specific route's data
router.post('/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const routeFile = getRouteFilePath(type, id);
    const routeData = req.body;

    // Basic validation for the new format
    if (!routeData || !routeData.name || !routeData.type || !Array.isArray(routeData.points)) {
        return res.status(400).json({ error: 'Invalid route data format. Name, type, and points array are required.' });
    }

    fs.writeFile(routeFile, JSON.stringify(routeData, null, 2), (err) => {
        if (err) {
            console.error(`Failed to save route ${type}/${id}:`, err);
            return res.status(500).json({ error: 'Failed to save route file.' });
        }
        res.status(200).json({ message: `Route ${type}/${id} saved successfully.` });
    });
});

// DELETE a specific route
router.delete('/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const routeFile = getRouteFilePath(type, id);

    fs.unlink(routeFile, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Route not found' });
            }
            console.error(`Failed to delete route ${type}/${id}:`, err);
            return res.status(500).json({ error: 'Failed to delete route file.' });
        }
        res.status(200).json({ message: `Route ${type}/${id} deleted successfully.` });
    });
});

// DELETE a specific route
router.delete('/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const routeFile = getRouteFilePath(type, id);

    fs.unlink(routeFile, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Route not found' });
            }
            console.error(`Failed to delete route ${type}/${id}:`, err);
            return res.status(500).json({ error: 'Failed to delete route file.' });
        }
        res.status(200).json({ message: `Route ${type}/${id} deleted successfully.` });
    });
});

module.exports = router;
