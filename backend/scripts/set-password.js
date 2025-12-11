const db = require('../database');

console.log('Setting verification email password...');

try {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now'))
  `);
  
  stmt.run('verification_email_password', 'AAA2025aaa?');
  console.log('✅ Password set successfully!');
} catch (error) {
  console.error('❌ Error setting password:', error);
  process.exit(1);
}
