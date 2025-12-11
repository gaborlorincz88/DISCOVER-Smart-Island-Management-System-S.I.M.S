const cron = require('node-cron');
const reportGenerator = require('./reportGenerator');
const emailService = require('./emailService');
const db = require('../database');

/**
 * Report Scheduler Service - Handles automated report generation
 */
class ReportScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
    this.settings = {
      enabled: false,
      weekly: { enabled: false, day: 1, time: '09:00', sendEmail: false }, // Monday at 9:00 AM
      monthly: { enabled: false, day: 1, time: '09:00', sendEmail: false } // 1st at 9:00 AM
    };
    this.loadSettings();
  }

  /**
   * Load settings from database
   */
  loadSettings() {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?');
      const settings = stmt.all('scheduler_%');
      
      settings.forEach(s => {
        const key = s.key.replace('scheduler_', '');
        if (key === 'enabled') {
          this.settings.enabled = s.value === 'true';
        } else if (key.startsWith('weekly_')) {
          const subKey = key.replace('weekly_', '');
          if (subKey === 'enabled') {
            this.settings.weekly.enabled = s.value === 'true';
          } else if (subKey === 'day') {
            this.settings.weekly.day = parseInt(s.value) || 1;
          } else if (subKey === 'time') {
            this.settings.weekly.time = s.value || '09:00';
          } else if (subKey === 'sendEmail') {
            this.settings.weekly.sendEmail = s.value === 'true';
          }
        } else if (key.startsWith('monthly_')) {
          const subKey = key.replace('monthly_', '');
          if (subKey === 'enabled') {
            this.settings.monthly.enabled = s.value === 'true';
          } else if (subKey === 'day') {
            this.settings.monthly.day = parseInt(s.value) || 1;
          } else if (subKey === 'time') {
            this.settings.monthly.time = s.value || '09:00';
          } else if (subKey === 'sendEmail') {
            this.settings.monthly.sendEmail = s.value === 'true';
          }
        }
      });
    } catch (error) {
      console.error('Error loading scheduler settings:', error);
    }
  }

  /**
   * Save settings to database
   */
  saveSettings() {
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))');
      stmt.run('scheduler_enabled', this.settings.enabled ? 'true' : 'false');
      stmt.run('scheduler_weekly_enabled', this.settings.weekly.enabled ? 'true' : 'false');
      stmt.run('scheduler_weekly_day', String(this.settings.weekly.day));
      stmt.run('scheduler_weekly_time', this.settings.weekly.time);
      stmt.run('scheduler_monthly_enabled', this.settings.monthly.enabled ? 'true' : 'false');
      stmt.run('scheduler_monthly_day', String(this.settings.monthly.day));
      stmt.run('scheduler_monthly_time', this.settings.monthly.time);
      stmt.run('scheduler_weekly_sendEmail', this.settings.weekly.sendEmail ? 'true' : 'false');
      stmt.run('scheduler_monthly_sendEmail', this.settings.monthly.sendEmail ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving scheduler settings:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    console.log('Updating scheduler settings:', JSON.stringify(newSettings, null, 2));
    // Deep merge settings
    if (newSettings.weekly) {
      this.settings.weekly = { ...this.settings.weekly, ...newSettings.weekly };
    }
    if (newSettings.monthly) {
      this.settings.monthly = { ...this.settings.monthly, ...newSettings.monthly };
    }
    if (newSettings.enabled !== undefined) {
      this.settings.enabled = newSettings.enabled;
    }
    console.log('Updated settings:', JSON.stringify(this.settings, null, 2));
    this.saveSettings();
    if (this.settings.enabled) {
      console.log('Scheduler enabled, restarting...');
      this.restart();
    } else {
      console.log('Scheduler disabled, stopping...');
      this.stop();
    }
  }

  /**
   * Restart scheduler with current settings
   */
  restart() {
    console.log('Restarting scheduler...');
    console.log('Current isRunning:', this.isRunning);
    console.log('Current jobs count:', this.jobs.length);
    this.stop();
    if (!this.settings.enabled) {
      console.log('Scheduler not enabled, not starting');
      return;
    }
    console.log('Starting scheduler after restart...');
    this.start();
  }

  /**
   * Start the scheduler
   */
  start() {
    console.log('=== START SCHEDULER CALLED ===');
    console.log('isRunning:', this.isRunning);
    console.log('settings.enabled:', this.settings.enabled);
    console.log('weekly.enabled:', this.settings.weekly?.enabled);
    console.log('monthly.enabled:', this.settings.monthly?.enabled);
    
    if (this.isRunning) {
      console.log('Report scheduler is already running, stopping first...');
      this.stop();
    }

    if (!this.settings.enabled) {
      console.log('Scheduler is disabled in settings');
      return;
    }

    console.log('Starting report scheduler...');
    this.jobs = [];

    // Weekly report
    if (this.settings.weekly.enabled) {
      const [hours, minutes] = this.settings.weekly.time.split(':').map(Number);
      const dayOfWeek = this.settings.weekly.day; // 0 = Sunday, 1 = Monday, etc.
      const cronExpr = `${minutes} ${hours} * * ${dayOfWeek}`;
      
      console.log(`Creating weekly job with cron: ${cronExpr} (Day ${dayOfWeek} = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]})`);
      
      const weeklyJob = cron.schedule(cronExpr, async () => {
        console.log('⏰ CRON TRIGGERED: Generating weekly report...');
        try {
          const sendEmail = this.settings.weekly.sendEmail;
          let emailRecipients = null;
          if (sendEmail) {
            emailRecipients = emailService.getRecipients();
            if (!emailRecipients || !emailRecipients.trim()) {
              console.warn('⚠️ Weekly report email enabled but no recipients configured in Email Configuration');
              emailRecipients = null;
            }
          }
          console.log(`Weekly report email: ${sendEmail && emailRecipients ? 'enabled' : 'disabled'}, recipients: ${emailRecipients || 'none'}`);
          const report = await reportGenerator.generateReport('weekly', '7d', emailRecipients);
          console.log('✅ Weekly report generated:', report.filename);
        } catch (error) {
          console.error('❌ Error generating weekly report:', error);
        }
      }, {
        scheduled: false,
        timezone: process.env.TZ || 'Europe/Malta'
      });

      weeklyJob.start();
      this.jobs.push({ name: 'weekly', job: weeklyJob });
      
      try {
        const nextRun = weeklyJob.nextDates ? weeklyJob.nextDates().toDate() : null;
        console.log(`✅ Weekly report job scheduled: Day ${dayOfWeek} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}) at ${this.settings.weekly.time}, next run: ${nextRun ? nextRun.toISOString() : 'N/A'}`);
        console.log(`   Job running status: ${weeklyJob.running}, Job object:`, Object.keys(weeklyJob));
      } catch (e) {
        console.log(`✅ Weekly report job scheduled: Day ${dayOfWeek} at ${this.settings.weekly.time} (could not calculate next run)`);
      }
    }

    // Monthly report
    if (this.settings.monthly.enabled) {
      const [hours, minutes] = this.settings.monthly.time.split(':').map(Number);
      const dayOfMonth = this.settings.monthly.day;
      const cronExpr = `${minutes} ${hours} ${dayOfMonth} * *`;
      
      const monthlyJob = cron.schedule(cronExpr, async () => {
        console.log('⏰ CRON TRIGGERED: Generating monthly report...');
        try {
          const sendEmail = this.settings.monthly.sendEmail;
          let emailRecipients = null;
          if (sendEmail) {
            emailRecipients = emailService.getRecipients();
            if (!emailRecipients || !emailRecipients.trim()) {
              console.warn('⚠️ Monthly report email enabled but no recipients configured in Email Configuration');
              emailRecipients = null;
            }
          }
          console.log(`Monthly report email: ${sendEmail && emailRecipients ? 'enabled' : 'disabled'}, recipients: ${emailRecipients || 'none'}`);
          const report = await reportGenerator.generateReport('monthly', '30d', emailRecipients);
          console.log('✅ Monthly report generated:', report.filename);
        } catch (error) {
          console.error('❌ Error generating monthly report:', error);
        }
      }, {
        scheduled: false,
        timezone: process.env.TZ || 'Europe/Malta'
      });

      monthlyJob.start();
      this.jobs.push({ name: 'monthly', job: monthlyJob });
      const nextRun = monthlyJob.nextDates ? monthlyJob.nextDates().toDate() : 'N/A';
      console.log(`Monthly report job scheduled: Day ${dayOfMonth} at ${this.settings.monthly.time}, next run: ${nextRun}`);
    }

    this.isRunning = this.jobs.length > 0;
    if (this.isRunning) {
      console.log('Report scheduler started successfully');
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`${name} report job stopped`);
    });

    this.jobs = [];
    this.isRunning = false;
    console.log('Report scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    const getNextRun = (job, name) => {
      try {
        if (job && typeof job.nextDates === 'function') {
          try {
            const nextDate = job.nextDates();
            if (nextDate && typeof nextDate.toDate === 'function') {
              return nextDate.toDate();
            } else if (nextDate instanceof Date) {
              return nextDate;
            }
          } catch (e) {
            console.log(`Error getting nextDates for ${name}:`, e.message);
          }
        }
        // Fallback: calculate next run based on settings
        if (name === 'weekly' && this.settings.weekly.enabled) {
          const [hours, minutes] = this.settings.weekly.time.split(':').map(Number);
          const dayOfWeek = this.settings.weekly.day;
          const now = new Date();
          const next = new Date();
          next.setHours(hours, minutes, 0, 0);
          
          // Calculate days until next occurrence
          const currentDay = now.getDay();
          let daysUntil = (dayOfWeek - currentDay + 7) % 7;
          if (daysUntil === 0 && (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes))) {
            daysUntil = 7; // Next week
          }
          next.setDate(now.getDate() + daysUntil);
          return next;
        } else if (name === 'monthly' && this.settings.monthly.enabled) {
          const [hours, minutes] = this.settings.monthly.time.split(':').map(Number);
          const dayOfMonth = this.settings.monthly.day;
          const now = new Date();
          const next = new Date();
          next.setHours(hours, minutes, 0, 0);
          next.setDate(dayOfMonth);
          
          if (next <= now) {
            next.setMonth(next.getMonth() + 1);
          }
          return next;
        }
      } catch (e) {
        console.error('Error calculating next run for', name, e);
      }
      return null;
    };

    const isJobRunning = (job) => {
      // Check if job exists and is running
      if (!job) return false;
      // node-cron jobs have a running property
      if (job.running !== undefined) {
        return job.running === true;
      }
      // If job exists and we have jobs array, assume it's running
      return this.jobs.some(j => j.job === job);
    };

    return {
      isRunning: this.isRunning,
      enabled: this.settings.enabled,
      settings: this.settings,
      jobs: this.jobs.map(({ name, job }) => ({
        name,
        running: isJobRunning(job),
        nextRun: getNextRun(job, name)
      }))
    };
  }
}

// Export singleton instance
const reportScheduler = new ReportScheduler();

module.exports = reportScheduler;

