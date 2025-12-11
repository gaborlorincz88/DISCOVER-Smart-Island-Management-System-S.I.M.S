// Modern Theme Toggle System
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('admin-theme') || 'light';
        this.init();
    }

    init() {
        // Set initial theme
        this.setTheme(this.currentTheme);
        
        // Create theme toggle button
        this.createThemeToggle();
        
        // Listen for system theme changes
        this.listenForSystemTheme();
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('admin-theme', theme);
        
        // Update theme toggle icon
        this.updateThemeToggleIcon();
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    createThemeToggle() {
        // Create floating theme toggle
        this.floatingToggle = document.createElement('div');
        this.floatingToggle.className = 'theme-toggle';
        this.floatingToggle.setAttribute('title', 'Toggle theme');
        this.floatingToggle.innerHTML = this.getThemeIcon();
        
        this.floatingToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        document.body.appendChild(this.floatingToggle);
    }



    getThemeIcon() {
        if (this.currentTheme === 'light') {
            return `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
            `;
        } else {
            return `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 5.25V3m4.227 4.227l1.591-1.591M18.75 12H21m-4.227 4.227l1.591 1.591M12 18.75V21" />
                </svg>
            `;
        }
    }

    updateThemeToggleIcon() {
        const icons = document.querySelectorAll('.theme-toggle');
        icons.forEach(icon => {
            icon.innerHTML = this.getThemeIcon();
        });
    }

    listenForSystemTheme() {
        // Check if user prefers dark mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a theme
            if (!localStorage.getItem('admin-theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // Get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Check if dark mode is active
    isDarkMode() {
        return this.currentTheme === 'dark';
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Export for use in other scripts
window.ThemeManager = ThemeManager;



