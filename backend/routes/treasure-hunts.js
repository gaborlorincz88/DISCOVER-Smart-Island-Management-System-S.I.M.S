const express = require('express');
const router = express.Router();
const db = require('../database');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { requireAuth } = require('../middleware/auth');
const { createSecureImageUpload } = require('../middleware/secureUpload');
const { imageOptimizer } = require('../middleware/imageOptimizer');

// Configure secure multer for treasure hunt icon uploads
const upload = createSecureImageUpload('uploads', 5 * 1024 * 1024, 'treasure-hunt-icon-'); // 5MB limit

// Haversine formula to calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Normalize answer for comparison (case-insensitive, trim whitespace)
function normalizeAnswer(answer) {
  return answer.trim().toLowerCase();
}

// Generate a 6-digit hex coupon code
function generateCouponCode() {
  return Math.random().toString(16).substring(2, 8).toUpperCase();
}

// Generate QR code as base64 data URL
async function generateQRCode(data) {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Track user activity
function trackActivity(userId, huntId, activityType, activityData = null) {
  try {
    db.prepare(`
      INSERT INTO treasure_hunt_activity (user_id, treasure_hunt_id, activity_type, activity_data, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(userId, huntId, activityType, activityData ? JSON.stringify(activityData) : null);
  } catch (error) {
    console.error('Error tracking activity:', error);
    // Don't fail the request if tracking fails
  }
}

// --- Admin Routes (require admin auth) ---

// GET /api/treasure-hunts/users - Get all users with treasure hunt activity (admin only)
// MUST come before /:id routes to avoid route conflicts
router.get('/users', requireAdminAuth, (req, res) => {
  console.log('=== GET /api/treasure-hunts/users ===');
  try {
    // Check if tables exist
    try {
      db.prepare('SELECT 1 FROM treasure_hunt_progress LIMIT 1').get();
    } catch (tableError) {
      console.log('treasure_hunt_progress table does not exist or is empty');
      return res.json([]);
    }
    
    // Check and add missing columns if needed
    const columns = db.prepare("PRAGMA table_info(treasure_hunt_progress)").all();
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('last_activity_at')) {
      console.log('Adding missing column: last_activity_at');
      db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN last_activity_at TEXT').run();
    }
    
    // Build query based on available columns
    let lastActivityColumn = columnNames.includes('last_activity_at') ? 'MAX(p.last_activity_at)' : 'MAX(p.updated_at)';
    
    // Get all users who have treasure hunt progress
    let usersWithProgress;
    try {
      usersWithProgress = db.prepare(`
        SELECT DISTINCT
          u.id,
          u.username,
          u.email,
          u.created_at as user_created_at,
          u.last_login,
          COUNT(DISTINCT p.treasure_hunt_id) as total_hunts_started,
          COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.treasure_hunt_id END) as total_hunts_completed,
          ${lastActivityColumn} as last_activity,
          MAX(p.updated_at) as last_progress_update
        FROM users u
        INNER JOIN treasure_hunt_progress p ON u.id = p.user_id
        GROUP BY u.id, u.username, u.email, u.created_at, u.last_login
        ORDER BY last_activity DESC, last_progress_update DESC
      `).all();
    } catch (queryError) {
      console.error('Error in main query:', queryError);
      // Fallback: simpler query without problematic columns
      usersWithProgress = db.prepare(`
        SELECT DISTINCT
          u.id,
          u.username,
          u.email,
          u.created_at as user_created_at,
          u.last_login,
          COUNT(DISTINCT p.treasure_hunt_id) as total_hunts_started,
          COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.treasure_hunt_id END) as total_hunts_completed,
          MAX(p.updated_at) as last_activity,
          MAX(p.updated_at) as last_progress_update
        FROM users u
        INNER JOIN treasure_hunt_progress p ON u.id = p.user_id
        GROUP BY u.id, u.username, u.email, u.created_at, u.last_login
        ORDER BY last_progress_update DESC
      `).all();
    }
    
    console.log(`Found ${usersWithProgress.length} users with treasure hunt progress`);
    
    // For each user, get detailed progress for each hunt
    const usersWithDetails = usersWithProgress.map(user => {
      const progressDetails = db.prepare(`
        SELECT 
          p.*,
          h.name as hunt_name,
          h.id as hunt_id,
          (SELECT COUNT(*) FROM treasure_hunt_clues WHERE treasure_hunt_id = h.id) as total_clues
        FROM treasure_hunt_progress p
        JOIN treasure_hunts h ON p.treasure_hunt_id = h.id
        WHERE p.user_id = ?
        ORDER BY p.updated_at DESC
      `).all(user.id);
      
      // Parse completed_clues JSON
      const progressWithParsed = progressDetails.map(progress => {
        let completedClues = [];
        try {
          completedClues = JSON.parse(progress.completed_clues || '[]');
        } catch (e) {
          completedClues = [];
        }
        
        return {
          ...progress,
          completed_clues: completedClues,
          completed_clues_count: completedClues.length,
          progress_percentage: progress.total_clues > 0 
            ? Math.round((progress.current_clue_number / progress.total_clues) * 100)
            : 0
        };
      });
      
      return {
        ...user,
        hunts: progressWithParsed
      };
    });
    
    console.log(`Returning ${usersWithDetails.length} users with details`);
    res.json(usersWithDetails);
  } catch (error) {
    console.error('❌ Error fetching users with treasure hunt activity:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// GET /api/treasure-hunts - Get all treasure hunts (admin can see all, users see only active)
router.get('/', (req, res) => {
  try {
    // Check if user is admin by checking for admin session cookie
    const sessionToken = req.cookies?.admin_session;
    let isAdmin = false;
    
    if (sessionToken) {
      try {
        const session = db.prepare(`
          SELECT s.*, u.email, u.role, u.username
          FROM admin_sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
        `).get(sessionToken);
        isAdmin = !!session;
      } catch (e) {
        // Not an admin session
        isAdmin = false;
      }
    }
    
    let hunts;
    try {
      // Check if table exists first
      try {
        db.prepare('SELECT 1 FROM treasure_hunts LIMIT 1').get();
      } catch (tableCheckError) {
        if (tableCheckError.message.includes('no such table')) {
          console.log('Treasure hunts table does not exist yet');
          return res.json([]);
        }
        throw tableCheckError;
      }
      
      if (isAdmin) {
        // Admins see all hunts
        hunts = db.prepare('SELECT * FROM treasure_hunts ORDER BY created_at DESC').all();
        console.log(`Admin fetched ${hunts.length} treasure hunts (all)`);
      } else {
        // Regular users see only active hunts
        hunts = db.prepare('SELECT * FROM treasure_hunts WHERE is_active = 1 ORDER BY created_at DESC').all();
        console.log(`User fetched ${hunts.length} active treasure hunts`);
      }
      
      // Ensure we return an array
      if (!Array.isArray(hunts)) {
        console.error('Hunts query did not return an array:', hunts);
        hunts = [];
      }
    } catch (dbError) {
      console.error('Database error fetching hunts:', dbError);
      console.error('Error stack:', dbError.stack);
      // Return empty array on error instead of throwing
      return res.status(500).json({ error: 'Database error', details: dbError.message });
    }
    
    console.log(`Returning ${hunts.length} hunts to client (isAdmin: ${isAdmin})`);
    res.json(hunts);
  } catch (error) {
    console.error('Error fetching treasure hunts:', error);
    res.status(500).json({ error: 'Failed to fetch treasure hunts' });
  }
});

// GET /api/treasure-hunts/:id - Get hunt details with clues
router.get('/:id', (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    // Check if user is admin (check both req.user and admin_session cookie)
    let isAdmin = false;
    if (req.user?.role === 'admin') {
      isAdmin = true;
    } else {
      // Check admin session cookie
      const sessionToken = req.cookies?.admin_session;
      if (sessionToken) {
        try {
          const session = db.prepare(`
            SELECT s.*, u.email, u.role, u.username
            FROM admin_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
          `).get(sessionToken);
          isAdmin = !!session;
        } catch (e) {
          isAdmin = false;
        }
      }
    }
    
    if (!isAdmin && !hunt.is_active) {
      return res.status(403).json({ error: 'Treasure hunt is not active' });
    }
    
    // Get clues ordered by clue_number
    // Always select answer, but we'll include it in response for admins
    const clues = db.prepare(`
      SELECT id, clue_number, title, clue_text, answer, latitude, longitude, icon, hint
      FROM treasure_hunt_clues
      WHERE treasure_hunt_id = ?
      ORDER BY clue_number ASC
    `).all(huntId);
    
    // For non-admins, remove answer field from clues
    if (!isAdmin) {
      clues.forEach(clue => {
        delete clue.answer;
      });
    }
    
    res.json({
      ...hunt,
      clues: clues
    });
  } catch (error) {
    console.error('Error fetching treasure hunt:', error);
    res.status(500).json({ error: 'Failed to fetch treasure hunt' });
  }
});

// POST /api/treasure-hunts/upload-icon - Upload treasure hunt icon (admin only)
router.post('/upload-icon', requireAdminAuth, upload.single('icon'), imageOptimizer, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No icon file provided' });
    }
    
    // Get the optimized image path if available, otherwise use the uploaded file
    const imagePath = req.optimizedImagePath || `/uploads/${req.file.filename}`;
    
    console.log('Treasure hunt icon uploaded successfully:', imagePath);
    res.json({ 
      success: true,
      icon: imagePath,
      message: 'Icon uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading treasure hunt icon:', error);
    res.status(500).json({ error: 'Failed to upload icon', details: error.message });
  }
});

// DELETE /api/treasure-hunts/:id/icon - Remove icon from treasure hunt (admin only)
router.delete('/:id/icon', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    // Delete icon file if it exists
    if (hunt.icon && hunt.icon.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', hunt.icon);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Deleted icon file:', hunt.icon);
        } catch (err) {
          console.error('Error deleting icon file:', err);
        }
      }
    }
    
    // Clear icon from database
    db.prepare('UPDATE treasure_hunts SET icon = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(huntId);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'update',
      `Removed icon from treasure hunt: ${hunt.name}`,
      'treasure_hunt',
      huntId.toString(),
      { huntName: hunt.name },
      req
    );
    
    res.json({ 
      success: true,
      message: 'Icon removed successfully' 
    });
  } catch (error) {
    console.error('Error removing treasure hunt icon:', error);
    res.status(500).json({ error: 'Failed to remove icon', details: error.message });
  }
});

// POST /api/treasure-hunts - Create new treasure hunt (admin only)
router.post('/', requireAdminAuth, (req, res) => {
  try {
    const { name, description, icon, is_active } = req.body;
    
    console.log('Creating treasure hunt with data:', { name, description, icon, is_active });
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Check if table exists
    try {
      db.prepare('SELECT 1 FROM treasure_hunts LIMIT 1').get();
    } catch (tableError) {
      console.error('Treasure hunts table does not exist:', tableError);
      return res.status(500).json({ error: 'Database table not found. Please restart the server to create tables.' });
    }
    
    // If icon is a base64 data URL, save it as a file
    let iconPath = icon;
    if (icon && icon.startsWith('data:image')) {
      try {
        const base64Data = icon.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = icon.match(/data:image\/(\w+);base64/)?.[1] || 'png';
        const filename = `treasure-hunt-icon-${uniqueSuffix}.${ext}`;
        const filePath = path.join(__dirname, '../uploads', filename);
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, buffer);
        iconPath = `/uploads/${filename}`;
        console.log('Saved base64 icon to file:', iconPath);
      } catch (saveError) {
        console.error('Error saving base64 icon to file:', saveError);
        // Continue with base64 if file save fails (fallback)
        iconPath = icon;
      }
    }
    
    console.log('About to insert hunt into database');
    // Log icon info without the full base64 string
    const iconLog = iconPath 
      ? (iconPath.startsWith('data:image') 
          ? `base64 (${iconPath.length} chars)` 
          : iconPath.length > 100 
            ? iconPath.substring(0, 100) + '...' 
            : iconPath)
      : null;
    console.log('Data:', { name, description, icon: iconLog, is_active });
    
    const result = db.prepare(`
      INSERT INTO treasure_hunts (name, description, icon, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(name, description || null, iconPath || null, is_active !== undefined ? (is_active ? 1 : 0) : 1);
    
    console.log('Insert result:', result);
    console.log('Last insert rowid:', result.lastInsertRowid);
    
    if (!result.lastInsertRowid) {
      console.error('No row ID returned from insert!');
      return res.status(500).json({ error: 'Failed to create treasure hunt - no ID returned' });
    }
    
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(result.lastInsertRowid);
    
    if (!hunt) {
      console.error('Failed to retrieve created hunt with ID:', result.lastInsertRowid);
      return res.status(500).json({ error: 'Hunt created but could not be retrieved' });
    }
    
    console.log('Successfully created and retrieved hunt:', hunt);
    
    try {
      logAdminActivity(
        req.admin.id,
        req.admin.email,
        'create',
        `Created treasure hunt: ${name}`,
        'treasure_hunt',
        hunt.id.toString(),
        null,
        req
      );
    } catch (logError) {
      console.error('Error logging admin activity:', logError);
      // Don't fail the request if logging fails
    }
    
    res.status(201).json(hunt);
  } catch (error) {
    console.error('Error creating treasure hunt:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create treasure hunt', details: error.message });
  }
});

