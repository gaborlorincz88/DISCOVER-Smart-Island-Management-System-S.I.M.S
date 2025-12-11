const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');

const busRoutesPath = path.join(__dirname, '../bus-routes');
console.log(`[BusRoutes] busRoutesPath: ${busRoutesPath}`);

// GET all route names
router.get('/', (req, res) => {
    fs.readdir(busRoutesPath, { withFileTypes: true }, (err, dirents) => {
        if (err) {
            console.error('Failed to read bus routes directory:', err);
            return res.status(500).json({ error: 'Failed to read bus routes directory' });
        }
        
        const routes = dirents
            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
            .map(dirent => {
                try {
                    const fileName = dirent.name;
                    const fileRouteId = path.basename(fileName, '.json');
                    const fileContent = fs.readFileSync(path.join(busRoutesPath, fileName), 'utf-8');
                    const routeData = JSON.parse(fileContent);
                    // Use routeData.id if available (preferred), otherwise use filename
                    const routeId = routeData.id || fileRouteId;
                    // Use routeData.name if available, otherwise generate from routeId
                    const name = routeData.name || `Route ${routeId}`;
                    // Use routeData.displayedName if available, otherwise fallback to name
                    const displayedName = routeData.displayedName || name;
                    return {
                        id: routeId,
                        name: name,
                        displayedName: displayedName
                    };
                } catch (e) {
                    console.error(`Could not process file ${dirent.name}:`, e);
                    return null; // Skip this file if it's malformed
                }
            })
            .filter(Boolean) // Remove any null entries from failed processing
            // Remove duplicates based on id (in case both filename and routeData.id exist)
            .filter((route, index, self) => index === self.findIndex(r => r.id === route.id));

        res.json(routes);
    });
});

// GET a specific route's data
router.get('/:routeId', (req, res) => {
    const routeId = req.params.routeId;
    let routeFile = path.join(busRoutesPath, `${routeId}.json`);
    
    // Try exact filename match first
    if (!fs.existsSync(routeFile)) {
        // If not found, search all files for matching routeData.id
        try {
            const files = fs.readdirSync(busRoutesPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(busRoutesPath, file);
                    try {
                        const fileContent = fs.readFileSync(filePath, 'utf-8');
                        const routeData = JSON.parse(fileContent);
                        if (routeData.id === routeId) {
                            routeFile = filePath;
                            break;
                        }
                    } catch (e) {
                        // Skip malformed files
                        continue;
                    }
                }
            }
        } catch (dirError) {
            console.error(`Error reading bus routes directory: ${dirError}`);
        }
    }
    
    fs.readFile(routeFile, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Route not found' });
            }
            return res.status(500).json({ error: 'Failed to read route file.' });
        }
        res.json(JSON.parse(data));
    });
});

// POST (save) a specific route's data
router.post('/:routeId', requireAdminAuth, (req, res) => {
    const routeId = req.params.routeId;
    const routeFile = path.join(busRoutesPath, `${routeId}.json`);
    const routeData = req.body;

    // Basic validation for the new format
    if (!routeData || !Array.isArray(routeData.points)) {
        return res.status(400).json({ error: 'Invalid route data format. "points" array is required.' });
    }

    const isNewRoute = !fs.existsSync(routeFile);

    fs.writeFile(routeFile, JSON.stringify(routeData, null, 2), (err) => {
        if (err) {
            console.error(`Failed to save route ${routeId}:`, err);
            return res.status(500).json({ error: 'Failed to save route file.' });
        }
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            isNewRoute ? 'BUS_ROUTE_CREATE' : 'BUS_ROUTE_UPDATE',
            `${isNewRoute ? 'Created' : 'Updated'} bus route: ${routeId}`,
            req.ip
        );
        
        res.status(200).json({ message: `Route ${routeId} saved successfully.` });
    });
});

