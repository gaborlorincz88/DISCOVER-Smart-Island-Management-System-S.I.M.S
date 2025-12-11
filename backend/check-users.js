const db = require('./database');

try {
  console.log('=== CHECKING CURRENT USERS ===');
  const users = db.prepare('SELECT * FROM users').all();
  
  if (users.length === 0) {
    console.log('No users found in database');
  } else {
    console.log(`Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Password Hash: ${user.password_hash ? 'SET (' + user.password_hash.substring(0, 20) + '...)' : 'NOT SET'}`);
      console.log(`  Created: ${user.created_at}`);
      console.log(`  Last Login: ${user.last_login || 'Never'}`);
    });
  }
  
  // Also check trips
  console.log('\n=== CHECKING TRIPS ===');
  const trips = db.prepare('SELECT user_id, COUNT(*) as count FROM trips GROUP BY user_id').all();
  console.log(`Found ${trips.length} user IDs with trips:`);
  trips.forEach(trip => {
    console.log(`  User ID: ${trip.user_id} - ${trip.count} trips`);
  });
  
} catch (error) {
  console.error('Error:', error.message);
}
