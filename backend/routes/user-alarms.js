const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { imageOptimizer } = require('../middleware/imageOptimizer');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { containsInappropriateContent, getPolitenessScore } = require('../services/politenessFilter');
const db = require('../database');
const router = express.Router();

// Path to user alarms data file
const USER_ALARMS_FILE = path.join(__dirname, '../data/user-alarms.json');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + '-' + file.originalname;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.dirname(USER_ALARMS_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Default values for alarm types
function getDefaultIcon(type) {
    const icons = {
        'jellyfish': '🪼',
        'shark': '🦈',
        'storm': '⛈️',
        'current': '🌊',
        'pollution': '☢️',
        'equipment': '🚧',
        'other': '⚠️'
    };
    return icons[type] || '⚠️';
}

function getDefaultColor(severity) {
    const colors = {
        'low': '#10B981',
        'medium': '#F59E0B',
        'high': '#EF4444',
        'critical': '#DC2626'
    };
    return colors[severity] || '#F59E0B';
}

// Helper function to delete image files
async function deleteImageFile(imageUrl) {
    if (!imageUrl) return;
    
    try {
        // Extract filename from URL
        const filename = path.basename(imageUrl);
        const uploadsPath = path.join(__dirname, '../uploads', filename);
        const optimizedPath = path.join(__dirname, '../uploads/optimized');
        
        // Delete original file
        if (require('fs').existsSync(uploadsPath)) {
            await fs.unlink(uploadsPath);
            console.log('Deleted original image:', uploadsPath);
        }
        
        // Delete optimized versions
        const baseName = path.basename(filename, path.extname(filename));
        const optimizedFiles = [
            `${baseName}-optimized.webp`,
            `${baseName}-small.webp`,
            `${baseName}-medium.webp`,
            `${baseName}-large.webp`
        ];
        
        for (const optFile of optimizedFiles) {
            const optPath = path.join(optimizedPath, optFile);
            if (require('fs').existsSync(optPath)) {
                await fs.unlink(optPath);
                console.log('Deleted optimized image:', optPath);
            }
        }
    } catch (error) {
        console.error('Error deleting image file:', error);
    }
}

// Image upload endpoint for user alarms
router.post('/upload-image', upload.single('image'), imageOptimizer, (req, res) => {
    console.log('User alarm image upload request received');
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
    
    console.log('User alarm image uploaded successfully:', imageUrl);
    res.json({ imageUrl: imageUrl });
});

// Get cleanup settings (must be before the catch-all route)
router.get('/cleanup-settings', async (req, res) => {
    try {
        await ensureDataDir();
        
        const settingsFile = path.join(__dirname, '..', 'data', 'cleanup-settings.json');
        let settings = { hours: 'off', nextCleanup: null };
        
        try {
            const settingsData = await fs.readFile(settingsFile, 'utf8');
            settings = JSON.parse(settingsData);
        } catch (fileError) {
            // File doesn't exist, use defaults
        }
        
        res.json({
            success: true,
            ...settings
        });
    } catch (error) {
        console.error('Error getting cleanup settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cleanup settings'
        });
    }
});

// Update cleanup settings
router.put('/cleanup-settings', requireAdminAuth, async (req, res) => {
    try {
        const { hours } = req.body;
        
        // Allow 'off' option or validate hours
        if (hours !== 'off' && (!hours || hours < 1 || hours > 720)) {
            return res.status(400).json({
                success: false,
                error: 'Hours must be between 1 and 720, or "off" to disable cleanup'
            });
        }
        
        await ensureDataDir();
        
        const settingsFile = path.join(__dirname, '..', 'data', 'cleanup-settings.json');
        
        const settings = {
            hours,
            updatedAt: new Date().toISOString()
        };
        
        // Only set nextCleanup if not disabled
        if (hours !== 'off') {
            const nextCleanup = new Date(Date.now() + hours * 60 * 60 * 1000);
            settings.nextCleanup = nextCleanup.toISOString();
        } else {
            settings.nextCleanup = null;
        }
        
        await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
        
        // Log admin activity
        const actionDescription = hours === 'off' ? 
            'Disabled automatic alarm cleanup' : 
            `Set automatic alarm cleanup to ${hours} hours`;
        
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'USER_ALARM_CLEANUP_SETTINGS',
            actionDescription,
            'cleanup_settings',
            null,
            { hours },
            req
        );
        
        res.json({
            success: true,
            ...settings
        });
    } catch (error) {
        console.error('Error updating cleanup settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update cleanup settings'
        });
    }
});

