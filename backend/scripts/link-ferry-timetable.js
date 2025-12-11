/**
 * Helper script to link the Gozo Channel ferry timetable to a ferry terminal place
 * 
 * Usage: node scripts/link-ferry-timetable.js [placeId]
 * 
 * If placeId is not provided, it will search for ferry terminals and let you choose.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use the same database path as database.js
const dbPath = path.resolve(__dirname, '..', 'discover_gozo.db');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database file not found at: ${dbPath}`);
  console.error('Please ensure the database file exists.');
  process.exit(1);
}

console.log(`📊 Using database: ${dbPath}`);
const db = new Database(dbPath);

const placeTimetablesPath = path.join(__dirname, '..', 'place-timetables');
const timetableFileName = 'gozochannel.json'; // The file we want to link

// Ensure directory exists
if (!fs.existsSync(placeTimetablesPath)) {
  fs.mkdirSync(placeTimetablesPath, { recursive: true });
  console.log('✅ Created place-timetables directory');
}

// Check if timetable file exists in place-timetables
const timetableFilePath = path.join(placeTimetablesPath, timetableFileName);
if (!fs.existsSync(timetableFilePath)) {
  // Try to copy from backend directory
  const sourcePath = path.join(__dirname, '..', timetableFileName);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, timetableFilePath);
    console.log(`✅ Copied ${timetableFileName} to place-timetables directory`);
  } else {
    console.error(`❌ Timetable file not found at ${sourcePath}`);
    console.error('Please ensure gozochannel.json exists in the backend directory');
    process.exit(1);
  }
}

const placeId = process.argv[2];

if (placeId) {
  // Link to specific place
  linkTimetableToPlace(placeId, timetableFileName);
} else {
  // Search for ferry terminals
  console.log('🔍 Searching for ferry terminal places...\n');
  
  const stmt = db.prepare(`
    SELECT id, name, category, coordinates 
    FROM places 
    WHERE category = 'Ferry Terminal' 
       OR name LIKE '%ferry%' 
       OR name LIKE '%Mgarr%' 
       OR name LIKE '%Cirkewwa%'
       OR name LIKE '%Gozo Channel%'
    ORDER BY name
  `);
  
  const places = stmt.all();
  
  if (places.length === 0) {
    console.log('❌ No ferry terminal places found in database.');
    console.log('\n💡 You can create a ferry terminal place through the admin interface,');
    console.log('   then run this script again with the place ID:');
    console.log(`   node scripts/link-ferry-timetable.js <placeId>\n`);
    process.exit(1);
  }
  
  console.log('Found the following ferry terminal places:\n');
  places.forEach((place, index) => {
    const coords = place.coordinates ? JSON.parse(place.coordinates) : {};
    console.log(`${index + 1}. ${place.name} (ID: ${place.id})`);
    console.log(`   Category: ${place.category}`);
    console.log(`   Coordinates: ${coords.lat || 'N/A'}, ${coords.lng || 'N/A'}`);
    console.log(`   Current timetable_file: ${place.timetable_file || 'None'}\n`);
  });
  
  if (places.length === 1) {
    console.log('✅ Only one ferry terminal found. Linking timetable automatically...\n');
    linkTimetableToPlace(places[0].id, timetableFileName);
  } else {
    console.log('💡 To link the timetable to a specific place, run:');
    console.log(`   node scripts/link-ferry-timetable.js <placeId>\n`);
    console.log('   For example:');
    console.log(`   node scripts/link-ferry-timetable.js ${places[0].id}\n`);
  }
}

function linkTimetableToPlace(placeId, filename) {
  try {
    // Verify place exists
    const placeStmt = db.prepare('SELECT * FROM places WHERE id = ?');
    const place = placeStmt.get(placeId);
    
    if (!place) {
      console.error(`❌ Place with ID ${placeId} not found in database.`);
      process.exit(1);
    }
    
    console.log(`\n📋 Linking timetable to place: ${place.name} (ID: ${placeId})`);
    
    // Update place with timetable filename
    const updateStmt = db.prepare('UPDATE places SET timetable_file = ? WHERE id = ?');
    const result = updateStmt.run(filename, placeId);
    
    if (result.changes > 0) {
      console.log('✅ Successfully linked timetable to place!');
      console.log(`   Timetable file: ${filename}`);
      console.log(`   Place: ${place.name}`);
      console.log(`\n🚀 The timetable should now appear in the frontend when viewing this place.`);
      console.log(`   API endpoint: /api/places/${placeId}/timetable\n`);
    } else {
      console.error('❌ Failed to update place. No rows were changed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error linking timetable:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

