const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const db = require('../database');

/**
 * Email Service - Handles sending PDF reports via email
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.config = null;
  }

  /**
   * Initialize email transporter from database settings
   */
  initialize() {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?');
      const settings = stmt.all('report_email_%');
      
      const config = {};
      settings.forEach(setting => {
        const key = setting.key.replace('report_email_', '');
        config[key] = setting.value;
      });

      // Check if email is enabled
      if (config.enabled !== 'true') {
        console.log('Email service is disabled');
        return false;
      }

      // Validate required settings
      if (!config.smtp_host || !config.smtp_port || !config.user || !config.password) {
        console.log('Email service not fully configured');
        return false;
      }

      this.config = config;
      this.transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port) || 587,
        secure: parseInt(config.smtp_port) === 465, // true for 465, false for other ports
        auth: {
          user: config.user,
          pass: config.password
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 10000, // 10 seconds
        debug: false, // Set to true for verbose logging
        logger: false
      });

      console.log(`✅ Email service initialized: ${config.smtp_host}:${config.smtp_port} (user: ${config.user})`);
      return true;
    } catch (error) {
      console.error('Error initializing email service:', error);
      return false;
    }
  }

  /**
   * Save email configuration
   */
  saveConfig(config) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
      `);

      Object.keys(config).forEach(key => {
        stmt.run(`report_email_${key}`, config[key]);
      });

      // Reinitialize after saving
      this.initialize();
      return true;
    } catch (error) {
      console.error('Error saving email config:', error);
      return false;
    }
  }

  /**
   * Get email configuration
   */
  getConfig() {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?');
      const settings = stmt.all('report_email_%');
      
      const config = {};
      settings.forEach(setting => {
        const key = setting.key.replace('report_email_', '');
        config[key] = setting.value;
      });

      return config;
    } catch (error) {
      console.error('Error getting email config:', error);
      return {};
    }
  }

  /**
   * Send report via email
   */
  async sendReport(reportPath, reportType, period) {
    if (!this.transporter) {
      if (!this.initialize()) {
        throw new Error('Email service not configured');
      }
    }

    if (!this.transporter) {
      throw new Error('Email service not available');
    }

    try {
      const recipients = this.config.recipients ? this.config.recipients.split(',').map(r => r.trim()) : [];
      if (recipients.length === 0) {
        throw new Error('No email recipients configured');
      }

      const reportName = path.basename(reportPath);
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const mailOptions = {
        from: `"Discover Gozo Analytics" <${this.config.user}>`,
        to: recipients.join(', '),
        subject: `Discover Gozo ${reportType} Analytics Report - ${reportDate}`,
        html: this.getEmailTemplate(reportType, period, reportDate),
        attachments: [
          {
            filename: reportName,
            path: reportPath,
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Report email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending report email:', error);
      throw error;
    }
  }

  /**
   * Get email HTML template
   */
  getEmailTemplate(reportType, period, reportDate) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Discover Gozo Analytics Report</h1>
            <p>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${period}</p>
        </div>
        <div class="content">
            <p>Dear Ministry of Tourism,</p>
            <p>Your ${reportType} analytics report for the period ${period} has been generated and is attached to this email.</p>
            <p>The report includes:</p>
            <ul>
                <li>Executive summary with key findings</li>
                <li>User engagement metrics</li>
                <li>Geographic insights and top destinations</li>
                <li>Device and browser statistics</li>
                <li>AI-generated insights and recommendations</li>
            </ul>
            <p>Please find the PDF report attached to this email.</p>
            <p>Report generated on: ${reportDate}</p>
            <p>Best regards,<br>Discover Gozo Analytics System</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send email with custom content
   */
  async sendEmail(to, subject, html, attachments = []) {
    // Validate recipients
    if (!to || (typeof to === 'string' && !to.trim())) {
      throw new Error('No recipients defined. Please provide at least one email address.');
    }
    
    // Ensure to is a string and trim it
    const recipientsStr = typeof to === 'string' ? to.trim() : String(to || '').trim();
    if (!recipientsStr) {
      throw new Error('No recipients defined. Please provide at least one email address.');
    }
    
    // Force re-initialization to get latest config
    this.transporter = null;
    this.config = null;
    
    if (!this.initialize()) {
      const config = this.getConfig();
      let errorMsg = 'Email service not configured. ';
      if (config.enabled !== 'true') {
        errorMsg += 'Email is disabled. Please enable it in settings.';
      } else if (!config.smtp_host || !config.smtp_port || !config.user || !config.password) {
        errorMsg += 'Missing SMTP configuration. Please fill in all SMTP settings.';
      } else {
        errorMsg += 'Please check your SMTP settings.';
      }
      throw new Error(errorMsg);
    }

    if (!this.transporter) {
      throw new Error('Email service not available. Please check your configuration.');
    }

    try {
      const mailOptions = {
        from: `"Discover Gozo Analytics" <${this.config.user}>`,
        to: recipientsStr,
        subject: subject,
        html: html,
        attachments: attachments.map(att => ({
          filename: att.filename,
          path: att.path,
          contentType: att.contentType || 'application/pdf'
        }))
      };

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
      });

      const sendPromise = this.transporter.sendMail(mailOptions);
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      if (error.code === 'EAUTH') {
        throw new Error('SMTP authentication failed. Please check your username and password (use App Password for Gmail).');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        throw new Error(`Cannot connect to SMTP server. Please check your SMTP host (${this.config.smtp_host}) and port (${this.config.smtp_port}).`);
      } else if (error.message.includes('timeout')) {
        throw new Error('Email sending timed out. Please check your SMTP settings and network connection.');
      }
      throw error;
    }
  }

  /**
   * Get global email recipients from config
   */
  getRecipients() {
    const config = this.getConfig();
    const recipients = config.recipients || '';
    console.log(`📧 getRecipients() called - config keys: ${Object.keys(config).join(', ')}, recipients value: "${recipients}"`);
    return recipients;
  }

  /**
   * Test email configuration
   */
  async testEmail() {
    // Force re-initialization to get latest config
    this.transporter = null;
    this.config = null;
    
    if (!this.initialize()) {
      const config = this.getConfig();
      let errorMsg = 'Email service not configured. ';
      if (config.enabled !== 'true') {
        errorMsg += 'Email is disabled. Please enable it in settings.';
      } else if (!config.smtp_host || !config.smtp_port || !config.user || !config.password) {
        errorMsg += 'Missing SMTP configuration. Please fill in all SMTP settings.';
      } else {
        errorMsg += 'Please check your SMTP settings.';
      }
      throw new Error(errorMsg);
    }

    try {
      const recipients = this.config.recipients ? this.config.recipients.split(',').map(r => r.trim()) : [];
      if (recipients.length === 0) {
        throw new Error('No email recipients configured. Please add at least one recipient email address.');
      }

      console.log(`📧 Sending test email to: ${recipients[0]}`);
      console.log(`📧 Using SMTP: ${this.config.smtp_host}:${this.config.smtp_port}`);
      console.log(`📧 From: ${this.config.user}`);

      const mailOptions = {
        from: `"Discover Gozo Analytics" <${this.config.user}>`,
        to: recipients[0], // Send test to first recipient only
        subject: 'Test Email - Discover Gozo Analytics',
        html: '<p>This is a test email from the Discover Gozo Analytics system. If you receive this, your email configuration is working correctly.</p>'
      };

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
      });

      const sendPromise = this.transporter.sendMail(mailOptions);
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      console.log('✅ Test email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending test email:', error.message);
      if (error.code === 'EAUTH') {
        throw new Error('SMTP authentication failed. Please check your username and password. For Gmail, make sure you\'re using an App Password, not your regular password.');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        throw new Error(`Cannot connect to SMTP server ${this.config.smtp_host}:${this.config.smtp_port}. Please check your SMTP host and port settings.`);
      } else if (error.message.includes('timeout')) {
        throw new Error('Email sending timed out. Please check your SMTP settings and network connection.');
      }
      throw error;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;

