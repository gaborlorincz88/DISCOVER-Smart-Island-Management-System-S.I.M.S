const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const verificationEmailService = require('../services/verificationEmailService');
const { authLimiter, emailLimiter, registrationLimiter } = require('../middleware/rateLimiter');

// Helper function to hash passwords using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

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

// Helper function to generate user ID
const generateUserId = () => {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// POST /api/auth/register - Register a new user
router.post('/register', registrationLimiter, async (req, res) => {
  console.log('=== AUTH API: User registration ===');
  console.log('Request body:', req.body);
  
  const { email, password, username, location, plannedStayDuration } = req.body;
  
  if (!email || !password || !username || !location || !plannedStayDuration) {
    console.log('Missing required fields:', { email: !!email, password: !!password, username: !!username, location: !!location, plannedStayDuration: !!plannedStayDuration });
    return res.status(400).json({ error: 'All fields are required for registration' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  try {
    // Check if user already exists by email or username
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    
    if (existingUser) {
      console.log('User already exists with email or username:', email, username);
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }
    
    // Create new user with email verification
    const userId = generateUserId();
    const passwordHash = await hashPassword(password);
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // Token expires in 24 hours
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, password_hash, location, planned_stay_duration, role, email_verified, verification_token, verification_token_expires, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, 'user', 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(userId, email, username, passwordHash, location, plannedStayDuration, verificationToken, tokenExpires.toISOString());
    
    if (result.changes > 0) {
      console.log('User created successfully with ID:', userId);
      
      // Send verification email
      try {
        await verificationEmailService.sendVerificationEmail(email, verificationToken, username);
        console.log('Verification email sent to:', email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError.message);
        // Don't fail registration if email fails - user can request resend
      }
      
      // Track user registration analytics
      try {
        db.prepare(`
          INSERT INTO analytics (event_name, event_data, user_id, timestamp, ip_address, user_agent)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        `).run(
          'user_registration',
          JSON.stringify({ 
            location: location || null,
            registration_method: 'direct',
            username: username 
          }),
          userId,
          req.ip || req.connection.remoteAddress || 'unknown',
          req.get('User-Agent') || 'unknown'
        );
      } catch (analyticsError) {
        console.log('Analytics tracking failed (non-critical):', analyticsError.message);
      }

      res.status(201).json({ 
        message: 'Registration successful! Please check your email to verify your account.', 
        requiresVerification: true,
        user: {
          id: userId,
          email,
          username,
          email_verified: false
        }
      });
    } else {
      console.log('Failed to create user');
      res.status(500).json({ error: 'Failed to create user' });
    }
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error registering user:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to register user' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/auth/verify-email - Verify email address
router.post('/verify-email', emailLimiter, async (req, res) => {
  console.log('=== AUTH API: Verify email ===');
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }
  
  try {
    // Find user with this token
    const user = db.prepare(`
      SELECT id, email, username, email_verified, verification_token_expires 
      FROM users 
      WHERE verification_token = ?
    `).get(token);
    
    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired verification token' });
    }
    
    // Check if already verified
    if (user.email_verified) {
      return res.json({ 
        message: 'Email already verified', 
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          email_verified: true
        }
      });
    }
    
    // Check if token expired
    if (user.verification_token_expires) {
      const expiresAt = new Date(user.verification_token_expires);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
      }
    }
    
    // Verify the email
    db.prepare(`
      UPDATE users 
      SET email_verified = 1, 
          verification_token = NULL, 
          verification_token_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);
    
    console.log('Email verified for user:', user.id);
    
    res.json({ 
      message: 'Email verified successfully! You can now log in.', 
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        email_verified: true
      }
    });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error verifying email:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to verify email' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', emailLimiter, async (req, res) => {
  console.log('=== AUTH API: Resend verification ===');
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    // Find user by email
    const user = db.prepare(`
      SELECT id, email, username, email_verified 
      FROM users 
      WHERE email = ?
    `).get(email);
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ 
        message: 'If an account exists with this email, a verification email has been sent.' 
      });
    }
    
    // Check if already verified
    if (user.email_verified) {
      return res.json({ 
        message: 'Email is already verified. You can log in now.' 
      });
    }
    
    // Generate new token
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24);
    
    // Update user with new token
    db.prepare(`
      UPDATE users 
      SET verification_token = ?, 
          verification_token_expires = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(verificationToken, tokenExpires.toISOString(), user.id);
    
    // Send verification email
    try {
      await verificationEmailService.sendVerificationEmail(user.email, verificationToken, user.username);
      console.log('Verification email resent to:', user.email);
      res.json({ 
        message: 'Verification email sent! Please check your inbox.' 
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Failed to send verification email' 
        : emailError.message;
      res.status(500).json({ error: errorMessage });
    }
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error resending verification:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to resend verification' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/auth/login - Login user
router.post('/login', authLimiter, async (req, res) => {
  console.log('=== AUTH API: User login ===');
  console.log('Request body:', req.body);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    console.log('Missing required fields:', { email: !!email, password: !!password });
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    // Find user by email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      console.log('User not found with email:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password (supports both bcrypt and legacy SHA256)
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // If password was verified with legacy SHA256, upgrade to bcrypt
    if (user.password_hash && !user.password_hash.startsWith('$2')) {
      try {
        const newHash = await hashPassword(password);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
        console.log('Password upgraded to bcrypt for user:', user.id);
      } catch (upgradeError) {
        console.error('Failed to upgrade password hash:', upgradeError);
        // Continue with login even if upgrade fails
      }
    }
    
    // Check if email is verified (optional - you can make this required or optional)
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before logging in. Check your inbox for the verification email.',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    // Create user session (similar to admin sessions)
    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = `user-session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    try {
      // Delete any existing sessions for this user (optional - you can allow multiple sessions)
      // db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
      
      // Create new session
      db.prepare(`
        INSERT INTO user_sessions (id, user_id, session_token, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sessionId, user.id, sessionToken, ipAddress, userAgent, expiresAt.toISOString());
      
      console.log('User session created successfully:', sessionId);
    } catch (sessionError) {
      console.error('Error creating user session:', sessionError);
      // If table doesn't exist, log error but don't fail login
      // User will need to restart server to create the table
      if (sessionError.message && sessionError.message.includes('no such table')) {
        console.error('⚠️ user_sessions table does not exist. Please restart the server to create it.');
      } else {
        // For other errors, still log but continue
        console.error('Session creation failed, but login will continue:', sessionError.message);
      }
    }
    
    // Set session cookie with domain for cross-subdomain support
    // For production: use .discover-gozo.com to work across subdomains
    // For development: don't set domain (works for localhost)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    };
    
    // Set domain for production (cross-subdomain cookies)
    if (process.env.NODE_ENV === 'production' || req.hostname.includes('discover-gozo.com')) {
      cookieOptions.domain = '.discover-gozo.com';
    }
    
    res.cookie('user_session', sessionToken, cookieOptions);
    
    console.log('User logged in successfully:', user.id);
    console.log('Session created:', sessionId);
    
    // Return user info (without password)
    const userInfo = {
      id: user.id,
      email: user.email,
      username: user.username,
      location: user.location,
      role: user.role,
      email_verified: user.email_verified ? true : false,
      created_at: user.created_at,
      last_login: new Date().toISOString()
    };
    
    res.json({ 
      message: 'Login successful', 
      user: userInfo 
    });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error logging in user:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to login' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/auth/user/:id - Get user info
router.get('/user/:id', (req, res) => {
  console.log('=== AUTH API: Get user info ===');
  console.log('User ID:', req.params.id);
  
  try {
    const user = db.prepare('SELECT id, email, role, created_at, last_login FROM users WHERE id = ?').get(req.params.id);
    
    if (!user) {
      console.log('User not found with ID:', req.params.id);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User found:', user.id);
    res.json({ user });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error getting user info:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get user info' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/auth/users - Get all users (admin only)
router.get('/users', (req, res) => {
  console.log('=== AUTH API: Get all users ===');
  
  try {
    const users = db.prepare(`
      SELECT id, email, username, location, role, created_at, last_login, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `).all();
    
    console.log('Found users:', users.length);
    res.json({ users });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error getting users:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get users' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/auth/analytics/tourist-origins - Get tourist origin analytics
router.get('/analytics/tourist-origins', (req, res) => {
  console.log('=== AUTH API: Get tourist origin analytics ===');
  
  try {
    // Get registration events with location data
    const registrations = db.prepare(`
      SELECT 
        event_data,
        timestamp,
        user_id
      FROM analytics 
      WHERE event_name = 'user_registration'
      ORDER BY timestamp DESC
    `).all();
    
    // Also get users directly from users table (for dummy users created directly)
    const directUsers = db.prepare(`
      SELECT 
        id,
        username,
        location,
        planned_stay_duration,
        created_at
      FROM users 
      WHERE location IS NOT NULL AND location != ?
      ORDER BY created_at DESC
    `).all('');
    
    // Process the data to extract location information and planned stay duration
    const locationCounts = {};
    const stayDurationCounts = {};
    let totalRegistrations = 0;
    let registrationsWithLocation = 0;
    let registrationsWithPlannedStay = 0;
    
    // Process analytics registration events
    registrations.forEach(reg => {
      try {
        const eventData = JSON.parse(reg.event_data);
        const location = eventData.location;
        const plannedStayDuration = eventData.plannedStayDuration;
        
        if (location && location.trim() !== '') {
          registrationsWithLocation++;
          const normalizedLocation = location.trim();
          
          if (locationCounts[normalizedLocation]) {
            locationCounts[normalizedLocation]++;
          } else {
            locationCounts[normalizedLocation] = 1;
          }
        }
        
        if (plannedStayDuration && plannedStayDuration.trim() !== '') {
          registrationsWithPlannedStay++;
          const normalizedDuration = plannedStayDuration.trim();
          
          if (stayDurationCounts[normalizedDuration]) {
            stayDurationCounts[normalizedDuration]++;
          } else {
            stayDurationCounts[normalizedDuration] = 1;
          }
        }
      } catch (parseError) {
        console.log('Error parsing event data:', parseError.message);
      }
    });
    
    // Process direct users (dummy users created directly in database)
    directUsers.forEach(user => {
      const location = user.location;
      const plannedStayDuration = user.planned_stay_duration;
      
      if (location && location.trim() !== '') {
        registrationsWithLocation++;
        const normalizedLocation = location.trim();
        
        if (locationCounts[normalizedLocation]) {
          locationCounts[normalizedLocation]++;
        } else {
          locationCounts[normalizedLocation] = 1;
        }
      }
      
      if (plannedStayDuration && plannedStayDuration.trim() !== '') {
        registrationsWithPlannedStay++;
        const normalizedDuration = plannedStayDuration.trim();
        
        if (stayDurationCounts[normalizedDuration]) {
          stayDurationCounts[normalizedDuration]++;
        } else {
          stayDurationCounts[normalizedDuration] = 1;
        }
      }
    });
    
    totalRegistrations = registrations.length + directUsers.length;
    
    // Convert to array and sort by count
    const locationStats = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
    
    // Define proper order for stay durations
    const durationOrder = {
      '1-3 days': 1,
      '4-7 days': 2,
      '1-2 weeks': 3,
      '2-4 weeks': 4,
      '1-3 months': 5,
      '3-6 months': 6,
      '6+ months': 7,
      'Local resident': 8
    };
    
    const stayDurationStats = Object.entries(stayDurationCounts)
      .map(([duration, count]) => ({ duration, count }))
      .sort((a, b) => (durationOrder[a.duration] || 999) - (durationOrder[b.duration] || 999));
    
    const analytics = {
      totalRegistrations,
      registrationsWithLocation,
      registrationsWithPlannedStay,
      locationStats,
      stayDurationStats,
      summary: {
        topLocation: locationStats[0] || null,
        uniqueLocations: locationStats.length,
        coveragePercentage: totalRegistrations > 0 ? 
          Math.round((registrationsWithLocation / totalRegistrations) * 100) : 0,
        plannedStayCoveragePercentage: totalRegistrations > 0 ?
          Math.round((registrationsWithPlannedStay / totalRegistrations) * 100) : 0
      },
      rawData: {
        registrations: registrations,
        directUsers: directUsers
      }
    };
    
    console.log(`Found ${totalRegistrations} total users (${registrations.length} from analytics, ${directUsers.length} direct), ${registrationsWithLocation} with location data`);
    res.json({ success: true, analytics });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error getting tourist origin analytics:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get tourist origin analytics' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/auth/migrate-trips - Migrate trips from old user ID to new user ID
router.post('/migrate-trips', (req, res) => {
  console.log('=== AUTH API: Migrate trips ===');
  console.log('Request body:', req.body);
  
  const { oldUserId, newUserId } = req.body;
  
  if (!oldUserId || !newUserId) {
    return res.status(400).json({ error: 'Old user ID and new user ID are required' });
  }
  
  try {
    // Check if both users exist
    const oldUser = db.prepare('SELECT id FROM users WHERE id = ?').get(oldUserId);
    const newUser = db.prepare('SELECT id FROM users WHERE id = ?').get(newUserId);
    
    if (!oldUser || !newUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Update trips to use new user ID
    const stmt = db.prepare('UPDATE trips SET user_id = ? WHERE user_id = ?');
    const result = stmt.run(newUserId, oldUserId);
    
    console.log('Migrated trips:', result.changes);
    
    res.json({ 
      message: 'Trips migrated successfully', 
      tripsMigrated: result.changes 
    });
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error migrating trips:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to migrate trips' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// DELETE /api/auth/users/:id - Delete a user
router.delete('/users/:id', (req, res) => {
  console.log('=== AUTH API: Delete user ===');
  console.log('User ID:', req.params.id);
  
  try {
    // First delete all trips for this user
    const deleteTripsStmt = db.prepare('DELETE FROM trips WHERE user_id = ?');
    const tripsResult = deleteTripsStmt.run(req.params.id);
    
    console.log('Deleted trips:', tripsResult.changes);
    
    // Then delete the user
    const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
    const userResult = deleteUserStmt.run(req.params.id);
    
    if (userResult.changes > 0) {
      console.log('User deleted successfully');
      res.json({ 
        message: 'User deleted successfully', 
        tripsDeleted: tripsResult.changes 
      });
    } else {
      console.log('User not found');
      res.status(404).json({ error: 'User not found' });
    }
    
  } catch (error) {
    console.error('=== AUTH API ERROR ===');
    console.error('Error deleting user:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to delete user' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/auth/status - Check if user has valid session
router.get('/status', async (req, res) => {
  try {
    const sessionToken = req.cookies?.user_session;
    
    if (!sessionToken) {
      return res.status(401).json({ 
        authenticated: false, 
        error: 'No session found' 
      });
    }
    
    // Check if session exists and is valid
    const session = db.prepare(`
      SELECT s.*, u.email, u.role, u.username
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ? AND s.expires_at > datetime('now')
    `).get(sessionToken);
    
    if (!session) {
      res.clearCookie('user_session');
      return res.status(401).json({ 
        authenticated: false, 
        error: 'Invalid or expired session' 
      });
    }
    
    // Update last activity
    db.prepare(`
      UPDATE user_sessions 
      SET last_activity = datetime('now')
      WHERE session_token = ?
    `).run(sessionToken);
    
    res.json({
      authenticated: true,
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        role: session.role
      }
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ 
      authenticated: false, 
      error: 'Authentication check failed' 
    });
  }
});

module.exports = router;
