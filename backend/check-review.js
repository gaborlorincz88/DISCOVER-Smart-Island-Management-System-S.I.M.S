const db = require('./database');

console.log('Checking recent reviews...');

const reviews = db.prepare('SELECT place_id, comment, created_at, typeof(place_id) as type FROM reviews ORDER BY created_at DESC LIMIT 5').all();
console.log('Recent reviews:');
reviews.forEach(review => {
  console.log(`Place ID: ${review.place_id} (${review.type}), Comment: "${review.comment}", Created: ${review.created_at}`);
});

// Check if there's a place with the name "Mixta Cave"
const places = db.prepare("SELECT id, name FROM places WHERE name LIKE '%Mixta%' OR name LIKE '%Ramla%'").all();
console.log('\nPlaces matching Mixta/Ramla:');
places.forEach(place => {
  console.log(`ID: ${place.id}, Name: ${place.name}`);
});
