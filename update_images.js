const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('discover_gozo.db');

console.log('Updating ticket images...');

// Update ticket images with actual existing images
const updates = [
  {
    id: 'ticket-1',
    image: '/uploads/1755336818270-7778911-images.jpg' // Bus tour image
  },
  {
    id: 'ticket-2', 
    image: '/uploads/1753048055561-1000px-Malte%2C_Gozo%2C_port_de_Mgarr_%26_ferrys_%26_Comino.jpg' // Comino boat image
  },
  {
    id: 'ticket-3',
    image: '/uploads/1753049661278-1000px-Ramla_Bay.jpg' // Hiking trail image
  },
  {
    id: 'ticket-4',
    image: '/uploads/1753009373370-1000px-F69_sinking.jpg' // Adventure image
  }
];

const updateStmt = db.prepare('UPDATE tickets SET main_image = ? WHERE id = ?');

updates.forEach(update => {
  const result = updateStmt.run(update.image, update.id);
  console.log(`Updated ${update.id}: ${result.changes} rows affected`);
});

// Verify the updates
const tickets = db.prepare('SELECT id, name, main_image FROM tickets').all();
console.log('\nUpdated tickets:');
tickets.forEach(ticket => {
  console.log(`${ticket.id}: ${ticket.name} - ${ticket.main_image}`);
});

db.close();
console.log('\nDatabase update complete!');
