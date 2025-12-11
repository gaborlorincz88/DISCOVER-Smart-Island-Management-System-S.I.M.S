const db = require('../database');

console.log('Checking SMTP settings...\n');

try {
  const stmt = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?');
  const settings = stmt.all('verification_email_%');
  
  const config = {};
  settings.forEach(setting => {
    const key = setting.key.replace('verification_email_', '');
    config[key] = setting.value;
  });
  
  console.log('Current SMTP Settings:');
  console.log('====================');
  console.log('Enabled:', config.enabled || 'not set');
  console.log('SMTP Host:', config.smtp_host || 'not set');
  console.log('SMTP Port:', config.smtp_port || 'not set');
  console.log('User:', config.user || 'not set');
  console.log('Password:', config.password ? '***' + config.password.slice(-3) : 'not set');
  console.log('Password length:', config.password ? config.password.length : 0);
  
} catch (error) {
  console.error('Error:', error);
}


