const db = require('../database');
const crypto = require('crypto');

// User authentication middleware - requires session or JWT token
// NOTE: This middleware now requires proper session-based authentication
// Do NOT rely on userId from request body/headers for authentication
function requireAuth(req, res, next) {
  // First try session-based authentication
  const sessionToken = req.cookies?.user_session;
  
  if (sessionToken) {
    try {
      // Check if session exists and is valid
      const session = db.prepare(`
        SELECT s.*, u.email, u.role, u.username
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now')
      `).get(sessionToken);
      
      if (session) {
        // Update last activity
        db.prepare(`
          UPDATE user_sessions 
          SET last_activity = datetime('now')
          WHERE session_token = ?
        `).run(sessionToken);
        
        // Attach user info to request
        req.user = {
          id: session.user_id,
          email: session.email,
          username: session.username,
          role: session.role
        };
        return next();
      }
    } catch (error) {
      console.error('Session auth error:', error);
      // Fall through to check JWT or deny
    }
  }
  
  // If no valid session, check for JWT in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Note: JWT verification would go here if JWT-based auth is implemented
    // For now, require session-based auth
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
  
  // No valid authentication found
  return res.status(401).json({ error: 'Authentication required. Please log in.' });
}

// Optional: Session-based authentication (if you want to implement it later)
function requireSessionAuth(req, res, next) {
  const sessionToken = req.cookies?.user_session;
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'Session required' });
  }
  
  try {
    // Check if session exists and is valid
    const session = db.prepare(`
      SELECT s.*, u.email, u.role, u.username
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ? AND s.expires_at > datetime('now')
    `).get(sessionToken);
    
    if (!session) {
      res.clearCookie('user_session');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Update last activity
    db.prepare(`
      UPDATE user_sessions 
      SET last_activity = datetime('now')
      WHERE session_token = ?
    `).run(sessionToken);
    
    // Attach user info to request
    req.user = {
      id: session.user_id,
      email: session.email,
      username: session.username,
      role: session.role
    };
    
    next();
  } catch (error) {
    console.error('Session auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = {
  requireAuth,
  requireSessionAuth
};
