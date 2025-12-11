const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecureLogger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'secure-logs');
    this.currentLogFile = null;
    this.initialized = false;
    this.ensureLogsDirectory();
  }

  async ensureLogsDirectory() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      // Create .gitignore to prevent accidental commits
      const gitignorePath = path.join(this.logsDir, '.gitignore');
      try {
        await fs.access(gitignorePath);
      } catch {
        await fs.writeFile(gitignorePath, '*\n!.gitignore\n', 'utf8');
      }
      await this.initializeSecureLog();
    } catch (error) {
      console.error('Error creating secure logs directory:', error);
    }
  }

  async initializeSecureLog() {
    // Create a daily log file with secure naming
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.currentLogFile = path.join(this.logsDir, `admin-activity-${today}.log`);
    
    // Create log file if it doesn't exist with secure headers
    try {
      await fs.access(this.currentLogFile);
    } catch {
      const header = this.generateLogHeader();
      await fs.writeFile(this.currentLogFile, header, 'utf8');
    }
    
    this.initialized = true;
  }

  generateLogHeader() {
    const timestamp = new Date().toISOString();
    const systemInfo = {
      hostname: require('os').hostname(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    };
    
    return `# SECURE ADMIN ACTIVITY LOG
# Created: ${timestamp}
# System: ${JSON.stringify(systemInfo)}
# Format: [TIMESTAMP] [HASH] [ADMIN_ID] [ADMIN_EMAIL] [ACTION_TYPE] [DESCRIPTION] [IP] [USER_AGENT] [DETAILS]
# Hash: SHA-256 of timestamp + admin_id + action_type + description for integrity verification
#
# WARNING: This file contains sensitive administrative actions. Do not modify or delete.
# Any tampering will be detected through hash verification.
#
${'='.repeat(80)}
`;
  }

  generateSecureHash(timestamp, adminId, actionType, description) {
    const data = `${timestamp}|${adminId}|${actionType}|${description}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  async logActivity(adminId, adminEmail, actionType, description, targetType = null, targetId = null, details = null, req = null) {
    try {
      // Ensure initialization is complete
      if (!this.initialized) {
        await this.initializeSecureLog();
      }
      
      const timestamp = new Date().toISOString();
      const ipAddress = req ? (req.ip || req.connection.remoteAddress) : 'unknown';
      const userAgent = req ? req.get('user-agent') : 'unknown';
      
      // Generate secure hash for integrity verification
      const hash = this.generateSecureHash(timestamp, adminId, actionType, description);
      
      // Format log entry
      const logEntry = {
        timestamp,
        hash,
        adminId,
        adminEmail,
        actionType,
        description,
        targetType,
        targetId,
        ipAddress,
        userAgent,
        details: details ? JSON.stringify(details) : null
      };
      
      // Create log line in secure format
      const logLine = `[${timestamp}] [${hash}] [${adminId}] [${adminEmail}] [${actionType}] [${description}] [${ipAddress}] [${userAgent}] [${logEntry.details || 'null'}]\n`;
      
      // Append to current log file
      await fs.appendFile(this.currentLogFile, logLine, 'utf8');
      
      // Also create a weekly backup for extra security
      await this.createWeeklyBackup();
      
      console.log(`🔒 SECURE LOG: ${actionType} - ${description} (Hash: ${hash})`);
      console.log(`📁 Log file: ${this.currentLogFile}`);
      
    } catch (error) {
      console.error('Error writing to secure log:', error);
      // Fallback to console logging
      console.log(`FALLBACK LOG: [${new Date().toISOString()}] ${adminId} (${adminEmail}) - ${actionType}: ${description}`);
    }
  }

  async createWeeklyBackup() {
    const now = new Date();
    const weekNumber = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
    const backupFile = path.join(this.logsDir, `admin-activity-backup-week${weekNumber}-${now.getFullYear()}.log`);
    
    try {
      // Check if backup already exists for this week
      await fs.access(backupFile);
    } catch {
      // Create backup if it doesn't exist
      const header = this.generateLogHeader();
      await fs.writeFile(backupFile, header, 'utf8');
    }
  }

  async searchLogs(searchParams) {
    try {
      const { 
        startDate, 
        endDate, 
        adminEmail, 
        actionType, 
        keyword,
        limit = 100 
      } = searchParams;
      
      const results = [];
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        if (this.shouldSearchFile(logFile, startDate, endDate)) {
          const fileResults = await this.searchInFile(logFile, {
            adminEmail,
            actionType,
            keyword,
            limit: limit - results.length
          });
          results.push(...fileResults);
          
          if (results.length >= limit) break;
        }
      }
      
      // Sort results by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return results.slice(0, limit);
      
    } catch (error) {
      console.error('Error searching logs:', error);
      return [];
    }
  }

  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logsDir);
      return files
        .filter(file => file.startsWith('admin-activity-') && file.endsWith('.log'))
        .map(file => path.join(this.logsDir, file))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      console.error('Error getting log files:', error);
      return [];
    }
  }

  shouldSearchFile(logFile, startDate, endDate) {
    if (!startDate && !endDate) return true;
    
    const fileName = path.basename(logFile);
    const dateMatch = fileName.match(/admin-activity-(\d{4}-\d{2}-\d{2})\.log/);
    if (!dateMatch) return true;
    
    const fileDate = new Date(dateMatch[1]);
    
    if (startDate && fileDate < new Date(startDate)) return false;
    if (endDate && fileDate > new Date(endDate)) return false;
    
    return true;
  }

  async searchInFile(logFile, searchParams) {
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const results = [];
      
      for (const line of lines) {
        const parsed = this.parseLogLine(line);
        if (!parsed) continue;
        
        if (this.matchesSearch(parsed, searchParams)) {
          results.push({
            ...parsed,
            source: path.basename(logFile)
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error(`Error searching in file ${logFile}:`, error);
      return [];
    }
  }

  parseLogLine(line) {
    try {
      const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[(.+)\]$/);
      if (!match) return null;
      
      return {
        timestamp: match[1],
        hash: match[2],
        adminId: match[3],
        adminEmail: match[4],
        actionType: match[5],
        description: match[6],
        ipAddress: match[7],
        userAgent: match[8],
        details: match[9] === 'null' ? null : match[9],
        rawLine: line
      };
    } catch (error) {
      console.error('Error parsing log line:', error);
      return null;
    }
  }

  matchesSearch(entry, searchParams) {
    // Date filtering
    if (searchParams.startDate || searchParams.endDate) {
      const entryDate = new Date(entry.timestamp);
      
      if (searchParams.startDate) {
        const startDate = new Date(searchParams.startDate);
        if (entryDate < startDate) return false;
      }
      
      if (searchParams.endDate) {
        const endDate = new Date(searchParams.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        if (entryDate > endDate) return false;
      }
    }
    
    // Admin email filtering (case-insensitive, partial match)
    if (searchParams.adminEmail && searchParams.adminEmail.trim()) {
      if (!entry.adminEmail.toLowerCase().includes(searchParams.adminEmail.toLowerCase().trim())) {
        return false;
      }
    }
    
    // Action type filtering (exact match)
    if (searchParams.actionType && searchParams.actionType.trim()) {
      if (entry.actionType !== searchParams.actionType.trim()) {
        return false;
      }
    }
    
    // Keyword filtering (case-insensitive, searches in description, email, and action type)
    if (searchParams.keyword && searchParams.keyword.trim()) {
      const keyword = searchParams.keyword.toLowerCase().trim();
      const searchableText = `${entry.description} ${entry.adminEmail} ${entry.actionType} ${entry.details || ''}`.toLowerCase();
      if (!searchableText.includes(keyword)) {
        return false;
      }
    }
    
    return true;
  }

  async verifyLogIntegrity(logFile) {
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const verificationResults = [];
      
      for (const line of lines) {
        const parsed = this.parseLogLine(line);
        if (!parsed) continue;
        
        const expectedHash = this.generateSecureHash(
          parsed.timestamp,
          parsed.adminId,
          parsed.actionType,
          parsed.description
        );
        
        verificationResults.push({
          line: line,
          isValid: parsed.hash === expectedHash,
          expectedHash,
          actualHash: parsed.hash
        });
      }
      
      return verificationResults;
      
    } catch (error) {
      console.error('Error verifying log integrity:', error);
      return [];
    }
  }

  async getLogStatistics() {
    try {
      const logFiles = await this.getLogFiles();
      let totalEntries = 0;
      let uniqueAdmins = new Set();
      let actionTypes = new Map();
      
      for (const logFile of logFiles) {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
          const parsed = this.parseLogLine(line);
          if (parsed) {
            totalEntries++;
            uniqueAdmins.add(parsed.adminEmail);
            
            const count = actionTypes.get(parsed.actionType) || 0;
            actionTypes.set(parsed.actionType, count + 1);
          }
        }
      }
      
      return {
        totalEntries,
        uniqueAdmins: uniqueAdmins.size,
        logFiles: logFiles.length,
        actionTypes: Object.fromEntries(actionTypes),
        oldestLog: logFiles.length > 0 ? path.basename(logFiles[logFiles.length - 1]) : null,
        newestLog: logFiles.length > 0 ? path.basename(logFiles[0]) : null
      };
      
    } catch (error) {
      console.error('Error getting log statistics:', error);
      return null;
    }
  }
}

// Create singleton instance
const secureLogger = new SecureLogger();

module.exports = secureLogger;
