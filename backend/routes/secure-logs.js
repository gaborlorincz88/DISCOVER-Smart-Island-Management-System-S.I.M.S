const express = require('express');
const secureLogger = require('../services/secureLogger');
const { requireAdminAuth } = require('../middleware/admin-auth');
const router = express.Router();

// Test endpoint to create a test log entry
router.post('/test', requireAdminAuth, async (req, res) => {
  try {
    const secureLogger = require('../services/secureLogger');
    
    // Create a test log entry
    await secureLogger.logActivity(
      req.admin.id,
      req.admin.email,
      'TEST_LOG',
      'Test secure logging functionality',
      'test',
      'test-123',
      { test: true, timestamp: new Date().toISOString() },
      req
    );
    
    res.json({
      success: true,
      message: 'Test log entry created successfully'
    });
  } catch (error) {
    console.error('Error creating test log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test log entry'
    });
  }
});

// Get secure log statistics
router.get('/statistics', requireAdminAuth, async (req, res) => {
  try {
    const stats = await secureLogger.getLogStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error getting log statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get log statistics'
    });
  }
});

// Search secure logs
router.get('/search', requireAdminAuth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      adminEmail,
      actionType,
      keyword,
      limit = 100
    } = req.query;

    const searchParams = {
      startDate: startDate || null,
      endDate: endDate || null,
      adminEmail: adminEmail || null,
      actionType: actionType || null,
      keyword: keyword || null,
      limit: parseInt(limit) || 100
    };

    const results = await secureLogger.searchLogs(searchParams);

    res.json({
      success: true,
      results,
      totalFound: results.length,
      searchParams
    });

  } catch (error) {
    console.error('Error searching secure logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

// Verify log integrity
router.get('/verify', requireAdminAuth, async (req, res) => {
  try {
    const { logFile } = req.query;
    
    if (!logFile) {
      return res.status(400).json({
        success: false,
        error: 'Log file parameter is required'
      });
    }

    const verificationResults = await secureLogger.verifyLogIntegrity(logFile);
    const invalidEntries = verificationResults.filter(result => !result.isValid);
    
    res.json({
      success: true,
      logFile,
      totalEntries: verificationResults.length,
      invalidEntries: invalidEntries.length,
      integrityStatus: invalidEntries.length === 0 ? 'INTACT' : 'TAMPERED',
      verificationResults: verificationResults.slice(0, 50) // Limit response size
    });

  } catch (error) {
    console.error('Error verifying log integrity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify log integrity'
    });
  }
});

// Get available log files
router.get('/files', requireAdminAuth, async (req, res) => {
  try {
    const logFiles = await secureLogger.getLogFiles();
    
    const filesWithInfo = await Promise.all(
      logFiles.map(async (filePath) => {
        const stats = await require('fs').promises.stat(filePath);
        return {
          filename: require('path').basename(filePath),
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );

    res.json({
      success: true,
      files: filesWithInfo
    });

  } catch (error) {
    console.error('Error getting log files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get log files'
    });
  }
});

// Export logs (for backup/analysis)
router.get('/export', requireAdminAuth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      format = 'json',
      includeHash = false 
    } = req.query;

    const searchParams = {
      startDate: startDate || null,
      endDate: endDate || null,
      limit: 10000 // Large limit for export
    };

    const results = await secureLogger.searchLogs(searchParams);

    if (format === 'csv') {
      // Generate CSV export
      const csvHeaders = 'Timestamp,Admin Email,Action Type,Description,IP Address,User Agent,Details,Hash';
      const csvRows = results.map(entry => {
        const details = entry.details ? `"${entry.details.replace(/"/g, '""')}"` : '';
        const hash = includeHash === 'true' ? entry.hash : '';
        return `"${entry.timestamp}","${entry.adminEmail}","${entry.actionType}","${entry.description.replace(/"/g, '""')}","${entry.ipAddress}","${entry.userAgent}","${details}","${hash}"`;
      });
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="admin-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
      
    } else {
      // JSON export
      const exportData = {
        exportDate: new Date().toISOString(),
        totalEntries: results.length,
        searchParams,
        logs: results.map(entry => ({
          timestamp: entry.timestamp,
          adminEmail: entry.adminEmail,
          actionType: entry.actionType,
          description: entry.description,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          details: entry.details,
          ...(includeHash === 'true' && { hash: entry.hash })
        }))
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="admin-logs-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    }

  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export logs'
    });
  }
});

module.exports = router;