// PUT /api/treasure-hunts/:id - Update treasure hunt (admin only)
router.put('/:id', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const { name, description, icon, is_active } = req.body;
    
    // Log icon info without the full base64 string
    const iconLog = icon 
      ? (icon.startsWith('data:image') 
          ? `base64 (${icon.length} chars)` 
          : icon.length > 100 
            ? icon.substring(0, 100) + '...' 
            : icon)
      : null;
    console.log('Updating treasure hunt:', huntId, { name, description, icon: iconLog, is_active });
    
    const existingHunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!existingHunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    // Handle is_active conversion (can be "on", true, 1, "1", etc.)
    let isActiveValue = existingHunt.is_active;
    if (is_active !== undefined) {
      if (is_active === 'on' || is_active === true || is_active === 1 || is_active === '1') {
        isActiveValue = 1;
      } else if (is_active === false || is_active === 0 || is_active === '0') {
        isActiveValue = 0;
      } else {
        isActiveValue = existingHunt.is_active;
      }
    }
    
    // If icon is a base64 data URL, save it as a file
    let iconPath = icon;
    if (icon && icon.startsWith('data:image')) {
      try {
        const base64Data = icon.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = icon.match(/data:image\/(\w+);base64/)?.[1] || 'png';
        const filename = `treasure-hunt-icon-${uniqueSuffix}.${ext}`;
        const filePath = path.join(__dirname, '../uploads', filename);
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, buffer);
        iconPath = `/uploads/${filename}`;
        console.log('Saved base64 icon to file:', iconPath);
        
        // Delete old icon file if it exists and is different
        if (existingHunt.icon && existingHunt.icon.startsWith('/uploads/') && existingHunt.icon !== iconPath) {
          const oldFilePath = path.join(__dirname, '..', existingHunt.icon);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
              console.log('Deleted old icon file:', existingHunt.icon);
            } catch (deleteError) {
              console.error('Error deleting old icon file:', deleteError);
            }
          }
        }
      } catch (saveError) {
        console.error('Error saving base64 icon to file:', saveError);
        // Continue with base64 if file save fails (fallback)
        iconPath = icon;
      }
    } else if (icon !== undefined) {
      iconPath = icon;
    }
    
    db.prepare(`
      UPDATE treasure_hunts
      SET name = ?, description = ?, icon = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name !== undefined ? name : existingHunt.name,
      description !== undefined ? description : existingHunt.description,
      iconPath !== undefined ? iconPath : existingHunt.icon,
      isActiveValue,
      huntId
    );
    
    const updatedHunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    
    try {
      logAdminActivity(
        req.admin?.id || req.user?.id,
        req.admin?.email || req.user?.email,
        'update',
        `Updated treasure hunt: ${name || existingHunt.name}`,
        'treasure_hunt',
        huntId.toString(),
        null,
        req
      );
    } catch (logError) {
      console.error('Error logging admin activity:', logError);
      // Don't fail the request if logging fails
    }
    
    res.json(updatedHunt);
  } catch (error) {
    console.error('Error updating treasure hunt:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update treasure hunt', details: error.message });
  }
});

// DELETE /api/treasure-hunts/:id - Delete treasure hunt (admin only)
router.delete('/:id', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    // Delete clues first (CASCADE should handle this, but being explicit)
    db.prepare('DELETE FROM treasure_hunt_clues WHERE treasure_hunt_id = ?').run(huntId);
    
    // Delete progress records
    db.prepare('DELETE FROM treasure_hunt_progress WHERE treasure_hunt_id = ?').run(huntId);
    
    // Delete hunt
    db.prepare('DELETE FROM treasure_hunts WHERE id = ?').run(huntId);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'delete',
      `Deleted treasure hunt: ${hunt.name}`,
      'treasure_hunt',
      huntId.toString(),
      null,
      req
    );
    
    res.json({ message: 'Treasure hunt deleted successfully' });
  } catch (error) {
    console.error('Error deleting treasure hunt:', error);
    res.status(500).json({ error: 'Failed to delete treasure hunt' });
  }
});

// POST /api/treasure-hunts/:id/clues - Add clue to hunt (admin only)
router.post('/:id/clues', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const { clue_number, title, clue_text, answer, latitude, longitude, icon, hint } = req.body;
    
    if (!clue_number || !clue_text || !answer || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required fields: clue_number, clue_text, answer, latitude, longitude' });
    }
    
    // Check if hunt exists
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    const result = db.prepare(`
      INSERT INTO treasure_hunt_clues (treasure_hunt_id, clue_number, title, clue_text, answer, latitude, longitude, icon, hint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(huntId, clue_number, title || null, clue_text, answer, latitude, longitude, icon || null, hint || null);
    
    const clue = db.prepare('SELECT * FROM treasure_hunt_clues WHERE id = ?').get(result.lastInsertRowid);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'create',
      `Added clue ${clue_number} to treasure hunt: ${hunt.name}`,
      'treasure_hunt_clue',
      clue.id.toString(),
      null,
      req
    );
    
    res.status(201).json(clue);
  } catch (error) {
    console.error('Error creating clue:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A clue with this number already exists for this hunt' });
    }
    res.status(500).json({ error: 'Failed to create clue' });
  }
});

