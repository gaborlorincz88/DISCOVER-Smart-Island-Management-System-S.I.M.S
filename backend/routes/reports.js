const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');
const reportGenerator = require('../services/reportGenerator');
const aiReportService = require('../services/aiReportService');
const emailService = require('../services/emailService');
const reportScheduler = require('../services/reportScheduler');
const { requireAdminAuth } = require('../middleware/admin-auth');

// Use the proper admin authentication middleware
const requireAdmin = requireAdminAuth;

/**
 * POST /api/reports/generate
 * Generate a report on demand
 */
router.post('/generate', requireAdmin, async (req, res) => {
  try {
    const { type = 'weekly', period = null, email = false, startDate, endDate } = req.query;
    
    // Determine period if not provided
    let reportPeriod = period;
    let reportType = type;
    
    // If custom date range is provided, use it
    if (startDate && endDate) {
      reportPeriod = `custom:${startDate}:${endDate}`;
      reportType = 'custom'; // Set type to custom when date range is provided
    } else if (!reportPeriod) {
      // Default periods for weekly/monthly
      reportPeriod = type === 'weekly' ? '7d' : '30d';
    }
    
    // Allow 'custom' type for custom date ranges
    if (!['weekly', 'monthly', 'custom'].includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type. Use "weekly", "monthly", or provide startDate and endDate for custom range' });
    }
    
    const sendEmail = email === 'true' || email === true;
    console.log(`📧 [ROUTE] Email requested: ${sendEmail} (email param: ${email})`);
    
    // Get global email recipients if email is enabled
    let emailRecipients = null;
    if (sendEmail) {
      const recipients = emailService.getRecipients();
      console.log(`📧 [ROUTE] Retrieved recipients from config: "${recipients}" (type: ${typeof recipients}, length: ${recipients ? recipients.length : 0})`);
      if (recipients && typeof recipients === 'string' && recipients.trim()) {
        emailRecipients = recipients.trim();
        console.log(`📧 [ROUTE] Email will be sent to: ${emailRecipients}`);
      } else {
        console.warn('⚠️ [ROUTE] Email requested but no recipients configured in Email Configuration');
        console.warn(`⚠️ [ROUTE] Recipients value: "${recipients}", type: ${typeof recipients}`);
        emailRecipients = null;
      }
    } else {
      console.log('📧 [ROUTE] Email sending is disabled for this report');
    }

    console.log(`📧 [ROUTE] Final emailRecipients before passing to generator: "${emailRecipients}"`);
    console.log(`Generating ${reportType} report for period: ${reportPeriod}...`);
    const report = await reportGenerator.generateReport(reportType, reportPeriod, emailRecipients);

    res.json({
      success: true,
      report: report
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      message: error.message 
    });
  }
});

/**
 * GET /api/reports/list
 * List all available reports
 */
router.get('/list', requireAdmin, (req, res) => {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      return res.json({ reports: [] });
    }

    const files = fs.readdirSync(reportsDir)
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(reportsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

    res.json({ reports: files });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * GET /api/reports/weekly
 * Get latest weekly report
 */
router.get('/weekly', requireAdmin, (req, res) => {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      return res.status(404).json({ error: 'No reports directory found' });
    }

    const files = fs.readdirSync(reportsDir)
      .filter(file => file.startsWith('weekly-') && file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(reportsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: filePath
        };
      })
      .sort((a, b) => b.modified - a.modified);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No weekly reports found' });
    }

    res.json({ report: files[0] });
  } catch (error) {
    console.error('Error getting weekly report:', error);
    res.status(500).json({ error: 'Failed to get weekly report' });
  }
});

/**
 * GET /api/reports/monthly
 * Get latest monthly report
 */
router.get('/monthly', requireAdmin, (req, res) => {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      return res.status(404).json({ error: 'No reports directory found' });
    }

    const files = fs.readdirSync(reportsDir)
      .filter(file => file.startsWith('monthly-') && file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(reportsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: filePath
        };
      })
      .sort((a, b) => b.modified - a.modified);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No monthly reports found' });
    }

    res.json({ report: files[0] });
  } catch (error) {
    console.error('Error getting monthly report:', error);
    res.status(500).json({ error: 'Failed to get monthly report' });
  }
});

/**
 * GET /api/reports/:filename/download
 * Download a specific report
 */