// Manual cleanup endpoint
router.post('/cleanup', requireAdminAuth, async (req, res) => {
    try {
        await ensureDataDir();
        
        // Get cleanup settings
        const settingsFile = path.join(__dirname, '..', 'data', 'cleanup-settings.json');
        let cleanupHours = 'off'; // Default
        
        try {
            const settingsData = await fs.readFile(settingsFile, 'utf8');
            const settings = JSON.parse(settingsData);
            cleanupHours = settings.hours || 'off';
        } catch (fileError) {
            // Use default
        }
        
        // For manual cleanup when automatic cleanup is disabled, delete ALL inactive alarms
        const isAutomaticDisabled = cleanupHours === 'off';
        if (isAutomaticDisabled) {
            cleanupHours = 0; // Delete all inactive alarms immediately
        }
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            // No alarms to clean up
            return res.json({
                success: true,
                deletedCount: 0,
                message: 'No alarms to clean up'
            });
        }
        
        // Calculate cutoff time
        const cutoffTime = cleanupHours === 0 ? new Date(0) : new Date(Date.now() - cleanupHours * 60 * 60 * 1000);
        
        // Filter out inactive alarms older than cutoff time
        const originalCount = alarms.length;
        const cleanupType = isAutomaticDisabled ? "ALL inactive alarms" : `${cleanupHours} hours old`;
        console.log(`Starting cleanup: ${originalCount} total alarms, deleting: ${cleanupType}`);
        
        // Log all inactive alarms for debugging
        const inactiveAlarms = alarms.filter(alarm => !alarm.isActive);
        console.log(`Found ${inactiveAlarms.length} inactive alarms`);
        inactiveAlarms.forEach(alarm => {
            const deactivatedAt = alarm.deactivatedAt ? new Date(alarm.deactivatedAt) : new Date(alarm.createdAt);
            const hoursOld = (Date.now() - deactivatedAt.getTime()) / (1000 * 60 * 60);
            console.log(`Inactive alarm ${alarm.id}: ${hoursOld.toFixed(1)} hours old, deactivatedAt: ${deactivatedAt.toISOString()}`);
        });
        
        const cleanedAlarms = alarms.filter(alarm => {
            if (alarm.isActive) return true; // Keep active alarms
            
            if (isAutomaticDisabled) {
                console.log(`Deleting inactive alarm: ${alarm.id} (automatic cleanup disabled)`);
                return false; // Delete all inactive alarms when automatic cleanup is disabled
            }
            
            const deactivatedAt = alarm.deactivatedAt ? new Date(alarm.deactivatedAt) : new Date(alarm.createdAt);
            return deactivatedAt > cutoffTime; // Keep if not old enough
        });
        
        const deletedCount = originalCount - cleanedAlarms.length;
        console.log(`Cleanup result: ${deletedCount} deleted, ${cleanedAlarms.length} kept`);
        
        // Save cleaned alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(cleanedAlarms, null, 2));
        
        const logMessage = isAutomaticDisabled ? 
            `Cleanup completed: Deleted ${deletedCount} inactive alarms (all inactive alarms deleted since automatic cleanup is disabled)` :
            `Cleanup completed: Deleted ${deletedCount} inactive alarms older than ${cleanupHours} hours`;
        console.log(logMessage);
        
        const isDefaultTime = req.body.isDefaultTime || false;
        let timeMessage;
        
        if (isAutomaticDisabled) {
            timeMessage = `Deleted ${deletedCount} inactive alarms (all inactive alarms deleted since automatic cleanup is disabled)`;
        } else if (isDefaultTime) {
            timeMessage = `Deleted ${deletedCount} inactive alarms older than ${cleanupHours} hours (using default time since automatic cleanup is disabled)`;
        } else {
            timeMessage = `Deleted ${deletedCount} inactive alarms older than ${cleanupHours} hours`;
        }

        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'USER_ALARM_CLEANUP',
            `Manual cleanup: ${timeMessage}`,
            'cleanup',
            null,
            { deletedCount, cleanupHours, isAutomaticDisabled },
            req
        );
            
        res.json({
            success: true,
            deletedCount,
            message: timeMessage
        });
        
    } catch (error) {
        console.error('Error running cleanup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run cleanup'
        });
    }
});

