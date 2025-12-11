/**
 * © 2025 Lőrincz Gábor – All Rights Reserved
 * Unauthorized copying or use is strictly prohibited.
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdminAuth } = require('../middleware/admin-auth');

const requireAdmin = requireAdminAuth;

/**
 * Get most viewed tours
 */
router.get('/tours/most-viewed', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND timestamp >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND timestamp >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND timestamp >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND timestamp >= datetime('now', '-1 year')";
    }

    const views = db.prepare(`
      SELECT 
        json_extract(event_data, '$.tour_name') as tour_name,
        json_extract(event_data, '$.tour_id') as tour_id,
        COUNT(*) as view_count
      FROM analytics 
      WHERE event_name IN ('view_tour', 'view_tour_detail') 
        AND json_extract(event_data, '$.tour_name') IS NOT NULL
        ${dateFilter}
      GROUP BY tour_name, tour_id
      ORDER BY view_count DESC
      LIMIT 20
    `).all();

    res.json({ success: true, data: views });
  } catch (error) {
    console.error('Error fetching most viewed tours:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch most viewed tours' });
  }
});

/**
 * Get most booked tours
 */
router.get('/tours/most-booked', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    const bookings = db.prepare(`
      SELECT 
        tour_name,
        COUNT(*) as booking_count,
        SUM(quantity) as total_tickets,
        SUM(total_price) as total_revenue
      FROM reservations 
      WHERE status IN ('confirmed', 'completed')
        AND tour_name IS NOT NULL
        ${dateFilter}
      GROUP BY tour_name
      ORDER BY booking_count DESC
      LIMIT 20
    `).all();

    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error fetching most booked tours:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch most booked tours' });
  }
});

/**
 * Get revenue per tour
 */
router.get('/tours/revenue', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    const revenue = db.prepare(`
      SELECT 
        tour_name,
        SUM(total_price) as total_revenue,
        COUNT(*) as booking_count,
        SUM(quantity) as total_tickets,
        currency
      FROM reservations 
      WHERE status IN ('confirmed', 'completed')
        AND tour_name IS NOT NULL
        ${dateFilter}
      GROUP BY tour_name, currency
      ORDER BY total_revenue DESC
      LIMIT 20
    `).all();

    res.json({ success: true, data: revenue });
  } catch (error) {
    console.error('Error fetching tour revenue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tour revenue' });
  }
});

/**
 * Get tickets sold per tour
 */
router.get('/tours/tickets-sold', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    const tickets = db.prepare(`
      SELECT 
        tour_name,
        SUM(quantity) as tickets_sold,
        COUNT(*) as booking_count
      FROM reservations 
      WHERE status IN ('confirmed', 'completed')
        AND tour_name IS NOT NULL
        ${dateFilter}
      GROUP BY tour_name
      ORDER BY tickets_sold DESC
      LIMIT 20
    `).all();

    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error fetching tickets sold:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets sold' });
  }
});

/**
 * Get abandoned checkouts
 */
