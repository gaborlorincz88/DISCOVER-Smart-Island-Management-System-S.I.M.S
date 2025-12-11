const db = require('../database');

/**
 * Script to configure Hostinger SMTP settings for email verification
 * Run this once to set up the email verification service
 */

console.log('🔧 Setting up email verification SMTP settings...');

try {
  // Hostinger SMTP settings
  const smtpConfig = {
    enabled: 'true',
    smtp_host: 'smtp.hostinger.com',
    smtp_port: '465', // SSL port (alternative: 587 for TLS)
    user: 'info@discover-gozo.com',
    password: process.env.HOSTINGER_EMAIL_PASSWORD || 'HHH2025hhh?' // Set this in .env or replace manually
  };

  // Save settings to database
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at) 
    VALUES (?, ?, datetime('now'))
  `);

  Object.keys(smtpConfig).forEach(key => {
    stmt.run(`verification_email_${key}`, smtpConfig[key]);
    console.log(`✅ Set verification_email_${key}: ${key === 'password' ? '***' : smtpConfig[key]}`);
  });

  console.log('\n✅ Email verification SMTP settings configured!');
  console.log('\n⚠️  IMPORTANT: Make sure to set HOSTINGER_EMAIL_PASSWORD in your .env file or update the password in the database manually.');
  console.log('\nTo update the password manually, run:');
  console.log('UPDATE settings SET value = \'your-password\' WHERE key = \'verification_email_password\';');
  
} catch (error) {
  console.error('❌ Error setting up email verification:', error);
  process.exit(1);
}

