const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/trips - Get all trips for a user
router.get('/', (req, res) => {
  console.log('=== TRIPS API: Getting trips for user ===');
  console.log('Query params:', req.query);
  
  const { userId } = req.query;
  
  if (!userId) {
    console.log('No userId provided in query');
    return res.status(400).json({ error: 'User ID is required' });
  }

  console.log('Fetching trips for userId:', userId);

  try {
    const stmt = db.prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY updated_at DESC');
    const trips = stmt.all(userId);
    
    console.log('Raw trips from database:', trips);
    
    // Parse JSON fields
    const parsedTrips = trips.map(trip => ({
      ...trip,
      places: JSON.parse(trip.places || '[]'),
      routeInfo: trip.route_info ? JSON.parse(trip.route_info) : {}
    }));
    
    console.log('Parsed trips being sent to frontend:', parsedTrips);
    res.json(parsedTrips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// POST /api/trips - Create a new trip
router.post('/', (req, res) => {
  console.log('=== TRIPS API: Creating new trip ===');
  console.log('Request body:', req.body);
  
  // Debug: Check the actual table schema
  try {
    console.log('=== CHECKING TABLE SCHEMA ===');
    const tableInfo = db.prepare("PRAGMA table_info(trips)").all();
    console.log('Trips table schema:', tableInfo);
    
    // Check if table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trips'").get();
    console.log('Trips table exists:', !!tableExists);
  } catch (schemaError) {
    console.error('Error checking schema:', schemaError);
  }
  
  const { id, userId, name, icon, places, routeInfo } = req.body;
  
  if (!id || !userId || !name || !icon) {
    console.log('Missing required fields:', { id, userId, name, icon });
    return res.status(400).json({ error: 'Missing required fields: id, userId, name, icon' });
  }

  try {
    console.log('Preparing database statement...');
    const stmt = db.prepare(`
      INSERT INTO trips (id, user_id, name, icon, places, route_info, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    console.log('Executing database statement...');
    const info = stmt.run(
      id,
      userId,
      name,
      icon,
      JSON.stringify(places || []),
      JSON.stringify(routeInfo || {})
    );
    
    console.log('Database result:', info);
    
    if (info.changes > 0) {
      console.log('Trip created successfully');
      res.status(201).json({ message: 'Trip created successfully', id });
    } else {
      console.log('No rows were affected');
      res.status(500).json({ error: 'Failed to create trip' });
    }
  } catch (error) {
    console.error('=== TRIPS API ERROR ===');
    console.error('Error creating trip:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create trip', details: error.message });
  }
});

// PUT /api/trips/:id - Update an existing trip
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, icon, places, routeInfo } = req.body;
  
  if (!name || !icon) {
    return res.status(400).json({ error: 'Missing required fields: name, icon' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE trips 
      SET name = ?, icon = ?, places = ?, route_info = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const info = stmt.run(
      name,
      icon,
      JSON.stringify(places || []),
      JSON.stringify(routeInfo || {}),
      id
    );
    
    if (info.changes > 0) {
      res.json({ message: 'Trip updated successfully' });
    } else {
      res.status(404).json({ error: 'Trip not found' });
    }
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// DELETE /api/trips/:id - Delete a trip
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const stmt = db.prepare('DELETE FROM trips WHERE id = ?');
    const info = stmt.run(id);
    
    if (info.changes > 0) {
      res.json({ message: 'Trip deleted successfully' });
    } else {
      res.status(404).json({ error: 'Trip not found' });
    }
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

module.exports = router;