router.get('/tours/abandoned-checkouts', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filter for analytics table (uses timestamp)
    let analyticsDateFilter = '';
    if (period === '7d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-1 year')";
    }

    // Build date filter for reservations table (uses created_at)
    let reservationsDateFilter = '';
    if (period === '7d') {
      reservationsDateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      reservationsDateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      reservationsDateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      reservationsDateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    // Get checkout starts from analytics
    const checkoutStarts = db.prepare(`
      SELECT 
        json_extract(event_data, '$.tour_id') as tour_id,
        json_extract(event_data, '$.tour_name') as tour_name,
        json_extract(event_data, '$.checkout_started_at') as started_at,
        user_id,
        timestamp
      FROM analytics 
      WHERE event_name = 'start_checkout'
        AND json_extract(event_data, '$.tour_name') IS NOT NULL
        ${analyticsDateFilter}
    `).all();

    // Get completed bookings
    const completedBookings = db.prepare(`
      SELECT 
        json_extract(event_data, '$.tour_id') as tour_id,
        json_extract(event_data, '$.reservation_id') as reservation_id,
        user_id
      FROM analytics 
      WHERE event_name = 'complete_booking'
        ${analyticsDateFilter}
    `).all();

    // Create set of completed bookings by tour_id and user_id
    const completedSet = new Set();
    completedBookings.forEach(booking => {
      if (booking.tour_id && booking.user_id) {
        completedSet.add(`${booking.tour_id}_${booking.user_id}`);
      }
    });

    // Filter out completed checkouts
    const abandoned = checkoutStarts.filter(start => {
      if (!start.tour_id || !start.user_id) return false;
      return !completedSet.has(`${start.tour_id}_${start.user_id}`);
    });

    // Also get pending reservations older than 24 hours
    const pendingReservations = db.prepare(`
      SELECT 
        id,
        tour_name,
        user_id,
        created_at,
        total_price,
        quantity
      FROM reservations 
      WHERE status = 'pending'
        AND created_at < datetime('now', '-24 hours')
        ${reservationsDateFilter}
    `).all();

    // Aggregate abandoned checkouts by tour
    const abandonedByTour = {};
    abandoned.forEach(item => {
      const tourName = item.tour_name || 'Unknown';
      if (!abandonedByTour[tourName]) {
        abandonedByTour[tourName] = { count: 0, users: [] };
      }
      abandonedByTour[tourName].count++;
      if (item.user_id) {
        abandonedByTour[tourName].users.push(item.user_id);
      }
    });

    // Add pending reservations to abandoned
    pendingReservations.forEach(res => {
      const tourName = res.tour_name || 'Unknown';
      if (!abandonedByTour[tourName]) {
        abandonedByTour[tourName] = { count: 0, users: [] };
      }
      abandonedByTour[tourName].count++;
      if (res.user_id) {
        abandonedByTour[tourName].users.push(res.user_id);
      }
    });

    const result = Object.entries(abandonedByTour).map(([tour_name, data]) => ({
      tour_name,
      abandoned_count: data.count,
      unique_users: new Set(data.users).size
    })).sort((a, b) => b.abandoned_count - a.abandoned_count);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching abandoned checkouts:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch abandoned checkouts',
      details: error.message
    });
  }
});

/**
 * Get unpaid tours (pending reservations)
 */
router.get('/tours/unpaid', requireAdmin, (req, res) => {
  try {
    const { period = '30d', thresholdHours = 24 } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    const unpaid = db.prepare(`
      SELECT 
        id,
        tour_name,
        user_id,
        quantity,
        total_price,
        currency,
        created_at,
        contact_email,
        contact_phone
      FROM reservations 
      WHERE status = 'pending'
        AND created_at < datetime('now', '-' || ? || ' hours')
        AND tour_name IS NOT NULL
        ${dateFilter}
      ORDER BY created_at DESC
      LIMIT 100
    `).all(thresholdHours);

    res.json({ success: true, data: unpaid });
  } catch (error) {
    console.error('Error fetching unpaid tours:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unpaid tours' });
  }
});

/**
 * Get merchant list for filtering
 */
router.get('/merchants/list', requireAdmin, (req, res) => {
  try {
    const merchants = db.prepare(`
      SELECT id, name, email, business_name
      FROM merchants
      WHERE is_active = 1
      ORDER BY name
    `).all();

    res.json({ success: true, data: merchants });
  } catch (error) {
    console.error('Error fetching merchants list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchants list' });
  }
});

/**
 * Get ticket scans per merchant
 */
router.get('/merchants/scans', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND tv.scanned_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND tv.scanned_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND tv.scanned_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND tv.scanned_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    const scans = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        COUNT(tv.id) as scan_count,
        COUNT(DISTINCT tv.reservation_id) as unique_tickets_scanned
      FROM ticket_validations tv
      JOIN merchants m ON tv.merchant_id = m.id
      WHERE tv.status = 'validated'
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name
      ORDER BY scan_count DESC
    `).all();

    res.json({ success: true, data: scans });
  } catch (error) {
    console.error('Error fetching merchant scans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant scans' });
  }
});

/**
 * Get revenue per merchant
 */
router.get('/merchants/revenue', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND r.created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND r.created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND r.created_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    // Get revenue from validated tickets (scanned by merchant)
    const revenue = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        SUM(r.total_price) as total_revenue,
        COUNT(DISTINCT r.id) as reservation_count,
        COUNT(tv.id) as validated_count,
        r.currency
      FROM ticket_validations tv
      JOIN merchants m ON tv.merchant_id = m.id
      JOIN reservations r ON tv.reservation_id = r.id
      WHERE tv.status = 'validated'
        AND r.status IN ('confirmed', 'completed')
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name, r.currency
      ORDER BY total_revenue DESC
    `).all();

    res.json({ success: true, data: revenue });
  } catch (error) {
    console.error('Error fetching merchant revenue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant revenue' });
  }
});

