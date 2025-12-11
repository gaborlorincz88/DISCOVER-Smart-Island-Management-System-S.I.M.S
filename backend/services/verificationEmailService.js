const nodemailer = require('nodemailer');
const db = require('../database');

/**
 * Verification Email Service - Handles sending email verification emails
 */
class VerificationEmailService {
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
      const settings = stmt.all('verification_email_%');
      
      const config = {};
      settings.forEach(setting => {
        const key = setting.key.replace('verification_email_', '');
        config[key] = setting.value;
      });

      // Check if email is enabled
      if (config.enabled !== 'true') {
        console.log('Verification email service is disabled');
        return false;
      }

      // Validate required settings
      if (!config.smtp_host || !config.smtp_port || !config.user || !config.password) {
        console.log('Verification email service not fully configured');
        return false;
      }

      this.config = config;
      const port = parseInt(config.smtp_port) || 587;
      const isSSL = port === 465;
      
      // For Hostinger, use TLS/STARTTLS on port 587
      // Some email providers require just the username part (before @) for auth
      const authUser = config.user.includes('@') ? config.user : `${config.user}@discover-gozo.com`;
      
      const transporterConfig = {
        host: config.smtp_host,
        port: port,
        secure: isSSL, // true for 465 (SSL), false for 587 (STARTTLS)
        auth: {
          user: authUser, // Use full email for authentication
          pass: config.password
        },
        connectionTimeout: 30000, // Increased timeout
        greetingTimeout: 30000,
        socketTimeout: 30000,
        debug: true, // Enable debug to see connection issues
        logger: true
      };
      
      // For port 587, explicitly require TLS
      if (port === 587) {
        transporterConfig.requireTLS = true;
        transporterConfig.tls = {
          rejectUnauthorized: false // Allow self-signed certificates if needed
        };
      }
      
      console.log('SMTP Auth User:', authUser);
      console.log('SMTP Auth Password length:', config.password ? config.password.length : 0);
      
      this.transporter = nodemailer.createTransport(transporterConfig);

      console.log(`✅ Verification email service initialized: ${config.smtp_host}:${port} (user: ${config.user})`);
      return true;
    } catch (error) {
      console.error('Error initializing verification email service:', error);
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, verificationToken, username) {
    if (!this.transporter) {
      if (!this.initialize()) {
        throw new Error('Verification email service not configured');
      }
    }

    if (!this.transporter) {
      throw new Error('Verification email service not available');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://discover-gozo.com';
    const verificationUrl = `${frontendUrl}?token=${verificationToken}`;
    const logoUrl = `${frontendUrl}/bestlogowhite.png`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Discover Gozo</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 15px;">
            <img src="${logoUrl}" alt="Discover Gozo Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
          </div>
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Discover Gozo!</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${username || 'there'},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for registering with Discover Gozo! To complete your registration and start exploring Gozo, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">This verification link will expire in 24 hours.</p>
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">If you didn't create an account with Discover Gozo, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">© ${new Date().getFullYear()} Discover Gozo. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Discover Gozo!

Hi ${username || 'there'},

Thank you for registering with Discover Gozo! To complete your registration and start exploring Gozo, please verify your email address by visiting this link:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with Discover Gozo, you can safely ignore this email.

© ${new Date().getFullYear()} Discover Gozo. All rights reserved.
    `;

    try {
      const mailOptions = {
        from: `"Discover Gozo" <${this.config.user}>`,
        to: email,
        subject: 'Verify Your Email Address - Discover Gozo',
        html: html,
        text: text
      };

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
      });

      const sendPromise = this.transporter.sendMail(mailOptions);
      const info = await Promise.race([sendPromise, timeoutPromise]);
      
      console.log('✅ Verification email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending verification email:', error.message);
      
      if (error.code === 'EAUTH') {
        throw new Error('SMTP authentication failed. Please check your email credentials.');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        throw new Error(`Cannot connect to SMTP server ${this.config.smtp_host}:${this.config.smtp_port}. Please check your SMTP settings.`);
      } else if (error.message.includes('timeout')) {
        throw new Error('Email sending timed out. Please check your SMTP settings and network connection.');
      }
      
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new VerificationEmailService();

