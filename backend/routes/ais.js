const express = require('express');
const router = express.Router();
const aisService = require('../services/aisService');
const db = require('../database');

/**
 * GET /api/ais/positions
 * Get current positions for all tracked vessels
 */
router.get('/positions', (req, res) => {
  try {
    const allPositions = aisService.getAllPositions();
    const positionCount = Object.keys(allPositions).length;
    console.log(`📤 Sending ${positionCount} AIS positions to client`);
    if (positionCount > 0) {
      console.log('📋 Position MMSIs:', Object.keys(allPositions).join(', '));
    } else {
      console.warn('⚠️ No AIS positions available - backend may not be receiving data from AisStream.io');
    }
    res.json(allPositions);
  } catch (error) {
    console.error('Error getting AIS positions:', error);
    res.status(500).json({ error: 'Failed to get AIS positions' });
  }
});

/**
 * GET /api/ais/positions/:id
 * Get positions for a specific place/event
 */
router.get('/positions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const positions = aisService.getPositionsForSubscription(id);
    res.json(positions);
  } catch (error) {
    console.error('Error getting positions for subscription:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

/**
 * GET /api/ais/stream
 * Server-Sent Events endpoint for real-time position updates
 */
router.get('/stream', (req, res) => {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && (
      origin.includes('discover-gozo.com') || 
      origin.includes('localhost')
    )) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    return res.status(204).end();
  }

  // Set CORS headers for SSE (must be before any writes)
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('discover-gozo.com') || 
    origin.includes('localhost')
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Default to frontend URL if no origin
    res.setHeader('Access-Control-Allow-Origin', 'https://discover-gozo.com');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Cloudflare-specific headers to prevent buffering and QUIC issues
  res.setHeader('CF-Cache-Status', 'DYNAMIC');
  res.setHeader('CF-Ray', req.headers['cf-ray'] || '');
  
  // Disable compression for SSE (can cause issues with streaming)
  res.setHeader('Content-Encoding', 'identity');

  // Flush headers immediately
  res.flushHeaders();

  // Send initial connection message
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'AIS stream connected' })}\n\n`);
  } catch (error) {
    console.error('Error writing initial SSE message:', error);
    return res.end();
  }

  // Create position update listener
  const positionListener = (position) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'position', data: position })}\n\n`);
    } catch (error) {
      console.error('Error sending position update:', error);
    }
  };

  // Add listener
  aisService.addPositionListener(positionListener);

  // Send current positions
  const currentPositions = aisService.getAllPositions();
  if (Object.keys(currentPositions).length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'positions', data: currentPositions })}\n\n`);
  }

  // Handle client disconnect
  const cleanup = () => {
    clearInterval(pingInterval);
    aisService.removePositionListener(positionListener);
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  
  // Cleanup on error
  req.on('error', (error) => {
    console.error('SSE request error:', error);
    cleanup();
  });

  res.on('close', cleanup);
  res.on('error', (error) => {
    console.error('SSE response error:', error);
    cleanup();
  });
});

/**
 * POST /api/ais/subscribe/:id
 * Subscribe to track a place/event (called automatically when place/event is created/updated with AIS config)
 */
router.post('/subscribe/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'place' or 'event'

    if (!type || !['place', 'event'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "place" or "event"' });
    }

    // Get place or event from database
    const table = type === 'place' ? 'places' : 'events';
    const item = db.prepare(`SELECT id, name, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location, latitude, longitude FROM ${table} WHERE id = ?`).get(id);

    if (!item) {
      return res.status(404).json({ error: `${type} not found` });
    }

    if (!item.is_dynamic_location) {
      return res.status(400).json({ error: `${type} does not have dynamic location enabled` });
    }

    const success = aisService.subscribe(id, type, item);

    if (success) {
      res.json({ message: `Subscribed to track ${type} ${id}`, status: 'success' });
    } else {
      res.status(400).json({ error: 'Failed to subscribe. Check AIS configuration.' });
    }
  } catch (error) {
    console.error('Error subscribing to AIS:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * POST /api/ais/unsubscribe/:id
 * Unsubscribe from tracking a place/event
 */
router.post('/unsubscribe/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = aisService.unsubscribe(id);

    if (success) {
      res.json({ message: `Unsubscribed from tracking ${id}`, status: 'success' });
    } else {
      res.status(404).json({ error: 'Subscription not found' });
    }
  } catch (error) {
    console.error('Error unsubscribing from AIS:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /api/ais/status
 * Get AIS service status
 */
router.get('/status', (req, res) => {
  try {
    const status = aisService.getStatus();
    console.log('📊 AIS Status requested:', status);
    
    // Check ALL places with is_dynamic_location (even if missing other fields)
    const allDynamicPlaces = db.prepare(`
      SELECT id, name, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location
      FROM places 
      WHERE is_dynamic_location = 1
    `).all();
    
    // Check places that meet the subscription criteria
    const validPlaces = db.prepare(`
      SELECT id, name, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location
      FROM places 
      WHERE is_dynamic_location = 1 
        AND ais_provider IS NOT NULL 
        AND ais_api_key IS NOT NULL 
        AND ais_mmsi IS NOT NULL
    `).all();
    
    const response = {
      ...status,
      allDynamicPlaces: allDynamicPlaces.map(p => ({
        id: p.id,
        name: p.name,
        hasProvider: !!p.ais_provider,
        hasApiKey: !!p.ais_api_key,
        hasMmsi: !!p.ais_mmsi,
        mmsi: p.ais_mmsi,
        provider: p.ais_provider,
        isConfigured: !!(p.ais_provider && p.ais_api_key && p.ais_mmsi)
      })),
      validPlaces: validPlaces.map(p => ({
        id: p.id,
        name: p.name,
        mmsi: p.ais_mmsi,
        provider: p.ais_provider
      })),
      diagnostics: {
        totalDynamicPlaces: allDynamicPlaces.length,
        validPlaces: validPlaces.length,
        subscriptionsCreated: status.subscriptions,
        positionsReceived: status.trackedVessels
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting AIS status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;

