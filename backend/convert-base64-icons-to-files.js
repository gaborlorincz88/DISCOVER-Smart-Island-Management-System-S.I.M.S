/**
 * Migration script to convert all base64 icon strings in treasure_hunts table to actual image files
 * Run this script once to clean up existing base64 icons in the database
 * 
 * Usage: node convert-base64-icons-to-files.js
 */

const db = require('./database');
const path = require('path');
const fs = require('fs');

console.log('=== Converting base64 icons to files ===\n');

try {
    // Get all hunts with base64 icons
    const hunts = db.prepare('SELECT id, name, icon FROM treasure_hunts WHERE icon IS NOT NULL AND icon LIKE "data:image%"').all();
    
    console.log(`Found ${hunts.length} treasure hunts with base64 icons\n`);
    
    if (hunts.length === 0) {
        console.log('No base64 icons found. All icons are already files or null.');
        process.exit(0);
    }
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('Created uploads directory');
    }
    
    let converted = 0;
    let errors = 0;
    
    hunts.forEach((hunt, index) => {
        try {
            const base64String = hunt.icon;
            
            // Extract base64 data and mime type
            const matches = base64String.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                console.log(`[${index + 1}/${hunts.length}] Hunt "${hunt.name}" (ID: ${hunt.id}): Invalid base64 format, skipping`);
                errors++;
                return;
            }
            
            const mimeType = matches[1];
            const base64Data = matches[2];
            
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Generate unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + hunt.id;
            const ext = mimeType === 'jpeg' ? 'jpg' : mimeType;
            const filename = `treasure-hunt-icon-${uniqueSuffix}.${ext}`;
            const filePath = path.join(uploadsDir, filename);
            
            // Write file
            fs.writeFileSync(filePath, buffer);
            
            // Update database
            const iconPath = `/uploads/${filename}`;
            db.prepare('UPDATE treasure_hunts SET icon = ?, updated_at = datetime(\'now\') WHERE id = ?').run(iconPath, hunt.id);
            
            console.log(`[${index + 1}/${hunts.length}] ✓ Converted icon for hunt "${hunt.name}" (ID: ${hunt.id}) -> ${iconPath}`);
            converted++;
        } catch (error) {
            console.error(`[${index + 1}/${hunts.length}] ✗ Error converting icon for hunt "${hunt.name}" (ID: ${hunt.id}):`, error.message);
            errors++;
        }
    });
    
    console.log(`\n=== Conversion Complete ===`);
    console.log(`Successfully converted: ${converted}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${hunts.length}`);
    
} catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
}

process.exit(0);








