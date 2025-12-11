// One-time script to remove email UNIQUE constraint
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'discover_gozo.db');
const db = new Database(dbPath);

console.log('🔧 Starting email constraint fix...');

try {
  // Drop any leftover temp tables
  console.log('Cleaning up any leftover temp tables...');
  try {
    db.exec('DROP TABLE IF EXISTS users_temp');
    db.exec('DROP TABLE IF EXISTS users_new');
    console.log('✅ Cleaned up temp tables');
  } catch (e) {
    console.log('No temp tables to clean');
  }

  // Disable foreign keys
  db.prepare('PRAGMA foreign_keys = OFF').run();
  console.log('✅ Foreign keys disabled');

  // Get all existing users
  const existingUsers = db.prepare('SELECT * FROM users').all();
  console.log(`✅ Found ${existingUsers.length} existing users`);

  // Create new table without UNIQUE on email
  db.exec(`
    CREATE TABLE users_new (
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
  console.log('✅ Created new users table without email UNIQUE constraint');

  // Copy all data
  const insertStmt = db.prepare(`
    INSERT INTO users_new (id, email, username, password_hash, location, role, created_at, last_login, updated_at)
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
  console.log(`✅ Copied ${existingUsers.length} users to new table`);

  // Replace old table
  db.exec('DROP TABLE users');
  db.exec('ALTER TABLE users_new RENAME TO users');
  console.log('✅ Replaced old table with new one');

  // Re-enable foreign keys
  db.prepare('PRAGMA foreign_keys = ON').run();
  console.log('✅ Foreign keys re-enabled');

  // Verify the change
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  console.log('\n✅ NEW TABLE SCHEMA:');
  console.log(tableInfo.sql);

  if (!tableInfo.sql.includes('email TEXT UNIQUE')) {
    console.log('\n🎉 SUCCESS! Email UNIQUE constraint removed!');
    console.log('You can now create users with duplicate emails from the admin UI.');
  } else {
    console.log('\n❌ WARNING: UNIQUE constraint still present!');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
} finally {
  db.close();
  console.log('\n✅ Database connection closed');
}

