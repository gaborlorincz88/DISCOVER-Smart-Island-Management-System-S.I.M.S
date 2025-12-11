const db = require('../database');

const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const pwd = stmt.get('verification_email_password');

console.log('Stored password:', pwd ? pwd.value : 'not found');
console.log('Expected: HHH2025hhh?');
console.log('Match:', pwd && pwd.value === 'HHH2025hhh?');
console.log('Password length:', pwd ? pwd.value.length : 0);


