const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');

// Load folder structure from gallery-manager
function loadGalleryFolders() {
    const foldersPath = path.join(__dirname, '../data/gallery-folders.json');
    if (fsSync.existsSync(foldersPath)) {
        return JSON.parse(fsSync.readFileSync(foldersPath, 'utf8'));
    }
    return { folders: [{ id: 'root', name: 'All Images', path: '', parent: null }] };
}

// GET /api/image-gallery/list - Get all uploaded images (with folder support)
router.get('/list', requireAdminAuth, async (req, res) => {
    try {
        const { search, limit = 100, offset = 0, folder = '' } = req.query;
        
        const uploadsDir = path.join(__dirname, '../uploads');
        
        // Load gallery manager folders
        const galleryStructure = loadGalleryFolders();
        
        // Determine which directory to scan
        let scanDirs = [];
        let folderInfo = [];
        
        if (folder) {
            // Scanning a specific folder
            const safeFolderPath = folder.replace(/\.\./g, '').replace(/^\/+/, '');
            scanDirs.push({
                dir: path.join(uploadsDir, safeFolderPath),
                prefix: safeFolderPath
            });
        } else {
            // Scanning root - include both root uploads and optimized folder
            scanDirs.push(
                { dir: uploadsDir, prefix: '' },
                { dir: path.join(uploadsDir, 'optimized'), prefix: 'optimized' }
            );
            
            // Add folders from gallery manager
            folderInfo = galleryStructure.folders
                .filter(f => f.parent === 'root' || !f.parent)
                .map(f => ({
                    name: f.name,
                    path: f.path,
                    imageCount: 0, // Will be calculated
                    type: 'folder',
                    id: f.id
                }));
        }
        
        // Collect all images and folders
        const images = [];
        const folders = [];
        
        // Scan all directories
        for (const { dir, prefix } of scanDirs) {
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
            
                for (const item of items) {
                    // Skip certain system directories
                    if (item.isDirectory() && ['categories', 'bus-routes', 'routes'].includes(item.name)) {
                        continue;
                    }
                    
                    if (item.isDirectory()) {
                        // It's a folder
                        const folderPath = path.join(dir, item.name);
                        const stats = await fs.stat(folderPath);
                        
                        // Count images in folder recursively
                        let imageCount = 0;
                        try {
                            const countImages = async (dirPath) => {
                                const contents = await fs.readdir(dirPath, { withFileTypes: true });
                                let count = 0;
                                for (const entry of contents) {
                                    if (entry.isDirectory()) {
                                        count += await countImages(path.join(dirPath, entry.name));
                                    } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                        count++;
                                    }
                                }
                                return count;
                            };
                            imageCount = await countImages(folderPath);
                        } catch (err) {
                            imageCount = 0;
                        }
                        
                        const folderPathRelative = prefix ? `${prefix}/${item.name}` : item.name;
                        
                        // Don't add duplicate folders
                        if (!folders.some(f => f.path === folderPathRelative)) {
                            folders.push({
                                name: item.name,
                                path: folderPathRelative,
                                imageCount: imageCount,
                                modified: stats.mtime,
                                type: 'folder'
                            });
                        }
                    } else if (item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        // It's an image - skip if it's a directory itself
                        try {
                            const filePath = path.join(dir, item.name);
                            const stats = await fs.stat(filePath);
                            const imagePath = prefix ? `/uploads/${prefix}/${item.name}` : `/uploads/${item.name}`;
                            
                            // Don't add duplicate images
                            if (!images.some(img => img.path === imagePath.replace(/\\/g, '/'))) {
                                images.push({
                                    filename: item.name,
                                    path: imagePath.replace(/\\/g, '/'),
                                    folder: prefix || '',
                                    size: stats.size,
                                    sizeFormatted: formatFileSize(stats.size),
                                    modified: stats.mtime,
                                    type: prefix === 'optimized' ? 'image' : 'original'
                                });
                            }
                        } catch (err) {
                            console.log(`Error processing file ${item.name}:`, err.message);
                        }
                    }
                }
            } catch (error) {
                console.log(`Error reading directory ${dir}:`, error.message);
            }
        }
        
        // Add gallery manager folders to the folders list
        folderInfo.forEach(gmFolder => {
            if (gmFolder.id !== 'root' && gmFolder.path) {
                // Calculate image count for this folder
                const folderPath = path.join(uploadsDir, gmFolder.path);
                try {
                    const countImages = (dirPath) => {
                        try {
                            const contents = fsSync.readdirSync(dirPath, { withFileTypes: true });
                            let count = 0;
                            for (const entry of contents) {
                                if (entry.isDirectory()) {
                                    count += countImages(path.join(dirPath, entry.name));
                                } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                    count++;
                                }
                            }
                            return count;
                        } catch {
                            return 0;
                        }
                    };
                    
                    gmFolder.imageCount = fsSync.existsSync(folderPath) ? countImages(folderPath) : 0;
                } catch {
                    gmFolder.imageCount = 0;
                }
                
                // Don't add duplicate folders
                if (!folders.some(f => f.path === gmFolder.path)) {
                    folders.push(gmFolder);
                }
            }
        });
        
        // Sort folders and images
        folders.sort((a, b) => a.name.localeCompare(b.name));
        images.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        
        // Apply search filter if provided
        let filteredImages = images;
        let filteredFolders = folders;
        
        if (search && search.trim()) {
            const searchLower = search.toLowerCase();
            filteredImages = images.filter(img => 
                img.filename.toLowerCase().includes(searchLower)
            );
            filteredFolders = folders.filter(f => 
                f.name.toLowerCase().includes(searchLower)
            );
        }
        
        // Apply pagination to images only (show all folders)
        const total = filteredImages.length;
        const paginatedImages = filteredImages.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        res.json({
            success: true,
            folders: filteredFolders,
            images: paginatedImages,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < total,
            currentFolder: folder || ''
        });
        
    } catch (error) {
        console.error('Error listing images:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to list images',
            details: error.message 
        });
    }
});