// Get all user-generated alarms
router.get('/', async (req, res) => {
    try {
        await ensureDataDir();
        
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            // File doesn't exist, return empty array
        }
        
        // Check if admin wants to see all alarms (including old inactive ones)
        const showAll = req.query.showAll === 'true';
        
        if (showAll) {
            // Return all alarms for admin interface
            // Populate usernames for alarms that don't have them
            const alarmsWithUsernames = await Promise.all(alarms.map(async (alarm) => {
                if (!alarm.createdByUsername && alarm.createdBy) {
                    try {
                        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(alarm.createdBy);
                        if (user) {
                            alarm.createdByUsername = user.username;
                        }
                    } catch (error) {
                        console.error('Error fetching username for alarm:', error);
                    }
                }
                return alarm;
            }));
            
            res.json(alarmsWithUsernames);
            return;
        }
        
        // Filter out inactive alarms older than 24 hours for frontend
        const now = new Date();
        const activeAlarms = alarms.filter(alarm => {
            if (alarm.isActive) return true;
            
            // If inactive, check if it's less than 24 hours old
            const alarmDate = new Date(alarm.updatedAt);
            const hoursDiff = (now - alarmDate) / (1000 * 60 * 60);
            return hoursDiff < 24;
        });
        
        res.json(activeAlarms);
    } catch (error) {
        console.error('Error fetching user alarms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user alarms'
        });
    }
});

// Middleware to require either admin auth or user identification
function requireUserOrAdminAuth(req, res, next) {
  // Check for admin authentication first
  const adminSessionToken = req.cookies?.admin_session;
  
  if (adminSessionToken) {
    // Try admin authentication
    try {
      const session = db.prepare(`
        SELECT s.*, u.email, u.role, u.username
        FROM admin_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
      `).get(adminSessionToken);
      
      if (session) {
        req.admin = {
          id: session.user_id,
          email: session.email,
          username: session.username,
          role: session.role
        };
        req.authType = 'admin';
        return next();
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
    }
  }
  
  // Check for user identification in request body
  const { createdBy, createdByEmail, createdByUsername } = req.body;
  
  if (createdBy && createdByEmail) {
    // Validate user exists
    try {
      const user = db.prepare('SELECT id, email, username, role FROM users WHERE id = ? AND email = ?').get(createdBy, createdByEmail);
      
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        };
        req.authType = 'user';
        return next();
      }
    } catch (error) {
      console.error('User auth check failed:', error);
    }
  }
  
  return res.status(401).json({ 
    success: false,
    error: 'Authentication required. Please log in as a user or admin.' 
  });
}

