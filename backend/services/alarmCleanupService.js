const fs = require('fs').promises;
const path = require('path');

const USER_ALARMS_FILE = path.join(__dirname, '..', 'data', 'user-alarms.json');
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'cleanup-settings.json');

class AlarmCleanupService {
    constructor() {
        this.cleanupInterval = null;
        this.isRunning = false;
    }

    async ensureDataDir() {
        const dataDir = path.join(__dirname, '..', 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
    }

    async getCleanupSettings() {
        try {
            const settingsData = await fs.readFile(SETTINGS_FILE, 'utf8');
            return JSON.parse(settingsData);
        } catch {
            return { hours: 'off', nextCleanup: null };
        }
    }

    async cleanupInactiveAlarms() {
        try {
            console.log('🧹 Starting automatic alarm cleanup...');
            
            // Get cleanup settings
            const settings = await this.getCleanupSettings();
            
            // Check if cleanup is disabled
            if (settings.hours === 'off') {
                console.log('🚫 Automatic cleanup is disabled, skipping...');
                return;
            }
            
            const cleanupHours = settings.hours || 24;
            
            // Load existing alarms
            let alarms = [];
            try {
                const alarmData = await fs.readFile(USER_ALARMS_FILE, 'utf8');
                alarms = JSON.parse(alarmData);
            } catch {
                console.log('No alarms file found, skipping cleanup');
                return;
            }
            
            // Calculate cutoff time
            const cutoffTime = new Date(Date.now() - cleanupHours * 60 * 60 * 1000);
            
            // Filter out inactive alarms older than cutoff time
            const originalCount = alarms.length;
            const cleanedAlarms = alarms.filter(alarm => {
                if (alarm.isActive) return true; // Keep active alarms
                
                const deactivatedAt = alarm.deactivatedAt ? new Date(alarm.deactivatedAt) : new Date(alarm.createdAt);
                return deactivatedAt > cutoffTime; // Keep if not old enough
            });
            
            const deletedCount = originalCount - cleanedAlarms.length;
            
            if (deletedCount > 0) {
                // Save cleaned alarms
                await fs.writeFile(USER_ALARMS_FILE, JSON.stringify(cleanedAlarms, null, 2));
                console.log(`✅ Cleanup completed: Deleted ${deletedCount} inactive alarms older than ${cleanupHours} hours`);
            } else {
                console.log('✅ Cleanup completed: No alarms to delete');
            }
            
            // Update next cleanup time (only if not disabled)
            const updatedSettings = {
                ...settings,
                lastCleanup: new Date().toISOString()
            };
            
            if (settings.hours !== 'off') {
                const nextCleanup = new Date(Date.now() + cleanupHours * 60 * 60 * 1000);
                updatedSettings.nextCleanup = nextCleanup.toISOString();
            }
            
            await fs.writeFile(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2));
            
        } catch (error) {
            console.error('❌ Error during automatic cleanup:', error);
        }
    }

    startScheduler() {
        if (this.isRunning) {
            console.log('Cleanup scheduler is already running');
            return;
        }

        console.log('🚀 Starting alarm cleanup scheduler...');
        this.isRunning = true;

        // Run cleanup every hour
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupInactiveAlarms();
        }, 60 * 60 * 1000); // 1 hour

        // Run initial cleanup after 1 minute
        setTimeout(async () => {
            await this.cleanupInactiveAlarms();
        }, 60 * 1000); // 1 minute
    }

    stopScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.isRunning = false;
            console.log('🛑 Alarm cleanup scheduler stopped');
        }
    }

    async runCleanupNow() {
        console.log('🧹 Manual cleanup requested...');
        await this.cleanupInactiveAlarms();
    }
}

// Create singleton instance
const cleanupService = new AlarmCleanupService();

module.exports = cleanupService;