// PUT /api/treasure-hunts/:id/clues/:clueId - Update clue (admin only)
router.put('/:id/clues/:clueId', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const clueId = parseInt(req.params.clueId);
    const { clue_number, title, clue_text, answer, latitude, longitude, icon, hint } = req.body;
    
    const existingClue = db.prepare('SELECT * FROM treasure_hunt_clues WHERE id = ? AND treasure_hunt_id = ?').get(clueId, huntId);
    if (!existingClue) {
      return res.status(404).json({ error: 'Clue not found' });
    }
    
    db.prepare(`
      UPDATE treasure_hunt_clues
      SET clue_number = ?, title = ?, clue_text = ?, answer = ?, latitude = ?, longitude = ?, icon = ?, hint = ?, updated_at = datetime('now')
      WHERE id = ? AND treasure_hunt_id = ?
    `).run(
      clue_number !== undefined ? clue_number : existingClue.clue_number,
      title !== undefined ? title : existingClue.title,
      clue_text !== undefined ? clue_text : existingClue.clue_text,
      answer !== undefined ? answer : existingClue.answer,
      latitude !== undefined ? latitude : existingClue.latitude,
      longitude !== undefined ? longitude : existingClue.longitude,
      icon !== undefined ? icon : existingClue.icon,
      hint !== undefined ? hint : existingClue.hint,
      clueId,
      huntId
    );
    
    const updatedClue = db.prepare('SELECT * FROM treasure_hunt_clues WHERE id = ?').get(clueId);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'update',
      `Updated clue ${clueId} in treasure hunt`,
      'treasure_hunt_clue',
      clueId.toString(),
      null,
      req
    );
    
    res.json(updatedClue);
  } catch (error) {
    console.error('Error updating clue:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A clue with this number already exists for this hunt' });
    }
    res.status(500).json({ error: 'Failed to update clue' });
  }
});

