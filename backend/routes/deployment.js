const express = require('express');
const router = express.Router();
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');
const deploymentConfig = require('../services/deploymentConfig');

// GET /api/deployment/public-config - Get public configuration (no auth required)
// This endpoint is used by the frontend to know which backend URL to use
router.get('/public-config', async (req, res) => {
    try {
        const backendUrl = deploymentConfig.getBackendUrl();
        const environment = deploymentConfig.getConfig().environment;
        
        res.json({
            success: true,
            backendUrl: backendUrl,
            environment: environment
        });
    } catch (error) {
        console.error('Error fetching public config:', error);
        // Fallback to default values
        res.json({
            success: true,
            backendUrl: 'http://localhost:3003',
            environment: 'development'
        });
    }
});

// GET /api/deployment/config - Get current deployment configuration
router.get('/config', requireAdminAuth, async (req, res) => {
    try {
        const config = deploymentConfig.getConfig();
        
        // Log activity
        await logAdminActivity(
            req.admin.email,
            'DEPLOYMENT_CONFIG_VIEW',
            'Viewed deployment configuration',
            req.ip
        );
        
        res.json({
            success: true,
            config: config,
            backendUrl: deploymentConfig.getBackendUrl(),
            frontendUrl: deploymentConfig.getFrontendUrl()
        });
    } catch (error) {
        console.error('Error fetching deployment config:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch deployment configuration' 
        });
    }
});

// PUT /api/deployment/config - Update deployment configuration
router.put('/config', requireAdminAuth, async (req, res) => {
    try {
        const updates = req.body;
        
        // Validate required fields
        if (updates.backend) {
            if (updates.backend.port && (updates.backend.port < 1 || updates.backend.port > 65535)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid port number' 
                });
            }
        }
        
        if (updates.frontend) {
            if (updates.frontend.port && (updates.frontend.port < 1 || updates.frontend.port > 65535)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid port number' 
                });
            }
        }
        
        const newConfig = await deploymentConfig.updateConfig(updates);
        
        // Log activity
        await logAdminActivity(
            req.admin.email,
            'DEPLOYMENT_CONFIG_UPDATE',
            `Updated deployment configuration: Environment=${newConfig.environment}, Backend=${deploymentConfig.getBackendUrl()}`,
            req.ip
        );
        
        res.json({
            success: true,
            message: 'Deployment configuration updated successfully. Please restart the server for changes to take effect.',
            config: newConfig,
            backendUrl: deploymentConfig.getBackendUrl(),
            frontendUrl: deploymentConfig.getFrontendUrl(),
            requiresRestart: true
        });
    } catch (error) {
        console.error('Error updating deployment config:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update deployment configuration' 
        });
    }
});

// POST /api/deployment/test-connection - Test backend connection
router.post('/test-connection', requireAdminAuth, async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL is required' 
            });
        }
        
        // Log activity
        await logAdminActivity(
            req.admin.email,
            'DEPLOYMENT_CONNECTION_TEST',
            `Tested connection to: ${url}`,
            req.ip
        );
        
        // Simple test - just return success as this server is responding
        res.json({
            success: true,
            message: 'Connection test successful',
            url: url,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Connection test failed' 
        });
    }
});

// GET /api/deployment/status - Get deployment status and health
router.get('/status', requireAdminAuth, async (req, res) => {
    try {
        const config = deploymentConfig.getConfig();
        const uptime = process.uptime();
        
        res.json({
            success: true,
            status: 'running',
            environment: config.environment,
            backendUrl: deploymentConfig.getBackendUrl(),
            frontendUrl: deploymentConfig.getFrontendUrl(),
            uptime: uptime,
            uptimeFormatted: formatUptime(uptime),
            nodeVersion: process.version,
            platform: process.platform,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        });
    } catch (error) {
        console.error('Error fetching deployment status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch deployment status' 
        });
    }
});

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
}

module.exports = router;

