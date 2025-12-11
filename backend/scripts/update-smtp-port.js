const db = require('../database');

console.log('Updating SMTP port to 587 (TLS)...');

try {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now'))
  `);
  
  stmt.run('verification_email_smtp_port', '587');
  console.log('✅ SMTP port updated to 587');
} catch (error) {
  console.error('❌ Error updating port:', error);
  process.exit(1);
}