// DELETE /api/treasure-hunts/:id/clues/:clueId - Delete clue (admin only)
router.delete('/:id/clues/:clueId', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const clueId = parseInt(req.params.clueId);
    
    const clue = db.prepare('SELECT * FROM treasure_hunt_clues WHERE id = ? AND treasure_hunt_id = ?').get(clueId, huntId);
    if (!clue) {
      return res.status(404).json({ error: 'Clue not found' });
    }
    
    db.prepare('DELETE FROM treasure_hunt_clues WHERE id = ? AND treasure_hunt_id = ?').run(clueId, huntId);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'delete',
      `Deleted clue ${clueId} from treasure hunt`,
      'treasure_hunt_clue',
      clueId.toString(),
      null,
      req
    );
    
    res.json({ message: 'Clue deleted successfully' });
  } catch (error) {
    console.error('Error deleting clue:', error);
    res.status(500).json({ error: 'Failed to delete clue' });
  }
});

// --- User Routes (require authentication) ---

// GET /api/treasure-hunts/:id/progress - Get user progress for a hunt
router.get('/:id/progress', requireAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // Check if prize columns exist, add them if not
    try {
      db.prepare('SELECT prize_coupon_code FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Progress] Adding prize columns to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_coupon_code TEXT').run();
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_qr_code TEXT').run();
        } catch (alterError) {
          console.error('[Progress] Error adding prize columns:', alterError);
        }
      }
    }
    
    // Check if last_activity_at column exists, add it if not
    try {
      db.prepare('SELECT last_activity_at FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Progress] Adding last_activity_at column to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
        } catch (alterError) {
          console.error('[Progress] Error adding last_activity_at column:', alterError);
        }
      }
    }
    
    let progress;
    try {
      progress = db.prepare(`
        SELECT * FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    } catch (error) {
      console.error('[Progress] Error fetching progress:', error);
      // Try with minimal columns
      progress = db.prepare(`
        SELECT id, user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, completed_at, created_at, updated_at
        FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    }
    
    if (!progress) {
      return res.json(null); // No progress yet
    }
    
    // Get hunt to check prize configuration
    const hunt = db.prepare('SELECT prize_discount_percentage FROM treasure_hunts WHERE id = ?').get(huntId);
    
    // Parse completed_clues JSON
    let completedClues = [];
    try {
      completedClues = JSON.parse(progress.completed_clues || '[]');
    } catch (e) {
      completedClues = [];
    }
    
    // Include prize information if completed and user has a prize
    const prizeInfo = progress.completed_at && progress.prize_coupon_code ? {
      coupon_code: progress.prize_coupon_code,
      qr_code: progress.prize_qr_code,
      discount_percentage: hunt?.prize_discount_percentage || null
    } : null;
    
    res.json({
      ...progress,
      completed_clues: completedClues,
      prize: prizeInfo
    });
  } catch (error) {
    console.error('[Progress] Error fetching progress:', error);
    console.error('[Progress] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch progress', details: error.message });
  }
});

