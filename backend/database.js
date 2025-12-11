/**
 * © 2025 Lőrincz Gábor – All Rights Reserved
 * Unauthorized copying or use is strictly prohibited.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Use an absolute path for the database file
const dbPath = path.resolve(__dirname, 'discover_gozo.db');
console.log('=== DATABASE SETUP ===');
console.log('Database path:', dbPath);
console.log('Database file exists:', fs.existsSync(dbPath));
console.log('Database file size:', fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 'N/A');

const db = new Database(dbPath); // Removed verbose logging for cleaner startup

function setupDatabase() {
  console.log('Setting up database...');

  // 1. Create the places table
  const createPlacesTable = `
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      image_urls TEXT,
      category TEXT,
      ai_generated_description TEXT,
      sources TEXT,
      website TEXT,
      icon TEXT,
      icon_size INTEGER DEFAULT 64,
      coordinates TEXT,
      gallery_images TEXT,
      short_description TEXT,
      distance REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 2. Create the events table
  const createEventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      location TEXT,
      image_url TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 3. Create the tours table
  const createToursTable = `
    CREATE TABLE IF NOT EXISTS tours (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      icon TEXT,
      icon_size INTEGER DEFAULT 32,
      polyline_color TEXT,
      main_image TEXT,
      coordinates TEXT,
      points TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 4. Create the analytics table
  const createAnalyticsTable = `
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      event_data TEXT,
      user_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT
    );
  `;

  // 5. Create the trips table
  const createTripsTable = `
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      places TEXT NOT NULL, -- JSON array of places
      route_info TEXT, -- JSON object of route information
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 6. Create the users table
  // Note: Email is NOT UNIQUE to allow admin UI to create test accounts with same email
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      location TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 7. Create the tickets table
  const createTicketsTable = `
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      duration_hours INTEGER,
      max_participants INTEGER,
      main_image TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 8. Create the reservations table
  const createReservationsTable = `
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      tour_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      status TEXT DEFAULT 'pending',
      reservation_date DATE NOT NULL,
      reservation_time TIME,
      special_requests TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
  `;

  // 8. Create the reviews table
  const createReviewsTable = `
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      place_id TEXT, -- Changed to TEXT to support virtual bus stop IDs
      tour_id TEXT, -- Changed to TEXT to support string tour IDs like "green-bus"
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      title TEXT,
      comment TEXT,
      is_approved BOOLEAN DEFAULT 1,
      is_visible BOOLEAN DEFAULT 1,
      politeness_score INTEGER,
      moderation_reasons TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      -- Removed FOREIGN KEY constraint on tour_id since it can be string IDs from JSON files
      CONSTRAINT check_place_or_tour CHECK (
        (place_id IS NOT NULL AND tour_id IS NULL) OR 
        (place_id IS NULL AND tour_id IS NOT NULL)
      )
    );
  `;

  // Execute table creation
  db.exec(createPlacesTable);
  db.exec(createEventsTable);
  db.exec(createToursTable);
  db.exec(createAnalyticsTable);
  db.exec(createTicketsTable);
  db.exec(createReservationsTable);
  db.exec(createReviewsTable);

  // Add politeness filter columns to reviews table if they don't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reviews)").all();
    const hasPolitenessScore = tableInfo.some(col => col.name === 'politeness_score');
    const hasModerationReasons = tableInfo.some(col => col.name === 'moderation_reasons');

    if (!hasPolitenessScore) {
      console.log('Adding politeness_score column to reviews table...');
      db.exec('ALTER TABLE reviews ADD COLUMN politeness_score INTEGER DEFAULT 100');
    }

    if (!hasModerationReasons) {
      console.log('Adding moderation_reasons column to reviews table...');
      db.exec('ALTER TABLE reviews ADD COLUMN moderation_reasons TEXT');
    }
  } catch (error) {
    console.error('Error adding politeness filter columns to reviews table:', error);
  }

  // Migrate tour_id from INTEGER to TEXT to support string tour IDs like "green-bus"
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reviews)").all();
    const tourIdColumn = tableInfo.find(col => col.name === 'tour_id');
    if (tourIdColumn && tourIdColumn.type.toUpperCase() === 'INTEGER') {
      console.log('Migrating tour_id column from INTEGER to TEXT to support string tour IDs...');
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      // First, create a backup of existing data
      db.exec(`
        CREATE TABLE IF NOT EXISTS reviews_backup AS SELECT * FROM reviews;
      `);

      // Drop the old table
      db.exec('DROP TABLE IF EXISTS reviews;');

      // Recreate with TEXT tour_id
      db.exec(`
        CREATE TABLE reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          place_id TEXT,
          tour_id TEXT,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          title TEXT,
          comment TEXT,
          is_approved BOOLEAN DEFAULT 1,
          is_visible BOOLEAN DEFAULT 1,
          politeness_score INTEGER,
          moderation_reasons TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT check_place_or_tour CHECK (
            (place_id IS NOT NULL AND tour_id IS NULL) OR 
            (place_id IS NULL AND tour_id IS NOT NULL)
          )
        );
      `);

      // Copy data back, converting tour_id to TEXT
      db.exec(`
        INSERT INTO reviews 
        SELECT 
          id, user_id, place_id, 
          CASE WHEN tour_id IS NOT NULL THEN CAST(tour_id AS TEXT) ELSE NULL END as tour_id,
          rating, title, comment, is_approved, is_visible, 
          politeness_score, moderation_reasons, created_at, updated_at
        FROM reviews_backup;
      `);

      // Drop backup table
      db.exec('DROP TABLE IF EXISTS reviews_backup;');

      // Recreate indexes
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible)');

      // Recreate review_stats view
      db.exec(`
        DROP VIEW IF EXISTS review_stats;
        CREATE VIEW review_stats AS
        SELECT 
          COALESCE(p.name, t.name) as item_name,
          COALESCE(p.category, t.category) as item_category,
          CASE 
            WHEN p.id IS NOT NULL THEN 'place'
            WHEN t.id IS NOT NULL THEN 'tour'
            ELSE 'tour' -- For string tour IDs not in database, default to 'tour'
          END as item_type,
          COALESCE(r.place_id, r.tour_id) as item_id,
          COUNT(*) as total_reviews,
          AVG(r.rating) as average_rating,
          COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
          COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
          COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
          COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
          COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count,
          COUNT(CASE WHEN r.is_approved = 1 THEN 1 END) as approved_reviews,
          COUNT(CASE WHEN r.is_approved = 0 THEN 1 END) as pending_reviews,
          MAX(r.created_at) as last_review_date
        FROM reviews r
        LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
        LEFT JOIN tours t ON CAST(r.tour_id AS TEXT) = CAST(t.id AS TEXT) AND r.tour_id IS NOT NULL
        WHERE r.is_visible = 1
        GROUP BY COALESCE(r.place_id, r.tour_id), COALESCE(p.name, t.name), COALESCE(p.category, t.category);
      `);

      console.log('✅ Successfully migrated tour_id column to TEXT and recreated indexes/view');
    }
  } catch (error) {
    console.error('Error migrating tour_id column:', error);
    // If migration fails, try to restore from backup
    try {
      const backupExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reviews_backup'").get();
      if (backupExists) {
        console.log('Attempting to restore from backup...');
        db.exec('DROP TABLE IF EXISTS reviews;');
        db.exec('ALTER TABLE reviews_backup RENAME TO reviews;');
        console.log('Restored from backup');
      }
    } catch (restoreError) {
      console.error('Failed to restore from backup:', restoreError);
    }
  }

  // 9. Create admin_sessions table for authentication
  const createAdminSessionsTable = `
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  // 10. Create admin_activity_logs table for tracking admin actions
  const createAdminActivityLogsTable = `
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_description TEXT,
      target_type TEXT,
      target_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `;

  db.exec(createAdminSessionsTable);
  db.exec(createAdminActivityLogsTable);

  // 11. Create user_sessions table for regular user authentication
  const createUserSessionsTable = `
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;
  db.exec(createUserSessionsTable);

  // Add main_image column to existing tickets table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(tickets)").all();
    const hasMainImage = tableInfo.some(col => col.name === 'main_image');

    if (!hasMainImage) {
      console.log('Adding main_image column to tickets table...');
      db.exec('ALTER TABLE tickets ADD COLUMN main_image TEXT');
    }
  } catch (error) {
    console.error('Error adding main_image column to tickets table:', error);
  }

  // Add category column to existing events table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(events)").all();
    const hasCategory = tableInfo.some(col => col.name === 'category');

    if (!hasCategory) {
      console.log('Adding category column to events table...');
      db.exec('ALTER TABLE events ADD COLUMN category TEXT');
    }
  } catch (error) {
    console.error('Error adding category column to events table:', error);
  }

  // Add tour_name column to existing reservations table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reservations)").all();
    const hasTourName = tableInfo.some(col => col.name === 'tour_name');

    if (!hasTourName) {
      console.log('Adding tour_name column to reservations table...');
      db.exec('ALTER TABLE reservations ADD COLUMN tour_name TEXT');
    }
  } catch (error) {
    console.error('Error adding tour_name column to reservations table:', error);
  }

  // Check if trips table exists and has correct schema
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trips'").get();

    if (tableExists) {
      // Table exists, check if schema is correct
      const tableInfo = db.prepare("PRAGMA table_info(trips)").all();
      const idColumn = tableInfo.find(col => col.name === 'id');

      if (idColumn && idColumn.type === 'TEXT') {
        console.log('Trips table exists with correct schema, keeping existing data.');
      } else {
        console.log('Trips table exists but has wrong schema, recreating...');
        db.exec('DROP TABLE IF EXISTS trips');
        db.exec(createTripsTable);
        console.log('Trips table recreated with correct schema.');
      }
    } else {
      // Table doesn't exist, create it
      console.log('Trips table does not exist, creating with correct schema.');
      db.exec(createTripsTable);
    }
  } catch (error) {
    console.error('Error checking trips table schema:', error);
    // Fallback: create table if there's an error
    db.exec(createTripsTable);
    console.log('Trips table created with fallback method.');
  }

  // Check if users table exists and has correct schema
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();

    if (tableExists) {
      // Table exists, check if schema is correct
      const tableInfo = db.prepare("PRAGMA table_info(users)").all();
      const idColumn = tableInfo.find(col => col.name === 'id');

      if (idColumn && idColumn.type === 'TEXT') {
        console.log('Users table exists with correct schema, keeping existing data.');

        // Check for missing columns and add them if needed
        const columnNames = tableInfo.map(col => col.name);

        if (!columnNames.includes('last_login')) {
          console.log('Adding missing last_login column to users table...');
          db.exec('ALTER TABLE users ADD COLUMN last_login DATETIME');
        }

        if (!columnNames.includes('updated_at')) {
          console.log('Adding missing updated_at column to users table...');
          // SQLite doesn't support DEFAULT in ALTER TABLE, so we'll add it without default
          db.exec('ALTER TABLE users ADD COLUMN updated_at DATETIME');
          // Then update existing rows to have a value
          db.exec('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL');
        }

        if (!columnNames.includes('created_at')) {
          console.log('Adding missing created_at column to users table...');
          // SQLite doesn't support DEFAULT in ALTER TABLE, so we'll add it without default
          db.exec('ALTER TABLE users ADD COLUMN created_at DATETIME');
          // Then update existing rows to have a value
          db.exec('UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL');
        }

        if (!columnNames.includes('role')) {
          console.log('Adding missing role column to users table...');
          // SQLite doesn't support DEFAULT in ALTER TABLE, so we'll add it without default
          db.exec('ALTER TABLE users ADD COLUMN role TEXT');
          // Then update existing rows to have a value
          db.exec('UPDATE users SET role = "user" WHERE role IS NULL');
        }

        if (!columnNames.includes('password_hash')) {
          console.log('Adding missing password_hash column to users table...');
          db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
        }

        // Update existing users with default values for new columns
        try {
          const existingUsers = db.prepare('SELECT id FROM users').all();
          if (existingUsers.length > 0) {
            console.log(`Updating ${existingUsers.length} existing users with default values...`);

            // Update users without created_at
            db.exec('UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL');

            // Update users without updated_at
            db.exec('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL');

            // Update users without role
            db.exec('UPDATE users SET role = \'user\' WHERE role IS NULL');

            console.log('Existing users updated with default values.');
          }
        } catch (updateError) {
          console.error('Error updating existing users:', updateError);
        }

        // Create default admin user if none exists
        try {
          const adminUsers = db.prepare('SELECT id FROM users WHERE role = \'admin\'').all();
          if (adminUsers.length === 0) {
            console.log('No admin users found, creating default admin...');
            const adminId = `admin-${Date.now()}`;
            const adminPasswordHash = crypto.createHash('sha256').update('admin123').digest('hex');

            db.prepare(`
              INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at) 
              VALUES (?, ?, ?, ?, \'admin\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(adminId, 'admin@discovergozo.com', 'admin', adminPasswordHash);

            console.log('Default admin user created: admin@discovergozo.com / admin123');
          }
        } catch (adminError) {
          console.error('Error creating default admin:', adminError);
        }

        // Create sample tickets if none exist
        try {
          const existingTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
          if (existingTickets.count === 0) {
            console.log('No tickets found, creating sample tickets...');

            const sampleTickets = [
              {
                id: 'ticket-1',
                name: 'Gozo Bus Tour',
                description: 'Comprehensive bus tour of Gozo\'s main attractions',
                category: 'sightseeing',
                price: 25.00,
                currency: 'EUR',
                duration_hours: 4,
                max_participants: 50,
                main_image: '/uploads/bus-tour.jpg'
              },
              {
                id: 'ticket-2',
                name: 'Comino Boat Trip',
                description: 'Boat trip to Comino Island with Blue Lagoon visit',
                category: 'boat',
                price: 35.00,
                currency: 'EUR',
                duration_hours: 6,
                max_participants: 30,
                main_image: '/uploads/comino-boat.jpg'
              },
              {
                id: 'ticket-3',
                name: 'Hiking Trail Guide',
                description: 'Guided hiking tour of Gozo\'s scenic trails',
                category: 'hiking',
                price: 20.00,
                currency: 'EUR',
                duration_hours: 3,
                max_participants: 15,
                main_image: '/uploads/hiking-trail.jpg'
              },
              {
                id: 'ticket-4',
                name: 'Quad Bike Adventure',
                description: 'Self-guided quad bike tour of Gozo',
                category: 'adventure',
                price: 45.00,
                currency: 'EUR',
                duration_hours: 2,
                max_participants: 8,
                main_image: '/uploads/quad-bike.jpg'
              }
            ];

            const insertTicket = db.prepare(`
              INSERT INTO tickets (id, name, description, category, price, currency, duration_hours, max_participants, main_image, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);

            sampleTickets.forEach(ticket => {
              insertTicket.run(
                ticket.id,
                ticket.name,
                ticket.description,
                ticket.category,
                ticket.price,
                ticket.currency,
                ticket.duration_hours,
                ticket.max_participants,
                ticket.main_image,
                1
              );
            });

            console.log(`Created ${sampleTickets.length} sample tickets`);
          } else {
            // Update existing tickets with images if they don't have them
            console.log('Updating existing tickets with images...');
            const updateTicketImage = db.prepare('UPDATE tickets SET main_image = ? WHERE id = ?');

            const ticketImages = {
              'ticket-1': '/uploads/bus-tour.jpg',
              'ticket-2': '/uploads/comino-boat.jpg',
              'ticket-3': '/uploads/hiking-trail.jpg',
              'ticket-4': '/uploads/quad-bike.jpg'
            };

            Object.entries(ticketImages).forEach(([ticketId, imagePath]) => {
              updateTicketImage.run(imagePath, ticketId);
            });

            console.log('Updated existing tickets with images');
          }
        } catch (ticketError) {
          console.error('Error creating sample tickets:', ticketError);
        }

        // Create user account for existing trips if needed
        try {
          const existingTrips = db.prepare('SELECT DISTINCT user_id FROM trips').all();
          if (existingTrips.length > 0) {
            console.log('Found existing trips, checking for orphaned trips...');

            // Find all user IDs that have trips but no corresponding user account
            const orphanedUserIds = existingTrips
              .map(t => t.user_id)
              .filter(tripUserId => {
                const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(tripUserId);
                return !userExists;
              });

            if (orphanedUserIds.length > 0) {
              console.log(`Found ${orphanedUserIds.length} orphaned user IDs with trips:`, orphanedUserIds);
              console.log('These trips will need to be manually migrated using the admin panel.');
              console.log('Admin users can use the Users Management page to migrate trips between accounts.');
            }
          }
        } catch (userError) {
          console.error('Error checking orphaned trips:', userError);
        }

        // Remove the automatic migration - this should be done manually by admins
        // to ensure proper user consent and data integrity

      } else {
        console.log('Users table exists but has wrong schema, recreating...');
        db.exec('DROP TABLE IF EXISTS users');
        db.exec(createUsersTable);
        console.log('Users table recreated with correct schema.');
      }
    } else {
      // Table doesn't exist, create it
      console.log('Users table does not exist, creating with correct schema.');
      db.exec(createUsersTable);
    }
  } catch (error) {
    console.error('Error checking users table schema:', error);
    // Fallback: create table if there's an error
    db.exec(createUsersTable);
    console.log('Users table created with fallback method.');
  }

  // Create merchants table
  const createMerchantsTable = `
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      business_name TEXT,
      location TEXT,
      assigned_tours TEXT, -- JSON array of tour IDs this merchant can validate
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Create ticket validations table
  const createTicketValidationsTable = `
    CREATE TABLE IF NOT EXISTS ticket_validations (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      reservation_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      validation_type TEXT DEFAULT 'scan',
      status TEXT DEFAULT 'validated',
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );
  `;

  // Add validation status to reservations table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reservations)").all();
    const hasValidationStatus = tableInfo.some(col => col.name === 'validation_status');

    if (!hasValidationStatus) {
      console.log('Adding validation_status column to reservations table...');
      db.exec('ALTER TABLE reservations ADD COLUMN validation_status TEXT DEFAULT "pending"');
    }
  } catch (error) {
    console.error('Error adding validation_status column to reservations table:', error);
  }

  // Add customer_name column to reservations table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reservations)").all();
    const hasCustomerName = tableInfo.some(col => col.name === 'customer_name');

    if (!hasCustomerName) {
      console.log('Adding customer_name column to reservations table...');
      db.exec('ALTER TABLE reservations ADD COLUMN customer_name TEXT');
    }
  } catch (error) {
    console.error('Error adding customer_name column to reservations table:', error);
  }

  // Create the new tables
  try {
    db.exec(createMerchantsTable);
    console.log('Merchants table created/verified');

    // Add assigned_tours column to existing merchants table if it doesn't exist
    try {
      const tableInfo = db.prepare("PRAGMA table_info(merchants)").all();
      const hasAssignedTours = tableInfo.some(col => col.name === 'assigned_tours');

      if (!hasAssignedTours) {
        console.log('Adding assigned_tours column to merchants table...');
        db.prepare('ALTER TABLE merchants ADD COLUMN assigned_tours TEXT').run();
        console.log('assigned_tours column added to merchants table');
      }
    } catch (error) {
      console.error('Error adding assigned_tours column:', error);
    }

    db.exec(createTicketValidationsTable);
    console.log('Ticket validations table created/verified');

    // Create sample merchant for testing
    const existingMerchant = db.prepare('SELECT id FROM merchants WHERE email = ?').get('merchant@discovergozo.com');
    if (!existingMerchant) {
      const merchantId = 'merchant-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const passwordHash = crypto.createHash('sha256').update('merchant123').digest('hex');

      db.prepare(`
        INSERT INTO merchants (id, name, email, password_hash, business_name, location, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        merchantId,
        'Test Merchant',
        'merchant@discovergozo.com',
        passwordHash,
        'Discover Gozo Tours',
        'Victoria, Gozo',
        1
      );
      console.log('Sample merchant created');
    }

  } catch (error) {
    console.error('Error creating merchant/ticket validation tables:', error);
  }

  // Migrate existing users table to add username and location columns
  try {
    // Check if username column exists
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasUsername = columns.some(col => col.name === 'username');
    const hasLocation = columns.some(col => col.name === 'location');

    if (!hasUsername || !hasLocation) {
      console.log('Migrating users table to add username and location columns...');

      // Create new users table with all columns
      const createNewUsersTable = `
        CREATE TABLE IF NOT EXISTS users_new (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          location TEXT,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      db.exec(createNewUsersTable);

      // Copy existing data to new table
      const existingUsers = db.prepare('SELECT * FROM users').all();
      const usedUsernames = new Set();

      existingUsers.forEach((user, index) => {
        // Generate unique username from user ID or use existing username
        let username;
        if (user.username) {
          username = user.username;
        } else if (user.id && user.id.includes('-')) {
          username = `user_${user.id.split('-')[1]}`;
        } else {
          username = `user_${Date.now()}_${index}`;
        }

        // Ensure username is unique
        let finalUsername = username;
        let counter = 1;
        while (usedUsernames.has(finalUsername)) {
          finalUsername = `${username}_${counter}`;
          counter++;
        }
        usedUsernames.add(finalUsername);

        db.prepare(`
          INSERT INTO users_new (id, email, username, password_hash, location, role, created_at, last_login, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          user.email,
          finalUsername,
          user.password_hash,
          user.location || null,
          user.role,
          user.created_at,
          user.last_login,
          user.updated_at
        );
      });

      // Replace old table with new one
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');

      console.log(`Successfully migrated ${existingUsers.length} users with username and location columns`);
    }
  } catch (error) {
    console.log('Migration completed or no migration needed:', error.message);
  }

  // Migration: Remove UNIQUE constraint from email column to allow duplicate emails in admin UI
  try {
    console.log('Checking if email UNIQUE constraint needs to be removed...');

    // Get the current schema
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();

    // Check if email still has UNIQUE constraint
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('email TEXT UNIQUE')) {
      console.log('Email has UNIQUE constraint, removing it...');

      // Disable foreign keys temporarily
      db.prepare('PRAGMA foreign_keys = OFF').run();

      // Start transaction
      db.prepare('BEGIN TRANSACTION').run();

      try {
        // Get all existing users
        const existingUsers = db.prepare('SELECT * FROM users').all();

        // Create new table without UNIQUE on email
        db.exec(`
          CREATE TABLE users_temp (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            location TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Copy all data to new table
        const insertStmt = db.prepare(`
          INSERT INTO users_temp (id, email, username, password_hash, location, role, created_at, last_login, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        existingUsers.forEach(user => {
          insertStmt.run(
            user.id,
            user.email,
            user.username,
            user.password_hash,
            user.location,
            user.role,
            user.created_at,
            user.last_login,
            user.updated_at
          );
        });

        // Replace old table
        db.exec('DROP TABLE users');
        db.exec('ALTER TABLE users_temp RENAME TO users');

        // Commit transaction
        db.prepare('COMMIT').run();

        // Re-enable foreign keys
        db.prepare('PRAGMA foreign_keys = ON').run();

        console.log('Email UNIQUE constraint removed successfully. Duplicate emails now allowed in admin UI.');
      } catch (innerError) {
        // Rollback on error
        db.prepare('ROLLBACK').run();
        db.prepare('PRAGMA foreign_keys = ON').run();
        throw innerError;
      }
    } else {
      console.log('Email UNIQUE constraint already removed or not found.');
    }
  } catch (error) {
    console.log('Email constraint migration completed or skipped:', error.message);
  }

  // Migration: Add planned_stay_duration column for tourist analytics
  try {
    console.log('Checking if planned_stay_duration column needs to be added...');
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasPlannedStay = columns.some(col => col.name === 'planned_stay_duration');

    if (!hasPlannedStay) {
      console.log('Adding planned_stay_duration column to users table...');
      db.prepare('ALTER TABLE users ADD COLUMN planned_stay_duration TEXT').run();
      console.log('✅ planned_stay_duration column added successfully');
    } else {
      console.log('planned_stay_duration column already exists');
    }
  } catch (error) {
    console.log('planned_stay_duration migration completed or skipped:', error.message);
  }

  // Create indexes for reviews table
  try {
    console.log('Creating indexes for reviews table...');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible)');
    console.log('✅ Reviews table indexes created successfully');
  } catch (error) {
    console.log('Reviews indexes creation completed or skipped:', error.message);
  }

  // Create view for review statistics
  try {
    console.log('Creating review statistics view...');
    db.exec(`
      CREATE VIEW IF NOT EXISTS review_stats AS
      SELECT 
        COALESCE(p.name, t.name, 
          CASE 
            WHEN r.tour_id IS NOT NULL THEN r.tour_id 
            WHEN r.place_id LIKE 'bus-stop-%' THEN 'Bus Stop: ' || SUBSTR(r.place_id, 10)
            WHEN r.place_id LIKE 'event-%' THEN 'Event: ' || SUBSTR(r.place_id, 7)
            ELSE r.place_id
          END
        ) as item_name,
        COALESCE(p.category, t.category,
          CASE 
            WHEN r.place_id LIKE 'bus-stop-%' THEN 'bus_stop'
            WHEN r.place_id LIKE 'event-%' THEN 'event'
            WHEN r.tour_id IS NOT NULL THEN 'tour'
            ELSE 'place'
          END
        ) as item_category,
        CASE 
          WHEN p.id IS NOT NULL THEN 'place'
          WHEN t.id IS NOT NULL THEN 'tour'
          WHEN r.tour_id IS NOT NULL THEN 'tour'
          ELSE 'place'
        END as item_type,
        COALESCE(r.place_id, r.tour_id) as item_id,
        COUNT(*) as total_reviews,
        AVG(r.rating) as average_rating,
        COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count,
        COUNT(CASE WHEN r.is_approved = 1 THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN r.is_approved = 0 THEN 1 END) as pending_reviews,
        MAX(r.created_at) as last_review_date
      FROM reviews r
      LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
      LEFT JOIN tours t ON CAST(r.tour_id AS TEXT) = CAST(t.id AS TEXT) AND r.tour_id IS NOT NULL
      WHERE r.is_visible = 1
      GROUP BY COALESCE(r.place_id, r.tour_id), COALESCE(p.name, t.name, r.tour_id), COALESCE(p.category, t.category, 'tour')
    `);
    console.log('✅ Review statistics view created successfully');
  } catch (error) {
    console.log('Review statistics view creation completed or skipped:', error.message);
  }

  // Add isDefaultIcon column to places table
  try {
    console.log('Checking if isDefaultIcon column needs to be added...');
    const placesColumns = db.prepare("PRAGMA table_info(places)").all();
    const hasIsDefaultIcon = placesColumns.some(col => col.name === 'isDefaultIcon');

    if (!hasIsDefaultIcon) {
      console.log('Adding isDefaultIcon column to places table...');
      db.prepare('ALTER TABLE places ADD COLUMN isDefaultIcon INTEGER DEFAULT 0').run();
      console.log('✅ isDefaultIcon column added successfully');
    } else {
      console.log('isDefaultIcon column already exists');
    }
  } catch (error) {
    console.log('isDefaultIcon migration completed or skipped:', error.message);
  }

  // Migration: Add AIS tracking fields to places table
  try {
    console.log('Checking if AIS tracking fields need to be added to places table...');
    const placesColumns = db.prepare("PRAGMA table_info(places)").all();
    const hasAisProvider = placesColumns.some(col => col.name === 'ais_provider');

    if (!hasAisProvider) {
      console.log('Adding AIS tracking fields to places table...');
      db.prepare('ALTER TABLE places ADD COLUMN ais_provider TEXT').run();
      db.prepare('ALTER TABLE places ADD COLUMN ais_api_key TEXT').run();
      db.prepare('ALTER TABLE places ADD COLUMN ais_mmsi TEXT').run();
      db.prepare('ALTER TABLE places ADD COLUMN is_dynamic_location INTEGER DEFAULT 0').run();
      console.log('✅ AIS tracking fields added to places table successfully');
    } else {
      console.log('AIS tracking fields already exist in places table');
    }
  } catch (error) {
    console.log('AIS fields migration for places completed or skipped:', error.message);
  }

  // Migration: Add timetable_file column to places table
  try {
    console.log('Checking if timetable_file column needs to be added to places table...');
    const placesColumns = db.prepare("PRAGMA table_info(places)").all();
    const hasTimetableFile = placesColumns.some(col => col.name === 'timetable_file');

    if (!hasTimetableFile) {
      console.log('Adding timetable_file column to places table...');
      db.prepare('ALTER TABLE places ADD COLUMN timetable_file TEXT').run();
      console.log('✅ timetable_file column added to places table successfully');
    } else {
      console.log('timetable_file column already exists in places table');
    }
  } catch (error) {
    console.log('timetable_file migration completed or skipped:', error.message);
  }

  // Migration: Add AIS tracking fields to events table
  try {
    console.log('Checking if AIS tracking fields need to be added to events table...');
    const eventsColumns = db.prepare("PRAGMA table_info(events)").all();
    const hasAisProvider = eventsColumns.some(col => col.name === 'ais_provider');

    if (!hasAisProvider) {
      console.log('Adding AIS tracking fields to events table...');
      db.prepare('ALTER TABLE events ADD COLUMN ais_provider TEXT').run();
      db.prepare('ALTER TABLE events ADD COLUMN ais_api_key TEXT').run();
      db.prepare('ALTER TABLE events ADD COLUMN ais_mmsi TEXT').run();
      db.prepare('ALTER TABLE events ADD COLUMN is_dynamic_location INTEGER DEFAULT 0').run();
      console.log('✅ AIS tracking fields added to events table successfully');
    } else {
      console.log('AIS tracking fields already exist in events table');
    }
  } catch (error) {
    console.log('AIS fields migration for events completed or skipped:', error.message);
  }

  // Create settings table for AI report configuration
  try {
    console.log('Creating settings table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Settings table created successfully');
  } catch (error) {
    console.log('Settings table creation completed or skipped:', error.message);
  }

  // Create report_metadata table
  try {
    console.log('Creating report_metadata table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS report_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        type TEXT NOT NULL,
        period TEXT,
        size INTEGER,
        generated_at DATETIME,
        email_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Report metadata table created successfully');
  } catch (error) {
    console.log('Report metadata table creation completed or skipped:', error.message);
  }

  // Create treasure_hunts table
  try {
    console.log('Creating treasure_hunts table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS treasure_hunts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        is_active INTEGER DEFAULT 1,
        prize_discount_percentage INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Treasure hunts table created successfully');
  } catch (error) {
    console.log('Treasure hunts table creation completed or skipped:', error.message);
  }

  // Create treasure_hunt_clues table
  try {
    console.log('Creating treasure_hunt_clues table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS treasure_hunt_clues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treasure_hunt_id INTEGER NOT NULL,
        clue_number INTEGER NOT NULL,
        title TEXT,
        clue_text TEXT NOT NULL,
        answer TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        icon TEXT,
        hint TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (treasure_hunt_id) REFERENCES treasure_hunts(id) ON DELETE CASCADE,
        UNIQUE(treasure_hunt_id, clue_number)
      )
    `);
    console.log('✅ Treasure hunt clues table created successfully');
  } catch (error) {
    console.log('Treasure hunt clues table creation completed or skipped:', error.message);
  }

  // Create treasure_hunt_progress table
  try {
    console.log('Creating treasure_hunt_progress table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS treasure_hunt_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        treasure_hunt_id INTEGER NOT NULL,
        current_clue_number INTEGER DEFAULT 1,
        completed_clues TEXT DEFAULT '[]',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        prize_coupon_code TEXT,
        prize_qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (treasure_hunt_id) REFERENCES treasure_hunts(id) ON DELETE CASCADE,
        UNIQUE(user_id, treasure_hunt_id)
      )
    `);
    console.log('✅ Treasure hunt progress table created successfully');
  } catch (error) {
    console.log('Treasure hunt progress table creation completed or skipped:', error.message);
  }

  // Create treasure_hunt_activity table for tracking user activity
  try {
    console.log('Creating treasure_hunt_activity table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS treasure_hunt_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        treasure_hunt_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        activity_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (treasure_hunt_id) REFERENCES treasure_hunts(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Treasure hunt activity table created successfully');
  } catch (error) {
    console.log('Treasure hunt activity table creation completed or skipped:', error.message);
  }

  // Create indexes for performance
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_clues_hunt_id ON treasure_hunt_clues(treasure_hunt_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_clues_clue_number ON treasure_hunt_clues(clue_number)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_progress_user_id ON treasure_hunt_progress(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_progress_hunt_id ON treasure_hunt_progress(treasure_hunt_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_activity_user_id ON treasure_hunt_activity(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_activity_hunt_id ON treasure_hunt_activity(treasure_hunt_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_treasure_hunt_activity_created_at ON treasure_hunt_activity(created_at)');
    console.log('✅ Treasure hunt indexes created successfully');
  } catch (error) {
    console.log('Treasure hunt indexes creation completed or skipped:', error.message);
  }

  console.log('Database setup is complete and up-to-date.');
}

// Run setup only if the database is new or needs changes.
try {
  setupDatabase();
} catch (err) {
  console.error("Database setup failed:", err);
}


module.exports = db;
