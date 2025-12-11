/**
 * Script to clear icons from specific treasure hunts
 * Usage: node clear-treasure-hunt-icons.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'discover_gozo.db');
const db = new Database(dbPath);

console.log('=== Clearing Treasure Hunt Icons ===\n');
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));
console.log('');

try {
  // Get all hunts
  const allHunts = db.prepare('SELECT id, name, icon FROM treasure_hunts ORDER BY id').all();
  console.log(`Total hunts in database: ${allHunts.length}\n`);
  
  if (allHunts.length === 0) {
    console.log('No hunts found in database. Make sure you are running this on the correct server.');
    db.close();
    process.exit(0);
  }
  
  // Show all hunts
  console.log('All hunts:');
  allHunts.forEach(hunt => {
    const iconInfo = hunt.icon 
      ? (hunt.icon.startsWith('data:image') 
          ? `base64 (${hunt.icon.length} chars)` 
          : hunt.icon)
      : 'null';
    console.log(`  ${hunt.id}: "${hunt.name}" - Icon: ${iconInfo}`);
  });
  console.log('');
  
  // Find hunts matching the names
  const targetNames = [
    'Gozos hidden treasure',
    'Dawn of the nights',
    'Gozo',
    'Dawn'
  ];
  
  const huntsToFix = allHunts.filter(hunt => 
    targetNames.some(name => hunt.name.toLowerCase().includes(name.toLowerCase()))
  );
  
  if (huntsToFix.length === 0) {
    console.log('No hunts found matching the target names.');
    console.log('Please check the hunt names above and update the script if needed.');
    db.close();
    process.exit(0);
  }
  
  console.log(`\nFound ${huntsToFix.length} hunt(s) to fix:\n`);
  
  let fixedCount = 0;
  
  for (const hunt of huntsToFix) {
    console.log(`Processing: "${hunt.name}" (ID: ${hunt.id})`);
    
    if (!hunt.icon) {
      console.log('  -> No icon to remove\n');
      continue;
    }
    
    // Handle base64 data URLs
    if (hunt.icon.startsWith('data:image')) {
      console.log(`  -> Removing base64 icon (${hunt.icon.length} characters)`);
      db.prepare('UPDATE treasure_hunts SET icon = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(hunt.id);
      console.log('  -> Icon cleared from database');
      fixedCount++;
    } 
    // Handle file paths
    else if (hunt.icon.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, hunt.icon);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`  -> Deleted icon file: ${hunt.icon}`);
        } catch (err) {
          console.error(`  -> Error deleting file: ${err.message}`);
        }
      } else {
        console.log(`  -> Icon file not found: ${hunt.icon}`);
      }
      // Clear from database
      db.prepare('UPDATE treasure_hunts SET icon = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(hunt.id);
      console.log('  -> Icon cleared from database');
      fixedCount++;
    } else {
      // Unknown format, just clear it
      console.log(`  -> Unknown icon format, clearing from database`);
      db.prepare('UPDATE treasure_hunts SET icon = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(hunt.id);
      fixedCount++;
    }
    
    console.log('');
  }
  
  console.log(`\n=== Complete: Fixed ${fixedCount} hunt(s) ===`);
  
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  db.close();
}