// POST /api/treasure-hunts/:id/start - Start a treasure hunt
router.post('/:id/start', requireAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log(`[Start Hunt] Starting hunt ${huntId} for user ${userId}`);
    
    // Check if last_activity_at column exists, add it if not
    try {
      db.prepare('SELECT last_activity_at FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Start Hunt] Adding last_activity_at column to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
        } catch (alterError) {
          console.error('[Start Hunt] Error adding last_activity_at column:', alterError);
        }
      }
    }
    
    // Check if prize columns exist, add them if not
    try {
      db.prepare('SELECT prize_coupon_code FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Start Hunt] Adding prize columns to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_coupon_code TEXT').run();
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_qr_code TEXT').run();
        } catch (alterError) {
          console.error('[Start Hunt] Error adding prize columns:', alterError);
        }
      }
    }
    
    // Check if hunt exists and is active
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ? AND is_active = 1').get(huntId);
    if (!hunt) {
      console.log(`[Start Hunt] Hunt ${huntId} not found or not active`);
      return res.status(404).json({ error: 'Treasure hunt not found or not active' });
    }
    
    // Check if user already has progress
    let existingProgress;
    try {
      existingProgress = db.prepare(`
        SELECT * FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    } catch (error) {
      console.error('[Start Hunt] Error checking existing progress:', error);
      // Try with minimal columns
      existingProgress = db.prepare(`
        SELECT id, user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, completed_at, created_at, updated_at
        FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    }
    
    if (existingProgress) {
      console.log(`[Start Hunt] User ${userId} already has progress for hunt ${huntId}`);
      // Track resume activity
      trackActivity(userId, huntId, 'hunt_resumed');
      return res.json(existingProgress); // Return existing progress
    }
    
    console.log(`[Start Hunt] Creating new progress for user ${userId}, hunt ${huntId}`);
    
    // Create new progress - try with all columns first, fallback to minimal if needed
    let result;
    try {
      result = db.prepare(`
        INSERT INTO treasure_hunt_progress (user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, last_activity_at, created_at, updated_at)
        VALUES (?, ?, 1, '[]', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
      `).run(userId, huntId);
    } catch (insertError) {
      console.warn('[Start Hunt] Error with full insert, trying minimal:', insertError.message);
      // Fallback to minimal columns
      result = db.prepare(`
        INSERT INTO treasure_hunt_progress (user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, created_at, updated_at)
        VALUES (?, ?, 1, '[]', datetime('now'), datetime('now'), datetime('now'))
      `).run(userId, huntId);
    }
    
    let progress;
    try {
      progress = db.prepare('SELECT * FROM treasure_hunt_progress WHERE id = ?').get(result.lastInsertRowid);
    } catch (selectError) {
      console.warn('[Start Hunt] Error selecting with *, trying minimal columns:', selectError.message);
      progress = db.prepare(`
        SELECT id, user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, completed_at, created_at, updated_at
        FROM treasure_hunt_progress WHERE id = ?
      `).get(result.lastInsertRowid);
    }
    
    if (!progress) {
      console.error(`[Start Hunt] Failed to retrieve created progress for id ${result.lastInsertRowid}`);
      return res.status(500).json({ error: 'Failed to retrieve created progress' });
    }
    
    // Track start activity
    trackActivity(userId, huntId, 'hunt_started');
    
    console.log(`[Start Hunt] Successfully started hunt ${huntId} for user ${userId}`);
    
    res.status(201).json({
      ...progress,
      completed_clues: []
    });
  } catch (error) {
    console.error('[Start Hunt] Error starting treasure hunt:', error);
    console.error('[Start Hunt] Error stack:', error.stack);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'You have already started this treasure hunt' });
    }
    res.status(500).json({ error: 'Failed to start treasure hunt', details: error.message });
  }
});

// DELETE /api/treasure-hunts/:id/progress - Stop/delete user progress for a hunt
router.delete('/:id/progress', requireAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const result = db.prepare(`
      DELETE FROM treasure_hunt_progress
      WHERE user_id = ? AND treasure_hunt_id = ?
    `).run(userId, huntId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'No progress found for this hunt' });
    }
    
    res.json({ success: true, message: 'Hunt stopped successfully' });
  } catch (error) {
    console.error('Error stopping hunt:', error);
    res.status(500).json({ error: 'Failed to stop hunt' });
  }
});

