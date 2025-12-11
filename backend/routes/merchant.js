const express = require('express');
const router = express.Router();
const db = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiter');

// JWT secret - require environment variable or generate strong secret
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const generatedSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET not set in environment. Generated temporary secret:', generatedSecret.substring(0, 16) + '...');
  console.warn('⚠️  Set JWT_SECRET in environment variables for production!');
  return generatedSecret;
})();

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

// Helper function to get current date in Malta timezone (for date comparisons)
const getMaltaDate = () => {
  const now = new Date();
  // Convert to Malta timezone string and parse back to get date components
  const maltaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Malta' }); // YYYY-MM-DD format
  const [year, month, day] = maltaDateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // Create date at midnight in local timezone for comparison
};

// Helper function to parse date string and get date in Malta timezone
const parseDateInMaltaTimezone = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Get date components in Malta timezone
  const maltaDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Malta' });
  const [year, month, day] = maltaDateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // Create date at midnight in local timezone for comparison
};

// Middleware to verify merchant JWT token
const authenticateMerchant = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.merchant = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Test endpoint for connection testing
router.get('/test', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Connection successful',
    timestamp: new Date().toISOString()
  });
});

// Token refresh endpoint
router.post('/refresh-token', authenticateMerchant, (req, res) => {
  console.log('=== TOKEN REFRESH ===');
  
  try {
    // Generate new JWT token with same payload
    const newToken = jwt.sign(
      { 
        merchantId: req.merchant.merchantId, 
        email: req.merchant.email, 
        name: req.merchant.name,
        role: 'merchant' 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      merchant: {
        id: req.merchant.merchantId,
        name: req.merchant.name,
        email: req.merchant.email,
        role: 'merchant'
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to refresh token' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Merchant Registration
router.post('/register', registrationLimiter, async (req, res) => {
  console.log('=== MERCHANT REGISTRATION ===');
  
  const { name, email, password, businessName, location } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  try {
    // Check if merchant already exists
    const existingMerchant = db.prepare('SELECT id FROM merchants WHERE email = ?').get(email);
    if (existingMerchant) {
      return res.status(400).json({ error: 'Merchant with this email already exists' });
    }
    
    // Create new merchant
    const merchantId = 'merchant-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await hashPassword(password);
    
    db.prepare(`
      INSERT INTO merchants (id, name, email, password_hash, business_name, location, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(merchantId, name, email, passwordHash, businessName || null, location || null);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        merchantId: merchantId, 
        email: email, 
        name: name,
        role: 'merchant' 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Merchant registered successfully',
      token,
      merchant: {
        id: merchantId,
        name,
        email,
        businessName: businessName || null,
        location: location || null
      }
    });
    
  } catch (error) {
    console.error('Error registering merchant:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to register merchant' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Merchant Login
router.post('/login', authLimiter, async (req, res) => {
  console.log('=== MERCHANT LOGIN ===');
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    // Find merchant by email
    const merchant = db.prepare('SELECT * FROM merchants WHERE email = ? AND is_active = 1').get(email);
    
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password (supports both bcrypt and legacy SHA256)
    const isValidPassword = await verifyPassword(password, merchant.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // If password was verified with legacy SHA256, upgrade to bcrypt
    if (merchant.password_hash && !merchant.password_hash.startsWith('$2')) {
      try {
        const newHash = await hashPassword(password);
        db.prepare('UPDATE merchants SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, merchant.id);
        console.log('Password upgraded to bcrypt for merchant:', merchant.id);
      } catch (upgradeError) {
        console.error('Failed to upgrade password hash:', upgradeError);
        // Continue with login even if upgrade fails
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        merchantId: merchant.id, 
        email: merchant.email, 
        name: merchant.name,
        role: 'merchant' 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        businessName: merchant.business_name,
        location: merchant.location
      }
    });
    
  } catch (error) {
    console.error('Error logging in merchant:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to login' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Validate Ticket
router.post('/validate-ticket', authenticateMerchant, (req, res) => {
  console.log('=== TICKET VALIDATION ===');
  console.log('Request body:', req.body);
  
  const { qrData, ticket_id, validation_type, location, notes } = req.body;
  const merchantId = req.merchant.merchantId;
  
  let reservationId, ticketId;
  
  // Handle direct ticket_id (from mobile app)
  if (ticket_id) {
    reservationId = ticket_id;
    // Find the ticket_id for this reservation
    const reservation = db.prepare('SELECT ticket_id FROM reservations WHERE id = ?').get(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    ticketId = reservation.ticket_id;
  }
  // Handle QR code data (from QR scanner)
  else if (qrData) {
    try {
      const ticketData = JSON.parse(qrData);
      const { ticketId: qrTicketId, reservationId: qrReservationId } = ticketData;
      reservationId = qrReservationId;
      ticketId = qrTicketId;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }
  } else {
    return res.status(400).json({ error: 'Either ticket_id or qrData is required' });
  }
  
  if (!ticketId || !reservationId) {
    return res.status(400).json({ error: 'Invalid ticket data' });
  }
  
  try {
    // Get merchant info to check assigned tours
    const merchant = db.prepare('SELECT assigned_tours FROM merchants WHERE id = ?').get(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Parse assigned tours
    const assignedTours = merchant.assigned_tours ? JSON.parse(merchant.assigned_tours) : [];
    
    // Verify ticket exists and is valid
    const reservation = db.prepare(`
      SELECT r.*, t.name as ticket_name, t.price as ticket_price, t.id as ticket_id
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      WHERE r.id = ? AND r.ticket_id = ?
    `).get(reservationId, ticketId);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Check if merchant is authorized to validate this ticket
    if (assignedTours.length > 0) {
      // Check if merchant is assigned to this specific tour
      const normalizedTourName = reservation.tour_name?.toLowerCase().replace(/\s+/g, '-');
      const isAuthorized = assignedTours.includes(normalizedTourName);
      
      console.log('=== AUTHORIZATION CHECK ===');
      console.log('Merchant assigned tours:', assignedTours);
      console.log('Reservation tour_name:', reservation.tour_name);
      console.log('Normalized tour name:', normalizedTourName);
      console.log('Is authorized:', isAuthorized);
      
      if (!isAuthorized) {
        return res.status(403).json({ 
          error: 'Unauthorized: You are not assigned to validate tickets for this tour',
          tourName: reservation.tour_name,
          assignedTours: assignedTours
        });
      }
    } else {
      // If merchant has no assigned tours, they cannot validate any ticket
      console.log('=== AUTHORIZATION CHECK ===');
      console.log('Merchant has no assigned tours - denying validation');
      return res.status(403).json({ 
        error: 'Unauthorized: You have no assigned tours. Please contact admin to assign tours.',
        assignedTours: []
      });
    }
    
    // Check if ticket is already validated
    if (reservation.validation_status === 'completed' || reservation.validation_status === 'used') {
      return res.status(400).json({ 
        error: 'Ticket already validated',
        ticket: {
          id: reservation.id,
          ticketName: reservation.tour_name || reservation.ticket_name,
          status: reservation.validation_status,
          validatedAt: reservation.updated_at
        }
      });
    }
    
    // Check if ticket is expired (optional - you can add expiration logic)
    // Use Malta timezone for date comparison
    const reservationDate = parseDateInMaltaTimezone(reservation.reservation_date);
    const today = getMaltaDate();
    if (reservationDate && reservationDate < today) {
      return res.status(400).json({ error: 'Ticket has expired' });
    }
    
    // Create validation record
    const validationId = 'validation-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    db.prepare(`
      INSERT INTO ticket_validations (id, ticket_id, reservation_id, merchant_id, validation_type, status, scanned_at, location, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
    `).run(validationId, ticketId, reservationId, merchantId, 'scan', 'validated', location || null, notes || null);
    
    // Update reservation status
    db.prepare('UPDATE reservations SET validation_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('completed', reservationId);
    
    res.json({
      message: 'Ticket validated successfully',
      validation: {
        id: validationId,
        ticketId,
        reservationId,
        ticketName: reservation.tour_name || reservation.ticket_name,
        customerEmail: reservation.contact_email,
        quantity: reservation.quantity,
        totalPrice: reservation.total_price,
        validatedAt: new Date().toISOString(),
        merchantId,
        location: location || null
      }
    });
    
  } catch (error) {
    console.error('Error validating ticket:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to validate ticket' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Get validated tickets for merchant
router.get('/tickets/validated', authenticateMerchant, (req, res) => {
  console.log('=== GET VALIDATED TICKETS ===');
  console.log('Requesting merchant ID:', req.merchant.merchantId);
  console.log('Token payload:', req.merchant);
  
  const merchantId = req.merchant.merchantId;
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    const validations = db.prepare(`
      SELECT 
        tv.*,
        r.tour_name,
        r.contact_email,
        r.contact_phone,
        r.quantity,
        r.total_price,
        r.reservation_date,
        r.reservation_time,
        t.name as ticket_name
      FROM ticket_validations tv
      JOIN reservations r ON tv.reservation_id = r.id
      JOIN tickets t ON tv.ticket_id = t.id
      WHERE tv.merchant_id = ?
      ORDER BY tv.scanned_at DESC
      LIMIT ? OFFSET ?
    `).all(merchantId, parseInt(limit), parseInt(offset));
    
    console.log(`Found ${validations.length} validations for merchant ${merchantId}`);
    console.log('Validation merchant IDs:', validations.map(v => v.merchant_id));
    
    res.json({
      validations,
      total: validations.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error getting validated tickets:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get validated tickets' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Get treasure hunt redemption history for merchant
router.get('/treasure-hunt-redemptions', authenticateMerchant, (req, res) => {
  console.log('=== GET TREASURE HUNT REDEMPTIONS ===');
  console.log('Requesting merchant ID:', req.merchant.merchantId);
  
  const merchantId = req.merchant.merchantId;
  const { limit = 50, offset = 0 } = req.query;
  
  try {
    // Check if table exists, create if not
    try {
      db.prepare('SELECT * FROM treasure_hunt_redemptions LIMIT 1').get();
    } catch (tableError) {
      if (tableError.message.includes('no such table')) {
        console.log('Creating treasure_hunt_redemptions table...');
        db.prepare(`
          CREATE TABLE IF NOT EXISTS treasure_hunt_redemptions (
            id TEXT PRIMARY KEY,
            treasure_hunt_id INTEGER,
            user_id INTEGER,
            coupon_code TEXT,
            merchant_id TEXT,
            redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (treasure_hunt_id) REFERENCES treasure_hunts(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (merchant_id) REFERENCES merchants(id)
          )
        `).run();
      }
    }
    
    // Debug: Check total redemptions
    try {
      const totalCount = db.prepare('SELECT COUNT(*) as count FROM treasure_hunt_redemptions').get();
      console.log(`Total redemptions in database: ${totalCount.count}`);
      const merchantCount = db.prepare('SELECT COUNT(*) as count FROM treasure_hunt_redemptions WHERE merchant_id = ?').get(merchantId);
      console.log(`Redemptions for merchant ${merchantId}: ${merchantCount.count}`);
    } catch (countError) {
      console.log('Count error:', countError.message);
    }
    
    const redemptions = db.prepare(`
      SELECT 
        thr.*,
        th.name as hunt_name,
        th.prize_discount_percentage,
        u.email as user_email,
        u.username as user_name
      FROM treasure_hunt_redemptions thr
      JOIN treasure_hunts th ON thr.treasure_hunt_id = th.id
      JOIN users u ON thr.user_id = u.id
      WHERE thr.merchant_id = ?
      ORDER BY thr.redeemed_at DESC
      LIMIT ? OFFSET ?
    `).all(merchantId, parseInt(limit), parseInt(offset));
    
    console.log(`Found ${redemptions.length} treasure hunt redemptions for merchant ${merchantId}`);
    if (redemptions.length > 0) {
      console.log('First redemption sample:', JSON.stringify(redemptions[0], null, 2));
    }
    
    res.json({
      redemptions,
      total: redemptions.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error getting treasure hunt redemptions:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get treasure hunt redemptions' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Get ticket status
router.get('/tickets/:ticketId/status', authenticateMerchant, (req, res) => {
  console.log('=== GET TICKET STATUS ===');
  
  const { ticketId } = req.params;
  const merchantId = req.merchant.merchantId;
  
  try {
    const ticket = db.prepare(`
      SELECT 
        r.*,
        t.name as ticket_name,
        tv.status as validation_status,
        tv.scanned_at,
        tv.location as validation_location,
        m.name as merchant_name
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      LEFT JOIN ticket_validations tv ON r.id = tv.reservation_id
      LEFT JOIN merchants m ON tv.merchant_id = m.id
      WHERE r.ticket_id = ?
      ORDER BY tv.scanned_at DESC
      LIMIT 1
    `).get(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({
      ticket: {
        id: ticket.id,
        ticketId: ticket.ticket_id,
        ticketName: ticket.tour_name || ticket.ticket_name,
        customerEmail: ticket.contact_email,
        quantity: ticket.quantity,
        totalPrice: ticket.total_price,
        reservationDate: ticket.reservation_date,
        validationStatus: ticket.validation_status || 'pending',
        validatedAt: ticket.scanned_at,
        validatedBy: ticket.merchant_name,
        validationLocation: ticket.validation_location
      }
    });
    
  } catch (error) {
    console.error('Error getting ticket status:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get ticket status' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Generate QR Code for ticket (for testing)
router.get('/tickets/:ticketId/qr-data', (req, res) => {
  console.log('=== GENERATE QR DATA ===');
  
  const { ticketId } = req.params;
  
  try {
    // First try to find by internal reservation ID (format: reservation-XXXXX-XXXXX)
    let reservation = db.prepare(`
      SELECT r.*, t.name as ticket_name, t.main_image as ticket_image
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      WHERE r.id = ?
    `).get(ticketId);
    
    // If not found by internal ID, try by GOZO format (GOZO-YYYYMMDD-XXXXX)
    if (!reservation) {
      reservation = db.prepare(`
        SELECT r.*, t.name as ticket_name, t.main_image as ticket_image
        FROM reservations r
        JOIN tickets t ON r.ticket_id = t.id
        WHERE r.id LIKE 'GOZO-%' AND r.id = ?
      `).get(ticketId);
    }
    
    // If still not found, try by ticket ID
    if (!reservation) {
      reservation = db.prepare(`
        SELECT r.*, t.name as ticket_name, t.main_image as ticket_image
        FROM reservations r
        JOIN tickets t ON r.ticket_id = t.id
        WHERE r.ticket_id = ?
        ORDER BY r.created_at DESC
        LIMIT 1
      `).get(ticketId);
    }
    
    if (!reservation) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Create QR code data
    const qrData = {
      ticketId: reservation.ticket_id,
      reservationId: reservation.id,
      userId: reservation.user_id,
      timestamp: new Date().toISOString(),
      hash: crypto.createHash('sha256')
        .update(`${reservation.ticket_id}-${reservation.id}-${reservation.user_id}`)
        .digest('hex').substring(0, 16)
    };
    
    res.json({
      id: reservation.id,
      ticket_id: reservation.ticket_id,
      tour_name: reservation.tour_name || reservation.ticket_name,
      customer_name: reservation.contact_name || 'Customer',
      contact_email: reservation.contact_email,
      contact_phone: reservation.contact_phone,
      quantity: reservation.quantity,
      total_price: reservation.total_price,
      reservation_date: reservation.reservation_date,
      status: reservation.status || 'confirmed',
      validation_status: reservation.validation_status || 'pending',
      ticket_image: reservation.ticket_image
    });
    
  } catch (error) {
    console.error('Error generating QR data:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to generate QR data' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Get merchant statistics
router.get('/statistics', authenticateMerchant, (req, res) => {
  console.log('=== GET MERCHANT STATISTICS ===');
  console.log('Requesting merchant ID:', req.merchant.merchantId);
  
  const merchantId = req.merchant.merchantId;
  
  try {
    // Use Malta timezone for date calculations
    const now = new Date();
    const maltaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Malta' });
    const [year, month, day] = maltaDateStr.split('-').map(Number);
    const today = new Date(year, month - 1, day);
    
    // Calculate week start (Monday) in Malta timezone
    const maltaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Malta' }));
    const dayOfWeek = maltaDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to subtract to get Monday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);
    
    // Month start in Malta timezone
    const monthStart = new Date(year, month - 1, 1);
    
    // Get all validations for this merchant with reservation details
    const validations = db.prepare(`
      SELECT 
        tv.*,
        r.quantity,
        r.total_price,
        r.tour_name,
        t.name as ticket_name,
        t.price as ticket_price
      FROM ticket_validations tv
      JOIN reservations r ON tv.reservation_id = r.id
      JOIN tickets t ON tv.ticket_id = t.id
      WHERE tv.merchant_id = ?
      ORDER BY tv.scanned_at DESC
    `).all(merchantId);
    
    console.log(`Found ${validations.length} validations for merchant ${merchantId}`);
    
    // Calculate statistics
    let totalTickets = 0;
    let totalPersons = 0;
    let totalRevenue = 0.0;
    
    let todayTickets = 0;
    let todayPersons = 0;
    let todayRevenue = 0.0;
    
    let weekTickets = 0;
    let weekPersons = 0;
    let weekRevenue = 0.0;
    
    let monthTickets = 0;
    let monthPersons = 0;
    let monthRevenue = 0.0;
    
    for (const validation of validations) {
      // Parse validation date and convert to Malta timezone for comparison
      const validatedAt = parseDateInMaltaTimezone(validation.scanned_at);
      const quantity = validation.quantity || 1;
      const price = validation.total_price || validation.ticket_price || 0;
      const revenue = quantity * price;
      
      // All time
      totalTickets++;
      totalPersons += quantity;
      totalRevenue += revenue;
      
      // Today
      if (validatedAt >= today) {
        todayTickets++;
        todayPersons += quantity;
        todayRevenue += revenue;
      }
      
      // This week
      if (validatedAt >= weekStart) {
        weekTickets++;
        weekPersons += quantity;
        weekRevenue += revenue;
      }
      
      // This month
      if (validatedAt >= monthStart) {
        monthTickets++;
        monthPersons += quantity;
        monthRevenue += revenue;
      }
    }
    
    const statistics = {
      totalTickets,
      totalPersons,
      totalRevenue,
      todayTickets,
      todayPersons,
      todayRevenue,
      weekTickets,
      weekPersons,
      weekRevenue,
      monthTickets,
      monthPersons,
      monthRevenue
    };
    
    console.log('Statistics calculated:', statistics);
    
    res.json(statistics);
    
  } catch (error) {
    console.error('Error getting merchant statistics:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to get statistics' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

// Validate Treasure Hunt QR Code
router.post('/validate-treasure-hunt', authenticateMerchant, async (req, res) => {
  console.log('=== VALIDATE TREASURE HUNT QR CODE ===');
  
  const merchantId = req.merchant.merchantId;
  const { qr_data } = req.body;
  
  if (!qr_data) {
    return res.status(400).json({ error: 'QR code data is required' });
  }
  
  try {
    // Parse QR code data (should be JSON string)
    let qrData;
    try {
      qrData = typeof qr_data === 'string' ? JSON.parse(qr_data) : qr_data;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }
    
    // Verify it's a treasure hunt reward QR code
    if (qrData.type !== 'treasure_hunt_reward') {
      return res.status(400).json({ error: 'This QR code is not a treasure hunt reward' });
    }
    
    const { hunt_id, user_id, coupon_code } = qrData;
    
    if (!hunt_id || !user_id || !coupon_code) {
      return res.status(400).json({ error: 'Invalid treasure hunt QR code data' });
    }
    
    // Check if the treasure hunt progress exists and is completed
    const progress = db.prepare(`
      SELECT 
        thp.*,
        th.name as hunt_name,
        th.prize_discount_percentage,
        u.email as user_email,
        u.username as user_name
      FROM treasure_hunt_progress thp
      JOIN treasure_hunts th ON thp.treasure_hunt_id = th.id
      JOIN users u ON thp.user_id = u.id
      WHERE thp.treasure_hunt_id = ? 
        AND thp.user_id = ? 
        AND thp.prize_coupon_code = ?
        AND thp.completed_at IS NOT NULL
    `).get(hunt_id, user_id, coupon_code);
    
    if (!progress) {
      return res.status(404).json({ 
        error: 'Treasure hunt reward not found or not completed',
        details: 'This QR code may be invalid, expired, or the treasure hunt may not be completed yet'
      });
    }
    
    // Check if this reward has already been redeemed
    // We'll track redemptions in a new table or add a column to treasure_hunt_progress
    // For now, we'll just return the reward info
    
    // Create validation record (optional - for tracking)
    const validationId = 'th-reward-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    try {
      // Try to insert into a redemption tracking table (create if doesn't exist)
      db.prepare(`
        CREATE TABLE IF NOT EXISTS treasure_hunt_redemptions (
          id TEXT PRIMARY KEY,
          treasure_hunt_id INTEGER,
          user_id INTEGER,
          coupon_code TEXT,
          merchant_id TEXT,
          redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (treasure_hunt_id) REFERENCES treasure_hunts(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (merchant_id) REFERENCES merchants(id)
        )
      `).run();
      
      // Check if already redeemed
      const existingRedemption = db.prepare(`
        SELECT * FROM treasure_hunt_redemptions 
        WHERE treasure_hunt_id = ? AND user_id = ? AND coupon_code = ?
      `).get(hunt_id, user_id, coupon_code);
      
      if (existingRedemption) {
        return res.json({
          message: 'Treasure hunt reward already redeemed',
          reward: {
            hunt_name: progress.hunt_name,
            user_name: progress.user_name || progress.user_email,
            user_email: progress.user_email,
            coupon_code: coupon_code,
            discount_percentage: progress.prize_discount_percentage,
            completed_at: progress.completed_at,
            redeemed_at: existingRedemption.redeemed_at,
            redeemed_by: 'Previous merchant',
            already_redeemed: true
          }
        });
      }
      
      // Record redemption
      console.log('Recording redemption:', { validationId, hunt_id, user_id, coupon_code, merchantId });
      db.prepare(`
        INSERT INTO treasure_hunt_redemptions 
        (id, treasure_hunt_id, user_id, coupon_code, merchant_id, redeemed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(validationId, hunt_id, user_id, coupon_code, merchantId);
      console.log('Redemption recorded successfully');
    } catch (redemptionError) {
      console.error('Could not track redemption:', redemptionError);
      // Continue anyway - redemption tracking is optional
    }
    
    res.json({
      message: 'Treasure hunt reward validated successfully',
      reward: {
        hunt_name: progress.hunt_name,
        user_name: progress.user_name || progress.user_email,
        user_email: progress.user_email,
        coupon_code: coupon_code,
        discount_percentage: progress.prize_discount_percentage,
        completed_at: progress.completed_at,
        redeemed_at: new Date().toISOString(),
        redeemed_by: req.merchant.name || 'Merchant',
        already_redeemed: false
      }
    });
    
  } catch (error) {
    console.error('Error validating treasure hunt reward:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to validate treasure hunt reward' 
      : error.message;
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;
