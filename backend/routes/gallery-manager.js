const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAdminAuth } = require('../middleware/admin-auth');

// Path to store folder structure
const FOLDERS_JSON_PATH = path.join(__dirname, '../data/gallery-folders.json');
const UPLOADS_BASE_PATH = path.join(__dirname, '../uploads');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize folders structure if doesn't exist
function loadFolders() {
    if (!fs.existsSync(FOLDERS_JSON_PATH)) {
        const defaultStructure = {
            folders: [
                { id: 'root', name: 'All Images', path: '', parent: null, created: new Date().toISOString() }
            ]
        };
        fs.writeFileSync(FOLDERS_JSON_PATH, JSON.stringify(defaultStructure, null, 2));
        return defaultStructure;
    }
    return JSON.parse(fs.readFileSync(FOLDERS_JSON_PATH, 'utf8'));
}

function saveFolders(structure) {
    fs.writeFileSync(FOLDERS_JSON_PATH, JSON.stringify(structure, null, 2));
}

// Helper function to scan filesystem folders
function scanFilesystemFolders() {
    const scannedFolders = [];
    
    // Scan uploads directory
    const scanDirectory = (dirPath, parentPath = '') => {
        try {
            if (!fs.existsSync(dirPath)) return;
            
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory() && !['categories', 'bus-routes', 'routes'].includes(item.name)) {
                    const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
                    const folderId = `filesystem_${folderPath.replace(/\//g, '_')}`;
                    
                    scannedFolders.push({
                        id: folderId,
                        name: item.name,
                        path: folderPath,
                        parent: parentPath ? `filesystem_${parentPath.replace(/\//g, '_')}` : 'root',
                        type: 'filesystem',
                        created: fs.statSync(path.join(dirPath, item.name)).birthtime.toISOString()
                    });
                    
                    // Recursively scan subdirectories
                    scanDirectory(path.join(dirPath, item.name), folderPath);
                }
            }
        } catch (error) {
            console.log(`Error scanning directory ${dirPath}:`, error.message);
        }
    };
    
    // Scan uploads root and optimized subfolder
    const uploadsPath = UPLOADS_BASE_PATH;
    scanDirectory(uploadsPath);
    
    return scannedFolders;
}

// Get all folders and their structure
router.get('/folders', requireAdminAuth, (req, res) => {
    try {
        const structure = loadFolders();
        
        // Scan filesystem for additional folders
        const filesystemFolders = scanFilesystemFolders();
        
        // Merge filesystem folders with managed folders
        // Deduplicate by path
        const folderMap = new Map();
        
        // Add managed folders first
        structure.folders.forEach(folder => {
            folderMap.set(folder.path, folder);
        });
        
        // Add filesystem folders that don't exist in managed structure
        filesystemFolders.forEach(folder => {
            if (!folderMap.has(folder.path)) {
                folderMap.set(folder.path, folder);
            }
        });
        
        const mergedFolders = Array.from(folderMap.values());
        
        res.json({ folders: mergedFolders });
    } catch (error) {
        console.error('Error loading folders:', error);
        res.status(500).json({ error: 'Failed to load folders' });
    }
});

