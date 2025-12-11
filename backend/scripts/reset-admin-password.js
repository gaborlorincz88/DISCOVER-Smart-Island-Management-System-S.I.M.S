const db = require('../database');
const crypto = require('crypto');

// Get email and password from command line args
const email = process.argv[2] || 'admin@discovergozo.com';
const newPassword = process.argv[3] || 'admin123';

if (!email || !newPassword) {
  console.error('Usage: node reset-admin-password.js <email> <new-password>');
  process.exit(1);
}

console.log('Resetting password for:', email);

try {
  // Check if user exists
  const user = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
  
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  
  console.log('User found:', user.email);
  console.log('User role:', user.role);
  
  // Hash the new password
  const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  
  // Update password
  const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?');
  const result = stmt.run(passwordHash, email);
  
  if (result.changes > 0) {
    console.log('✅ Password reset successfully!');
    console.log('New password:', newPassword);
    console.log('New hash:', passwordHash);
  } else {
    console.error('Failed to update password');
    process.exit(1);
  }
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}