// Create a new user-generated alarm
router.post('/', requireUserOrAdminAuth, async (req, res) => {
    try {
        const { type, title, description, coordinates, severity, icon, color, imageUrl, createdBy, createdByEmail, createdByUsername } = req.body;
        
        // Validate required fields
        if (!type || !title || !coordinates || !createdBy) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, title, coordinates, createdBy'
            });
        }
        
        // Validate coordinates
        if (typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates format'
            });
        }
        
        // Check content for inappropriate language
        const contentToCheck = `${title || ''} ${description || ''}`.trim();
        const politenessCheck = containsInappropriateContent(contentToCheck);
        const politenessScore = getPolitenessScore(contentToCheck);
        
        // Reject alarm if content is highly inappropriate
        if (politenessCheck.isInappropriate && politenessScore > 80) {
            return res.status(400).json({
                success: false,
                error: 'Alarm content contains inappropriate language and cannot be created',
                politenessScore: politenessScore,
                moderationReasons: politenessCheck.reasons
            });
        }
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            // File doesn't exist, start with empty array
        }
        
        // Create new alarm
        const newAlarm = {
            id: `user_alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            title: title.trim(),
            description: description ? description.trim() : '',
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            severity: severity || 'medium',
            isActive: true,
            icon: icon || getDefaultIcon(type),
            color: color || getDefaultColor(severity || 'medium'),
            imageUrl: imageUrl || null,
            createdBy,
            createdByEmail: createdByEmail || null,
            createdByUsername: createdByUsername || (req.user ? req.user.username : null) || (req.admin ? req.admin.username : null),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deactivatedBy: null,
            deactivatedAt: null,
            politenessScore: politenessScore,
            moderationReasons: politenessCheck.isInappropriate ? JSON.stringify(politenessCheck.reasons) : null,
            isModerated: politenessCheck.isInappropriate && politenessScore > 20
        };
        
        // Add new alarm
        alarms.push(newAlarm);
        
        // Save to file
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log activity (admin or user)
        if (req.authType === 'admin') {
            logAdminActivity(
                req.admin.id,
                req.admin.email,
                'USER_ALARM_CREATE',
                `Created user alarm: ${title}`,
                'user_alarm',
                newAlarm.id,
                null,
                req
            );
        } else {
            // Log user activity (could be enhanced with user activity logging)
            console.log(`User ${req.user.email} created alarm: ${title} (ID: ${newAlarm.id})`);
        }
        
        res.json({
            success: true,
            alarm: newAlarm,
            message: 'User alarm created successfully'
        });
        
    } catch (error) {
        console.error('Error creating user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user alarm'
        });
    }
});

// Update/deactivate a user alarm
router.put('/:id', requireUserOrAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, deactivatedBy, title, description, severity } = req.body;
        
        // Basic validation - require some form of user identification for deactivation
        if (isActive === false && !deactivatedBy) {
            return res.status(400).json({
                success: false,
                error: 'User identification required for deactivation'
            });
        }
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Find the alarm
        const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
        if (alarmIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        const alarm = alarms[alarmIndex];
        
        // Check content for inappropriate language if title or description is being updated
        if (title || description !== undefined) {
            const contentToCheck = `${title || alarm.title} ${description !== undefined ? description : alarm.description || ''}`.trim();
            const politenessCheck = containsInappropriateContent(contentToCheck);
            const politenessScore = getPolitenessScore(contentToCheck);
            
            // Reject update if content is highly inappropriate
            if (politenessCheck.isInappropriate && politenessScore > 80) {
                return res.status(400).json({
                    success: false,
                    error: 'Updated alarm content contains inappropriate language and cannot be saved',
                    politenessScore: politenessScore,
                    moderationReasons: politenessCheck.reasons
                });
            }
            
            // Update politeness scoring fields
            alarm.politenessScore = politenessScore;
            alarm.moderationReasons = politenessCheck.isInappropriate ? JSON.stringify(politenessCheck.reasons) : null;
            alarm.isModerated = politenessCheck.isInappropriate && politenessScore > 20;
        }
        
        // Update alarm
        if (isActive !== undefined) {
            alarm.isActive = isActive;
            if (!isActive && deactivatedBy) {
                alarm.deactivatedBy = deactivatedBy;
                alarm.deactivatedAt = new Date().toISOString();
            } else if (isActive) {
                alarm.deactivatedBy = null;
                alarm.deactivatedAt = null;
            }
        }
        
        if (title) alarm.title = title.trim();
        if (description !== undefined) alarm.description = description.trim();
        if (severity) alarm.severity = severity;
        
        alarm.updatedAt = new Date().toISOString();
        
        // Save updated alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log activity (admin or user)
        const actionType = isActive === false ? 'USER_ALARM_DEACTIVATE' : 'USER_ALARM_UPDATE';
        const actionDescription = isActive === false ? `Deactivated user alarm: ${alarm.title}` : `Updated user alarm: ${alarm.title}`;
        
        if (req.authType === 'admin') {
            logAdminActivity(
                req.admin.id,
                req.admin.email,
                actionType,
                actionDescription,
                'user_alarm',
                id,
                null,
                req
            );
        } else {
            console.log(`User ${req.user.email} ${actionType.toLowerCase()}: ${actionDescription} (ID: ${id})`);
        }
        
        res.json({
            success: true,
            alarm: alarm,
            message: isActive === false ? 'Alarm deactivated successfully' : 'Alarm updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user alarm'
        });
    }
});

// Delete a user alarm (only by creator or admin)
router.delete('/:id', requireUserOrAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { deletedBy } = req.body;
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Find the alarm
        const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
        if (alarmIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        const alarm = alarms[alarmIndex];
        
        // Check if user can delete (creator or admin)
        const isAdmin = req.authType === 'admin';
        const isCreator = req.authType === 'user' && alarm.createdBy === req.user.id;
        
        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                error: 'Only the creator or admin can delete this alarm'
            });
        }
        
        // Delete associated image files before removing alarm
        if (alarm.imageUrl) {
            await deleteImageFile(alarm.imageUrl);
        }
        
        // Remove alarm
        alarms.splice(alarmIndex, 1);
        
        // Save updated alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log activity (admin or user)
        if (req.authType === 'admin') {
            logAdminActivity(
                req.admin.id,
                req.admin.email,
                'USER_ALARM_DELETE',
                `Deleted user alarm: ${alarm.title}`,
                'user_alarm',
                id,
                null,
                req
            );
        } else {
            console.log(`User ${req.user.email} deleted alarm: ${alarm.title} (ID: ${id})`);
        }
        
        res.json({
            success: true,
            message: 'Alarm deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user alarm'
        });
    }
});

// Activate user alarm (PUT)
router.put('/:id/activate', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Find and activate the alarm
        const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
        if (alarmIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Activate alarm
        alarms[alarmIndex] = {
            ...alarms[alarmIndex],
            isActive: true,
            deactivatedBy: null,
            deactivatedAt: null,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'USER_ALARM_ACTIVATE',
            `Activated user alarm: ${alarms[alarmIndex].title}`,
            'user_alarm',
            id,
            null,
            req
        );
        
        res.json({
            success: true,
            alarm: alarms[alarmIndex]
        });
        
    } catch (error) {
        console.error('Error activating user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to activate user alarm'
        });
    }
});

// Approve user alarm (clear moderation flag)
router.put('/:id/approve', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Find the alarm
        const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
        if (alarmIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Approve alarm (clear moderation flag)
        alarms[alarmIndex] = {
            ...alarms[alarmIndex],
            isModerated: false,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'USER_ALARM_APPROVE',
            `Approved user alarm: ${alarms[alarmIndex].title}`,
            'user_alarm',
            id,
            null,
            req
        );
        
        res.json({
            success: true,
            alarm: alarms[alarmIndex],
            message: 'Alarm approved successfully'
        });
        
    } catch (error) {
        console.error('Error approving user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve user alarm'
        });
    }
});

// Reject user alarm (deactivate and mark as rejected)
router.put('/:id/reject', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Find the alarm
        const alarmIndex = alarms.findIndex(alarm => alarm.id === id);
        if (alarmIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Reject alarm (deactivate and mark as rejected)
        alarms[alarmIndex] = {
            ...alarms[alarmIndex],
            isActive: false,
            isModerated: false,
            isRejected: true,
            deactivatedBy: req.admin.email,
            deactivatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save updated alarms
        await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(alarms, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'USER_ALARM_REJECT',
            `Rejected user alarm: ${alarms[alarmIndex].title}`,
            'user_alarm',
            id,
            null,
            req
        );
        
        res.json({
            success: true,
            alarm: alarms[alarmIndex],
            message: 'Alarm rejected successfully'
        });
        
    } catch (error) {
        console.error('Error rejecting user alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject user alarm'
        });
    }
});

module.exports = router;