// DELETE /api/image-gallery/:filename - Delete an image
router.delete('/:filename', requireAdminAuth, async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Security: prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid filename' 
            });
        }
        
        const uploadsDir = path.join(__dirname, '../uploads');
        const optimizedDir = path.join(uploadsDir, 'optimized');
        
        let deleted = false;
        const deletedFiles = [];
        
        // Try to delete from optimized directory
        const optimizedPath = path.join(optimizedDir, filename);
        try {
            await fs.access(optimizedPath);
            await fs.unlink(optimizedPath);
            deleted = true;
            deletedFiles.push(`optimized/${filename}`);
            console.log(`✅ Deleted optimized image: ${filename}`);
        } catch (error) {
            // File doesn't exist in optimized, that's ok
        }
        
        // Try to delete from uploads directory
        const uploadPath = path.join(uploadsDir, filename);
        try {
            await fs.access(uploadPath);
            await fs.unlink(uploadPath);
            deleted = true;
            deletedFiles.push(filename);
            console.log(`✅ Deleted original image: ${filename}`);
        } catch (error) {
            // File doesn't exist in uploads, that's ok
        }
        
        // Also check for related optimized versions (thumbnail, medium, etc.)
        const baseFilename = filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
        try {
            const optimizedFiles = await fs.readdir(optimizedDir);
            for (const file of optimizedFiles) {
                if (file.startsWith(baseFilename) || file.includes(baseFilename)) {
                    const relatedPath = path.join(optimizedDir, file);
                    try {
                        await fs.unlink(relatedPath);
                        deletedFiles.push(`optimized/${file}`);
                        console.log(`✅ Deleted related file: ${file}`);
                    } catch (err) {
                        console.log(`Could not delete related file: ${file}`);
                    }
                }
            }
        } catch (error) {
            // Directory doesn't exist or error reading
        }
        
        if (!deleted && deletedFiles.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Image not found' 
            });
        }
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'IMAGE_DELETE',
            `Deleted image: ${filename} (${deletedFiles.length} files removed)`,
            'image',
            filename,
            { deletedFiles },
            req
        );
        
        res.json({
            success: true,
            message: 'Image deleted successfully',
            deletedFiles: deletedFiles
        });
        
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete image',
            details: error.message 
        });
    }
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;

