const express = require('express');
const db = require('../database');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const { containsInappropriateContent, getPolitenessScore } = require('../services/politenessFilter');
const router = express.Router();

// Simple user authentication helper
function getUserFromRequest(req) {
  const userId = req.body?.userId || req.headers['x-user-id'] || req.query?.userId;
  if (!userId) {
    return null;
  }
  
  try {
    const user = db.prepare('SELECT id, email, username, role FROM users WHERE id = ?').get(userId);
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// GET /api/reviews - Get reviews for a specific place or tour
router.get('/', async (req, res) => {
  try {
    const { place_id, tour_id, user_id, approved_only = 'true', limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        r.*,
        u.username,
        u.email,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 
            'Bus Stop: ' || SUBSTR(r.place_id, 10)
          WHEN r.place_id LIKE 'event-%' THEN 
            'Event: ' || SUBSTR(r.place_id, 7)
          ELSE p.name
        END as place_name,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 'bus_stop'
          WHEN r.place_id LIKE 'event-%' THEN 'event'
          ELSE p.category
        END as place_category,
        t.name as tour_name,
        t.category as tour_category
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
      LEFT JOIN tours t ON r.tour_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // IMPORTANT: tour_id and place_id are mutually exclusive
    // If tour_id is provided, only return tour reviews (ignore place_id)
    // If place_id is provided (and no tour_id), return place reviews
    if (tour_id) {
      // Only query for tour reviews - explicitly exclude place reviews
      query += ' AND r.tour_id = ? AND r.place_id IS NULL';
      params.push(tour_id);
    } else if (place_id) {
      // Only query for place reviews when tour_id is not provided
      // Handle both numeric place IDs and virtual IDs (bus-stop-, event-)
      const numericId = Number(place_id);
      if (isNaN(numericId)) {
        // Virtual ID (bus-stop-, event-)
        query += ' AND r.place_id = ? AND r.tour_id IS NULL';
        params.push(place_id);
      } else {
        // Numeric ID - check both as string and number to handle storage inconsistencies
        query += ' AND (r.place_id = ? OR r.place_id = ?) AND r.tour_id IS NULL';
        params.push(numericId, numericId.toString());
      }
    }
    
    if (user_id) {
      query += ' AND r.user_id = ?';
      params.push(user_id);
    }
    
    if (approved_only === 'true') {
      query += ' AND r.is_approved = 1 AND r.is_visible = 1';
    }
    
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const reviews = db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM reviews r
      WHERE 1=1
    `;
    const countParams = [];
    
    // IMPORTANT: tour_id and place_id are mutually exclusive (same logic as main query)
    if (tour_id) {
      countQuery += ' AND r.tour_id = ? AND r.place_id IS NULL';
      countParams.push(tour_id);
    } else if (place_id) {
      countQuery += ' AND r.place_id = ? AND r.tour_id IS NULL';
      countParams.push(place_id);
    }
    
    if (user_id) {
      countQuery += ' AND r.user_id = ?';
      countParams.push(user_id);
    }
    
    if (approved_only === 'true') {
      countQuery += ' AND r.is_approved = 1 AND r.is_visible = 1';
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      reviews,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/stats - Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const { place_id, tour_id } = req.query;

    let query = `
      SELECT 
        rs.*,
        p.name as place_name,
        p.category as place_category,
        t.name as tour_name,
        t.category as tour_category
      FROM review_stats rs
      LEFT JOIN places p ON rs.item_id = p.id AND rs.item_type = 'place'
      LEFT JOIN tours t ON rs.item_id = t.id AND rs.item_type = 'tour'
      WHERE 1=1
    `;
    
    const params = [];
    
    // IMPORTANT: tour_id and place_id are mutually exclusive
    if (tour_id) {
      query += ' AND rs.item_type = ? AND rs.item_id = ?';
      params.push('tour', tour_id);
    } else if (place_id) {
      query += ' AND rs.item_type = ? AND rs.item_id = ?';
      params.push('place', place_id);
    }
    
    query += ' ORDER BY rs.total_reviews DESC';

    const stats = db.prepare(query).all(...params);
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

// POST /api/reviews - Create a new review (requires authentication)
router.post('/', async (req, res) => {
  try {
    const { place_id, tour_id, rating, title, comment } = req.body;
    const user = getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ error: 'User authentication required' });
    }
    
    const user_id = user.id;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (!place_id && !tour_id) {
      return res.status(400).json({ error: 'Either place_id or tour_id is required' });
    }

    if (place_id && tour_id) {
      return res.status(400).json({ error: 'Cannot review both place and tour in the same review' });
    }

    // Check if user already reviewed this item
    let existingReview;
    if (place_id) {
      existingReview = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND place_id = ?').get(user_id, place_id);
    } else {
      existingReview = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND tour_id = ?').get(user_id, tour_id);
    }

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this item' });
    }

    // Verify place or tour exists
    if (place_id) {
      // Convert to string to handle both string and number place_ids
      const placeIdStr = String(place_id);
      
      // Check if it's a virtual place (bus stop or event)
      if (placeIdStr.startsWith('bus-stop-') || placeIdStr.startsWith('event-')) {
        // Virtual places (bus stops and events) don't exist in places table
        console.log(`Allowing review for virtual place: ${placeIdStr}`);
      } else {
        // Check if it's a real place in the database
        const place = db.prepare('SELECT id FROM places WHERE id = ?').get(place_id);
        if (!place) {
          return res.status(404).json({ error: 'Place not found' });
        }
      }
    } else {
      // Tour ID can be either numeric (from database) or string (from JSON files like "green-bus")
      // For string IDs, we don't need to verify existence in database since they come from JSON files
      // For numeric IDs, check if tour exists in database
      const numericTourId = Number(tour_id);
      if (!isNaN(numericTourId)) {
        const tour = db.prepare('SELECT id FROM tours WHERE id = ?').get(numericTourId);
        if (!tour) {
          return res.status(404).json({ error: 'Tour not found' });
        }
      }
      // For string tour IDs (like "green-bus"), we allow them without database verification
      // since they come from JSON route files and are valid tour identifiers
    }

    // Check content for inappropriate language
    const contentToCheck = `${title || ''} ${comment || ''}`.trim();
    const politenessCheck = containsInappropriateContent(contentToCheck);
    const politenessScore = getPolitenessScore(contentToCheck);
    
    // Auto-approve if content is clean (low politeness score = polite), otherwise mark for review
    const isApproved = !politenessCheck.isInappropriate && politenessScore <= 20;
    const isVisible = isApproved; // Only visible if approved
    
    // Create review
    const stmt = db.prepare(`
      INSERT INTO reviews (user_id, place_id, tour_id, rating, title, comment, is_approved, is_visible, politeness_score, moderation_reasons)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const moderationReasons = politenessCheck.isInappropriate ? 
      JSON.stringify(politenessCheck.reasons) : null;

    const result = stmt.run(
      user_id, 
      place_id || null, 
      tour_id || null, 
      rating, 
      title || null, 
      comment || null, 
      isApproved ? 1 : 0, 
      isVisible ? 1 : 0,
      politenessScore,
      moderationReasons
    );

    // Get the created review with user info
    const newReview = db.prepare(`
      SELECT 
        r.*,
        u.username,
        u.email,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 
            'Bus Stop: ' || SUBSTR(r.place_id, 10)
          WHEN r.place_id LIKE 'event-%' THEN 
            'Event: ' || SUBSTR(r.place_id, 7)
          ELSE p.name
        END as place_name,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 'bus_stop'
          WHEN r.place_id LIKE 'event-%' THEN 'event'
          ELSE p.category
        END as place_category,
        t.name as tour_name,
        t.category as tour_category
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
      LEFT JOIN tours t ON r.tour_id = t.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ review: newReview });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// PUT /api/reviews/:id - Update a review (user can only update their own reviews)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;
    const user = getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ error: 'User authentication required' });
    }
    
    const user_id = user.id;

    // Check if review exists and belongs to user
    const existingReview = db.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').get(id, user_id);
    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
    }

    // Validation
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Update review
    const stmt = db.prepare(`
      UPDATE reviews 
      SET rating = COALESCE(?, rating),
          title = COALESCE(?, title),
          comment = COALESCE(?, comment),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(rating || null, title || null, comment || null, id);

    // Get updated review
    const updatedReview = db.prepare(`
      SELECT 
        r.*,
        u.username,
        u.email,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 
            'Bus Stop: ' || SUBSTR(r.place_id, 10)
          WHEN r.place_id LIKE 'event-%' THEN 
            'Event: ' || SUBSTR(r.place_id, 7)
          ELSE p.name
        END as place_name,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 'bus_stop'
          WHEN r.place_id LIKE 'event-%' THEN 'event'
          ELSE p.category
        END as place_category,
        t.name as tour_name,
        t.category as tour_category
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
      LEFT JOIN tours t ON r.tour_id = t.id
      WHERE r.id = ?
    `).get(id);

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// DELETE /api/reviews/:id - Delete a review (user can only delete their own reviews)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ error: 'User authentication required' });
    }
    
    const user_id = user.id;

    // Check if review exists and belongs to user
    const existingReview = db.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').get(id, user_id);
    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
    }

    // Delete review
    const stmt = db.prepare('DELETE FROM reviews WHERE id = ?');
    stmt.run(id);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ADMIN ROUTES

// GET /api/reviews/admin/all - Get all reviews for admin (including unapproved)
router.get('/admin/all', requireAdminAuth, async (req, res) => {
  try {
    const { status = 'all', limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        r.*,
        u.username,
        u.email,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 
            'Bus Stop: ' || SUBSTR(r.place_id, 10) -- Remove 'bus-stop-' prefix
          WHEN r.place_id LIKE 'event-%' THEN 
            'Event: ' || COALESCE(e.name, SUBSTR(r.place_id, 7)) -- Use event name if available
          ELSE p.name
        END as place_name,
        CASE 
          WHEN r.place_id LIKE 'bus-stop-%' THEN 'bus_stop'
          WHEN r.place_id LIKE 'event-%' THEN 'event'
          ELSE p.category
        END as place_category,
        t.name as tour_name,
        t.category as tour_category
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id AND r.place_id NOT LIKE 'bus-stop-%' AND r.place_id NOT LIKE 'event-%'
      LEFT JOIN events e ON r.place_id = 'event-' || e.id -- Join events table for event reviews
      LEFT JOIN tours t ON r.tour_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status === 'approved') {
      query += ' AND r.is_approved = 1 AND r.is_visible = 1';
    } else if (status === 'pending') {
      query += ' AND r.is_approved = 0';
    } else if (status === 'hidden') {
      query += ' AND r.is_visible = 0';
    }
    
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const reviews = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM reviews r WHERE 1=1';
    const countParams = [];
    
    if (status === 'approved') {
      countQuery += ' AND r.is_approved = 1 AND r.is_visible = 1';
    } else if (status === 'pending') {
      countQuery += ' AND r.is_approved = 0';
    } else if (status === 'hidden') {
      countQuery += ' AND r.is_visible = 0';
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      reviews,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// PUT /api/reviews/admin/:id/approve - Approve a review (admin only)
router.put('/admin/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review
    const stmt = db.prepare('UPDATE reviews SET is_approved = 1, is_visible = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);

    // Log admin activity
    await logAdminActivity(adminId, req.admin.email, 'approve_review', 'Review approved', 'review', id, req);

    res.json({ message: 'Review approved successfully' });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: 'Failed to approve review' });
  }
});

// PUT /api/reviews/admin/:id/hide - Hide a review (admin only)
router.put('/admin/:id/hide', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review
    const stmt = db.prepare('UPDATE reviews SET is_visible = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);

    // Log admin activity
    await logAdminActivity(adminId, req.admin.email, 'hide_review', 'Review hidden', 'review', id, req);

    res.json({ message: 'Review hidden successfully' });
  } catch (error) {
    console.error('Error hiding review:', error);
    res.status(500).json({ error: 'Failed to hide review' });
  }
});

// DELETE /api/reviews/admin/:id - Delete a review (admin only)
router.delete('/admin/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Delete review
    const stmt = db.prepare('DELETE FROM reviews WHERE id = ?');
    stmt.run(id);

    // Log admin activity
    await logAdminActivity(adminId, req.admin.email, 'delete_review', 'Review deleted', 'review', id, req);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// GET /api/reviews/admin/stats - Get comprehensive review statistics for admin
router.get('/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = db.prepare('SELECT * FROM review_stats ORDER BY total_reviews DESC').all();
    
    // Get overall statistics
    const overallStats = db.prepare(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN is_approved = 1 THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN is_approved = 0 THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN is_visible = 0 THEN 1 END) as hidden_reviews,
        COUNT(CASE WHEN place_id IS NOT NULL THEN 1 END) as place_reviews,
        COUNT(CASE WHEN tour_id IS NOT NULL THEN 1 END) as tour_reviews
      FROM reviews
    `).get();

    res.json({ 
      stats, 
      overall: overallStats 
    });
  } catch (error) {
    console.error('Error fetching admin review stats:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

// PUT /api/reviews/:id/approve - Approve a review (admin only)
router.put('/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review status
    db.prepare(`
      UPDATE reviews 
      SET is_approved = 1, is_visible = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);

    // Log admin activity
    const itemName = review.place_id ? 
      db.prepare('SELECT name FROM places WHERE id = ?').get(review.place_id)?.name :
      db.prepare('SELECT name FROM tours WHERE id = ?').get(review.tour_id)?.name;
    
    logAdminActivity(adminId, req.admin.email, 'APPROVE_REVIEW', 
      `Approved review for ${itemName || 'item'}`, 'review', id, req);

    res.json({ message: 'Review approved successfully' });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: 'Failed to approve review' });
  }
});

// PUT /api/reviews/:id/reject - Reject a review (admin only)
router.put('/:id/reject', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review status
    const moderationReasons = reason ? 
      JSON.stringify([reason]) : 
      review.moderation_reasons;

    db.prepare(`
      UPDATE reviews 
      SET is_approved = 0, is_visible = 0, moderation_reasons = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(moderationReasons, id);

    // Log admin activity
    const itemName = review.place_id ? 
      db.prepare('SELECT name FROM places WHERE id = ?').get(review.place_id)?.name :
      db.prepare('SELECT name FROM tours WHERE id = ?').get(review.tour_id)?.name;
    
    logAdminActivity(adminId, req.admin.email, 'REJECT_REVIEW', 
      `Rejected review for ${itemName || 'item'}: ${reason || 'No reason provided'}`, 'review', id, req);

    res.json({ message: 'Review rejected successfully' });
  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({ error: 'Failed to reject review' });
  }
});

// PUT /api/reviews/:id/hide - Hide a review (admin only)
router.put('/:id/hide', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review visibility
    db.prepare(`
      UPDATE reviews 
      SET is_visible = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);

    // Log admin activity
    const itemName = review.place_id ? 
      db.prepare('SELECT name FROM places WHERE id = ?').get(review.place_id)?.name :
      db.prepare('SELECT name FROM tours WHERE id = ?').get(review.tour_id)?.name;
    
    logAdminActivity(adminId, req.admin.email, 'HIDE_REVIEW', 
      `Hidden review for ${itemName || 'item'}`, 'review', id, req);

    res.json({ message: 'Review hidden successfully' });
  } catch (error) {
    console.error('Error hiding review:', error);
    res.status(500).json({ error: 'Failed to hide review' });
  }
});

// PUT /api/reviews/:id/show - Show a review (admin only)
router.put('/:id/show', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    // Check if review exists
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update review visibility
    db.prepare(`
      UPDATE reviews 
      SET is_visible = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);

    // Log admin activity
    const itemName = review.place_id ? 
      db.prepare('SELECT name FROM places WHERE id = ?').get(review.place_id)?.name :
      db.prepare('SELECT name FROM tours WHERE id = ?').get(review.tour_id)?.name;
    
    logAdminActivity(adminId, req.admin.email, 'SHOW_REVIEW', 
      `Showed review for ${itemName || 'item'}`, 'review', id, req);

    res.json({ message: 'Review shown successfully' });
  } catch (error) {
    console.error('Error showing review:', error);
    res.status(500).json({ error: 'Failed to show review' });
  }
});

module.exports = router;
