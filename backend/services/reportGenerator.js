const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const aiReportService = require('./aiReportService');
const emailService = require('./emailService');

/**
 * Report Generator Service - Generates PDF reports from analytics data
 */
class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '..', 'reports');
    this.templatePath = path.join(__dirname, '..', 'templates', 'report-template.html');
    
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate a PDF report
   */
  async generateReport(type = 'weekly', period = null, emailRecipients = null) {
    try {
      // Determine period based on type if not provided
      if (!period) {
        period = type === 'weekly' ? '7d' : '30d';
      }

      // Determine report type label for custom date ranges
      let reportTypeLabel = type;
      if (period && period.startsWith('custom:')) {
        reportTypeLabel = 'custom';
      }

      console.log(`Generating ${type} report for period ${period}...`);

      // Fetch analytics data
      const analyticsData = await this.fetchAnalyticsData(period);

      // Generate AI insights
      console.log('Generating AI insights...');
      let aiInsights;
      try {
        aiInsights = await aiReportService.generateInsights(analyticsData, period);
        console.log('AI insights generated successfully');
      } catch (aiError) {
        console.error('Error generating AI insights:', aiError);
        // Use fallback insights if AI fails
        aiInsights = {
          executiveSummary: 'Unable to generate AI insights at this time.',
          keyInsights: ['Analytics data collected successfully'],
          recommendations: ['Review the data manually'],
          opportunities: []
        };
      }

      // Generate HTML content
      console.log('Generating HTML content...');
      const htmlContent = await this.generateHTML(analyticsData, aiInsights, type, period);
      console.log(`HTML content generated, length: ${htmlContent.length} characters`);

      // Convert to PDF
      console.log('Converting to PDF...');
      const pdfPath = await this.convertToPDF(htmlContent, type, period);

      // Get file stats
      const stats = fs.statSync(pdfPath);
      const reportMetadata = {
        filename: path.basename(pdfPath),
        path: pdfPath,
        size: stats.size,
        type: type,
        period: period,
        generatedAt: new Date().toISOString()
      };

      // Save metadata to database (optional)
      await this.saveReportMetadata(reportMetadata);

      // Send email if recipients provided
      console.log(`📧 [REPORT GENERATOR] Email recipients parameter received: "${emailRecipients}" (type: ${typeof emailRecipients}, isNull: ${emailRecipients === null}, isUndefined: ${emailRecipients === undefined})`);
      
      if (emailRecipients !== null && emailRecipients !== undefined) {
        // Ensure emailRecipients is a string
        const recipientsStr = typeof emailRecipients === 'string' ? emailRecipients.trim() : String(emailRecipients || '').trim();
        console.log(`📧 [REPORT GENERATOR] Processed recipients string: "${recipientsStr}" (length: ${recipientsStr.length})`);
        
        if (recipientsStr && recipientsStr.length > 0) {
          try {
            console.log(`📧 [REPORT GENERATOR] Attempting to send email to: ${recipientsStr}`);
            await emailService.sendEmail(
              recipientsStr,
              `${type.charAt(0).toUpperCase() + type.slice(1)} Analytics Report for Discover Gozo`,
              `<p>Dear Admin,</p><p>Please find attached the latest ${type} analytics report for Discover Gozo, covering the period of ${period || (type === 'weekly' ? '7 days' : '30 days')}.</p><p>Best regards,</p><p>Discover Gozo Analytics Team</p>`,
              [{ filename: reportMetadata.filename, path: pdfPath, contentType: 'application/pdf' }]
            );
            reportMetadata.emailSent = true;
            console.log(`✅ [REPORT GENERATOR] Email sent successfully to: ${recipientsStr}`);
          } catch (emailError) {
            console.error('❌ [REPORT GENERATOR] Failed to send email:', emailError.message);
            reportMetadata.emailSent = false;
            reportMetadata.emailError = emailError.message;
          }
        } else {
          console.log('⚠️ [REPORT GENERATOR] Email recipients is empty after processing, skipping email send');
        }
      } else {
        console.log('⚠️ [REPORT GENERATOR] No email recipients provided (null/undefined), skipping email send');
      }

      return reportMetadata;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Fetch analytics data directly from database (more reliable than HTTP)
   */
  async fetchAnalyticsData(period) {
    const db = require('../database');
    
    try {
      // Build date filters
      let dateFilter = '';
      let sessionDateFilter = '';
      let periodString = '-30 days';
      
      // Check if period is a custom date range (format: custom:YYYY-MM-DD:YYYY-MM-DD)
      if (period && period.startsWith('custom:')) {
        const parts = period.split(':');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          // Add one day to endDate to include the full end date
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          const endDateStr = endDatePlusOne.toISOString().split('T')[0];
          
          dateFilter = `AND timestamp >= datetime('${startDate} 00:00:00') AND timestamp < datetime('${endDateStr} 00:00:00')`;
          sessionDateFilter = `start_time >= datetime('${startDate} 00:00:00') AND start_time < datetime('${endDateStr} 00:00:00')`;
          periodString = `${startDate} to ${endDate}`;
        }
      } else if (period === '7d') {
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

      // Get session stats - also try to get from all events if session_data is empty
      let sessionStats = { total_sessions: 0, avg_session_duration: 0, unique_users: 0, unique_sessions: 0 };
      try {
        const sessionData = db.prepare(`
          SELECT event_data, user_id
          FROM analytics 
          WHERE event_name = 'session_data' ${dateFilter}
        `).all();
        
        console.log(`📊 Found ${sessionData.length} session_data events for period ${period}`);
        
        if (sessionData.length > 0) {
          const sessions = sessionData.map(row => {
            try {
              return JSON.parse(row.event_data);
            } catch (e) {
              console.log('Error parsing session data:', e);
              return null;
            }
          }).filter(Boolean);
          
          const uniqueSessions = new Set(sessions.map(s => s.session_id).filter(Boolean));
          const uniqueUsers = new Set(sessions.map(s => s.user_id).filter(Boolean));
          // Also get unique users from the user_id column
          sessionData.forEach(row => {
            if (row.user_id) uniqueUsers.add(row.user_id);
          });
          const durations = sessions.map(s => s.duration).filter(Boolean);
          
          sessionStats = {
            total_sessions: sessions.length,
            avg_session_duration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            unique_users: uniqueUsers.size,
            unique_sessions: uniqueSessions.size
          };
          
          console.log(`📊 Session stats calculated:`, sessionStats);
        } else {
          // Fallback: calculate from all events
          console.log('⚠️ No session_data events found, calculating from all events...');
          const allEvents = db.prepare(`
            SELECT DISTINCT user_id, COUNT(*) as event_count
            FROM analytics 
            WHERE user_id IS NOT NULL ${dateFilter}
            GROUP BY user_id
          `).all();
          
          const totalEvents = db.prepare(`
            SELECT COUNT(*) as total
            FROM analytics 
            WHERE 1=1 ${dateFilter}
          `).get();
          
          const uniqueSessionsSet = new Set();
          const allSessions = db.prepare(`
            SELECT DISTINCT user_id
            FROM analytics 
            WHERE user_id IS NOT NULL ${dateFilter}
          `).all();
          
          sessionStats = {
            total_sessions: allSessions.length || 0,
            avg_session_duration: 0, // Can't calculate without session_data
            unique_users: allEvents.length || 0,
            unique_sessions: allSessions.length || 0
          };
          
          console.log(`📊 Fallback session stats:`, sessionStats);
        }
      } catch (error) {
        console.error('❌ Error getting session stats:', error);
      }

      // Get top places
      const topPlaces = db.prepare(`
        SELECT 
          json_extract(event_data, '$.place_name') as place_name, 
          COUNT(*) as view_count 
        FROM analytics 
        WHERE event_name = 'view_place' ${dateFilter}
        GROUP BY place_name 
        ORDER BY view_count DESC 
        LIMIT 10
      `).all();

      // Get top categories
      const topCategories = db.prepare(`
        SELECT 
          json_extract(event_data, '$.category') as category, 
          COUNT(*) as view_count 
        FROM analytics 
        WHERE event_name = 'view_place' AND json_extract(event_data, '$.category') IS NOT NULL ${dateFilter}
        GROUP BY category 
        ORDER BY view_count DESC 
        LIMIT 10
      `).all();

      // Get device stats
      let deviceStats = [];
      try {
        const sessionData = db.prepare(`
          SELECT event_data
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
        console.log('Device stats query failed');
      }

      // Get hourly stats - use dateFilter for custom ranges, periodString for relative dates
      let hourlyStatsQuery = '';
      if (period && period.startsWith('custom:')) {
        const parts = period.split(':');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          const endDateStr = endDatePlusOne.toISOString().split('T')[0];
          hourlyStatsQuery = `
            SELECT 
              strftime('%H', timestamp) as hour,
              COUNT(*) as event_count,
              COUNT(DISTINCT user_id) as unique_users
            FROM analytics 
            WHERE timestamp >= datetime('${startDate} 00:00:00') AND timestamp < datetime('${endDateStr} 00:00:00')
            GROUP BY strftime('%H', timestamp)
            ORDER BY hour
          `;
        }
      } else {
        hourlyStatsQuery = `
          SELECT 
            strftime('%H', timestamp) as hour,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as unique_users
          FROM analytics 
          WHERE timestamp >= datetime('now', '${periodString}')
          GROUP BY strftime('%H', timestamp)
          ORDER BY hour
        `;
      }
      const hourlyStats = hourlyStatsQuery ? db.prepare(hourlyStatsQuery).all() : [];

      // Get daily stats - use dateFilter for custom ranges, periodString for relative dates
      let dailyStatsQuery = '';
      if (period && period.startsWith('custom:')) {
        const parts = period.split(':');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          const endDateStr = endDatePlusOne.toISOString().split('T')[0];
          dailyStatsQuery = `
            SELECT 
              strftime('%Y-%m-%d', timestamp) as date,
              COUNT(*) as event_count,
              COUNT(DISTINCT user_id) as unique_users
            FROM analytics 
            WHERE timestamp >= datetime('${startDate} 00:00:00') AND timestamp < datetime('${endDateStr} 00:00:00')
            GROUP BY strftime('%Y-%m-%d', timestamp)
            ORDER BY date
          `;
        }
      } else {
        dailyStatsQuery = `
          SELECT 
            strftime('%Y-%m-%d', timestamp) as date,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as unique_users
          FROM analytics 
          WHERE timestamp >= datetime('now', '${periodString}')
          GROUP BY strftime('%Y-%m-%d', timestamp)
          ORDER BY date
        `;
      }
      const dailyStats = dailyStatsQuery ? db.prepare(dailyStatsQuery).all() : [];

      // Get heatmap data
      const heatmapData = db.prepare(`
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

      // Get search analytics
      const searchAnalytics = db.prepare(`
        SELECT 
          json_extract(event_data, '$.query') as query,
          COUNT(*) as search_count
        FROM analytics 
        WHERE event_name = 'search_query' 
          AND json_extract(event_data, '$.query') IS NOT NULL
          ${dateFilter}
        GROUP BY query
        ORDER BY search_count DESC
        LIMIT 20
      `).all();

      // Get economic activity
      const economicActivity = db.prepare(`
        SELECT 
          json_extract(event_data, '$.place_name') as place_name,
          json_extract(event_data, '$.category') as category,
          COUNT(*) as interactions
        FROM analytics 
        WHERE event_name IN ('view_place', 'bookmark_place', 'add_to_trip')
          AND json_extract(event_data, '$.category') IN ('Food & Drink', 'Shopping', 'Boat Tour', 'Art & Culture')
          ${dateFilter}
        GROUP BY place_name, category
        ORDER BY interactions DESC
        LIMIT 20
      `).all();

      // Get tour analytics
      const mostViewedTours = db.prepare(`
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
        LIMIT 10
      `).all();

      const mostBookedTours = db.prepare(`
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
        LIMIT 10
      `).all();

      const tourRevenue = db.prepare(`
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
        LIMIT 10
      `).all();

      const ticketsSold = db.prepare(`
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
        LIMIT 10
      `).all();

      // Get abandoned checkouts
      const checkoutStarts = db.prepare(`
        SELECT 
          json_extract(event_data, '$.tour_id') as tour_id,
          json_extract(event_data, '$.tour_name') as tour_name,
          user_id,
          timestamp
        FROM analytics 
        WHERE event_name = 'start_checkout'
          AND json_extract(event_data, '$.tour_name') IS NOT NULL
          ${dateFilter}
      `).all();

      const completedBookings = db.prepare(`
        SELECT 
          json_extract(event_data, '$.tour_id') as tour_id,
          user_id
        FROM analytics 
        WHERE event_name = 'complete_booking'
          ${dateFilter}
      `).all();

      const completedSet = new Set();
      completedBookings.forEach(booking => {
        if (booking.tour_id && booking.user_id) {
          completedSet.add(`${booking.tour_id}_${booking.user_id}`);
        }
      });

      const abandoned = checkoutStarts.filter(start => {
        if (!start.tour_id || !start.user_id) return false;
        return !completedSet.has(`${start.tour_id}_${start.user_id}`);
      });

      const abandonedByTour = {};
      abandoned.forEach(item => {
        const tourName = item.tour_name || 'Unknown';
        abandonedByTour[tourName] = (abandonedByTour[tourName] || 0) + 1;
      });

      const abandonedCheckouts = Object.entries(abandonedByTour).map(([tour_name, abandoned_count]) => ({
        tour_name,
        abandoned_count
      })).sort((a, b) => b.abandoned_count - a.abandoned_count).slice(0, 10);

      const unpaidTours = db.prepare(`
        SELECT 
          id,
          tour_name,
          user_id,
          quantity,
          total_price,
          currency,
          created_at,
          contact_email
        FROM reservations 
        WHERE status = 'pending'
          AND created_at < datetime('now', '-24 hours')
          AND tour_name IS NOT NULL
          ${dateFilter}
        ORDER BY created_at DESC
        LIMIT 20
      `).all();

      // Get merchant analytics
      let merchantDateFilter = '';
      if (period && period.startsWith('custom:')) {
        const parts = period.split(':');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          const endDateStr = endDatePlusOne.toISOString().split('T')[0];
          merchantDateFilter = `AND tv.scanned_at >= datetime('${startDate} 00:00:00') AND tv.scanned_at < datetime('${endDateStr} 00:00:00')`;
        }
      } else if (period === '7d') {
        merchantDateFilter = "AND tv.scanned_at >= datetime('now', '-7 days')";
      } else if (period === '30d') {
        merchantDateFilter = "AND tv.scanned_at >= datetime('now', '-30 days')";
      } else if (period === '90d') {
        merchantDateFilter = "AND tv.scanned_at >= datetime('now', '-90 days')";
      } else if (period === '1y') {
        merchantDateFilter = "AND tv.scanned_at >= datetime('now', '-1 year')";
      }

      let merchantReservationDateFilter = merchantDateFilter.replace('tv.scanned_at', 'r.created_at');

      const merchantScans = db.prepare(`
        SELECT 
          m.id as merchant_id,
          m.name as merchant_name,
          m.business_name,
          COUNT(tv.id) as scan_count,
          COUNT(DISTINCT tv.reservation_id) as unique_tickets_scanned
        FROM ticket_validations tv
        JOIN merchants m ON tv.merchant_id = m.id
        WHERE tv.status = 'validated'
          ${merchantDateFilter}
        GROUP BY m.id, m.name, m.business_name
        ORDER BY scan_count DESC
        LIMIT 10
      `).all();

      const merchantRevenue = db.prepare(`
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
          ${merchantReservationDateFilter}
        GROUP BY m.id, m.name, m.business_name, r.currency
        ORDER BY total_revenue DESC
        LIMIT 10
      `).all();

      const merchantReservations = db.prepare(`
        SELECT 
          m.id as merchant_id,
          m.name as merchant_name,
          m.business_name,
          COUNT(DISTINCT r.id) as reservation_count,
          SUM(r.quantity) as total_tickets
        FROM reservations r
        JOIN tickets t ON r.ticket_id = t.id
        JOIN merchants m ON json_extract(m.assigned_tours, '$') LIKE '%' || t.id || '%'
        WHERE r.status IN ('confirmed', 'completed', 'pending')
          AND r.tour_name IS NOT NULL
          ${merchantReservationDateFilter}
        GROUP BY m.id, m.name, m.business_name
        ORDER BY reservation_count DESC
        LIMIT 10
      `).all();

      const merchantUnused = db.prepare(`
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
          ${merchantReservationDateFilter}
        GROUP BY m.id, m.name, m.business_name
        ORDER BY unused_count DESC
        LIMIT 10
      `).all();

      return {
        sessionStats,
        topPlaces,
        topCategories,
        deviceStats,
        hourlyStats,
        dailyStats,
        heatmapData,
        searchAnalytics,
        economicActivity,
        tourAnalytics: {
          mostViewedTours,
          mostBookedTours,
          tourRevenue,
          ticketsSold,
          abandonedCheckouts,
          unpaidTours
        },
        merchantAnalytics: {
          merchantScans,
          merchantRevenue,
          merchantReservations,
          merchantUnused
        },
        summary: {
          topPlaces,
          topCategories,
          topTrips: [],
          topSearchQueries: searchAnalytics
        },
        tripAnalytics: {},
        period
      };
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      throw new Error('Failed to fetch analytics data: ' + error.message);
    }
  }

  /**
   * Generate HTML content from template
   */
  async generateHTML(analyticsData, aiInsights, type, period) {
    // Read template
    let template;
    try {
      template = fs.readFileSync(this.templatePath, 'utf8');
    } catch (error) {
      // Use inline template if file doesn't exist
      template = this.getDefaultTemplate();
    }

    // Load logo as base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(__dirname, '..', 'public', 'bestlogowhite.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        console.log('✅ Logo loaded successfully');
      } else {
        console.log('⚠️ Logo file not found at:', logoPath);
      }
    } catch (error) {
      console.log('⚠️ Could not load logo:', error.message);
    }

    // Prepare data for template
    const templateData = {
      type: type,
      period: period,
      periodLabel: this.getPeriodLabel(period),
      generatedAt: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      logoBase64: logoBase64,
      sessionStats: analyticsData.sessionStats || {},
      topPlaces: analyticsData.topPlaces || analyticsData.summary?.topPlaces || [],
      topCategories: analyticsData.topCategories || analyticsData.summary?.topCategories || [],
      deviceStats: analyticsData.deviceStats || [],
      hourlyStats: analyticsData.hourlyStats || [],
      dailyStats: analyticsData.dailyStats || [],
      searchAnalytics: analyticsData.searchAnalytics || [],
      economicActivity: analyticsData.economicActivity || [],
      heatmapData: analyticsData.heatmapData || [],
      tourAnalytics: analyticsData.tourAnalytics || {},
      merchantAnalytics: analyticsData.merchantAnalytics || {},
      aiInsights: aiInsights
    };

    // Replace template variables
    let html = template;
    
    // Replace nested sessionStats properties
    if (templateData.sessionStats) {
      const stats = templateData.sessionStats;
      html = html.replace(/{{sessionStats\.total_sessions}}/g, String(stats.total_sessions || 0));
      html = html.replace(/{{sessionStats\.unique_users}}/g, String(stats.unique_users || 0));
      html = html.replace(/{{sessionStats\.avg_session_duration}}/g, String(Math.round(stats.avg_session_duration || 0)));
      html = html.replace(/{{sessionStats\.unique_sessions}}/g, String(stats.unique_sessions || 0));
    }
    
    // Replace other template variables
    Object.keys(templateData).forEach(key => {
      let value = templateData[key];
      if (typeof value === 'object' && value !== null && key !== 'sessionStats') {
        // Stringify for JavaScript - escape single quotes and backslashes for use in single-quoted strings
        value = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      } else if (value === null || value === undefined) {
        value = '';
      }
      // Escape special regex characters in the key
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`{{${escapedKey}}}`, 'g'), String(value));
    });

    // Replace AI insights sections (ensure they're replaced even if already done above)
    if (aiInsights.executiveSummary) {
      html = html.replace(/{{executiveSummary}}/g, aiInsights.executiveSummary);
    }
    if (aiInsights.keyInsights && Array.isArray(aiInsights.keyInsights)) {
      html = html.replace(/{{keyInsights}}/g, this.formatList(aiInsights.keyInsights));
    }
    if (aiInsights.recommendations && Array.isArray(aiInsights.recommendations)) {
      html = html.replace(/{{recommendations}}/g, this.formatList(aiInsights.recommendations));
    }
    if (aiInsights.opportunities && Array.isArray(aiInsights.opportunities)) {
      html = html.replace(/{{opportunities}}/g, this.formatList(aiInsights.opportunities));
    }
    
    // Replace top places and categories in template
    if (templateData.topPlaces && Array.isArray(templateData.topPlaces)) {
      const placesJson = JSON.stringify(templateData.topPlaces);
      html = html.replace(/{{topPlaces}}/g, placesJson);
    }
    if (templateData.topCategories && Array.isArray(templateData.topCategories)) {
      const categoriesJson = JSON.stringify(templateData.topCategories);
      html = html.replace(/{{topCategories}}/g, categoriesJson);
    }

    // Replace tour and merchant analytics
    if (templateData.tourAnalytics) {
      const tourAnalyticsJson = JSON.stringify(templateData.tourAnalytics);
      html = html.replace(/{{tourAnalytics}}/g, tourAnalyticsJson);
    }
    if (templateData.merchantAnalytics) {
      const merchantAnalyticsJson = JSON.stringify(templateData.merchantAnalytics);
      html = html.replace(/{{merchantAnalytics}}/g, merchantAnalyticsJson);
    }

    return html;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  async convertToPDF(htmlContent, type, period) {
    let browser;
    try {
      console.log('Launching Puppeteer browser...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ],
        timeout: 30000
      });
      console.log('Browser launched successfully');

      const page = await browser.newPage();
      console.log('New page created, setting content...');
      
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      console.log('Content set, waiting for charts to render...');
      
      // Wait for charts to render (Chart.js needs time to draw)
      // Use Promise-based delay instead of waitForTimeout (deprecated)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Also wait for Chart.js to be ready
      try {
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (typeof Chart !== 'undefined') {
              // Wait a bit more for charts to fully render
              setTimeout(resolve, 1000);
            } else {
              resolve();
            }
          });
        });
      } catch (e) {
        console.log('Chart wait completed (or charts not present)');
      }
      
      console.log('Generating PDF...');
      
      // Generate filename based on type and period
      let filename;
      if (period && period.startsWith('custom:')) {
        const parts = period.split(':');
        const startDate = parts[1];
        const endDate = parts[2];
        filename = `custom-${startDate}-to-${endDate}.pdf`;
      } else {
        filename = `${type}-${this.getDateString(type)}.pdf`;
      }
      const pdfPath = path.join(this.reportsDir, filename);

      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        timeout: 60000
      });

      console.log(`PDF generated successfully: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      console.error('Error in convertToPDF:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to convert HTML to PDF: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('Browser closed');
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  /**
   * Get date string for filename
   */
  getDateString(type) {
    const now = new Date();
    if (type === 'weekly') {
      return now.toISOString().split('T')[0]; // YYYY-MM-DD
    } else {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    }
  }

  /**
   * Get period label
   */
  getPeriodLabel(period) {
    const labels = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      '1y': 'Last Year'
    };
    return labels[period] || period;
  }

  /**
   * Format list as HTML
   */
  formatList(items) {
    if (!Array.isArray(items)) return '';
    return items.map(item => `<li>${item}</li>`).join('');
  }

  /**
   * Save report metadata to database
   */
  async saveReportMetadata(metadata) {
    try {
      const db = require('../database');
      const stmt = db.prepare(`
        INSERT INTO report_metadata (filename, type, period, size, generated_at, email_sent)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        metadata.filename,
        metadata.type,
        metadata.period,
        metadata.size,
        metadata.generatedAt,
        metadata.emailSent ? 1 : 0
      );
    } catch (error) {
      // Table might not exist, that's okay
      console.log('Could not save report metadata:', error.message);
    }
  }

  /**
   * Get default template if file doesn't exist
   */
  getDefaultTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Discover Gozo Analytics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .section { margin: 30px 0; }
        .section h2 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .metric-card { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .insights ul { line-height: 1.8; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table th, table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        table th { background: #667eea; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Discover Gozo Analytics Report</h1>
        <p>{{type}} Report - {{periodLabel}}</p>
        <p>Generated: {{generatedAt}}</p>
    </div>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <p>{{executiveSummary}}</p>
    </div>
    
    <div class="section">
        <h2>Key Metrics</h2>
        <div class="metric-card">
            <strong>Total Sessions:</strong> {{sessionStats.total_sessions}}<br>
            <strong>Unique Users:</strong> {{sessionStats.unique_users}}<br>
            <strong>Average Session Duration:</strong> {{sessionStats.avg_session_duration}} seconds
        </div>
    </div>
    
    <div class="section insights">
        <h2>Key Insights</h2>
        <ul>{{keyInsights}}</ul>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <ul>{{recommendations}}</ul>
    </div>
</body>
</html>`;
  }
}

// Export singleton instance
const reportGenerator = new ReportGenerator();

module.exports = reportGenerator;

