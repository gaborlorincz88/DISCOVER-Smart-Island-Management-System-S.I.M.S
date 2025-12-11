// AI Analytics Report Control Panel JavaScript

let currentSettings = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadReports();
    loadSchedulerSettings();
    initReportTypeHandler();
    
    // Setup form handlers
    document.getElementById('ai-config-form').addEventListener('submit', saveAISettings);
    document.getElementById('email-config-form').addEventListener('submit', saveEmailSettings);
    document.getElementById('email-enabled').addEventListener('change', toggleEmailSettings);
    
    // Setup scheduler handlers
    document.getElementById('weekly-enabled').addEventListener('change', () => {
        document.getElementById('weekly-settings').style.display = 
            document.getElementById('weekly-enabled').checked ? 'block' : 'none';
    });
    document.getElementById('monthly-enabled').addEventListener('change', () => {
        document.getElementById('monthly-settings').style.display = 
            document.getElementById('monthly-enabled').checked ? 'block' : 'none';
    });
});

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const eye = document.getElementById(inputId + '-eye');
    
    if (input.type === 'password') {
        input.type = 'text';
        eye.classList.remove('fa-eye');
        eye.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        eye.classList.remove('fa-eye-slash');
        eye.classList.add('fa-eye');
    }
}

// Load settings from API
async function loadSettings() {
    try {
        const response = await fetch('/api/reports/settings', { credentials: 'include' });
        const settings = await response.json();
        currentSettings = settings;
        
        // Populate AI settings
        if (settings.ai) {
            const apiKeyField = document.getElementById('api-key');
            // Always populate with full API key if available from server
            if (settings.ai.apiKey && settings.ai.apiKey.length > 10) {
                // Always set the full key - don't check current value
                apiKeyField.value = settings.ai.apiKey;
                console.log('Populated API key field with full key, length:', settings.ai.apiKey.length);
            } else if (settings.ai.apiKeyPreview) {
                // If only preview is available, show it but log a warning
                console.warn('Only API key preview available, full key not returned from server');
                apiKeyField.value = settings.ai.apiKeyPreview;
            }
            if (settings.ai.model) {
                document.getElementById('ai-model').value = settings.ai.model;
            }
            
            // Store full key in currentSettings for reference
            if (settings.ai.apiKey) {
                currentSettings.ai.apiKey = settings.ai.apiKey;
            }
            
            // Display last test time
            updateLastTestDisplay(settings.ai.lastTestTime);
        }
        
        // Populate email settings
        if (settings.email) {
            document.getElementById('email-enabled').checked = settings.email.enabled === 'true';
            document.getElementById('smtp-host').value = settings.email.smtp_host || '';
            document.getElementById('smtp-port').value = settings.email.smtp_port || '587';
            document.getElementById('smtp-user').value = settings.email.user || '';
            document.getElementById('smtp-password').value = settings.email.password || '';
            document.getElementById('email-recipients').value = settings.email.recipients || '';
        }
        
        toggleEmailSettings();
    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('Failed to load settings', 'error');
    }
}

// Save AI settings
async function saveAISettings(e) {
    e.preventDefault();
    
    const apiKeyField = document.getElementById('api-key');
    const apiKey = apiKeyField.value.trim();
    const model = document.getElementById('ai-model').value;
    
    if (!apiKey) {
        showAlert('Please enter an API key first', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/reports/settings/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apiKey, model, skipValidation: false })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            // Show detailed error message
            const errorMsg = result.error || result.details || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMsg);
        }
        
        if (result.success) {
            showAlert('AI settings saved successfully', 'success');
            // Keep the API key in the field - don't clear it
            apiKeyField.value = apiKey; // Ensure it's still there
            if (model) {
                document.getElementById('ai-model').value = model;
            }
            // Update the settings object to reflect saved state
            if (currentSettings.ai) {
                currentSettings.ai.apiKeyConfigured = true;
                currentSettings.ai.apiKey = apiKey; // Store full key in memory
                currentSettings.ai.model = model || currentSettings.ai.model;
            }
            // Update last test time display without reloading (to preserve the key)
            updateLastTestDisplay(new Date().toISOString());
        } else {
            showAlert(result.error || 'Failed to save AI settings', 'error');
        }
    } catch (error) {
        console.error('Error saving AI settings:', error);
        showAlert(error.message || 'Failed to save AI settings', 'error');
    }
}

