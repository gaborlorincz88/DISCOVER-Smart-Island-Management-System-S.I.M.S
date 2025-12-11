export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  tooltipPosition: TooltipPosition;
  preAction?: () => void | Promise<void>;
  waitForElement?: boolean;
  highlightPadding?: number;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'map-controls-zoom',
    title: 'Map Controls',
    description: 'Use the zoom buttons to zoom in and out of the map. You can also pinch to zoom on mobile devices.',
    targetSelector: '[data-onboarding="zoom-controls"]',
    tooltipPosition: 'left',
    highlightPadding: 8,
  },
  {
    id: 'map-controls-gps',
    title: 'Location Tracking',
    description: 'Enable GPS tracking to see your current location on the map. The center button will take you back to your location.',
    targetSelector: '.map-control-button.gps-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
  },
  {
    id: 'map-controls-center',
    title: 'Center on Location',
    description: 'Click this button to quickly center the map on your current location.',
    targetSelector: '.map-control-button.center-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
  },
  {
    id: 'map-controls-weather',
    title: 'Weather & Waves',
    description: 'View real-time weather conditions and wave information for beaches and coastal areas.',
    targetSelector: '.map-control-button.wave-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
    waitForElement: true,
  },
  {
    id: 'map-controls-alerts',
    title: 'User Safety Alerts',
    description: 'See community-generated safety alerts like jellyfish sightings, strong currents, or other hazards.',
    targetSelector: '.map-control-button.user-alarm-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
    waitForElement: true,
  },
  {
    id: 'map-controls-go-mode',
    title: 'GO Mode',
    description: 'Activate GO mode for continuous location tracking while you explore. Only available when location tracking is enabled.',
    targetSelector: '.map-control-button.go-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
    waitForElement: true,
    preAction: async () => {
      // Enable location tracking if not already enabled, so GO mode button appears
      const gpsButton = document.querySelector('.map-control-button.gps-control') as HTMLElement;
      if (gpsButton && !gpsButton.classList.contains('active')) {
        // Check if we need to enable location tracking
        const goButton = document.querySelector('.map-control-button.go-control');
        if (!goButton) {
          // Location tracking is not enabled, we'll need to show it anyway during onboarding
          // The button should be visible in onboarding context
        }
      }
    },
  },
  {
    id: 'map-controls-treasure-hunt',
    title: 'Treasure Hunt',
    description: 'Participate in interactive treasure hunts around Gozo! Complete challenges and discover hidden locations. Available after registration.',
    targetSelector: '.map-control-button.treasure-hunt-control',
    tooltipPosition: 'left',
    highlightPadding: 8,
    waitForElement: true,
  },
  {
    id: 'menu-button',
    title: 'Menu Button',
    description: 'This is the menu button. Most of your controls and features are accessed through the menu.',
    targetSelector: '[data-menu-trigger]',
    tooltipPosition: 'right',
    highlightPadding: 8,
    waitForElement: false,
  },
  {
    id: 'menu-open',
    title: 'Open the Menu',
    description: 'Click this button to open the menu where you\'ll find navigation, search, and filter controls.',
    targetSelector: '[data-menu-trigger]',
    tooltipPosition: 'right',
    highlightPadding: 8,
    waitForElement: false,
    preAction: async () => {
      // Ensure sidebar is open (mobile only)
      const sidebarButton = document.querySelector('[data-menu-trigger]') as HTMLElement;
      if (sidebarButton) {
        const sidebar = document.querySelector('[data-sidebar]');
        if (sidebar) {
          const transform = window.getComputedStyle(sidebar).transform;
          const isSidebarOpen = transform === 'none' || transform.includes('translateX(0px)');
          const isMobile = window.innerWidth < 1024;
          
          if (isMobile && !isSidebarOpen) {
            sidebarButton.click();
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
    },
  },
  {
    id: 'menu-navigation',
    title: 'Navigation Buttons',
    description: 'Switch between Explorer, Events, Excursions, and Business pages to discover different content. On desktop, these buttons are in the header.',
    targetSelector: '[data-onboarding="menu-nav"], header nav',
    tooltipPosition: 'right',
    highlightPadding: 12,
    waitForElement: true,
    preAction: async () => {
      // Ensure sidebar is open and wait
      const sidebar = document.querySelector('[data-sidebar]');
      if (sidebar) {
        const transform = window.getComputedStyle(sidebar).transform;
        const isSidebarOpen = transform === 'none' || transform.includes('translateX(0px)');
        const isMobile = window.innerWidth < 1024;
        if (isMobile && !isSidebarOpen) {
          const sidebarButton = document.querySelector('[data-menu-trigger]') as HTMLElement;
          if (sidebarButton) {
            sidebarButton.click();
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
    },
  },
  {
    id: 'menu-search-field',
    title: 'Search Field',
    description: 'Search for places by name or location. Type a place name or address to find it on the map.',
    targetSelector: '[data-onboarding="search-field"]',
    tooltipPosition: 'right',
    highlightPadding: 8,
    waitForElement: true,
    preAction: async () => {
      // Ensure sidebar is open and controls are expanded
      const sidebar = document.querySelector('[data-sidebar]');
      const isMobile = window.innerWidth < 1024;
      
      if (isMobile && sidebar) {
        const transform = window.getComputedStyle(sidebar).transform;
        const isSidebarOpen = transform === 'none' || transform.includes('translateX(0px)');
        if (!isSidebarOpen) {
          const sidebarButton = document.querySelector('[data-menu-trigger]') as HTMLElement;
          if (sidebarButton) {
            sidebarButton.click();
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
      
      // Expand controls section if collapsed
      const controlsContainer = document.querySelector('[data-onboarding="search-filters"]');
      if (controlsContainer) {
        const collapsibleContent = controlsContainer.querySelector('.collapsible-content');
        if (collapsibleContent && collapsibleContent.classList.contains('collapsed')) {
          const toggleButton = controlsContainer.querySelector('button') as HTMLElement;
          if (toggleButton) {
            toggleButton.click();
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      }
    },
  },
  {
    id: 'menu-range-selector',
    title: 'Search Radius',
    description: 'Adjust the search radius to find places within a specific distance from your location.',
    targetSelector: '[data-onboarding="range-selector"]',
    tooltipPosition: 'right',
    highlightPadding: 8,
    waitForElement: true,
    preAction: async () => {
      // Ensure controls are expanded
      const controlsContainer = document.querySelector('[data-onboarding="search-filters"]');
      if (controlsContainer) {
        const collapsibleContent = controlsContainer.querySelector('.collapsible-content');
        if (collapsibleContent && collapsibleContent.classList.contains('collapsed')) {
          const toggleButton = controlsContainer.querySelector('button') as HTMLElement;
          if (toggleButton) {
            toggleButton.click();
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      }
    },
  },
  {
    id: 'menu-category-selector',
    title: 'Category Filters',
    description: 'Filter places by category like beaches, restaurants, churches, and more. Select multiple categories to narrow your search.',
    targetSelector: '[data-onboarding="category-selector"]',
    tooltipPosition: 'right',
    highlightPadding: 8,
    waitForElement: true,
    preAction: async () => {
      // Ensure controls are expanded
      const controlsContainer = document.querySelector('[data-onboarding="search-filters"]');
      if (controlsContainer) {
        const collapsibleContent = controlsContainer.querySelector('.collapsible-content');
        if (collapsibleContent && collapsibleContent.classList.contains('collapsed')) {
          const toggleButton = controlsContainer.querySelector('button') as HTMLElement;
          if (toggleButton) {
            toggleButton.click();
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      }
    },
  },
];