// GET /api/treasure-hunts/:id/current-clue - Get current clue for user
router.get('/:id/current-clue', requireAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log(`[Current Clue] Fetching clue for hunt ${huntId}, user ${userId}`);
    
    // Check if last_activity_at column exists, add it if not
    try {
      db.prepare('SELECT last_activity_at FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Current Clue] Adding last_activity_at column to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
        } catch (alterError) {
          console.error('[Current Clue] Error adding last_activity_at column:', alterError);
        }
      }
    }
    
    // Check if prize columns exist, add them if not
    try {
      db.prepare('SELECT prize_coupon_code FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Current Clue] Adding prize columns to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_coupon_code TEXT').run();
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_qr_code TEXT').run();
        } catch (alterError) {
          console.error('[Current Clue] Error adding prize columns:', alterError);
        }
      }
    }
    
    // Get user progress - select only columns that exist
    let progress;
    try {
      progress = db.prepare(`
        SELECT * FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    } catch (error) {
      console.error('[Current Clue] Error fetching progress:', error);
      // Try with minimal columns
      progress = db.prepare(`
        SELECT id, user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, completed_at, created_at, updated_at
        FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    }
    
    if (!progress) {
      console.log(`[Current Clue] No progress found for hunt ${huntId}, user ${userId}`);
      return res.status(404).json({ error: 'You have not started this treasure hunt yet' });
    }
    
    console.log(`[Current Clue] Progress found: current_clue_number=${progress.current_clue_number}, completed_at=${progress.completed_at}`);
    
    // Check if hunt is completed
    if (progress.completed_at) {
      console.log(`[Current Clue] Hunt ${huntId} is already completed for user ${userId}`);
      return res.status(404).json({ error: 'This treasure hunt has been completed' });
    }
    
    // Get current clue
    const clue = db.prepare(`
      SELECT id, clue_number, title, clue_text, latitude, longitude, icon, hint
      FROM treasure_hunt_clues
      WHERE treasure_hunt_id = ? AND clue_number = ?
    `).get(huntId, progress.current_clue_number);
    
    if (!clue) {
      console.log(`[Current Clue] Clue not found for hunt ${huntId}, clue_number ${progress.current_clue_number}`);
      // Check if there are any clues for this hunt
      const clueCount = db.prepare(`
        SELECT COUNT(*) as count FROM treasure_hunt_clues WHERE treasure_hunt_id = ?
      `).get(huntId).count;
      console.log(`[Current Clue] Total clues for hunt ${huntId}: ${clueCount}`);
      return res.status(404).json({ error: 'Current clue not found. The hunt may be completed or invalid.' });
    }
    
    console.log(`[Current Clue] Found clue ${clue.id} (clue_number ${clue.clue_number}) for hunt ${huntId}`);
    
    // Update last activity (only if column exists)
    try {
      db.prepare(`
        UPDATE treasure_hunt_progress
        SET last_activity_at = datetime('now')
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).run(userId, huntId);
    } catch (updateError) {
      console.warn('[Current Clue] Could not update last_activity_at:', updateError.message);
      // Continue even if update fails
    }
    
    // Track activity
    trackActivity(userId, huntId, 'clue_viewed', { clue_number: progress.current_clue_number });
    
    // Parse completed clues
    let completedClues = [];
    try {
      completedClues = JSON.parse(progress.completed_clues || '[]');
    } catch (e) {
      completedClues = [];
    }
    
    // Get total number of clues
    const totalClues = db.prepare(`
      SELECT COUNT(*) as count FROM treasure_hunt_clues WHERE treasure_hunt_id = ?
    `).get(huntId).count;
    
    res.json({
      clue: clue,
      progress: {
        current_clue_number: progress.current_clue_number,
        completed_clues: completedClues,
        total_clues: totalClues,
        is_completed: progress.completed_at !== null
      }
    });
  } catch (error) {
    console.error('[Current Clue] Error fetching current clue:', error);
    console.error('[Current Clue] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch current clue', details: error.message });
  }
});

// POST /api/treasure-hunts/:id/solve-clue - Submit answer for current clue
router.post('/:id/solve-clue', requireAuth, async (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const userId = req.user.id;
    const { answer, userLatitude, userLongitude } = req.body;
    
    console.log(`[Solve Clue] Solving clue for hunt ${huntId}, user ${userId}`);
    
    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }
    
    if (userLatitude === undefined || userLongitude === undefined) {
      return res.status(400).json({ error: 'User location (latitude, longitude) is required' });
    }
    
    // Check if prize columns exist, add them if not (do this first before any queries)
    try {
      db.prepare('SELECT prize_coupon_code FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Solve Clue] Adding prize columns to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_coupon_code TEXT').run();
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN prize_qr_code TEXT').run();
        } catch (alterError) {
          console.error('[Solve Clue] Error adding prize columns:', alterError);
        }
      }
    }
    
    // Check if last_activity_at column exists, add it if not
    try {
      db.prepare('SELECT last_activity_at FROM treasure_hunt_progress LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Solve Clue] Adding last_activity_at column to treasure_hunt_progress table');
        try {
          db.prepare('ALTER TABLE treasure_hunt_progress ADD COLUMN last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
        } catch (alterError) {
          console.error('[Solve Clue] Error adding last_activity_at column:', alterError);
        }
      }
    }
    
    // Get user progress - try with all columns first, fallback if needed
    let progress;
    try {
      progress = db.prepare(`
        SELECT * FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    } catch (error) {
      console.warn('[Solve Clue] Error with SELECT *, trying minimal columns:', error.message);
      // Fallback to minimal columns
      progress = db.prepare(`
        SELECT id, user_id, treasure_hunt_id, current_clue_number, completed_clues, started_at, completed_at, created_at, updated_at
        FROM treasure_hunt_progress
        WHERE user_id = ? AND treasure_hunt_id = ?
      `).get(userId, huntId);
    }
    
    if (!progress) {
      return res.status(404).json({ error: 'You have not started this treasure hunt yet' });
    }
    
    if (progress.completed_at) {
      return res.status(400).json({ error: 'This treasure hunt is already completed' });
    }
    
    // Get current clue
    const clue = db.prepare(`
      SELECT * FROM treasure_hunt_clues
      WHERE treasure_hunt_id = ? AND clue_number = ?
    `).get(huntId, progress.current_clue_number);
    
    if (!clue) {
      return res.status(404).json({ error: 'Current clue not found' });
    }
    
    // Validate GPS location (must be within 100 meters)
    const distance = calculateDistance(userLatitude, userLongitude, clue.latitude, clue.longitude);
    if (distance > 100) {
      return res.status(400).json({ 
        error: 'You are too far from the clue location',
        distance: Math.round(distance),
        requiredDistance: 100
      });
    }
    
    // Validate answer (case-insensitive)
    const normalizedUserAnswer = normalizeAnswer(answer);
    const normalizedCorrectAnswer = normalizeAnswer(clue.answer);
    
    if (normalizedUserAnswer !== normalizedCorrectAnswer) {
      return res.status(400).json({ error: 'Incorrect answer. Try again!' });
    }
    
    // Answer is correct! Update progress
    let completedClues = [];
    try {
      completedClues = JSON.parse(progress.completed_clues || '[]');
    } catch (e) {
      completedClues = [];
    }
    
    // Add current clue to completed list
    completedClues.push(clue.id);
    
    // Get total number of clues
    const totalClues = db.prepare(`
      SELECT COUNT(*) as count FROM treasure_hunt_clues WHERE treasure_hunt_id = ?
    `).get(huntId).count;
    
    // Check if hunt is completed
    // Note: current_clue_number is 1-indexed, so if we're on clue 3 of 3, current_clue_number = 3
    // After solving clue 3, we would move to clue 4, but there is no clue 4, so it's completed
    // So completion happens when: current_clue_number >= totalClues
    const isCompleted = progress.current_clue_number >= totalClues;
    
    console.log(`[Solve Clue] Hunt ${huntId}, User ${userId}: current_clue_number=${progress.current_clue_number}, totalClues=${totalClues}, isCompleted=${isCompleted}`);
    console.log(`[Solve Clue] Completed clues array length: ${completedClues.length}`);
    
    if (isCompleted) {
      console.log('[Solve Clue] Hunt is completed! Generating prize...');
      
      // Check if hunt has a prize configured
      const hunt = db.prepare('SELECT prize_discount_percentage FROM treasure_hunts WHERE id = ?').get(huntId);
      console.log('[Solve Clue] Hunt data:', JSON.stringify(hunt));
      console.log('[Solve Clue] Hunt prize_discount_percentage:', hunt?.prize_discount_percentage);
      console.log('[Solve Clue] Prize check - hunt exists:', !!hunt, 'prize_discount_percentage:', hunt?.prize_discount_percentage, 'type:', typeof hunt?.prize_discount_percentage);
      
      let couponCode = null;
      let qrCodeDataURL = null;
      
      // Generate unique prize for this user if hunt has prize configured
      // Check for both null and 0 values (0 means no prize)
      const hasPrize = hunt && hunt.prize_discount_percentage != null && hunt.prize_discount_percentage > 0;
      console.log('[Solve Clue] Has prize configured:', hasPrize);
      
      if (hasPrize) {
        console.log('[Solve Clue] Prize configured, generating coupon and QR code...');
        couponCode = generateCouponCode();
        console.log('[Solve Clue] Generated coupon code:', couponCode);
        
        // Generate QR code with unique coupon code data
        const qrCodeData = JSON.stringify({
          type: 'treasure_hunt_reward',
          hunt_id: huntId,
          user_id: userId,
          coupon_code: couponCode,
          discount_percentage: hunt.prize_discount_percentage
        });
        
        console.log('[Solve Clue] Generating QR code with data:', qrCodeData);
        qrCodeDataURL = await generateQRCode(qrCodeData);
        console.log('[Solve Clue] QR code generated, length:', qrCodeDataURL?.length);
      } else {
        console.warn('[Solve Clue] No prize configured for this hunt. Hunt:', hunt);
        console.warn('[Solve Clue] prize_discount_percentage value:', hunt?.prize_discount_percentage);
      }
      
      // Mark hunt as completed and store user's unique prize
      // Try with all columns first, fallback if needed
      console.log('[Solve Clue] Updating progress with prize. couponCode:', couponCode ? 'YES' : 'NO', 'qrCodeDataURL:', qrCodeDataURL ? 'YES' : 'NO');
      
      try {
        const updateResult = db.prepare(`
          UPDATE treasure_hunt_progress
          SET completed_clues = ?, completed_at = datetime('now'), last_activity_at = datetime('now'), 
              prize_coupon_code = ?, prize_qr_code = ?, updated_at = datetime('now')
          WHERE user_id = ? AND treasure_hunt_id = ?
        `).run(JSON.stringify(completedClues), couponCode, qrCodeDataURL, userId, huntId);
        console.log('[Solve Clue] Prize update successful. Changes:', updateResult.changes);
      } catch (updateError) {
        console.warn('[Solve Clue] Error with full update, trying minimal:', updateError.message);
        // Fallback to minimal columns
        db.prepare(`
          UPDATE treasure_hunt_progress
          SET completed_clues = ?, completed_at = datetime('now'), updated_at = datetime('now')
          WHERE user_id = ? AND treasure_hunt_id = ?
        `).run(JSON.stringify(completedClues), userId, huntId);
        // Try to update prize columns separately if they exist
        if (couponCode) {
          try {
            console.log('[Solve Clue] Attempting separate prize update...');
            const prizeUpdateResult = db.prepare(`
              UPDATE treasure_hunt_progress
              SET prize_coupon_code = ?, prize_qr_code = ?
              WHERE user_id = ? AND treasure_hunt_id = ?
            `).run(couponCode, qrCodeDataURL, userId, huntId);
            console.log('[Solve Clue] Separate prize update successful. Changes:', prizeUpdateResult.changes);
          } catch (prizeError) {
            console.error('[Solve Clue] Could not update prize columns:', prizeError.message);
            console.error('[Solve Clue] Prize error details:', prizeError);
          }
        } else {
          console.warn('[Solve Clue] No coupon code to update (prize not configured)');
        }
      }
      
      // Track completion activity
      trackActivity(userId, huntId, 'hunt_completed', { clue_number: progress.current_clue_number, prize_generated: !!couponCode });
    } else {
      // Move to next clue
      try {
        db.prepare(`
          UPDATE treasure_hunt_progress
          SET current_clue_number = ?, completed_clues = ?, last_activity_at = datetime('now'), updated_at = datetime('now')
          WHERE user_id = ? AND treasure_hunt_id = ?
        `).run(progress.current_clue_number + 1, JSON.stringify(completedClues), userId, huntId);
      } catch (updateError) {
        console.warn('[Solve Clue] Error with full update, trying minimal:', updateError.message);
        // Fallback to minimal columns
        db.prepare(`
          UPDATE treasure_hunt_progress
          SET current_clue_number = ?, completed_clues = ?, updated_at = datetime('now')
          WHERE user_id = ? AND treasure_hunt_id = ?
        `).run(progress.current_clue_number + 1, JSON.stringify(completedClues), userId, huntId);
      }
      // Track clue solved activity
      trackActivity(userId, huntId, 'clue_solved', { clue_number: progress.current_clue_number });
    }
    
    // Get updated progress
    const updatedProgress = db.prepare(`
      SELECT * FROM treasure_hunt_progress
      WHERE user_id = ? AND treasure_hunt_id = ?
    `).get(userId, huntId);
    
    // Get next clue if not completed
    let nextClue = null;
    if (!isCompleted) {
      const nextClueNumber = progress.current_clue_number + 1;
      nextClue = db.prepare(`
        SELECT id, clue_number, title, clue_text, latitude, longitude, icon, hint
        FROM treasure_hunt_clues
        WHERE treasure_hunt_id = ? AND clue_number = ?
      `).get(huntId, nextClueNumber);
    }
    
    res.json({
      success: true,
      message: isCompleted ? 'Congratulations! You completed the treasure hunt!' : 'Correct! Clue solved successfully.',
      completed: isCompleted,
      nextClue: nextClue,
      progress: {
        ...updatedProgress,
        completed_clues: completedClues,
        total_clues: totalClues,
        is_completed: isCompleted
      }
    });
  } catch (error) {
    console.error('Error solving clue:', error);
    res.status(500).json({ error: 'Failed to solve clue' });
  }
});