// Save email settings
async function saveEmailSettings(e) {
    e.preventDefault();
    
    const config = {
        enabled: document.getElementById('email-enabled').checked ? 'true' : 'false',
        smtp_host: document.getElementById('smtp-host').value.trim(),
        smtp_port: document.getElementById('smtp-port').value.trim(),
        user: document.getElementById('smtp-user').value.trim(),
        password: document.getElementById('smtp-password').value.trim(),
        recipients: document.getElementById('email-recipients').value.trim()
    };
    
    try {
        const response = await fetch('/api/reports/settings/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Email settings saved successfully', 'success');
            loadSettings();
        } else {
            showAlert(result.error || 'Failed to save email settings', 'error');
        }
    } catch (error) {
        console.error('Error saving email settings:', error);
        showAlert('Failed to save email settings', 'error');
    }
}

// Toggle email settings visibility
function toggleEmailSettings() {
    const enabled = document.getElementById('email-enabled').checked;
    document.getElementById('email-settings').style.display = enabled ? 'block' : 'none';
}

// Test API key
async function testApiKey() {
    const apiKeyField = document.getElementById('api-key');
    const apiKey = apiKeyField.value.trim();
    
    if (!apiKey) {
        showAlert('Please enter an API key first', 'error');
        return;
    }
    
    // Validate key format
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
        showAlert('API key format looks invalid. Gemini API keys should start with "AIza" and be at least 30 characters long.', 'error');
        return;
    }
    
    console.log('Testing API key, length:', apiKey.length, 'starts with:', apiKey.substring(0, 10));
    
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Testing...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/reports/settings/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apiKey, skipValidation: false })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            // Show detailed error message
            const errorMsg = result.error || result.details || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMsg);
        }
        
        if (result.success) {
            showAlert('API key is valid and saved!', 'success');
            // Keep the API key in the field - ensure it's still there
            const apiKeyField = document.getElementById('api-key');
            if (apiKey && apiKeyField.value !== apiKey) {
                apiKeyField.value = apiKey;
            }
            // Update the settings object to reflect saved state
            if (currentSettings.ai) {
                currentSettings.ai.apiKeyConfigured = true;
                currentSettings.ai.apiKey = apiKey; // Store full key
            }
            // Update last test time display without reloading (to preserve the key)
            updateLastTestDisplay(new Date().toISOString());
        } else {
            showAlert(result.error || 'Invalid API key', 'error');
        }
    } catch (error) {
        console.error('Error testing API key:', error);
        showAlert(error.message || 'Failed to test API key. Please check your API key format.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Test email
async function testEmail() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Sending...';
    btn.disabled = true;
    
    try {
        // First, save the email settings to ensure they're in the database
        const emailConfig = {
            enabled: document.getElementById('email-enabled').checked ? 'true' : 'false',
            smtp_host: document.getElementById('smtp-host').value.trim(),
            smtp_port: document.getElementById('smtp-port').value.trim(),
            user: document.getElementById('smtp-user').value.trim(),
            password: document.getElementById('smtp-password').value.trim(),
            recipients: document.getElementById('email-recipients').value.trim()
        };
        
        // Validate required fields
        if (!emailConfig.smtp_host || !emailConfig.smtp_port || !emailConfig.user || !emailConfig.password) {
            showAlert('Please fill in all SMTP settings before testing', 'error');
            return;
        }
        
        if (!emailConfig.recipients) {
            showAlert('Please enter at least one email recipient', 'error');
            return;
        }
        
        // Save settings first
        const saveResponse = await fetch('/api/reports/settings/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(emailConfig)
        });
        
        if (!saveResponse.ok) {
            if (saveResponse.status === 401) {
                showAlert('Your session has expired. Please refresh the page and log in again.', 'error');
                setTimeout(() => {
                    window.location.href = '/admin-login.html';
                }, 2000);
                return;
            }
            const saveResult = await saveResponse.json();
            throw new Error(saveResult.error || 'Failed to save email settings');
        }
        
        // Now test the email
        const response = await fetch('/api/reports/settings/email/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showAlert('Your session has expired. Please refresh the page and log in again.', 'error');
                setTimeout(() => {
                    window.location.href = '/admin-login.html';
                }, 2000);
                return;
            }
            const errorResult = await response.json();
            throw new Error(errorResult.error || errorResult.message || 'Failed to send test email');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Test email sent successfully! Check your inbox.', 'success');
        } else {
            showAlert(result.error || 'Failed to send test email', 'error');
        }
    } catch (error) {
        console.error('Error testing email:', error);
        showAlert(error.message || 'Failed to send test email', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Handle report type change to show/hide custom date range
function initReportTypeHandler() {
    console.log('Initializing report type handler...');
    const reportTypeSelect = document.getElementById('report-type');
    const customDateRange = document.getElementById('custom-date-range');
    
    console.log('report-type element:', reportTypeSelect);
    console.log('custom-date-range element:', customDateRange);
    
    if (reportTypeSelect && customDateRange) {
        console.log('Both elements found, setting up handler');
        
        // Set initial state
        if (reportTypeSelect.value === 'custom') {
            console.log('Initial value is custom, showing date range');
            customDateRange.style.display = 'block';
            // Set default dates (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const endDateInput = document.getElementById('end-date');
            const startDateInput = document.getElementById('start-date');
            if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
            if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
        } else {
            console.log('Initial value is not custom, hiding date range');
            customDateRange.style.display = 'none';
        }
        
        // Add change event listener
        reportTypeSelect.addEventListener('change', (e) => {
            console.log('Report type changed to:', e.target.value);
            if (e.target.value === 'custom') {
                console.log('Showing custom date range');
                customDateRange.style.display = 'block';
                // Set default dates (last 30 days)
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                const endDateInput = document.getElementById('end-date');
                const startDateInput = document.getElementById('start-date');
                if (endDateInput) {
                    endDateInput.value = endDate.toISOString().split('T')[0];
                    console.log('Set end date to:', endDateInput.value);
                }
                if (startDateInput) {
                    startDateInput.value = startDate.toISOString().split('T')[0];
                    console.log('Set start date to:', startDateInput.value);
                }
            } else {
                console.log('Hiding custom date range');
                customDateRange.style.display = 'none';
            }
        });
    } else {
        console.error('Missing elements:', { reportTypeSelect, customDateRange });
    }
}

async function generateReportWithSettings() {
    const reportType = document.getElementById('report-type').value;
    const sendEmail = document.getElementById('send-email-checkbox').checked;
    const statusDiv = document.getElementById('generation-status');
    
    let type = reportType;
    let startDate = null;
    let endDate = null;
    
    // If custom date range, get the dates
    if (reportType === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
        
        if (!startDate || !endDate) {
            showAlert('Please select both start and end dates for custom date range', 'error');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            showAlert('Start date must be before end date', 'error');
            return;
        }
        
        type = 'custom'; // Use custom type for backend
    }
    
    statusDiv.innerHTML = '<div class="alert alert-info"><span class="loading"></span> Generating report... This may take a few minutes.</div>';
    
    try {
        let url = `/api/reports/generate?type=${type}&email=${sendEmail}`;
        if (startDate && endDate) {
            url += `&startDate=${startDate}&endDate=${endDate}`;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const reportName = result.report?.filename || result.filename || 'report.pdf';
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Report generated successfully!
                    <br>Filename: ${reportName}
                    <br>Size: ${result.report?.size ? (result.report.size / 1024).toFixed(2) + ' KB' : 'N/A'}
                    ${result.report?.emailSent ? '<br>Email sent successfully' : ''}
                    <br><a href="/api/reports/${reportName}/download" target="_blank" class="btn btn-primary" style="margin-top: 10px; display: inline-block; padding: 8px 16px; text-decoration: none; border-radius: 4px; background: #007bff; color: white;">
                        <i class="fas fa-download"></i> Download Report
                    </a>
                </div>
            `;
            loadReports();
        } else {
            statusDiv.innerHTML = `<div class="alert alert-error">${result.error || result.message || 'Failed to generate report'}</div>`;
        }
    } catch (error) {
        console.error('Error generating report:', error);
        statusDiv.innerHTML = `<div class="alert alert-error">Failed to generate report: ${error.message}</div>`;
    }
}

// Quick generate function for weekly/monthly reports
async function generateReport(type, sendEmail = false) {
    const statusDiv = document.getElementById('generation-status');
    const sendEmailCheckbox = document.getElementById('send-email-checkbox');
    
    if (sendEmailCheckbox) {
        sendEmailCheckbox.checked = sendEmail;
    }
    
    statusDiv.innerHTML = '<div class="alert alert-info"><span class="loading"></span> Generating report... This may take a few minutes.</div>';
    
    try {
        const response = await fetch(`/api/reports/generate?type=${type}&email=${sendEmail}`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const reportName = result.report?.filename || result.filename || 'report.pdf';
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Report generated successfully!
                    <br>Filename: ${reportName}
                    <br>Size: ${result.report?.size ? (result.report.size / 1024).toFixed(2) + ' KB' : 'N/A'}
                    ${result.report?.emailSent ? '<br>Email sent successfully' : ''}
                    <br><a href="/api/reports/${reportName}/download" target="_blank" class="btn btn-primary" style="margin-top: 10px; display: inline-block; padding: 8px 16px; text-decoration: none; border-radius: 4px; background: #007bff; color: white;">
                        <i class="fas fa-download"></i> Download Report
                    </a>
                </div>
            `;
            loadReports();
        } else {
            statusDiv.innerHTML = `<div class="alert alert-error">${result.error || result.message || 'Failed to generate report'}</div>`;
        }
    } catch (error) {
        console.error('Error generating report:', error);
        statusDiv.innerHTML = `<div class="alert alert-error">Failed to generate report: ${error.message}</div>`;
    }
}

// Load reports list
async function loadReports() {
    try {
        const response = await fetch('/api/reports/list', { credentials: 'include' });
        const result = await response.json();
        
        const reportsList = document.getElementById('reports-list');
        
        if (!result.reports || result.reports.length === 0) {
            reportsList.innerHTML = '<p>No reports generated yet.</p>';
            return;
        }
        
        reportsList.innerHTML = result.reports.map(report => {
            const date = new Date(report.modified).toLocaleString();
            const size = (report.size / 1024).toFixed(2);
            return `
                <div class="report-item">
                    <div class="report-item-info">
                        <div class="report-item-name">${report.filename}</div>
                        <div class="report-item-meta">${size} KB • ${date}</div>
                    </div>
                    <a href="/api/reports/${report.filename}/download" class="btn btn-primary" download>
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
        document.getElementById('reports-list').innerHTML = '<p>Failed to load reports.</p>';
    }
}

// Load scheduler settings
async function loadSchedulerSettings() {
    try {
        const response = await fetch('/api/reports/scheduler/settings', { credentials: 'include' });
        const result = await response.json();
        
        if (result.success && result.settings) {
            const settings = result.settings;
            
            // Set enabled checkbox
            document.getElementById('scheduler-enabled').checked = settings.enabled || false;
            updateSchedulerEnabled();
            
            // Set weekly settings
            if (settings.weekly) {
                document.getElementById('weekly-enabled').checked = settings.weekly.enabled || false;
                document.getElementById('weekly-day').value = settings.weekly.day || 1;
                document.getElementById('weekly-time').value = settings.weekly.time || '09:00';
                document.getElementById('weekly-send-email').checked = settings.weekly.sendEmail || false;
                document.getElementById('weekly-settings').style.display = 
                    settings.weekly.enabled ? 'block' : 'none';
            }
            
            // Set monthly settings
            if (settings.monthly) {
                document.getElementById('monthly-enabled').checked = settings.monthly.enabled || false;
                document.getElementById('monthly-day').value = settings.monthly.day || 1;
                document.getElementById('monthly-time').value = settings.monthly.time || '09:00';
                document.getElementById('monthly-send-email').checked = settings.monthly.sendEmail || false;
                document.getElementById('monthly-settings').style.display = 
                    settings.monthly.enabled ? 'block' : 'none';
            }
            
            // Load status
            loadSchedulerStatus();
        }
    } catch (error) {
        console.error('Error loading scheduler settings:', error);
    }
}

// Update scheduler enabled state
function updateSchedulerEnabled() {
    const enabled = document.getElementById('scheduler-enabled').checked;
    const settingsDiv = document.getElementById('scheduler-settings');
    settingsDiv.style.display = enabled ? 'block' : 'none';
}

// Save scheduler settings
async function saveSchedulerSettings() {
    const enabled = document.getElementById('scheduler-enabled').checked;
    const weeklyEnabled = document.getElementById('weekly-enabled').checked;
    const weeklyDay = parseInt(document.getElementById('weekly-day').value);
    const weeklyTime = document.getElementById('weekly-time').value;
    const weeklySendEmail = document.getElementById('weekly-send-email').checked;
    const monthlyEnabled = document.getElementById('monthly-enabled').checked;
    const monthlyDay = parseInt(document.getElementById('monthly-day').value);
    const monthlyTime = document.getElementById('monthly-time').value;
    const monthlySendEmail = document.getElementById('monthly-send-email').checked;
    
    const settings = {
        enabled: enabled,
        weekly: {
            enabled: weeklyEnabled,
            day: weeklyDay,
            time: weeklyTime,
            sendEmail: weeklySendEmail
        },
        monthly: {
            enabled: monthlyEnabled,
            day: monthlyDay,
            time: monthlyTime,
            sendEmail: monthlySendEmail
        }
    };
    
    try {
        const response = await fetch('/api/reports/scheduler/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(settings)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Scheduler settings saved successfully', 'success');
            loadSchedulerStatus();
        } else {
            showAlert(result.error || 'Failed to save scheduler settings', 'error');
        }
    } catch (error) {
        console.error('Error saving scheduler settings:', error);
        showAlert('Failed to save scheduler settings', 'error');
    }
}

// Load scheduler status
async function loadSchedulerStatus() {
    try {
        const response = await fetch('/api/reports/scheduler/status', { credentials: 'include' });
        const status = await response.json();
        
        const statusDiv = document.getElementById('scheduler-status');
        
        if (!statusDiv) return;
        
        let statusHTML = '<div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #0d6efd;">';
        statusHTML += '<h4 style="margin-top: 0; color: #495057;"><i class="fas fa-info-circle"></i> Current Status</h4>';
        
        if (status.enabled) {
            statusHTML += '<p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #28a745;">✓ Enabled</span></p>';
        } else {
            statusHTML += '<p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc3545;">✗ Disabled</span></p>';
        }
        
        if (status.jobs && status.jobs.length > 0) {
            status.jobs.forEach(job => {
                const nextRun = job.nextRun ? new Date(job.nextRun).toLocaleString() : 'N/A';
                statusHTML += `<p style="margin: 5px 0;"><strong>${job.name.charAt(0).toUpperCase() + job.name.slice(1)}:</strong> `;
                statusHTML += job.running ? `<span style="color: #28a745;">Running</span>` : `<span style="color: #dc3545;">Stopped</span>`;
                statusHTML += ` (Next: ${nextRun})</p>`;
            });
        } else {
            statusHTML += '<p style="margin: 5px 0; color: #6c757d;">No scheduled jobs</p>';
        }
        
        statusHTML += '</div>';
        statusDiv.innerHTML = statusHTML;
    } catch (error) {
        console.error('Error loading scheduler status:', error);
    }
}

// Test scheduler - generate report immediately
async function testScheduler(type) {
    if (!confirm(`This will generate a ${type} report immediately. Continue?`)) {
        return;
    }
    
    const statusDiv = document.getElementById('scheduler-status');
    statusDiv.innerHTML = '<div style="padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;"><i class="fas fa-spinner fa-spin"></i> Generating test report...</div>';
    
    try {
        const response = await fetch('/api/reports/scheduler/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.innerHTML = `<div style="padding: 15px; background: #d1ecf1; border-radius: 8px; border-left: 4px solid #0c5460;">
                <i class="fas fa-check-circle"></i> Test report generated successfully!<br>
                Filename: ${result.report.filename}<br>
                <a href="/api/reports/${result.report.filename}/download" target="_blank" class="btn btn-primary" style="margin-top: 10px; display: inline-block; padding: 8px 16px; text-decoration: none; border-radius: 4px; background: #007bff; color: white;">
                    <i class="fas fa-download"></i> Download Report
                </a>
            </div>`;
            loadReports();
        } else {
            statusDiv.innerHTML = `<div style="padding: 15px; background: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545;">Error: ${result.error || 'Failed to generate test report'}</div>`;
        }
    } catch (error) {
        console.error('Error testing scheduler:', error);
        statusDiv.innerHTML = `<div style="padding: 15px; background: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545;">Error: ${error.message}</div>`;
    }
}

// Update last test display
function updateLastTestDisplay(lastTestTime) {
    const statusDiv = document.getElementById('api-key-status');
    if (!statusDiv) {
        console.warn('api-key-status div not found');
        return;
    }
    
    if (lastTestTime) {
        try {
            const testDate = new Date(lastTestTime);
            const formattedDate = testDate.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            statusDiv.innerHTML = `<span style="color: #10b981; font-weight: 500;"><i class="fas fa-check-circle"></i> Last tested successfully: ${formattedDate}</span>`;
            statusDiv.style.display = 'block';
        } catch (e) {
            console.error('Error formatting test date:', e);
            statusDiv.innerHTML = `<span style="color: #10b981;"><i class="fas fa-check-circle"></i> Last tested: ${lastTestTime}</span>`;
        }
    } else {
        statusDiv.innerHTML = '<span style="color: #f59e0b; font-weight: 500;"><i class="fas fa-exclamation-triangle"></i> API key not tested yet</span>';
        statusDiv.style.display = 'block';
    }
}

// Show alert
function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
    
    container.innerHTML = '';
    container.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