/**
 * Get reservations per merchant
 */
router.get('/merchants/reservations', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND r.created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND r.created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND r.created_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    // Get reservations for tours assigned to merchant
    const reservations = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        COUNT(DISTINCT r.id) as reservation_count,
        SUM(r.quantity) as total_tickets,
        SUM(r.total_price) as potential_revenue
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      JOIN merchants m ON json_extract(m.assigned_tours, '$') LIKE '%' || t.id || '%'
      WHERE r.status IN ('confirmed', 'completed', 'pending')
        AND r.tour_name IS NOT NULL
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name
      ORDER BY reservation_count DESC
    `).all();

    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Error fetching merchant reservations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant reservations' });
  }
});

/**
 * Get unused tickets per merchant
 */
router.get('/merchants/unused-tickets', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND r.created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND r.created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND r.created_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    // Get unused tickets (reservations without validations)
    const unused = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        COUNT(DISTINCT r.id) as unused_count,
        SUM(r.quantity) as unused_tickets,
        SUM(r.total_price) as unused_revenue
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      JOIN merchants m ON json_extract(m.assigned_tours, '$') LIKE '%' || t.id || '%'
      LEFT JOIN ticket_validations tv ON r.id = tv.reservation_id
      WHERE r.status IN ('confirmed', 'completed')
        AND tv.id IS NULL
        AND r.reservation_date <= date('now')
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name
      ORDER BY unused_count DESC
    `).all();

    res.json({ success: true, data: unused });
  } catch (error) {
    console.error('Error fetching unused tickets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unused tickets' });
  }
});

/**
 * Get validation statistics per merchant
 */
router.get('/merchants/validation-stats', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND r.created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND r.created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND r.created_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    // Get validation statistics per merchant
    const stats = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        COUNT(DISTINCT r.id) as total_sold,
        COUNT(DISTINCT CASE WHEN tv.id IS NOT NULL THEN r.id END) as validated_count,
        COUNT(DISTINCT CASE WHEN tv.id IS NULL AND r.reservation_date <= date('now') THEN r.id END) as unvalidated_count,
        SUM(CASE WHEN tv.id IS NOT NULL THEN r.total_price ELSE 0 END) as validated_revenue,
        SUM(CASE WHEN tv.id IS NULL AND r.reservation_date <= date('now') THEN r.total_price ELSE 0 END) as unvalidated_revenue
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      JOIN merchants m ON json_extract(m.assigned_tours, '$') LIKE '%' || t.id || '%'
      LEFT JOIN ticket_validations tv ON r.id = tv.reservation_id AND tv.status = 'validated'
      WHERE r.status IN ('confirmed', 'completed')
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name
      ORDER BY total_sold DESC
    `).all();

    // Calculate validation rate for each
    const result = stats.map(s => ({
      ...s,
      validation_rate: s.total_sold > 0 ? Math.round((s.validated_count / s.total_sold) * 100) : 0
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching merchant validation stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant validation stats' });
  }
});

/**
 * Get tours breakdown per merchant
 */
router.get('/merchants/tours-breakdown', requireAdmin, (req, res) => {
  try {
    const { period = '30d', merchantId } = req.query;

    // Build date filter
    let dateFilter = '';
    if (period === '7d') {
      dateFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = "AND r.created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = "AND r.created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      dateFilter = "AND r.created_at >= datetime('now', '-1 year')";
    }

    let merchantFilter = '';
    if (merchantId) {
      merchantFilter = `AND m.id = '${merchantId.replace(/'/g, "''")}'`;
    }

    // Get tour breakdown per merchant
    const breakdown = db.prepare(`
      SELECT 
        m.id as merchant_id,
        m.name as merchant_name,
        m.business_name,
        r.tour_name,
        t.id as tour_id,
        SUM(r.quantity) as tickets_sold,
        SUM(r.total_price) as revenue,
        COUNT(DISTINCT CASE WHEN tv.id IS NOT NULL THEN r.id END) as validated_count,
        COUNT(DISTINCT CASE WHEN tv.id IS NULL AND r.reservation_date <= date('now') THEN r.id END) as unvalidated_count
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      JOIN merchants m ON json_extract(m.assigned_tours, '$') LIKE '%' || t.id || '%'
      LEFT JOIN ticket_validations tv ON r.id = tv.reservation_id AND tv.status = 'validated'
      WHERE r.status IN ('confirmed', 'completed')
        AND r.tour_name IS NOT NULL
        ${dateFilter}
        ${merchantFilter}
      GROUP BY m.id, m.name, m.business_name, r.tour_name, t.id
      ORDER BY m.name, revenue DESC
    `).all();

    // Group by merchant
    const merchants = {};
    breakdown.forEach(row => {
      if (!merchants[row.merchant_id]) {
        merchants[row.merchant_id] = {
          merchant_id: row.merchant_id,
          merchant_name: row.merchant_name,
          business_name: row.business_name,
          tours: []
        };
      }
      merchants[row.merchant_id].tours.push({
        tour_id: row.tour_id,
        tour_name: row.tour_name,
        tickets_sold: row.tickets_sold,
        revenue: row.revenue,
        validated_count: row.validated_count,
        unvalidated_count: row.unvalidated_count
      });
    });

    res.json({ success: true, data: Object.values(merchants) });
  } catch (error) {
    console.error('Error fetching merchant tours breakdown:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant tours breakdown' });
  }
});

