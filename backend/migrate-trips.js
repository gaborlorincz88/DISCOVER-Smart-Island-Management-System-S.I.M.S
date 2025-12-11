const db = require('./database');

console.log('=== TRIP MIGRATION SCRIPT ===');
console.log('This script will help you migrate trips from old user IDs to a new user account.');

// Get all trips in the database
const allTrips = db.prepare('SELECT * FROM trips').all();
console.log(`\nFound ${allTrips.length} trips in the database:`);

allTrips.forEach((trip, index) => {
  console.log(`${index + 1}. Trip: "${trip.name}" (ID: ${trip.id}) - User: ${trip.user_id}`);
});

// Get all user IDs that have trips
const userIdsWithTrips = [...new Set(allTrips.map(trip => trip.user_id))];
console.log(`\nUser IDs with trips: ${userIdsWithTrips.join(', ')}`);

// Check if users table exists and has users
try {
  const usersExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  
  if (usersExist) {
    const users = db.prepare('SELECT * FROM users').all();
    console.log(`\nFound ${users.length} users in the users table:`);
    users.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    });
  } else {
    console.log('\nUsers table does not exist yet. It will be created when you restart the server.');
  }
} catch (error) {
  console.log('\nCould not check users table:', error.message);
}

console.log('\n=== MIGRATION INSTRUCTIONS ===');
console.log('1. Restart your server to create the new users table');
console.log('2. Register a new account with your email address');
console.log('3. Use the Users Management page in the admin panel to migrate your trips');
console.log('4. Or use the migration API endpoint: POST /api/admin/migrate-trips');

console.log('\n=== API ENDPOINTS ===');
console.log('POST /api/auth/register - Register new user');
console.log('POST /api/auth/login - Login user');
console.log('GET /api/admin/users - View all users (admin)');
console.log('POST /api/admin/migrate-trips - Migrate trips between users');

console.log('\n=== ADMIN PANEL ===');
console.log('Access the Users Management page at: http://localhost:3003/users.html');

console.log('\nMigration script completed.');
