const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /api/analytics/event
router.post('/event', (req, res) => {
  const { event_type, event_data, session_id, user_id, timestamp } = req.body;

  if (!event_type) {
    return res.status(400).json({ error: 'event_type is required' });
  }

  try {
    const eventTimestamp = timestamp || new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO analytics (event_name, event_data, user_id, timestamp) 
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(
      event_type, 
      JSON.stringify(event_data), 
      user_id || null, 
      eventTimestamp
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    console.error('Failed to log analytics event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics/session
router.post('/session', (req, res) => {
  const { session_id, user_id, device_info, location_info, start_time, end_time, duration, is_return_visitor, visit_count } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    // If end_time is provided, this is a session update (end of session)
    // Otherwise, it's a session start
    const sessionData = {
      session_id,
      user_id: user_id || null,
      device_info: device_info || {},
      location_info: location_info || {},
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || null,
      duration: duration || (start_time && end_time ? 
        Math.round((new Date(end_time) - new Date(start_time)) / 1000) : null),
      is_return_visitor: is_return_visitor || false,
      visit_count: visit_count || 1
    };
    
    const stmt = db.prepare(`
      INSERT INTO analytics (event_name, event_data, user_id, timestamp) 
      VALUES (?, ?, ?, ?)
    `);
    
    const timestamp = end_time ? new Date(end_time).toISOString() : new Date().toISOString();
    
    const info = stmt.run(
      'session_data', 
      JSON.stringify(sessionData), 
      user_id || null, 
      timestamp
    );
    
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    console.error('Failed to log session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/summary
router.get('/summary', (req, res) => {
  try {
    // Time period filter (default: last 30 days)
    const { period = '30d' } = req.query;
    let dateFilter = '';
    
    if (period === '7d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-7 days\')';
    } else if (period === '30d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-30 days\')';
    } else if (period === '90d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-90 days\')';
    } else if (period === '1y') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-1 year\')';
    }

    const topPlacesStmt = db.prepare(`
      SELECT 
        json_extract(event_data, '$.place_name') as place_name, 
        COUNT(*) as view_count 
      FROM analytics 
      WHERE event_name = 'view_place' ${dateFilter}
      GROUP BY place_name 
      ORDER BY view_count DESC 
      LIMIT 10
    `);
    const topPlaces = topPlacesStmt.all();

    const topTripsStmt = db.prepare(`
      SELECT 
        json_extract(event_data, '$.trip_name') as trip_name, 
        COUNT(*) as trip_count 
      FROM analytics 
      WHERE event_name = 'create_trip' ${dateFilter}
      GROUP BY trip_name 
      ORDER BY trip_count DESC 
      LIMIT 10
    `);
    const topTrips = topTripsStmt.all();

    const topCategoriesStmt = db.prepare(`
      SELECT 
        json_extract(event_data, '$.category') as category, 
        COUNT(*) as view_count 
      FROM analytics 
      WHERE event_name = 'view_place' AND json_extract(event_data, '$.category') IS NOT NULL ${dateFilter}
      GROUP BY category 
      ORDER BY view_count DESC 
      LIMIT 10
    `);
    const topCategories = topCategoriesStmt.all();

    const topSearchQueriesStmt = db.prepare(`
      SELECT 
        json_extract(event_data, '$.query') as query, 
        COUNT(*) as search_count 
      FROM analytics 
      WHERE event_name = 'search_query' AND json_extract(event_data, '$.query') IS NOT NULL ${dateFilter}
      GROUP BY query 
      ORDER BY search_count DESC 
      LIMIT 10
    `);
    const topSearchQueries = topSearchQueriesStmt.all();

    res.json({ topPlaces, topTrips, topCategories, topSearchQueries });
  } catch (error) {
    console.error('Failed to get analytics summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/comprehensive
router.get('/comprehensive', (req, res) => {
  try {
    // Time period filter (default: last 30 days)
    const { period = '30d' } = req.query;
    let dateFilter = '';
    let sessionDateFilter = '';
    let periodString = '-30 days';
    
    if (period === '7d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-7 days\')';
      sessionDateFilter = 'start_time >= datetime(\'now\', \'-7 days\')';
      periodString = '-7 days';
    } else if (period === '30d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-30 days\')';
      sessionDateFilter = 'start_time >= datetime(\'now\', \'-30 days\')';
      periodString = '-30 days';
    } else if (period === '90d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-90 days\')';
      sessionDateFilter = 'start_time >= datetime(\'now\', \'-90 days\')';
      periodString = '-90 days';
    } else if (period === '1y') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-1 year\')';
      sessionDateFilter = 'start_time >= datetime(\'now\', \'-1 year\')';
      periodString = '-1 year';
    }

    // 1. User Engagement Analytics - Get from analytics table
    let sessionStats = { total_sessions: 0, avg_session_duration: 0, unique_users: 0, unique_sessions: 0 };
    try {
        const sessionData = db.prepare(`
          SELECT 
            event_data
          FROM analytics 
          WHERE event_name = 'session_data' ${dateFilter}
        `).all();
        
        if (sessionData.length > 0) {
          const sessions = sessionData.map(row => JSON.parse(row.event_data));
          const uniqueSessions = new Set(sessions.map(s => s.session_id));
          const uniqueUsers = new Set(sessions.map(s => s.user_id).filter(Boolean));
          const durations = sessions.map(s => s.duration).filter(Boolean);
          
          sessionStats = {
            total_sessions: sessions.length,
            avg_session_duration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            unique_users: uniqueUsers.size,
            unique_sessions: uniqueSessions.size
          };
        }
    } catch (error) {
      console.log('Error getting session stats:', error);
    }

    // 2. Device & Browser Analytics
    let deviceStats = [];
    try {
      const sessionData = db.prepare(`
        SELECT 
          event_data
        FROM analytics 
        WHERE event_name = 'session_data' ${dateFilter}
      `).all();
      
      if (sessionData.length > 0) {
        const deviceCounts = {};
        sessionData.forEach(row => {
          const session = JSON.parse(row.event_data);
          const deviceInfo = session.device_info || {};
          const key = `${deviceInfo.device_type || 'unknown'}|${deviceInfo.browser || 'unknown'}|${deviceInfo.os || 'unknown'}`;
          deviceCounts[key] = (deviceCounts[key] || 0) + 1;
        });
        
        deviceStats = Object.entries(deviceCounts).map(([key, count]) => {
          const [device_type, browser, os] = key.split('|');
          return { device_type, browser, os, count };
        }).sort((a, b) => b.count - a.count);
      }
    } catch (error) {
      console.log('Device stats query failed, using defaults');
    }

    // 3. Geographic Analytics (Heatmap Data)
    let heatmapData = [];
    try {
      heatmapData = db.prepare(`
        SELECT 
          json_extract(event_data, '$.latitude') as latitude,
          json_extract(event_data, '$.longitude') as longitude,
          json_extract(event_data, '$.place_name') as place_name,
          COUNT(*) as visit_count,
          json_extract(event_data, '$.category') as category
        FROM analytics 
        WHERE event_name = 'view_place' 
          AND json_extract(event_data, '$.latitude') IS NOT NULL
          AND json_extract(event_data, '$.longitude') IS NOT NULL
          ${dateFilter}
        GROUP BY latitude, longitude, place_name, category
        ORDER BY visit_count DESC
      `).all();
    } catch (error) {
      console.log('Heatmap data query failed, using defaults');
    }

    // 4. Time-based Analytics
    let hourlyStats = [];
    try {
      hourlyStats = db.prepare(`
        SELECT 
          strftime('%H', timestamp) as hour,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics 
        WHERE timestamp >= datetime('now', '${periodString}')
        GROUP BY strftime('%H', timestamp)
        ORDER BY hour
      `).all();
    } catch (error) {
      console.log('Hourly stats query failed, using defaults');
    }

    let dailyStats = [];
    try {
      dailyStats = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', timestamp) as date,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics 
        WHERE timestamp >= datetime('now', '${periodString}')
        GROUP BY strftime('%Y-%m-%d', timestamp)
        ORDER BY date
      `).all();
    } catch (error) {
      console.log('Daily stats query failed, using defaults');
    }

    // 5. Feature Usage Analytics
    let featureUsage = [];
    try {
      featureUsage = db.prepare(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events 
        WHERE timestamp >= datetime('now', '${periodString}')
        GROUP BY event_type
        ORDER BY count DESC
      `).all();
    } catch (error) {
      console.log('Feature usage query failed, using defaults');
    }

    // 6. User Journey Analytics
    let userJourney = [];
    try {
      userJourney = db.prepare(`
        SELECT 
          session_id,
          COUNT(*) as events_per_session,
          MIN(timestamp) as session_start,
          MAX(timestamp) as session_end,
          GROUP_CONCAT(event_type, ' -> ') as journey_path
        FROM analytics_events 
        WHERE session_id IS NOT NULL 
          AND timestamp >= datetime('now', '-7 days')
        GROUP BY session_id
        ORDER BY events_per_session DESC
        LIMIT 50
      `).all();
    } catch (error) {
      console.log('User journey query failed, using defaults');
    }

    // 7. Economic Activity (Commercial POI interactions)
    let economicActivity = [];
    try {
      economicActivity = db.prepare(`
        SELECT 
          json_extract(event_data, '$.place_name') as place_name,
          json_extract(event_data, '$.category') as category,
          COUNT(*) as interactions,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events 
        WHERE event_type IN ('view_place', 'bookmark_place', 'add_to_trip')
          AND json_extract(event_data, '$.category') IN ('Food & Drink', 'Shopping', 'Boat Tour', 'Art & Culture')
          ${dateFilter}
        GROUP BY place_name, category
        ORDER BY interactions DESC
        LIMIT 20
      `).all();
    } catch (error) {
      console.log('Economic activity query failed, using defaults');
    }

    // 8. Search Analytics
    let searchAnalytics = [];
    try {
      searchAnalytics = db.prepare(`
        SELECT 
          json_extract(event_data, '$.query') as query,
          COUNT(*) as search_count,
          COUNT(DISTINCT session_id) as unique_searchers,
          AVG(json_extract(event_data, '$.results_count')) as avg_results
        FROM analytics_events 
        WHERE event_type = 'search_query' 
          AND json_extract(event_data, '$.query') IS NOT NULL
          ${dateFilter}
        GROUP BY query
        ORDER BY search_count DESC
        LIMIT 20
      `).all();
    } catch (error) {
      console.log('Search analytics query failed, using defaults');
    }

    res.json({
      sessionStats,
      deviceStats,
      heatmapData,
      hourlyStats,
      dailyStats,
      featureUsage,
      userJourney,
      economicActivity,
      searchAnalytics,
      period
    });
  } catch (error) {
    console.error('Failed to get comprehensive analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/real-time
router.get('/real-time', (req, res) => {
  try {
    // Current active sessions (last 5 minutes)
    let activeSessions = { active_sessions: 0, active_users: 0 };
    try {
      activeSessions = db.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as active_sessions
        FROM analytics 
        WHERE timestamp >= datetime('now', '-5 minutes')
      `).get();
    } catch (error) {
      console.log('Active sessions query failed, using defaults');
    }

    // Recent events (last hour)
    let recentEvents = [];
    try {
      recentEvents = db.prepare(`
        SELECT 
          event_name,
          json_extract(event_data, '$.place_name') as place_name,
          timestamp,
          user_id
        FROM analytics 
        WHERE timestamp >= datetime('now', '-1 hour')
        ORDER BY timestamp DESC
        LIMIT 50
      `).all();
    } catch (error) {
      console.log('Recent events query failed, using defaults');
    }

    // Current popular places (last hour)
    let currentPopular = [];
    try {
      currentPopular = db.prepare(`
        SELECT 
          json_extract(event_data, '$.place_name') as place_name,
          COUNT(*) as recent_views
        FROM analytics 
        WHERE event_name = 'view_place' 
          AND timestamp >= datetime('now', '-1 hour')
        GROUP BY place_name
        ORDER BY recent_views DESC
        LIMIT 10
      `).all();
    } catch (error) {
      console.log('Current popular places query failed, using defaults');
    }

    res.json({
      activeSessions,
      recentEvents,
      currentPopular,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get real-time analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/export
router.get('/export', (req, res) => {
  try {
    const { format = 'json', period = '30d' } = req.query;
    
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-7 days\')';
    } else if (period === '30d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-30 days\')';
    } else if (period === '90d') {
      dateFilter = 'AND timestamp >= datetime(\'now\', \'-90 days\')';
    }

    const analyticsData = db.prepare(`
      SELECT 
        event_type,
        event_data,
        session_id,
        user_id,
        timestamp
      FROM analytics_events 
      WHERE 1=1 ${dateFilter}
      ORDER BY timestamp DESC
    `).all();

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'event_type,place_name,category,query,session_id,user_id,timestamp\n';
      const csvData = analyticsData.map(event => {
        const data = JSON.parse(event.event_data || '{}');
        return [
          event.event_type,
          data.place_name || '',
          data.category || '',
          data.query || '',
          event.session_id || '',
          event.user_id || '',
          event.timestamp
        ].join(',');
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="gozo-analytics-${period}.csv"`);
      res.send(csvHeader + csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gozo-analytics-${period}.json"`);
      res.json(analyticsData);
    }
  } catch (error) {
    console.error('Failed to export analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