// PUT /api/treasure-hunts/:id/prize - Set prize configuration for treasure hunt (admin only)
// Note: This only sets the discount percentage. Unique codes are generated per user on completion.
router.put('/:id/prize', requireAdminAuth, async (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const { discount_percentage } = req.body;
    
    console.log(`[Set Prize] Request for hunt ${huntId}, discount: ${discount_percentage}`);
    
    if (discount_percentage === undefined || discount_percentage === null || discount_percentage < 0 || discount_percentage > 100) {
      return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
    }
    
    // Check if hunt exists
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      console.log(`[Set Prize] Hunt ${huntId} not found`);
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    console.log(`[Set Prize] Updating hunt ${huntId} with discount ${discount_percentage}%`);
    
    // Only store discount percentage - codes will be generated per user on completion
    // Check if column exists, if not add it
    try {
      db.prepare('SELECT prize_discount_percentage FROM treasure_hunts LIMIT 1').get();
    } catch (colError) {
      if (colError.message.includes('no such column')) {
        console.log('[Set Prize] Adding prize_discount_percentage column to treasure_hunts table');
        try {
          db.prepare('ALTER TABLE treasure_hunts ADD COLUMN prize_discount_percentage INTEGER').run();
        } catch (alterError) {
          console.error('[Set Prize] Error adding column:', alterError);
          // Column might already exist, continue
        }
      }
    }
    
    const updateResult = db.prepare(`
      UPDATE treasure_hunts
      SET prize_discount_percentage = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(discount_percentage, huntId);
    
    console.log(`[Set Prize] Update result:`, updateResult);
    
    const updatedHunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    
    if (!updatedHunt) {
      console.error(`[Set Prize] Failed to retrieve updated hunt ${huntId}`);
      return res.status(500).json({ error: 'Failed to retrieve updated hunt' });
    }
    
    try {
      logAdminActivity(
        req.admin.id,
        req.admin.email,
        'update',
        `Set prize configuration for treasure hunt: ${hunt.name} (${discount_percentage}% discount)`,
        'treasure_hunt',
        huntId.toString(),
        { discount_percentage },
        req
      );
    } catch (logError) {
      console.error('[Set Prize] Error logging admin activity:', logError);
      // Don't fail the request if logging fails
    }
    
    console.log(`[Set Prize] Successfully set prize for hunt ${huntId}`);
    
    res.json({
      success: true,
      hunt: updatedHunt,
      message: 'Prize configuration set. Unique codes will be generated for each user upon completion.'
    });
  } catch (error) {
    console.error('[Set Prize] Error setting prize:', error);
    console.error('[Set Prize] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to set prize', details: error.message });
  }
});

// DELETE /api/treasure-hunts/:id/prize - Remove prize from treasure hunt (admin only)
router.delete('/:id/prize', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    
    const hunt = db.prepare('SELECT * FROM treasure_hunts WHERE id = ?').get(huntId);
    if (!hunt) {
      return res.status(404).json({ error: 'Treasure hunt not found' });
    }
    
    // Remove prize configuration (this won't affect already-generated user codes)
    db.prepare(`
      UPDATE treasure_hunts
      SET prize_discount_percentage = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(huntId);
    
    logAdminActivity(
      req.admin.id,
      req.admin.email,
      'update',
      `Removed prize from treasure hunt: ${hunt.name}`,
      'treasure_hunt',
      huntId.toString(),
      null,
      req
    );
    
    res.json({ success: true, message: 'Prize removed successfully' });
  } catch (error) {
    console.error('Error removing prize:', error);
    res.status(500).json({ error: 'Failed to remove prize' });
  }
});