// Create a new folder
router.post('/folders', requireAdminAuth, (req, res) => {
    try {
        const { name, parent } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        const structure = loadFolders();
        
        // Find parent folder to build path
        let parentPath = '';
        if (parent && parent !== 'root') {
            const parentFolder = structure.folders.find(f => f.id === parent);
            if (!parentFolder) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            parentPath = parentFolder.path;
        }
        
        // Generate unique ID
        const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Build folder path
        const folderPath = parentPath ? `${parentPath}/${name}` : name;
        
        // Create physical folder
        const physicalPath = path.join(UPLOADS_BASE_PATH, folderPath);
        if (!fs.existsSync(physicalPath)) {
            fs.mkdirSync(physicalPath, { recursive: true });
        }
        
        // Add to structure
        const newFolder = {
            id,
            name,
            path: folderPath,
            parent: parent || 'root',
            created: new Date().toISOString()
        };
        
        structure.folders.push(newFolder);
        saveFolders(structure);
        
        res.status(201).json(newFolder);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Rename a folder
router.put('/folders/:id', requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        if (id === 'root') {
            return res.status(400).json({ error: 'Cannot rename root folder' });
        }
        
        const structure = loadFolders();
        const folderIndex = structure.folders.findIndex(f => f.id === id);
        
        if (folderIndex === -1) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        const folder = structure.folders[folderIndex];
        const oldPath = folder.path;
        
        // Build new path
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = name;
        const newPath = pathParts.join('/');
        
        // Rename physical folder
        const oldPhysicalPath = path.join(UPLOADS_BASE_PATH, oldPath);
        const newPhysicalPath = path.join(UPLOADS_BASE_PATH, newPath);
        
        if (fs.existsSync(oldPhysicalPath)) {
            fs.renameSync(oldPhysicalPath, newPhysicalPath);
        }
        
        // Update folder and all subfolders
        folder.name = name;
        folder.path = newPath;
        
        // Update children paths
        structure.folders.forEach(f => {
            if (f.path.startsWith(oldPath + '/')) {
                f.path = f.path.replace(oldPath, newPath);
            }
        });
        
        saveFolders(structure);
        res.json(folder);
    } catch (error) {
        console.error('Error renaming folder:', error);
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});

// Delete a folder
router.delete('/folders/:id', requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        
        if (id === 'root') {
            return res.status(400).json({ error: 'Cannot delete root folder' });
        }
        
        const structure = loadFolders();
        const folder = structure.folders.find(f => f.id === id);
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Check if folder has subfolders
        const hasChildren = structure.folders.some(f => f.parent === id);
        if (hasChildren) {
            return res.status(400).json({ error: 'Cannot delete folder with subfolders. Delete subfolders first.' });
        }
        
        // Delete physical folder
        const physicalPath = path.join(UPLOADS_BASE_PATH, folder.path);
        if (fs.existsSync(physicalPath)) {
            // Check if folder has files
            const files = fs.readdirSync(physicalPath);
            if (files.length > 0) {
                return res.status(400).json({ error: 'Cannot delete folder with images. Move or delete images first.' });
            }
            fs.rmdirSync(physicalPath);
        }
        
        // Remove from structure
        structure.folders = structure.folders.filter(f => f.id !== id);
        saveFolders(structure);
        
        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// Get images in a specific folder
router.get('/images/:folderId', requireAdminAuth, (req, res) => {
    try {
        const { folderId } = req.params;
        const structure = loadFolders();
        
        let folderPath = '';
        if (folderId !== 'root') {
            // Try to find folder in managed structure
            let folder = structure.folders.find(f => f.id === folderId);
            
            // If not found in managed structure, check if it's a filesystem folder
            if (!folder && folderId.startsWith('filesystem_')) {
                folderPath = folderId.replace('filesystem_', '').replace(/_/g, '/');
            } else if (folder) {
                folderPath = folder.path;
            } else {
                return res.status(404).json({ error: 'Folder not found' });
            }
        }
        
        const physicalPath = path.join(UPLOADS_BASE_PATH, folderPath);
        
        if (!fs.existsSync(physicalPath)) {
            return res.json({ images: [] });
        }
        
        let files = [];
        const folders = [];
        
        // Scan directory for files and subdirectories
        const items = fs.readdirSync(physicalPath, { withFileTypes: true });
        
        for (const item of items) {
            if (item.isDirectory()) {
                folders.push(item.name);
            } else {
                const ext = path.extname(item.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                    files.push(item.name);
                }
            }
        }
        
        const images = files
            .map(file => {
                const filePath = path.join(physicalPath, file);
                const stats = fs.statSync(filePath);
                const webPath = folderPath ? `/uploads/${folderPath}/${file}` : `/uploads/${file}`;
                
                return {
                    name: file,
                    path: webPath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    folder: folderId
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json({ images, folders });
    } catch (error) {
        console.error('Error loading images:', error);
        res.status(500).json({ error: 'Failed to load images' });
    }
});

// Move image(s) to different folder
router.post('/images/move', requireAdminAuth, (req, res) => {
    try {
        const { images, targetFolderId } = req.body;
        
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'Images array is required' });
        }
        
        const structure = loadFolders();
        
        // Get target folder path
        let targetPath = '';
        if (targetFolderId !== 'root') {
            const targetFolder = structure.folders.find(f => f.id === targetFolderId);
            if (!targetFolder) {
                return res.status(404).json({ error: 'Target folder not found' });
            }
            targetPath = targetFolder.path;
        }
        
        const moved = [];
        const errors = [];
        
        images.forEach(imagePath => {
            try {
                // Extract current path and filename
                const relativePath = imagePath.replace('/uploads/', '');
                const oldPhysicalPath = path.join(UPLOADS_BASE_PATH, relativePath);
                const filename = path.basename(relativePath);
                
                // Build new path
                const newRelativePath = targetPath ? `${targetPath}/${filename}` : filename;
                const newPhysicalPath = path.join(UPLOADS_BASE_PATH, newRelativePath);
                
                // Move file
                if (fs.existsSync(oldPhysicalPath)) {
                    fs.renameSync(oldPhysicalPath, newPhysicalPath);
                    moved.push({
                        oldPath: imagePath,
                        newPath: `/uploads/${newRelativePath}`
                    });
                } else {
                    errors.push({ path: imagePath, error: 'File not found' });
                }
            } catch (error) {
                errors.push({ path: imagePath, error: error.message });
            }
        });
        
        res.json({ moved, errors });
    } catch (error) {
        console.error('Error moving images:', error);
        res.status(500).json({ error: 'Failed to move images' });
    }
});

// Delete image(s)
router.post('/images/delete', requireAdminAuth, (req, res) => {
    try {
        const { images } = req.body;
        
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'Images array is required' });
        }
        
        const deleted = [];
        const errors = [];
        
        images.forEach(imagePath => {
            try {
                const relativePath = imagePath.replace('/uploads/', '');
                const physicalPath = path.join(UPLOADS_BASE_PATH, relativePath);
                
                if (fs.existsSync(physicalPath)) {
                    fs.unlinkSync(physicalPath);
                    deleted.push(imagePath);
                } else {
                    errors.push({ path: imagePath, error: 'File not found' });
                }
            } catch (error) {
                errors.push({ path: imagePath, error: error.message });
            }
        });
        
        res.json({ deleted, errors });
    } catch (error) {
        console.error('Error deleting images:', error);
        res.status(500).json({ error: 'Failed to delete images' });
    }
});

// Search images across all folders
router.get('/search', requireAdminAuth, (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const searchTerm = query.toLowerCase();
        const structure = loadFolders();
        const allImages = [];
        
        // Search through all folders
        function searchFolder(folderPath) {
            const physicalPath = path.join(UPLOADS_BASE_PATH, folderPath);
            
            if (!fs.existsSync(physicalPath)) return;
            
            const files = fs.readdirSync(physicalPath);
            
            files.forEach(file => {
                const filePath = path.join(physicalPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    const subPath = folderPath ? `${folderPath}/${file}` : file;
                    searchFolder(subPath);
                } else {
                    const ext = path.extname(file).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
                        if (file.toLowerCase().includes(searchTerm)) {
                            const webPath = folderPath ? `/uploads/${folderPath}/${file}` : `/uploads/${file}`;
                            allImages.push({
                                name: file,
                                path: webPath,
                                size: stats.size,
                                created: stats.birthtime,
                                folder: folderPath || 'root'
                            });
                        }
                    }
                }
            });
        }
        
        searchFolder('');
        
        res.json({ images: allImages });
    } catch (error) {
        console.error('Error searching images:', error);
        res.status(500).json({ error: 'Failed to search images' });
    }
});

module.exports = router;