/**
 * Get checkout funnel data
 */
router.get('/checkout-funnel', requireAdmin, (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Build date filters
    let analyticsDateFilter = '';
    let reservationsDateFilter = '';
    if (period === '7d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-7 days')";
      reservationsDateFilter = "AND created_at >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-30 days')";
      reservationsDateFilter = "AND created_at >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-90 days')";
      reservationsDateFilter = "AND created_at >= datetime('now', '-90 days')";
    } else if (period === '1y') {
      analyticsDateFilter = "AND timestamp >= datetime('now', '-1 year')";
      reservationsDateFilter = "AND created_at >= datetime('now', '-1 year')";
    }

    // Get tour views
    const tourViews = db.prepare(`
      SELECT COUNT(*) as count FROM analytics 
      WHERE event_name IN ('view_tour', 'view_tour_detail') 
        ${analyticsDateFilter}
    `).get();

    // Get checkout starts
    const checkoutStarts = db.prepare(`
      SELECT COUNT(*) as count FROM analytics 
      WHERE event_name = 'start_checkout' 
        ${analyticsDateFilter}
    `).get();

    // Get completed payments (confirmed/completed reservations)
    const paymentsCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM reservations 
      WHERE status IN ('confirmed', 'completed') 
        ${reservationsDateFilter}
    `).get();

    // Get pending payments
    const pendingPayments = db.prepare(`
      SELECT COUNT(*) as count FROM reservations 
      WHERE status = 'pending' 
        ${reservationsDateFilter}
    `).get();

    // Get validated tickets
    const validatedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM ticket_validations 
      WHERE status = 'validated' 
        ${analyticsDateFilter.replace('timestamp', 'scanned_at')}
    `).get();

    const funnel = {
      tour_views: tourViews?.count || 0,
      checkouts_started: checkoutStarts?.count || 0,
      payments_completed: paymentsCompleted?.count || 0,
      pending_payments: pendingPayments?.count || 0,
      tickets_validated: validatedTickets?.count || 0
    };

    // Calculate conversion rates
    funnel.view_to_checkout_rate = funnel.tour_views > 0
      ? Math.round((funnel.checkouts_started / funnel.tour_views) * 100)
      : 0;
    funnel.checkout_to_payment_rate = funnel.checkouts_started > 0
      ? Math.round((funnel.payments_completed / funnel.checkouts_started) * 100)
      : 0;
    funnel.abandonment_rate = funnel.checkouts_started > 0
      ? Math.round(((funnel.checkouts_started - funnel.payments_completed) / funnel.checkouts_started) * 100)
      : 0;

    res.json({ success: true, data: funnel });
  } catch (error) {
    console.error('Error fetching checkout funnel:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checkout funnel' });
  }
});

module.exports = router;