// GET /api/treasure-hunts/:id/activity - Get user activity for a hunt (admin only)
router.get('/:id/activity', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    const { user_id, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT a.*, u.username, u.email
      FROM treasure_hunt_activity a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.treasure_hunt_id = ?
    `;
    let params = [huntId];
    
    if (user_id) {
      query += ' AND a.user_id = ?';
      params.push(user_id);
    }
    
    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const activities = db.prepare(query).all(...params);
    
    // Parse activity_data JSON
    const activitiesWithParsedData = activities.map(activity => ({
      ...activity,
      activity_data: activity.activity_data ? JSON.parse(activity.activity_data) : null
    }));
    
    res.json(activitiesWithParsedData);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/treasure-hunts/:id/stats - Get statistics for a hunt (admin only)
router.get('/:id/stats', requireAdminAuth, (req, res) => {
  try {
    const huntId = parseInt(req.params.id);
    
    // Get total users who started
    const totalStarted = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM treasure_hunt_progress
      WHERE treasure_hunt_id = ?
    `).get(huntId).count;
    
    // Get total users who completed
    const totalCompleted = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM treasure_hunt_progress
      WHERE treasure_hunt_id = ? AND completed_at IS NOT NULL
    `).get(huntId).count;
    
    // Get activity counts by type
    const activityCounts = db.prepare(`
      SELECT activity_type, COUNT(*) as count
      FROM treasure_hunt_activity
      WHERE treasure_hunt_id = ?
      GROUP BY activity_type
    `).all(huntId);
    
    // Get recent activity (last 7 days)
    const recentActivity = db.prepare(`
      SELECT COUNT(*) as count
      FROM treasure_hunt_activity
      WHERE treasure_hunt_id = ? AND created_at >= datetime('now', '-7 days')
    `).get(huntId).count;
    
    res.json({
      total_started: totalStarted,
      total_completed: totalCompleted,
      completion_rate: totalStarted > 0 ? ((totalCompleted / totalStarted) * 100).toFixed(2) : 0,
      activity_counts: activityCounts,
      recent_activity_7d: recentActivity
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;

