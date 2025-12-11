const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { requireAdminAuth, createAdminSession, deleteAdminSession, logAdminActivity } = require('../middleware/admin-auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Helper function to verify passwords (handles both bcrypt and legacy SHA256)
const verifyPassword = async (password, hash) => {
  // Check if hash is bcrypt (starts with $2a$, $2b$, or $2y$)
  if (hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'))) {
    return await bcrypt.compare(password, hash);
  }
  // Legacy SHA256 support for migration
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  return passwordHash === hash;
};

// Helper function to hash passwords using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// POST /api/admin-auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  
  console.log('=== ADMIN AUTH: Login attempt ===');
  console.log('Email:', email);
  console.log('Password provided:', password ? 'Yes' : 'No');
  
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    // Find user and verify they're an admin
    const user = db.prepare(`
      SELECT id, email, username, password_hash, role 
      FROM users 
      WHERE email = ? AND role = 'admin'
    `).get(email);
    
    console.log('User found:', user ? 'Yes' : 'No');
    if (user) {
      console.log('User ID:', user.id);
      console.log('User role:', user.role);
    }
    
    if (!user) {
      console.log('User not found or not an admin');
      return res.status(401).json({ error: 'Invalid credentials or not an admin' });
    }
    
    // Verify password (supports both bcrypt and legacy SHA256)
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // If password was verified with legacy SHA256, upgrade to bcrypt
    if (user.password_hash && !user.password_hash.startsWith('$2')) {
      try {
        const newHash = await hashPassword(password);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
        console.log('Password upgraded to bcrypt for admin:', user.id);
      } catch (upgradeError) {
        console.error('Failed to upgrade password hash:', upgradeError);
        // Continue with login even if upgrade fails
      }
    }
    
    console.log('Login successful for admin:', user.email);
    
    // Create session
    const { sessionToken, expiresAt } = createAdminSession(user.id, user.email, req);
    
    // Set cookie
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      admin: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      expiresAt
    });
    
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Login failed' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/admin-auth/logout
router.post('/logout', requireAdminAuth, (req, res) => {
  const sessionToken = req.cookies?.admin_session;
  
  // Log logout
  logAdminActivity(req.admin.id, req.admin.email, 'LOGOUT', 'Admin logged out', null, null, null, req);
  
  deleteAdminSession(sessionToken);
  res.clearCookie('admin_session');
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/admin-auth/session
router.get('/session', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// GET /api/admin-auth/status (alias for /session)
router.get('/status', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    user: req.admin
  });
});

// GET /api/admin-auth/activity-logs
router.get('/activity-logs', requireAdminAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const logs = db.prepare(`
      SELECT * FROM admin_activity_logs 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM admin_activity_logs').get();
    
    res.json({
      success: true,
      logs,
      total: total.count,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to fetch activity logs' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;