router.get('/:filename/download', requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename;
    const reportsDir = path.join(__dirname, '..', 'reports');
    const filePath = path.join(reportsDir, filename);

    // Security: Ensure file is within reports directory
    if (!filePath.startsWith(reportsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading report:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download report' });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

/**
 * GET /api/reports/settings
 * Get report settings (API key, email config, etc.)
 */
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const apiKey = aiReportService.getApiKey();
    const model = aiReportService.getModel();
    const emailConfig = emailService.getConfig();
    const schedulerStatus = reportScheduler.getStatus();
    
    // Get last test time
    const lastTestStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const lastTestResult = lastTestStmt.get('google_ai_last_test');
    const lastTestTime = lastTestResult ? lastTestResult.value : null;

    res.json({
      ai: {
        apiKeyConfigured: !!apiKey,
        apiKey: apiKey || null, // Return full API key for display
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : null,
        model: model,
        lastTestTime: lastTestTime
      },
      email: emailConfig,
      scheduler: schedulerStatus
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * POST /api/reports/settings/ai
 * Update AI settings (API key, model)
 */
router.post('/settings/ai', requireAdmin, async (req, res) => {
  try {
    const { apiKey, model, skipValidation } = req.body;

    if (apiKey !== undefined) {
      const trimmedKey = apiKey ? apiKey.trim() : '';
      
      // Validate API key if provided and validation is not skipped
      if (trimmedKey && !skipValidation) {
        // Basic format check
        if (!trimmedKey.startsWith('AIza') || trimmedKey.length < 30) {
          return res.status(400).json({ 
            error: 'Invalid API key format. Gemini API keys should start with "AIza" and be at least 30 characters long.',
            details: `Key length: ${trimmedKey.length}`
          });
        }
        
        console.log('Validating API key, length:', trimmedKey.length);
        
        try {
          await aiReportService.validateApiKey(trimmedKey);
          // If validation succeeds, save the key and update last test time
          const saveResult = aiReportService.saveApiKey(trimmedKey);
          
          if (!saveResult) {
            return res.status(500).json({ error: 'Failed to save API key to database' });
          }
          
          // Verify it was saved correctly
          const savedKey = aiReportService.getApiKey();
          if (savedKey !== trimmedKey) {
            console.error('API key mismatch after save! Expected length:', trimmedKey.length, 'Got length:', savedKey ? savedKey.length : 0);
            return res.status(500).json({ error: 'API key was not saved correctly. Please try again.' });
          }
          
          // Save last successful test time
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO settings (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
          `);
          stmt.run('google_ai_last_test', new Date().toISOString());
          
          console.log('API key validated and saved successfully, length:', trimmedKey.length);
        } catch (validationError) {
          console.error('API key validation error:', validationError);
          // Return detailed error message
          return res.status(400).json({ 
            error: validationError.message || 'Failed to validate API key',
            details: validationError.toString()
          });
        }
      } else if (apiKey !== undefined) {
        // Save empty key if provided (to clear it)
        aiReportService.saveApiKey(trimmedKey);
      }
    }

    if (model) {
      aiReportService.saveModel(model);
    }

    res.json({ success: true, message: 'AI settings updated' });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ error: 'Failed to update AI settings', details: error.message });
  }
});

/**
 * POST /api/reports/settings/email
 * Update email settings
 */
router.post('/settings/email', requireAdmin, (req, res) => {
  try {
    const config = req.body;
    console.log('📧 Saving email config:', Object.keys(config).join(', '), 'recipients:', config.recipients);
    emailService.saveConfig(config);
    console.log('📧 Email config saved. Verifying recipients:', emailService.getRecipients());
    res.json({ success: true, message: 'Email settings updated' });
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

/**
 * POST /api/reports/settings/email/test
 * Test email configuration
 */
router.post('/settings/email/test', requireAdmin, async (req, res) => {
  try {
    const result = await emailService.testEmail();
    res.json({ success: true, message: 'Test email sent successfully', ...result });
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: 'Failed to send test email', message: error.message });
  }
});

/**
 * POST /api/reports/scheduler/start
 * Start the report scheduler
 */
router.post('/scheduler/start', requireAdmin, (req, res) => {
  try {
    reportScheduler.start();
    res.json({ success: true, message: 'Scheduler started' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

/**
 * POST /api/reports/scheduler/stop
 * Stop the report scheduler
 */
router.post('/scheduler/stop', requireAdmin, (req, res) => {
  try {
    reportScheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped' });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

/**
 * GET /api/reports/scheduler/status
 * Get scheduler status
 */
router.get('/scheduler/status', requireAdmin, (req, res) => {
  try {
    const status = reportScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

/**
 * GET /api/reports/scheduler/settings
 * Get scheduler settings
 */
router.get('/scheduler/settings', requireAdmin, (req, res) => {
  try {
    const settings = reportScheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error getting scheduler settings:', error);
    res.status(500).json({ error: 'Failed to get scheduler settings' });
  }
});

/**
 * POST /api/reports/scheduler/settings
 * Update scheduler settings
 */
router.post('/scheduler/settings', requireAdmin, (req, res) => {
  try {
    const { enabled, weekly, monthly } = req.body;
    const newSettings = {
      enabled: enabled !== undefined ? enabled : reportScheduler.settings.enabled,
      weekly: weekly || reportScheduler.settings.weekly,
      monthly: monthly || reportScheduler.settings.monthly
    };
    reportScheduler.updateSettings(newSettings);
    res.json({ success: true, message: 'Scheduler settings updated' });
  } catch (error) {
    console.error('Error updating scheduler settings:', error);
    res.status(500).json({ error: 'Failed to update scheduler settings' });
  }
});

/**
 * POST /api/reports/scheduler/test
 * Test run a report immediately (for testing purposes)
 */
router.post('/scheduler/test', requireAdmin, async (req, res) => {
  try {
    const { type = 'weekly' } = req.body;
    console.log(`Test run: Generating ${type} report immediately...`);
    const report = await reportGenerator.generateReport(type, type === 'weekly' ? '7d' : '30d', false);
    res.json({ success: true, message: `${type} report generated successfully for testing`, report });
  } catch (error) {
    console.error('Error in test run:', error);
    res.status(500).json({ error: 'Failed to generate test report', message: error.message });
  }
});

module.exports = router;

