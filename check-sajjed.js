const db = require('./backend/database');

const stmt = db.prepare('SELECT * FROM places WHERE name LIKE "%Sajj%"');
const results = stmt.all();

console.log('Found Sajj stops in database:');
console.log(JSON.stringify(results, null, 2));

// Also check for any stops with "Sajjed" (one j)
const stmt2 = db.prepare('SELECT * FROM places WHERE name LIKE "%Sajjed%"');
const results2 = stmt2.all();

console.log('\nFound Sajjed stops in database:');
console.log(JSON.stringify(results2, null, 2));