// GET next departure times for a specific stop
router.get('/:routeId/stop/:stopName', (req, res) => {
    let routeId = req.params.routeId.replace(/-to-/g, '-').replace(/_/g, '-');
    const stopName = decodeURIComponent(req.params.stopName);

    console.log(`[Timetable] Request: routeId=${routeId}, stopName=${stopName}`);

    // Fix vistoria typo in routeId
    if (routeId.toLowerCase().includes('vistoria')) {
        routeId = routeId.replace(/vistoria/gi, 'victoria');
        console.log(`[Timetable] Fixed routeId typo: ${req.params.routeId} -> ${routeId}`);
    }

    // Normalize routeId to lowercase for case-insensitive matching
    const normalizedRouteId = routeId.toLowerCase();
    const timetableDir = path.join(busRoutesPath, 'timetables-json');
    
    console.log(`[Timetable] Looking in directory: ${timetableDir}`);
    
    // Try exact match first (using corrected routeId)
    let timetableFile = path.join(timetableDir, `${routeId}.json`);
    console.log(`[Timetable] Trying exact match: ${timetableFile}, exists: ${fs.existsSync(timetableFile)}`);
    
    // Also try lowercase version
    if (!fs.existsSync(timetableFile)) {
        timetableFile = path.join(timetableDir, `${normalizedRouteId}.json`);
        console.log(`[Timetable] Trying lowercase: ${timetableFile}, exists: ${fs.existsSync(timetableFile)}`);
    }
    
    // Quick check: if routeId contains "306-victoria-munxar-xlendi", try direct match
    if (!fs.existsSync(timetableFile) && normalizedRouteId.includes('306') && normalizedRouteId.includes('victoria') && normalizedRouteId.includes('munxar') && normalizedRouteId.includes('xlendi')) {
        const directFile = path.join(timetableDir, '306-victoria-munxar-xlendi-victoria.json');
        if (fs.existsSync(directFile)) {
            timetableFile = directFile;
            console.log(`[Timetable] Found via direct match: ${timetableFile}`);
        }
    }
    
    // If exact file doesn't exist, try to find a case-insensitive match
    if (!fs.existsSync(timetableFile)) {
        try {
            const files = fs.readdirSync(timetableDir);
            // First try: case-insensitive exact match
            let matchingFile = files.find(file => {
                const fileRouteId = path.basename(file, '.json').toLowerCase();
                return fileRouteId === normalizedRouteId;
            });
            
            // Second try: if routeId is just a number (like "306"), try to find files starting with that number
            if (!matchingFile && /^\d+$/.test(routeId)) {
                matchingFile = files.find(file => {
                    const fileRouteId = path.basename(file, '.json');
                    return fileRouteId.toLowerCase().startsWith(`${routeId}-`) || 
                           fileRouteId.toLowerCase().startsWith(`${routeId}_`);
                });
            }
            
            // Third try: if routeId contains a number, try partial match (e.g., "306" matches "306-victoria-...")
            if (!matchingFile) {
                const routeNumber = routeId.match(/^(\d+)/);
                if (routeNumber) {
                    const num = routeNumber[1];
                    // Try to find file starting with route number and containing key locations
                    matchingFile = files.find(file => {
                        const fileRouteId = path.basename(file, '.json').toLowerCase();
                        return fileRouteId.startsWith(`${num}-`) && 
                               (fileRouteId.includes('victoria') || fileRouteId.includes('vistoria')) &&
                               (fileRouteId.includes('munxar') || fileRouteId.includes('xlendi'));
                    });
                }
            }
            
            // Fourth try: if routeId is just "306", find the file with the full name
            if (!matchingFile && routeId === '306') {
                matchingFile = files.find(file => {
                    const fileRouteId = path.basename(file, '.json').toLowerCase();
                    return fileRouteId.includes('306') && fileRouteId.includes('victoria') && 
                           fileRouteId.includes('munxar') && fileRouteId.includes('xlendi');
                });
                if (matchingFile) {
                    console.log(`[Timetable] Found 306 route match via route number: ${matchingFile}`);
                }
            }
            
            // Fifth try: if still no match and routeId contains "306", try to find any 306 file with victoria
            if (!matchingFile && normalizedRouteId.includes('306')) {
                matchingFile = files.find(file => {
                    const fileRouteId = path.basename(file, '.json').toLowerCase();
                    return fileRouteId.startsWith('306-') && fileRouteId.includes('victoria') && 
                           fileRouteId.includes('munxar') && fileRouteId.includes('xlendi');
                });
                if (matchingFile) {
                    console.log(`[Timetable] Found 306 route match via fallback: ${matchingFile}`);
                }
            }
            
            // Third try: check route file to find matching timetable by route filename
            if (!matchingFile) {
                try {
                    // Try to find route file by routeId (could be filename or id field)
                    let routeFile = path.join(busRoutesPath, `${routeId}.json`);
                    if (!fs.existsSync(routeFile)) {
                        // Search for route file that has this id
                        const routeFiles = fs.readdirSync(busRoutesPath).filter(f => f.endsWith('.json'));
                        for (const rf of routeFiles) {
                            try {
                                const routeData = JSON.parse(fs.readFileSync(path.join(busRoutesPath, rf), 'utf-8'));
                                if (routeData.id === routeId) {
                                    routeFile = path.join(busRoutesPath, rf);
                                    break;
                                }
                            } catch (e) {
                                // Skip malformed files
                            }
                        }
                    }
                    
                    if (fs.existsSync(routeFile)) {
                        const routeFileName = path.basename(routeFile, '.json');
                        // Try to find timetable file matching the route filename
                        matchingFile = files.find(file => {
                            const fileRouteId = path.basename(file, '.json').toLowerCase();
                            return fileRouteId === routeFileName.toLowerCase();
                        });
                    }
                } catch (routeError) {
                    // Ignore route file errors
                }
            }
            
            if (matchingFile) {
                timetableFile = path.join(timetableDir, matchingFile);
                console.log(`Found timetable match: ${matchingFile} for routeId: ${routeId}`);
            }
        } catch (dirError) {
            console.error(`Error reading timetable directory: ${timetableDir}`, dirError);
        }
    }

    if (!fs.existsSync(timetableFile)) {
        console.error(`[Timetable] File does not exist: ${timetableFile}`);
        console.error(`[Timetable] RouteId: ${routeId}, Normalized: ${normalizedRouteId}`);
        try {
            const allFiles = fs.readdirSync(timetableDir);
            const matchingFiles = allFiles.filter(f => f.toLowerCase().includes('306'));
            console.error(`[Timetable] Directory exists: ${fs.existsSync(timetableDir)}`);
            console.error(`[Timetable] Files with 306:`, matchingFiles.join(', '));
            console.error(`[Timetable] All files in dir:`, allFiles.slice(0, 10).join(', '));
        } catch (e) {
            console.error(`[Timetable] Error reading directory:`, e.message);
        }
        return res.status(404).json({ error: `Timetable file not found for route: ${routeId}` });
    }
    
    console.log(`[Timetable] Using file: ${timetableFile}`);

    fs.readFile(timetableFile, 'utf8', (err, data) => {
        if (err) {
            console.error(`[Timetable] Error reading timetable file: ${timetableFile}`, err);
            return res.status(404).json({ error: 'Timetable file not found for this route.' });
        }
        
        try {
            const timetable = JSON.parse(data);
            // Normalize stop name: lowercase, remove spaces, remove parentheses and their contents
            const normalizeStopName = (name) => {
                return name.toLowerCase()
                    .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents
                    .replace(/\s+/g, '') // Remove all spaces
                    .trim();
            };
            
            const requestedStopKey = normalizeStopName(stopName);
            let stopTimes;
            let bestMatch = null;
            let bestMatchLength = 0;

            // Find the key that matches the requested stop name
            // Try exact match first, then best partial match
            for (const key in timetable) {
                const normalizedKey = normalizeStopName(key);
                // Exact match - highest priority
                if (normalizedKey === requestedStopKey) {
                    stopTimes = timetable[key];
                    break;
                }
                // Partial match: check if requested stop name is contained in timetable key or vice versa
                // Prefer longer matches to avoid false positives
                if (normalizedKey.includes(requestedStopKey) || requestedStopKey.includes(normalizedKey)) {
                    const matchLength = Math.min(normalizedKey.length, requestedStopKey.length);
                    if (matchLength > bestMatchLength) {
                        bestMatch = timetable[key];
                        bestMatchLength = matchLength;
                    }
                }
            }

            // Use best match if no exact match found
            if (!stopTimes && bestMatch) {
                stopTimes = bestMatch;
            }

            if (stopTimes) {
                res.json({ times: stopTimes });
            } else {
                console.error(`Stop not found: "${stopName}" (normalized: "${requestedStopKey}") in route ${routeId}. Available stops: ${Object.keys(timetable).join(', ')}`);
                res.status(404).json({ error: 'Stop not found in this timetable.' });
            }
        } catch (parseError) {
            console.error(`Error parsing timetable JSON: ${timetableFile}`, parseError);
            res.status(500).json({ error: 'Failed to parse timetable data.' });
        }
    });
});

// DELETE a specific route
router.delete('/:routeId', requireAdminAuth, (req, res) => {
    const routeId = req.params.routeId;
    const routeFile = path.join(busRoutesPath, `${routeId}.json`);

    // Check if file exists
    if (!fs.existsSync(routeFile)) {
        return res.status(404).json({ error: 'Route not found' });
    }

    // Delete the file
    fs.unlink(routeFile, (err) => {
        if (err) {
            console.error(`Failed to delete route ${routeId}:`, err);
            return res.status(500).json({ error: 'Failed to delete route file' });
        }
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'BUS_ROUTE_DELETE',
            `Deleted bus route: ${routeId}`,
            req.ip
        );
        
        res.status(200).json({ message: `Route ${routeId} deleted successfully` });
    });
});

module.exports = router;
