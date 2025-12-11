import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaceCategory } from '../types';
import { CATEGORIES, CATEGORY_INFO, SEARCH_RADIUS_OPTIONS } from '../constants';
import { getApiBaseUrl } from '../services/config';
import BusRouteSelector from './BusRouteSelector';

// Add style to ensure container expands when dropdown opens
if (typeof document !== 'undefined') {
    const styleId = 'filter-controls-dropdown-expand';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .collapsible-content {
                overflow: visible !important;
            }
            .collapsible-content > div {
                overflow: visible !important;
            }
            [data-bus-route-dropdown-open="true"] {
                overflow: visible !important;
                padding-bottom: 50px !important;
            }
            .rounded-xl.shadow-lg.flex-shrink-0:has([data-bus-route-dropdown-open="true"]) {
                overflow: visible !important;
            }
        `;
        document.head.appendChild(style);
    }
}

interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  isCustom: boolean;
  createdAt: string;
}

interface FilterControlsProps {
  selectedCategories: Array<PlaceCategory | string>;
  onCategoryChange: (category: PlaceCategory | string) => void;
  searchRadius: number;
  onRadiusChange: (radius: number) => void;
  isRadiusEnabled: boolean;
  selectedBusRoute: string | null;
  onBusRouteChange: (routeId: string | null) => void;
  isGoModeActive?: boolean;
  hasLocation?: boolean;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  selectedCategories,
  onCategoryChange,
  searchRadius,
  onRadiusChange,
  isRadiusEnabled,
  selectedBusRoute,
  onBusRouteChange,
  isGoModeActive = false,
  hasLocation = false,
}) => {
  const { t } = useTranslation();
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [allCategories, setAllCategories] = useState<Array<PlaceCategory | CustomCategory>>([]);
  const [isBusRouteDropdownOpen, setIsBusRouteDropdownOpen] = useState(false);

  // Load custom categories from API
  useEffect(() => {
    const loadCategories = async () => {
      // Try API endpoint first (most up-to-date)
      try {
        console.log('Loading custom categories from API...');
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/admin/custom-categories`);
        if (response.ok) {
          const customCats = await response.json();
          console.log('Custom categories loaded from API:', customCats);
          setCustomCategories(customCats);
          setAllCategories([...CATEGORIES, ...customCats]);
          // Do not cache categories in localStorage; frontend will fetch from API/static file on load
          return;
        }
      } catch (apiError) {
        console.log('API endpoint not available, trying other sources...', apiError);
      }

      // Fallback to static file if API not available
      try {
        console.log('Loading custom categories from static file...');
        const response = await fetch('/custom-categories.json');
        if (response.ok) {
          const customCats = await response.json();
          console.log('Custom categories loaded from static file:', customCats);
          setCustomCategories(customCats);
          setAllCategories([...CATEGORIES, ...customCats]);
        } else {
          throw new Error('Static file not found');
        }
      } catch (error) {
        console.error('Error loading custom categories from static file:', error);
        console.log('No custom categories found, using built-in only');
        setAllCategories(CATEGORIES);
      }
    };

    // Load categories on mount
    loadCategories();

    // Listen for custom events (for same-tab updates)
    const handleCustomCategoriesChange = () => {
      console.log('Custom categories change event received, reloading...');
      loadCategories();
    };

    // Listen for localStorage changes (for cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customCategories' || e.key === 'categoriesUpdated') {
        console.log('Storage change detected, reloading categories...');
        loadCategories();
      }
    };

    window.addEventListener('customCategoriesChanged', handleCustomCategoriesChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('customCategoriesChanged', handleCustomCategoriesChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Helper functions to get category info
  const getCategoryIcon = (category: PlaceCategory | CustomCategory) => {
    if (typeof category === 'object' && 'isCustom' in category) {
      return category.icon;
    }
    return CATEGORY_INFO[category as PlaceCategory]?.icon || '📍';
  };

  const getCategoryName = (category: PlaceCategory | CustomCategory) => {
    if (typeof category === 'object' && 'isCustom' in category) {
      // Try to get translation for custom category, fallback to original name
      return t(`categories.${category.name}`, category.name);
    }
    const categoryKey = category as PlaceCategory;
    // Try to get translation, fallback to original category name
    return t(`categories.${categoryKey}`, categoryKey);
  };

  const getCategoryKey = (category: PlaceCategory | CustomCategory): PlaceCategory | string => {
    if (typeof category === 'object' && 'isCustom' in category) {
      return category.name;
    }
    return category as PlaceCategory;
  };

  const isBusStopSelected = selectedCategories.includes(PlaceCategory.BUS_STOP);
  const showBusStopMessage = isBusStopSelected && !hasLocation && !selectedBusRoute;

  // Automatically reduce radius to 1km when bus stop is selected and radius is > 1km
  useEffect(() => {
    if (isBusStopSelected && searchRadius > 1) {
      onRadiusChange(1);
    }
  }, [isBusStopSelected, searchRadius, onRadiusChange]);

  return (
    <div>
      <div className="mb-3 md:mb-4" data-onboarding="range-selector">
        <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 text-[rgb(var(--text-secondary))]">{t('filters.search_radius')}</h3>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {SEARCH_RADIUS_OPTIONS.map((option) => {
            // Disable options > 500m in GO mode OR options > 1km when bus stop is selected
            const isDisabledByGoMode = isGoModeActive && option.value > 0.5;
            const isDisabledByBusStop = isBusStopSelected && option.value > 1;
            const isDisabled = isDisabledByGoMode || isDisabledByBusStop;
            const isSelected = searchRadius === option.value;
            
            // Determine the appropriate message for disabled state
            let disabledMessage = '';
            if (isDisabledByGoMode) {
              disabledMessage = 'Not available in GO mode';
            } else if (isDisabledByBusStop) {
              disabledMessage = 'Maximum range for bus stops is 1 km';
            }
            
            return (
              <button
                key={option.value}
                onClick={() => {
                  if (isDisabled) {
                    // Show message when clicking disabled option
                    if (isDisabledByGoMode) {
                      alert('This range is not available in GO mode. Maximum range in GO mode is 500m.');
                    } else if (isDisabledByBusStop) {
                      alert('This range is not available for bus stops. Maximum range for bus stops is 1 km.');
                    }
                  } else {
                    onRadiusChange(option.value);
                  }
                }}
                disabled={isDisabled}
                className={`px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-semibold rounded-full transition-all duration-200 ease-in-out shadow-sm active:scale-95 transform
                  ${isSelected
                    ? 'bg-sky-600 text-white shadow-md'
                    : isDisabled
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] hover:bg-slate-300'
                  }`}
                title={disabledMessage}
              >
                {t(`filters.${option.label}`, option.label)}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="my-3 md:my-4 border-t border-[rgb(var(--border-color))]"></div>

      <div className="mb-3 md:mb-4" data-onboarding="category-selector">
        <div className="flex justify-between items-center mb-2 md:mb-3">
          <h3 className="text-base md:text-lg font-semibold text-[rgb(var(--text-secondary))]">{t('filters.categories')}</h3>
          <div className="flex gap-1.5 md:gap-2">
            {selectedCategories.length > 0 && (
              <button 
                onClick={() => {
                  // Deselect all categories
                  selectedCategories.forEach(cat => onCategoryChange(cat));
                }}
                className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 font-semibold shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 inline-flex items-center gap-1 md:gap-1.5"
              >
                <span className="sm:hidden">{t('filters.clear_all', 'Clear')}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="hidden sm:block w-3 md:w-4 h-3 md:h-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">{t('filters.clear_all')}</span>
              </button>
            )}
            {selectedBusRoute && (
              <button 
                onClick={() => onBusRouteChange(null)}
                className="text-xs md:text-sm text-sky-500 hover:text-sky-600 font-semibold"
              >
                {t('filters.clear_route')}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {allCategories.map((category) => {
            const categoryKey = getCategoryKey(category);
            const categoryName = getCategoryName(category);
            const categoryIcon = getCategoryIcon(category);
            // Handle both PlaceCategory enum values and custom category strings
            const isSelected = selectedCategories.some(selected => 
              selected === categoryKey || String(selected) === String(categoryKey)
            );
            
            
            return (
              <button
                key={categoryKey}
                onClick={() => onCategoryChange(categoryKey as PlaceCategory)}
                className={`px-2.5 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-full transition-all duration-200 ease-in-out inline-flex items-center shadow-sm active:scale-95 transform
                  ${isSelected
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] hover:bg-slate-300'
                  }`}
              >
                <span className="mr-1.5 md:mr-2 text-base md:text-lg">{categoryIcon}</span>
                {categoryName}
              </button>
            );
          })}
        </div>
        
        {showBusStopMessage && (
          <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm md:text-base text-blue-800 dark:text-blue-200">
              <strong>Too many bus stops to show.</strong> Enable GPS or browse the map to see nearby stops.
            </p>
          </div>
        )}
        
        {selectedCategories.includes(PlaceCategory.BUS_STOP) && (
            <div 
                className="p-3 mt-4 border border-blue-500 rounded-lg bg-blue-500/10" 
                data-bus-route-dropdown-open={isBusRouteDropdownOpen ? "true" : "false"}
                style={{ 
                    overflow: 'visible', 
                    minHeight: isBusRouteDropdownOpen ? '550px' : 'auto',
                    transition: 'min-height 0.3s ease-out',
                    marginBottom: isBusRouteDropdownOpen ? '10px' : '0',
                    position: 'relative',
                    zIndex: isBusRouteDropdownOpen ? 10 : 'auto'
                }}
            >
                <BusRouteSelector
                    selectedBusRoute={selectedBusRoute}
                    onBusRouteChange={onBusRouteChange}
                    onDropdownToggle={setIsBusRouteDropdownOpen}
                />
            </div>
        )}

      </div>

    </div>
  );
};

export default FilterControls;