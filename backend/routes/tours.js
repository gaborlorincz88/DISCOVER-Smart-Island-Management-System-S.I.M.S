const express = require('express');
const router = express.Router();
const hikingTrailsRouter = require('./hikingTrails'); // Import the hiking trails router
const fs = require('fs');
const path = require('path');
const { createSecureImageUpload } = require('../middleware/secureUpload');
const { requireAdminAuth } = require('../middleware/admin-auth');

// Configure secure multer for file uploads
const upload = createSecureImageUpload('uploads/categories', 5 * 1024 * 1024, 'category-'); // 5MB limit

// Helper function to load categories
function loadCategories() {
    const categoriesPath = path.join(__dirname, '..', 'routes-data', 'categories.json');
    if (fs.existsSync(categoriesPath)) {
        const data = fs.readFileSync(categoriesPath, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

// Helper function to save categories
function saveCategories(categories) {
    const categoriesPath = path.join(__dirname, '..', 'routes-data', 'categories.json');
    fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
}

// GET /api/tour-categories - Get all tour categories
router.get('/tour-categories', (req, res) => {
    try {
        const categories = loadCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

// POST /api/tour-categories - Create a new category
router.post('/tour-categories', requireAdminAuth, upload.single('image'), (req, res) => {
    try {
        const categories = loadCategories();
        const { name, description, icon, color, active, gallerySelectedImage } = req.body;
        
        // Generate unique ID
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        // Check if ID already exists
        if (categories.find(cat => cat.id === id)) {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }
        
        // Determine image URL: gallery-selected image takes precedence over uploaded file
        let imageUrl = '';
        if (gallerySelectedImage) {
            imageUrl = gallerySelectedImage;
            console.log('📸 Category POST - Using gallery-selected image:', gallerySelectedImage);
        } else if (req.file) {
            imageUrl = `/uploads/categories/${req.file.filename}`;
        }
        
        const newCategory = {
            id,
            name,
            description: description || '',
            image: imageUrl,
            icon: icon || '🎪',
            color: color || '#3b82f6',
            active: active === 'true',
            order: categories.length + 1
        };
        
        categories.push(newCategory);
        saveCategories(categories);
        
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// PUT /api/tour-categories/:id - Update a category
router.put('/tour-categories/:id', requireAdminAuth, upload.single('image'), (req, res) => {
    try {
        const categories = loadCategories();
        const { id } = req.params;
        const { name, description, icon, color, active, order, gallerySelectedImage } = req.body;
        
        const categoryIndex = categories.findIndex(cat => cat.id === id);
        if (categoryIndex === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        const updatedCategory = {
            ...categories[categoryIndex],
            name: name || categories[categoryIndex].name,
            description: description || categories[categoryIndex].description,
            icon: icon || categories[categoryIndex].icon,
            color: color || categories[categoryIndex].color,
            active: active === 'true',
            order: order ? parseInt(order) : categories[categoryIndex].order
        };
        
        // Update image: gallery-selected image takes precedence over uploaded file
        if (gallerySelectedImage) {
            updatedCategory.image = gallerySelectedImage;
            console.log('📸 Category PUT - Using gallery-selected image:', gallerySelectedImage);
        } else if (req.file) {
            updatedCategory.image = `/uploads/categories/${req.file.filename}`;
        }
        
        categories[categoryIndex] = updatedCategory;
        saveCategories(categories);
        
        res.json(updatedCategory);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// DELETE /api/tour-categories/:id - Delete a category
router.delete('/tour-categories/:id', requireAdminAuth, (req, res) => {
    try {
        const categories = loadCategories();
        const { id } = req.params;
        
        const categoryIndex = categories.findIndex(cat => cat.id === id);
        if (categoryIndex === -1) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Check if category has any tours
        const dataDir = path.join(__dirname, '..', 'routes-data');
        const categoryDir = path.join(dataDir, id === 'sightseeing' ? 'sightseeing' : 
                                    id === 'jeep-tour' ? 'jeep-tours' : 
                                    id === 'quad-tours' ? 'quad-tours' : 
                                    id === 'boat-tour' ? 'boat-tour' : id);
        
        if (fs.existsSync(categoryDir)) {
            const files = fs.readdirSync(categoryDir);
            if (files.length > 0) {
                return res.status(400).json({ error: 'Cannot delete category with existing tours' });
            }
        }
        
        categories.splice(categoryIndex, 1);
        saveCategories(categories);
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// POST /api/tours/:categoryId - Create a new tour
router.post('/tours/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    const tourData = req.body;
    
    try {
        const dataDir = path.join(__dirname, '..', 'routes-data');
        let categoryDir;
        
        if (categoryId === 'sightseeing') {
            categoryDir = path.join(dataDir, 'sightseeing');
        } else if (categoryId === 'jeep-tour') {
            categoryDir = path.join(dataDir, 'jeep-tours');
        } else if (categoryId === 'quad-tours') {
            categoryDir = path.join(dataDir, 'quad-tours');
        } else if (categoryId === 'boat-tour') {
            categoryDir = path.join(dataDir, 'boat-tour');
        } else {
            return res.status(400).json({ error: 'Invalid tour category' });
        }
        
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        
        const filePath = path.join(categoryDir, `${tourData.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(tourData, null, 2));
        
        res.status(201).json(tourData);
    } catch (error) {
        console.error('Error creating tour:', error);
        res.status(500).json({ error: 'Failed to create tour' });
    }
});

// PUT /api/tours/:categoryId/:tourId - Update an existing tour
router.put('/tours/:categoryId/:tourId', (req, res) => {
    const { categoryId, tourId } = req.params;
    const tourData = req.body;
    
    try {
        const dataDir = path.join(__dirname, '..', 'routes-data');
        let categoryDir;
        
        if (categoryId === 'sightseeing') {
            categoryDir = path.join(dataDir, 'sightseeing');
        } else if (categoryId === 'jeep-tour') {
            categoryDir = path.join(dataDir, 'jeep-tours');
        } else if (categoryId === 'quad-tours') {
            categoryDir = path.join(dataDir, 'quad-tours');
        } else if (categoryId === 'boat-tour') {
            categoryDir = path.join(dataDir, 'boat-tour');
        } else {
            return res.status(400).json({ error: 'Invalid tour category' });
        }
        
        const filePath = path.join(categoryDir, `${tourId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(tourData, null, 2));
        
        res.json(tourData);
    } catch (error) {
        console.error('Error updating tour:', error);
        res.status(500).json({ error: 'Failed to update tour' });
    }
});

// DELETE /api/tours/:categoryId/:tourId - Delete a tour
router.delete('/tours/:categoryId/:tourId', (req, res) => {
    const { categoryId, tourId } = req.params;
    
    try {
        const dataDir = path.join(__dirname, '..', 'routes-data');
        let categoryDir;
        
        if (categoryId === 'sightseeing') {
            categoryDir = path.join(dataDir, 'sightseeing');
        } else if (categoryId === 'jeep-tour') {
            categoryDir = path.join(dataDir, 'jeep-tours');
        } else if (categoryId === 'quad-tours') {
            categoryDir = path.join(dataDir, 'quad-tours');
        } else if (categoryId === 'boat-tour') {
            categoryDir = path.join(dataDir, 'boat-tour');
        } else {
            return res.status(400).json({ error: 'Invalid tour category' });
        }
        
        const filePath = path.join(categoryDir, `${tourId}.json`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ message: 'Tour deleted successfully' });
        } else {
            res.status(404).json({ error: 'Tour not found' });
        }
    } catch (error) {
        console.error('Error deleting tour:', error);
        res.status(500).json({ error: 'Failed to delete tour' });
    }
});

// Function to read tour data from JSON files
const readTourDataFromFile = (categoryId) => {
    try {
        console.log(`=== BACKEND: Reading tour data for category: ${categoryId} ===`);
        const dataDir = path.join(__dirname, '..', 'routes-data');
        console.log('Data directory:', dataDir);
        
        if (categoryId === 'sightseeing') {
            const sightseeingDir = path.join(dataDir, 'sightseeing');
            console.log('Sightseeing directory:', sightseeingDir);
            console.log('Directory exists:', fs.existsSync(sightseeingDir));
            
            if (fs.existsSync(sightseeingDir)) {
                const files = fs.readdirSync(sightseeingDir).filter(file => file.endsWith('.json'));
                console.log('JSON files found:', files);
                
                const result = files.map(file => {
                    const filePath = path.join(sightseeingDir, file);
                    console.log('Reading file:', filePath);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log('=== BACKEND: Reading file:', filePath);
                    console.log('File data keys:', Object.keys(data));
                    console.log('File data:', data);
                    console.log('File mainImage:', data.mainImage);
                    console.log('File mainImage type:', typeof data.mainImage);
                    
                    // Convert points to coordinates array for the route
                    const coordinates = data.points.map(point => [point.lat, point.lng]);
                    console.log('Converted coordinates:', coordinates);
                    
                    const tourData = {
                        id: data.id,
                        name: data.name,
                        description: data.description || `Sightseeing route: ${data.name}`,
                        importantInfo: data.importantInfo || '',
                        icon: data.icon || '/tours.svg',
                        iconSize: data.iconSize || 32,
                        polylineColor: data.polylineColor || '#8A2BE2',
                        mainImage: data.mainImage || '',
                        currency: data.currency || 'EUR',
                        prices: data.prices || {},
                        duration: data.duration || '',
                        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
                        coordinates: coordinates,
                        points: data.points.map((point, index) => ({
                            placeId: `sightseeing-poi-${data.id}-${(point.id ?? index)}`,
                            order: index + 1,
                            name: point.name || `Point ${index + 1}`,
                            coordinates: [point.lat, point.lng],
                            type: point.type || 'stop', // Preserve the type field
                            lat: point.lat, // Keep original lat/lng for compatibility
                            lng: point.lng,
                            description: point.description || '',
                            images: point.images || []
                        }))
                    };
                    console.log('Final tour data:', tourData);
                    console.log('Final tour data mainImage:', tourData.mainImage);
                    return tourData;
                });
                
                console.log('Final result:', result);
                return result;
            }
        }
        
        // Add support for other tour categories when you create the data files
        else if (categoryId === 'jeep-tour') {
            const jeepDir = path.join(dataDir, 'jeep-tours');
            console.log('Jeep directory:', jeepDir);
            console.log('Jeep directory exists:', fs.existsSync(jeepDir));
            
            if (fs.existsSync(jeepDir)) {
                const files = fs.readdirSync(jeepDir).filter(file => file.endsWith('.json'));
                console.log('Jeep JSON files found:', files);
                
                return files.map(file => {
                    const filePath = path.join(jeepDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Convert points to coordinates array for the route
                    const coordinates = data.points.map(point => [point.lat, point.lng]);
                    
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description || `Jeep tour: ${data.name}`,
                        icon: data.icon || '/tours.svg',
                        iconSize: data.iconSize || 32,
                        polylineColor: data.polylineColor || '#8A2BE2',
                        mainImage: data.mainImage || '',
                        currency: data.currency || 'EUR',
                        prices: data.prices || {},
                        duration: data.duration || '',
                        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
                        coordinates: coordinates,
                        points: data.points.map((point, index) => ({
                            placeId: `jeep-poi-${data.id}-${(point.id ?? index)}`,
                            order: index + 1,
                            name: point.name || `Point ${index + 1}`,
                            coordinates: [point.lat, point.lng],
                            type: point.type || 'stop', // Preserve the type field
                            lat: point.lat, // Keep original lat/lng for compatibility
                            lng: point.lng,
                            description: point.description || '',
                            images: point.images || []
                        }))
                    };
                });
            }
        }
        
        else if (categoryId === 'quad-tours') {
            const quadDir = path.join(dataDir, 'quad-tours');
            console.log('Quad directory:', quadDir);
            console.log('Quad directory exists:', fs.existsSync(quadDir));
            
            if (fs.existsSync(quadDir)) {
                const files = fs.readdirSync(quadDir).filter(file => file.endsWith('.json'));
                console.log('Quad JSON files found:', files);
                
                return files.map(file => {
                    const filePath = path.join(quadDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Convert points to coordinates array for the route
                    const coordinates = data.points.map(point => [point.lat, point.lng]);
                    
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description || `Quad tour: ${data.name}`,
                        icon: data.icon || '/tours.svg',
                        iconSize: data.iconSize || 32,
                        polylineColor: data.polylineColor || '#8A2BE2',
                        mainImage: data.mainImage || '',
                        currency: data.currency || 'EUR',
                        prices: data.prices || {},
                        duration: data.duration || '',
                        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
                        coordinates: coordinates,
                        points: data.points.map((point, index) => ({
                            placeId: `quad-poi-${data.id}-${(point.id ?? index)}`,
                            order: index + 1,
                            name: point.name || `Point ${index + 1}`,
                            coordinates: [point.lat, point.lng],
                            type: point.type || 'stop', // Preserve the type field
                            lat: point.lat, // Keep original lat/lng for compatibility
                            lng: point.lng,
                            description: point.description || '',
                            images: point.images || []
                        }))
                    };
                });
            }
        }
        
        // Add support for boat tours
        else if (categoryId === 'boat-tour') {
            const boatDir = path.join(dataDir, 'boat-tour');
            console.log('Boat directory:', boatDir);
            console.log('Boat directory exists:', fs.existsSync(boatDir));
            
            if (fs.existsSync(boatDir)) {
                const files = fs.readdirSync(boatDir).filter(file => file.endsWith('.json'));
                console.log('Boat JSON files found:', files);
                
                return files.map(file => {
                    const filePath = path.join(boatDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Convert points to coordinates array for the route
                    const coordinates = data.points.map(point => [point.lat, point.lng]);
                    
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description || `Boat tour: ${data.name}`,
                        icon: data.icon || '/tours.svg',
                        iconSize: data.iconSize || 32,
                        polylineColor: data.polylineColor || '#8A2BE2',
                        mainImage: data.mainImage || '',
                        currency: data.currency || 'EUR',
                        prices: data.prices || {},
                        duration: data.duration || '',
                        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
                        coordinates: coordinates,
                        points: data.points.map((point, index) => ({
                            placeId: `boat-poi-${data.id}-${(point.id ?? index)}`,
                            order: index + 1,
                            name: point.name || `Point ${index + 1}`,
                            coordinates: [point.lat, point.lng],
                            type: point.type || 'stop', // Preserve the type field
                            lat: point.lat, // Keep original lat/lng for compatibility
                            lng: point.lng,
                            description: point.description || '',
                            images: point.images || []
                        }))
                    };
                });
            }
        }
        
        // Add support for parasailing tours
        if (categoryId === 'parasailing') {
            const parasailingDir = path.join(dataDir, 'parasailing');
            if (fs.existsSync(parasailingDir)) {
                const files = fs.readdirSync(parasailingDir).filter(file => file.endsWith('.json'));
                return files.map(file => {
                    const filePath = path.join(parasailingDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Convert points to coordinates array for the route
                    const coordinates = data.points.map(point => [point.lat, point.lng]);
                    
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description || `Parasailing: ${data.name}`,
                        icon: data.icon || '/tours.svg',
                        iconSize: data.iconSize || 32,
                        polylineColor: data.polylineColor || '#8A2BE2',
                        mainImage: data.mainImage || '',
                        currency: data.currency || 'EUR',
                        prices: data.prices || {},
                        duration: data.duration || '',
                        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
                        coordinates: coordinates,
                        points: data.points.map((point, index) => ({
                            placeId: `parasailing-poi-${data.id}-${(point.id ?? index)}`,
                            order: index + 1,
                            name: point.name || `Point ${index + 1}`,
                            coordinates: [point.lat, point.lng],
                            type: point.type || 'stop', // Preserve the type field
                            lat: point.lat, // Keep original lat/lng for compatibility
                            lng: point.lng,
                            description: point.description || '',
                            images: point.images || []
                        }))
                    };
                });
            }
        }
        
        return [];
    } catch (error) {
        console.error(`Error reading tour data for category ${categoryId}:`, error);
        return [];
    }
};

// GET /api/tours/:categoryId/:tourId - Get a specific tour (MUST come before the category route)
router.get('/tours/:categoryId/:tourId', (req, res) => {
    const { categoryId, tourId } = req.params;
    console.log(`Fetching tour ${tourId} for category: ${categoryId}`);
    
    try {
        // Handle hiking trails differently since they come from KML files
        if (categoryId === 'hiking') {
            console.log('Fetching hiking trail from KML files...');
            const KML_DIR = path.join(__dirname, '../hiking_trails');
            
            if (!fs.existsSync(KML_DIR)) {
                return res.status(404).json({ error: 'Hiking trails directory not found' });
            }
            
            const files = fs.readdirSync(KML_DIR).filter(file => file.endsWith('.kml'));
            console.log('KML files found:', files);
            
            // Find the KML file that matches the tourId
            const kmlFile = files.find(file => {
                const fileName = file.replace('.kml', '');
                const normalizedFileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const normalizedTourId = tourId.toLowerCase().replace(/[^a-z0-9]/g, '-');
                console.log(`Comparing: "${normalizedFileName}" vs "${normalizedTourId}"`);
                return normalizedFileName === normalizedTourId;
            });
            
            if (!kmlFile) {
                console.log(`No KML file found for tourId: ${tourId}`);
                return res.status(404).json({ error: 'Hiking trail not found' });
            }
            
            console.log(`Found KML file: ${kmlFile}`);
            const filePath = path.join(KML_DIR, kmlFile);
            const kmlContent = fs.readFileSync(filePath, 'utf8');
            
            // Extract Document name
            const docNameMatch = kmlContent.match(/<Document>\s*<name>(.*?)<\/name>/);
            const trailName = docNameMatch && docNameMatch[1] ? docNameMatch[1] : kmlFile.replace('.kml', '');
            
            // Extract Document description
            const docDescMatch = kmlContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
            const trailDescription = docDescMatch && docDescMatch[1] ? docDescMatch[1] : 'No description available.';
            
            // Find Walking Path folder
            const walkingPathStart = kmlContent.indexOf('<Folder>');
            const walkingPathEnd = kmlContent.indexOf('</Folder>', walkingPathStart);
            
            if (walkingPathStart !== -1 && walkingPathEnd !== -1) {
                const folderContent = kmlContent.substring(walkingPathStart, walkingPathEnd);
                
                // Check if this folder contains "Walking Path"
                if (folderContent.includes('<name>Walking Path</name>')) {
                    console.log(`Found Walking Path folder in ${kmlFile}`);
                    
                    // Extract all coordinates from LineString elements
                    const coordinates = [];
                    const lineStringRegex = /<coordinates>(.*?)<\/coordinates>/gs;
                    let coordMatch;
                    
                    while ((coordMatch = lineStringRegex.exec(folderContent)) !== null) {
                        const coordString = coordMatch[1].trim();
                        const coordPairs = coordString.split(/\s+/);
                        
                        coordPairs.forEach(pair => {
                            const [lng, lat] = pair.split(',').map(Number);
                            if (!isNaN(lat) && !isNaN(lng)) {
                                coordinates.push([lat, lng]);
                            }
                        });
                    }
                    
                    // Extract points of interest from Placemark elements
                    const pointsOfInterest = [];
                    const placemarkRegex = /<Placemark>.*?<name>(.*?)<\/name>.*?<coordinates>(.*?)<\/coordinates>.*?<\/Placemark>/gs;
                    let placemarkMatch;
                    
                    while ((placemarkMatch = placemarkRegex.exec(folderContent)) !== null) {
                        const poiName = placemarkMatch[1];
                        const poiCoords = placemarkMatch[2].trim();
                        const [lng, lat] = poiCoords.split(',').map(Number);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            pointsOfInterest.push({
                                name: poiName,
                                coordinates: [lat, lng]
                            });
                        }
                    }
                    
                    if (coordinates.length > 0) {
                        // Load hiking category icon from categories.json
                        const categories = loadCategories();
                        const hikingCategory = categories.find(cat => cat.id === 'hiking');
                        const hikingIcon = hikingCategory?.icon || '🏃';
                        const hikingIconSize = hikingCategory?.iconSize || 32;
                        
                        const tourData = {
                            id: tourId,
                            name: trailName,
                            description: trailDescription,
                            importantInfo: '',
                            icon: hikingIcon,
                            iconSize: hikingIconSize,
                            polylineColor: '#8b5cf6',
                            mainImage: '',
                            coordinates: coordinates,
                            points: pointsOfInterest.map((poi, index) => ({
                                placeId: `hiking-poi-${tourId}-${poi.name.replace(/\s+/g, '-').toLowerCase()}`,
                                order: index + 1,
                                name: poi.name,
                                coordinates: poi.coordinates,
                                type: 'stop',
                                lat: poi.coordinates[0],
                                lng: poi.coordinates[1],
                                description: '',
                                images: []
                            }))
                        };
                        
                        console.log(`Returning hiking trail: ${trailName} with ${coordinates.length} coordinates and ${pointsOfInterest.length} POIs`);
                        return res.json(tourData);
                    }
                }
            }
            
            return res.status(404).json({ error: 'Hiking trail data not found in KML file' });
        }
        
        // Handle other tour categories (JSON files)
        const dataDir = path.join(__dirname, '..', 'routes-data');
        let categoryDir;
        
        if (categoryId === 'sightseeing') {
            categoryDir = path.join(dataDir, 'sightseeing');
        } else if (categoryId === 'jeep-tour') {
            categoryDir = path.join(dataDir, 'jeep-tours');
        } else if (categoryId === 'quad-tours') {
            categoryDir = path.join(dataDir, 'quad-tours');
        } else if (categoryId === 'boat-tour') {
            categoryDir = path.join(dataDir, 'boat-tour');
        } else if (categoryId === 'parasailing') {
            categoryDir = path.join(dataDir, 'parasailing');
        } else {
            return res.status(400).json({ error: 'Invalid tour category' });
        }
        
        const filePath = path.join(categoryDir, `${tourId}.json`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Tour not found' });
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Convert points to coordinates array for the route
        const coordinates = data.points.map(point => [point.lat, point.lng]);
        
        const tourData = {
            id: data.id,
            name: data.name,
            description: data.description || `${categoryId} tour: ${data.name}`,
            importantInfo: data.importantInfo || '',
            icon: data.icon || '/tours.svg',
            iconSize: data.iconSize || 32,
            polylineColor: data.polylineColor || '#8A2BE2',
            mainImage: data.mainImage || '',
            currency: data.currency || 'EUR',
            prices: data.prices || {},
            duration: data.duration || '',
            maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
            coordinates: coordinates,
            points: data.points.map((point, index) => ({
                placeId: `${categoryId}-poi-${data.id}-${(point.id ?? index)}`,
                order: index + 1,
                name: point.name || `Point ${index + 1}`,
                coordinates: [point.lat, point.lng],
                type: point.type || 'stop',
                lat: point.lat,
                lng: point.lng,
                description: point.description || '',
                images: point.images || []
            }))
        };
        
        res.json(tourData);
    } catch (error) {
        console.error(`Error fetching tour ${tourId} for category ${categoryId}:`, error);
        res.status(500).json({ error: 'Failed to fetch tour' });
    }
});

// Updated route to fetch actual tour routes based on category
router.get('/tours/:categoryId', async (req, res) => {
    const { categoryId } = req.params;
    console.log(`Fetching tours for category: ${categoryId}`);
    let tours = [];

    if (categoryId === 'hiking') {
        // Simplified hiking trails logic
        try {
            console.log('=== BACKEND: Fetching hiking trails (simplified) ===');
            const KML_DIR = path.join(__dirname, '../hiking_trails');
            console.log('KML directory:', KML_DIR);
            
            if (!fs.existsSync(KML_DIR)) {
                console.log('KML directory does not exist');
                return res.json([]);
            }
            
            const files = fs.readdirSync(KML_DIR).filter(file => file.endsWith('.kml'));
            console.log('KML files found:', files);
            
            const hikingTrails = [];
            
            for (const file of files) {
                console.log(`Processing hiking file: ${file}`);
                const filePath = path.join(KML_DIR, file);
                const kmlContent = fs.readFileSync(filePath, 'utf8');
                
                // Extract Document name
                const docNameMatch = kmlContent.match(/<Document>\s*<name>(.*?)<\/name>/);
                const trailName = docNameMatch && docNameMatch[1] ? docNameMatch[1] : file.replace('.kml', '');
                
                // Extract Document description
                const docDescMatch = kmlContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
                const trailDescription = docDescMatch && docDescMatch[1] ? docDescMatch[1] : 'No description available.';
                
                // Find Walking Path folder
                const walkingPathStart = kmlContent.indexOf('<Folder>');
                const walkingPathEnd = kmlContent.indexOf('</Folder>', walkingPathStart);
                
                if (walkingPathStart !== -1 && walkingPathEnd !== -1) {
                    const folderContent = kmlContent.substring(walkingPathStart, walkingPathEnd);
                    
                    // Check if this folder contains "Walking Path"
                    if (folderContent.includes('<name>Walking Path</name>')) {
                        console.log(`Found Walking Path folder in ${file}`);
                        
                        // Extract all coordinates from LineString elements
                        const coordinates = [];
                        const lineStringRegex = /<coordinates>(.*?)<\/coordinates>/gs;
                        let coordMatch;
                        
                        while ((coordMatch = lineStringRegex.exec(folderContent)) !== null) {
                            const coordsStr = coordMatch[1];
                            const segmentCoords = coordsStr.trim().split(/\s+/).map(coord => {
                                const [lon, lat, alt] = coord.split(',').map(Number);
                                return [lat, lon]; // Leaflet expects [lat, lon]
                            });
                            coordinates.push(...segmentCoords);
                        }
                        
                        // Extract points of interest from Point elements
                        const pointsOfInterest = [];
                        const pointRegex = /<Point>\s*<coordinates>(.*?)<\/coordinates>\s*<\/Point>/gs;
                        const nameRegex = /<name>(.*?)<\/name>/g;
                        const names = [];
                        let nameMatch;
                        
                        // Collect all names first
                        while ((nameMatch = nameRegex.exec(folderContent)) !== null) {
                            names.push(nameMatch[1]);
                        }
                        
                        let pointMatch;
                        let pointIndex = 0;
                        while ((pointMatch = pointRegex.exec(folderContent)) !== null) {
                            const pointCoordsStr = pointMatch[1];
                            const [lon, lat, alt] = pointCoordsStr.split(',').map(Number);
                            
                            pointsOfInterest.push({
                                name: names[pointIndex] || `Point ${pointIndex + 1}`,
                                description: 'Point of interest on the trail',
                                coordinates: [lat, lon]
                            });
                            pointIndex++;
                        }
                        
                        if (coordinates.length > 0) {
                            hikingTrails.push({
                                name: trailName,
                                description: trailDescription,
                                coordinates: coordinates,
                                pointsOfInterest: pointsOfInterest
                            });
                            console.log(`Added trail: ${trailName} with ${coordinates.length} coordinates`);
                        }
                    }
                }
            }
            
            // Load hiking category icon from categories.json
            const categories = loadCategories();
            const hikingCategory = categories.find(cat => cat.id === 'hiking');
            const hikingIcon = hikingCategory?.icon || '🏃';
            const hikingIconSize = hikingCategory?.iconSize || 32;
            
            // Convert hiking trails to tour format
            tours = hikingTrails.map((trail) => ({
                id: trail.name.replace(/\s+/g, '-').toLowerCase(),
                name: trail.name,
                description: trail.description,
                coordinates: trail.coordinates,
                icon: hikingIcon, // Add hiking category icon
                iconSize: hikingIconSize, // Add icon size
                points: trail.pointsOfInterest.map((poi, index) => ({
                    placeId: `hiking-poi-${trail.name.replace(/\s+/g, '-').toLowerCase()}-${poi.name.replace(/\s+/g, '-').toLowerCase()}`,
                    order: index + 1,
                    name: poi.name,
                    coordinates: poi.coordinates
                }))
            }));
            
            console.log(`Hiking trails processed: ${tours.length}`);
        } catch (error) {
            console.error('Error fetching hiking trails for tours:', error);
            return res.status(500).json({ error: 'Failed to fetch hiking trails for tours' });
        }
    } else {
        // Read from actual JSON files for other categories
        console.log(`=== BACKEND: Reading tour data for non-hiking category: ${categoryId} ===`);
        tours = readTourDataFromFile(categoryId);
        console.log(`Tours found from files for ${categoryId}:`, tours);
        console.log(`Number of tours found: ${tours.length}`);
        
        // Fallback to dummy data if no files found
        if (tours.length === 0) {
            if (categoryId === 'boat-tour') {
                tours = [
                    {
                        id: 'boat-1',
                        name: 'Blue Lagoon Cruise',
                        description: 'Visit the famous Blue Lagoon.',
                        coordinates: [[36.01, 14.31], [36.02, 14.32], [36.03, 14.33]],
                        points: [{ placeId: 'place-id-4', order: 1 }]
                    },
                ];
            } else if (categoryId === 'sightseeing') {
                tours = [
                    {
                        id: 'sightseeing-1',
                        name: 'Citadel Tour',
                        description: 'Discover the historic Citadel.',
                        coordinates: [[36.046, 14.23], [36.047, 14.231], [36.048, 14.232]],
                        points: [{ placeId: 'place-id-5', order: 1 }]
                    },
                ];
            }
        }
    }

    res.json(tours);
});

module.exports = router;
