const db = require('./backend/database');

console.log('=== DATABASE TEST ===');

// Check if tables exist
const ticketsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get();
const reservationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'").get();

console.log('Tickets table exists:', !!ticketsTable);
console.log('Reservations table exists:', !!reservationsTable);

if (ticketsTable) {
  const tickets = db.prepare('SELECT * FROM tickets').all();
  console.log('Sample tickets:', tickets.length);
  tickets.forEach(ticket => {
    console.log(`- ${ticket.id}: ${ticket.name} (${ticket.price}€)`);
  });
}

if (reservationsTable) {
  const reservations = db.prepare('SELECT * FROM reservations').all();
  console.log('Existing reservations:', reservations.length);
}

// Test creating a reservation
try {
  const testReservation = db.prepare(`
    INSERT INTO reservations (
      id, user_id, ticket_id, quantity, total_price, currency, 
      status, reservation_date, reservation_time, special_requests, 
      contact_email, contact_phone, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    'test-reservation-123',
    'user-1756317687357-4ei5nw6zu',
    'ticket-2',
    1,
    35.00,
    'EUR',
    'confirmed',
    '2025-09-17',
    '10:00',
    'Test reservation',
    'test@example.com',
    '123456789'
  );
  
  console.log('Test reservation created successfully:', testReservation.changes);
  
  // Clean up test reservation
  db.prepare('DELETE FROM reservations WHERE id = ?').run('test-reservation-123');
  console.log('Test reservation cleaned up');
  
} catch (error) {
  console.error('Error creating test reservation:', error.message);
  console.error('Error details:', error);
}

console.log('=== END TEST ===');
