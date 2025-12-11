const db = require('../database');
const crypto = require('crypto');
const secureLogger = require('../services/secureLogger');

// Middleware to check if admin is authenticated
function requireAdminAuth(req, res, next) {
  const sessionToken = req.cookies?.admin_session;
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'Authentication required', redirectTo: '/admin-login.html' });
  }
  
  try {
    // Check if session exists and is valid
    const session = db.prepare(`
      SELECT s.*, u.email, u.role, u.username
      FROM admin_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.role = 'admin'
    `).get(sessionToken);
    
    if (!session) {
      res.clearCookie('admin_session');
      return res.status(401).json({ error: 'Invalid or expired session', redirectTo: '/admin-login.html' });
    }
    
    // Update last activity
    db.prepare(`
      UPDATE admin_sessions 
      SET last_activity = datetime('now')
      WHERE session_token = ?
    `).run(sessionToken);
    
    // Attach admin info to request
    req.admin = {
      id: session.user_id,
      email: session.email,
      username: session.username,
      role: session.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Log admin activity (both database and secure file logging)
function logAdminActivity(adminId, adminEmail, actionType, description, targetType = null, targetId = null, details = null, req) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    
    // Database logging (for UI display)
    db.prepare(`
      INSERT INTO admin_activity_logs 
      (admin_id, admin_email, action_type, action_description, target_type, target_id, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      adminEmail,
      actionType,
      description,
      targetType,
      targetId,
      ipAddress,
      userAgent,
      details ? JSON.stringify(details) : null
    );
    
    // Secure file logging (tamper-proof, persistent)
    secureLogger.logActivity(adminId, adminEmail, actionType, description, targetType, targetId, details, req);
    
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
}

// Create admin session
function createAdminSession(userId, email, req) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionId = `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');
  
  db.prepare(`
    INSERT INTO admin_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, userId, sessionToken, ipAddress, userAgent, expiresAt.toISOString());
  
  // Log login activity
  logAdminActivity(userId, email, 'LOGIN', 'Admin logged in', null, null, null, req);
  
  return { sessionToken, expiresAt };
}

// Delete admin session (logout)
function deleteAdminSession(sessionToken) {
  if (sessionToken) {
    db.prepare('DELETE FROM admin_sessions WHERE session_token = ?').run(sessionToken);
  }
}

// Clean up expired sessions (run periodically)
function cleanupExpiredSessions() {
  try {
    const result = db.prepare(`
      DELETE FROM admin_sessions WHERE expires_at <= datetime('now')
    `).run();
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired admin sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}

module.exports = {
  requireAdminAuth,
  logAdminActivity,
  createAdminSession,
  deleteAdminSession,
  cleanupExpiredSessions
};

