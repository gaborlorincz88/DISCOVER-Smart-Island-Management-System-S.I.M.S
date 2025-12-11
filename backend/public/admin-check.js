// Admin Authentication Check
// Include this script in all admin pages to protect them

(async function() {
    // Don't check auth on login page
    if (window.location.pathname.includes('admin-login.html')) {
        return;
    }

    try {
        const response = await fetch('/api/admin-auth/status', {
            credentials: 'include'
        });

        if (!response.ok) {
            // Not authenticated, redirect to login
            console.log('Not authenticated, redirecting to login...');
            window.location.href = '/admin-login.html';
            return;
        }

        const data = await response.json();
        
        if (data.success && data.user) {
            // Store admin info globally
            window.adminUser = data.user;
            
            // Show admin info in console
            console.log('👤 Logged in as:', data.user.email);
            
            // Dispatch event for other scripts to use
            window.dispatchEvent(new CustomEvent('adminAuthenticated', {
                detail: data.user
            }));
        } else {
            // Invalid session, redirect to login
            window.location.href = '/admin-login.html';
        }
        
    } catch (error) {
        console.error('Auth check error:', error);
        // On error, redirect to login
        window.location.href = '/admin-login.html';
    }
})();

// Logout function
async function adminLogout() {
    if (!confirm('Are you sure you want to log out?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin-auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/admin-login.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// Add logout button to all admin pages
function addAdminUIElements() {
    // Find the top menu if it exists
    const topMenu = document.querySelector('.top-menu');
    if (topMenu && window.adminUser) {
        // Check if already added
        if (topMenu.querySelector('.admin-indicator')) {
            return;
        }
        
        // Ensure top-menu uses flexbox and pushes admin elements to the right
        topMenu.style.display = 'flex';
        topMenu.style.alignItems = 'center';
        topMenu.style.gap = '12px';
        
        // Add a spacer to push admin elements to the right
        const spacer = document.createElement('div');
        spacer.style.marginLeft = 'auto';
        topMenu.appendChild(spacer);
        
        // Add admin indicator (light blue)
        const adminIndicator = document.createElement('span');
        adminIndicator.className = 'admin-indicator';
        adminIndicator.style.cssText = `
            color: #ffffff;
            font-size: 13px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(79, 172, 254, 0.3);
        `;
        adminIndicator.innerHTML = `
            <i class="fas fa-user-shield"></i>
            ${window.adminUser.username || window.adminUser.email}
        `;
        topMenu.appendChild(adminIndicator);
        
        // Add logout button (red)
        const logoutBtn = document.createElement('a');
        logoutBtn.href = '#';
        logoutBtn.className = 'btn btn-logout';
        logoutBtn.style.cssText = `
            background: linear-gradient(135deg, #ff4757 0%, #ff6348 100%) !important;
            color: white !important;
            border: none !important;
            padding: 10px 20px !important;
            font-size: 14px !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            text-decoration: none !important;
            font-weight: 500 !important;
            box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3) !important;
        `;
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.onmouseover = () => {
            logoutBtn.style.transform = 'translateY(-2px)';
            logoutBtn.style.boxShadow = '0 4px 12px rgba(255, 71, 87, 0.4)';
        };
        logoutBtn.onmouseout = () => {
            logoutBtn.style.transform = 'translateY(0)';
            logoutBtn.style.boxShadow = '0 2px 8px rgba(255, 71, 87, 0.3)';
        };
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            adminLogout();
        };
        topMenu.appendChild(logoutBtn);
    }
}

// Try to add UI elements on DOMContentLoaded
document.addEventListener('DOMContentLoaded', addAdminUIElements);

// Also listen for the authenticated event in case timing is off
window.addEventListener('adminAuthenticated', () => {
    setTimeout(addAdminUIElements, 100);
});

