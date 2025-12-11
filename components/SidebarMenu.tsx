import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import PrivacySettings from './PrivacySettings';
import { useAuth } from '../auth/AuthContext';
import { Place, PlaceCategory, Coordinates, GroupedBusStop } from '../types';
import LocationSearch from './LocationSearch';
import FilterControls from './FilterControls';
import PlaceDetailCard from './PlaceDetailCard';
import PlacesList from './PlacesList';
import BusRouteSelector from './BusRouteSelector';
import { getApiBaseUrl } from '../services/config';
import { fetchHeaderSettings, resolveHeaderContext, resolveButtonStyle } from '../services/headerSettings';

interface SidebarMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onPageChange: (page: 'app' | 'business' | 'trips' | 'events' | 'excursions') => void;
    theme: 'light' | 'dark';
    onThemeToggle: () => void;
    currentPage: 'app' | 'business' | 'trips' | 'events' | 'excursions';
    isControlsCollapsed: boolean;
    onToggleControls: () => void;
    isPlacesListCollapsed: boolean;
    onTogglePlacesList: () => void;
    
    // Props for controls and lists
    allPlaces: Place[];
    allEvents?: Place[];
    tourRoutes?: Place[];
    filteredPlaces: Place[];
    selectedPlace: Place | null;
    isLoadingPlaces: boolean;
    hasSearched: boolean;
    searchCenter: Coordinates | null;
    selectedCategories: PlaceCategory[];
    searchRadius: number;
    isLoadingAiDescription: boolean;
    isLoadingImage: boolean;
    aiError: string | null;
    
    onCategoryChange: (category: PlaceCategory) => void;
    onRadiusChange: (radius: number) => void;
    onPlaceClick: (place: Place) => void;
    onLocationFound: (coords: Coordinates) => void;
    onSuggestionSelect: (place: Place) => void;
    onGenerateDescription: (place: Place) => void;
    onSendMessage: (place: Place, message: string) => void;
    onClosePlaceDetail: () => void;
    onOpenGallery: (place: Place, imageIndex?: number) => void;
    onEditPlace: (place: Place) => void;
    onAddToTrip: (place: Place) => void;
    selectedBusRoute: string | null;
    onBusRouteChange: (routeId: string | null) => void;
    selectedClusterStops: any[];
    selectedGroupedBusStop: GroupedBusStop | null;

    // Note: onShowTrailOnMap removed - hiking trails now use unified tour system
    selectedTour: Place | null;
    onCloseTour: () => void;
    onLoginClick: () => void;
    isSmallScreen: boolean;
    isGoModeActive?: boolean;
}

const SidebarMenu: React.FC<SidebarMenuProps> = (props) => {
    const { t } = useTranslation();
    const { 
        isOpen, onClose, onPageChange, theme, onThemeToggle,
        currentPage, isControlsCollapsed, onToggleControls, isPlacesListCollapsed, onTogglePlacesList,
        allPlaces, filteredPlaces, selectedPlace, isLoadingPlaces, hasSearched, searchCenter,
        selectedCategories, searchRadius, isLoadingAiDescription, isLoadingImage, aiError,
        onCategoryChange, onRadiusChange, onPlaceClick, onLocationFound, onSuggestionSelect,
        onGenerateDescription, onSendMessage, onClosePlaceDetail, onOpenGallery, onEditPlace, onAddToTrip,
        selectedBusRoute, onBusRouteChange, selectedClusterStops, selectedGroupedBusStop,
        selectedTour, onCloseTour, onLoginClick, isSmallScreen, isGoModeActive = false

    } = props;

    const { user } = useAuth();

    const backendBaseUrl = useMemo(() => {
        const url = getApiBaseUrl();
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }, []);

    const getBackendAssetUrl = useCallback(
        (path: string) => `${backendBaseUrl}${path.startsWith('/') ? path : `/${path}`}`,
        [backendBaseUrl]
    );
    
    const [headerSettings, setHeaderSettings] = useState<any>(null);
    const [isDesktop, setIsDesktop] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
    const themeMode = props.theme;
    useEffect(() => {
        fetchHeaderSettings().then(setHeaderSettings).catch(() => {});
        const onResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    // Live update when admin saves from editor (storage/BroadcastChannel)
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'dg_header_settings_updated') {
                fetchHeaderSettings().then(setHeaderSettings).catch(() => {});
            }
        };
        window.addEventListener('storage', onStorage);
        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('dg-header');
            bc.onmessage = (msg) => {
                if (msg?.data?.type === 'header-settings-updated') {
                    fetchHeaderSettings().then(setHeaderSettings).catch(() => {});
                }
            };
        } catch {}
        return () => {
            window.removeEventListener('storage', onStorage);
            try { bc && bc.close(); } catch {}
        };
    }, []);

    const handlePageChange = (page: 'app' | 'business' | 'trips' | 'events' | 'excursions') => {
        onPageChange(page);
        onClose();
    };

    const handlePlaceClickAndClose = (place: Place) => {
        onPlaceClick(place);
        // On mobile, selecting a place from the list shouldn't close the sidebar
        // onClose(); 
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            
            {/* Sidebar Panel */}
            <div 
              className={`
                fixed top-0 left-0 h-full z-50 
                w-full max-w-[260px] md:max-w-xs transform transition-transform duration-300 ease-in-out 
                ${currentPage === 'app' ? 'lg:relative lg:translate-x-0 lg:max-w-sm lg:w-full lg:min-w-[420px]' : 'lg:-translate-x-full'}
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col
              `}
              data-sidebar
            style={(() => {
              const fallback = { backgroundColor: themeMode === 'dark' ? '#000000' : '#f1f5f9' };
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
              const sidebarBg = ctx.sidebar?.sidebarBg;
              return {
                backgroundColor: sidebarBg || fallback.backgroundColor
              };
            })()}
            >
                {/* Mobile Header */}
                <div
                    className="flex-shrink-0 p-4 flex items-center justify-between text-white shadow-xl lg:hidden"
                    style={(() => {
                      const base: React.CSSProperties = { minHeight: '72px', backgroundColor: '#1f2937' };
                      if (!headerSettings) return base;
                      const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', false);
                      const bg = ctx.header?.bg;
                      const shadow = ctx.header?.shadow;
                      const borderColor = ctx.header?.borderColor;
                      return {
                        ...base,
                        background: bg || base.backgroundColor,
                        boxShadow: shadow || undefined,
                        borderBottom: borderColor ? `1px solid ${borderColor}` : undefined
                      };
                    })()}
                >
                    <div className="w-8 md:w-10"></div> {/* Spacer */}
                    <div className="flex-1 flex justify-center">
                        {(() => {
                          if (!headerSettings) {
                            return (
                              <img
                                src={getBackendAssetUrl('/logo.png')}
                                alt="Discover Gozo Logo"
                                className="h-10 cursor-pointer"
                                onClick={() => handlePageChange('app')}
                              />
                            );
                          }
                          const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', false);
                          const logo = ctx.logo || {};
                          const rawUrl = logo.url || '/logo.png';
                          const isAbsolute = /^https?:\/\//i.test(rawUrl);
                          const src = isAbsolute ? rawUrl : getBackendAssetUrl(rawUrl);
                          const width = logo.width || 40;
                          const height = logo.height || 40;
                          const alt = logo.alt || 'Discover Gozo Logo';
                          return (
                            <img
                              src={src}
                              alt={alt}
                              className="cursor-pointer"
                              style={{ width, height, objectFit: 'contain' }}
                              onClick={() => handlePageChange('app')}
                            />
                          );
                        })()}
                    </div>
                    <div className="w-8 md:w-10 flex justify-end">
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 transition-colors" aria-label="Close sidebar">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto flex flex-col gap-2 md:gap-3 p-2 md:p-3">
                    {/* Navigation Section (Mobile Only) */}
                    <nav 
                      className="rounded-xl shadow-lg p-2 md:hidden" 
                      data-onboarding="menu-nav"
                      style={{
                        backgroundColor: headerSettings ? (resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop).sidebar?.cardBg || (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')) : (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')
                      }}
                    >
                        <div className="grid grid-cols-2 gap-1">
                            <button 
                                onClick={() => handlePageChange('app')} 
                                className={`w-full h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                                    currentPage === 'app' 
                                        ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                                        : ''
                                }`}
                                style={(() => {
                                  const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
                                  if (!headerSettings) return fallback;
                                  const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
                                  const btn = resolveButtonStyle(ctx, 'explorer') || {} as any;
                                  const isSelected = currentPage === 'app';
                                  const selectedBlur = btn.selectedBlur !== undefined ? btn.selectedBlur : 8;
                                  const selectedShadowColor = btn.selectedShadowColor || '#ff6b35';
                                  const selectedShadowIntensity = btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3;
                                  const shadowRgb = selectedShadowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                                  const shadowR = shadowRgb ? parseInt(shadowRgb[1], 16) : 255;
                                  const shadowG = shadowRgb ? parseInt(shadowRgb[2], 16) : 107;
                                  const shadowB = shadowRgb ? parseInt(shadowRgb[3], 16) : 53;
                                  return {
                                    color: btn.color || '#ff6b35',
                                    fontSize: (btn.fontSize || 13.6) / 16 + 'rem',
                                    fontFamily: btn.fontFamily || undefined,
                                    fontWeight: btn.fontWeight || undefined,
                                    letterSpacing: btn.letterSpacing !== undefined ? `${btn.letterSpacing}em` : undefined,
                                    backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                                    borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                                    backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                                    boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                                  } as React.CSSProperties;
                                })()}
                            >
                                {/* <img src={getBackendAssetUrl('/explorer.png')} alt="Explorer" className="h-full w-auto object-contain" /> */}
                                {t('header.explorer')}
                            </button>
                            <button 
                                onClick={() => handlePageChange('events')} 
                                className={`w-full h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                                    currentPage === 'events' 
                                        ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                                        : ''
                                }`}
                                style={(() => {
                                  const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
                                  if (!headerSettings) return fallback;
                                  const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
                                  const btn = resolveButtonStyle(ctx, 'events') || {} as any;
                                  const isSelected = currentPage === 'events';
                                  const selectedBlur = btn.selectedBlur !== undefined ? btn.selectedBlur : 8;
                                  const selectedShadowColor = btn.selectedShadowColor || '#ff6b35';
                                  const selectedShadowIntensity = btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3;
                                  const shadowRgb = selectedShadowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                                  const shadowR = shadowRgb ? parseInt(shadowRgb[1], 16) : 255;
                                  const shadowG = shadowRgb ? parseInt(shadowRgb[2], 16) : 107;
                                  const shadowB = shadowRgb ? parseInt(shadowRgb[3], 16) : 53;
                                  return {
                                    color: btn.color || '#ff6b35',
                                    fontSize: (btn.fontSize || 13.6) / 16 + 'rem',
                                    fontFamily: btn.fontFamily || undefined,
                                    fontWeight: btn.fontWeight || undefined,
                                    letterSpacing: btn.letterSpacing !== undefined ? `${btn.letterSpacing}em` : undefined,
                                    backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                                    borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                                    backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                                    boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                                  } as React.CSSProperties;
                                })()}
                            >
                                {/* <img src={getBackendAssetUrl('/events.png')} alt="Events" className="h-full w-auto object-contain max-w-[65%]" /> */}
                                {t('header.events')}
                            </button>
                            <button 
                                onClick={() => handlePageChange('excursions')} 
                                className={`w-full h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                                    currentPage === 'excursions' 
                                        ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                                        : ''
                                }`}
                                style={(() => {
                                  const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
                                  if (!headerSettings) return fallback;
                                  const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
                                  const btn = resolveButtonStyle(ctx, 'excursions') || {} as any;
                                  const isSelected = currentPage === 'excursions';
                                  const selectedBlur = btn.selectedBlur !== undefined ? btn.selectedBlur : 8;
                                  const selectedShadowColor = btn.selectedShadowColor || '#ff6b35';
                                  const selectedShadowIntensity = btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3;
                                  const shadowRgb = selectedShadowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                                  const shadowR = shadowRgb ? parseInt(shadowRgb[1], 16) : 255;
                                  const shadowG = shadowRgb ? parseInt(shadowRgb[2], 16) : 107;
                                  const shadowB = shadowRgb ? parseInt(shadowRgb[3], 16) : 53;
                                  return {
                                    color: btn.color || '#ff6b35',
                                    fontSize: (btn.fontSize || 13.6) / 16 + 'rem',
                                    fontFamily: btn.fontFamily || undefined,
                                    fontWeight: btn.fontWeight || undefined,
                                    letterSpacing: btn.letterSpacing !== undefined ? `${btn.letterSpacing}em` : undefined,
                                    backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                                    borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                                    backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                                    boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                                  } as React.CSSProperties;
                                })()}
                            >
                                {/* <img src={getBackendAssetUrl('/excursions.png')} alt="Excursions" className="h-full w-auto object-contain" /> */}
                                {t('header.excursions')}
                            </button>
                            <button 
                                onClick={() => handlePageChange('business')} 
                                className={`w-full h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                                    currentPage === 'business' 
                                        ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                                        : ''
                                }`}
                                style={(() => {
                                  const fallback = { color: '#ff6b35', fontSize: '0.8rem' } as any;
                                  if (!headerSettings) return fallback;
                                  const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
                                  const btn = resolveButtonStyle(ctx, 'contact') || {} as any;
                                  const isSelected = currentPage === 'business';
                                  const selectedBlur = btn.selectedBlur !== undefined ? btn.selectedBlur : 8;
                                  const selectedShadowColor = btn.selectedShadowColor || '#ff6b35';
                                  const selectedShadowIntensity = btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3;
                                  const shadowRgb = selectedShadowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                                  const shadowR = shadowRgb ? parseInt(shadowRgb[1], 16) : 255;
                                  const shadowG = shadowRgb ? parseInt(shadowRgb[2], 16) : 107;
                                  const shadowB = shadowRgb ? parseInt(shadowRgb[3], 16) : 53;
                                  return {
                                    color: btn.color || '#ff6b35',
                                    fontSize: (btn.fontSize || 12.8) / 16 + 'rem',
                                    fontFamily: btn.fontFamily || undefined,
                                    fontWeight: btn.fontWeight || undefined,
                                    letterSpacing: btn.letterSpacing !== undefined ? `${btn.letterSpacing}em` : undefined,
                                    backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                                    borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                                    backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                                    boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                                  } as React.CSSProperties;
                                })()}
                            >
                                {/* <img src={getBackendAssetUrl('/for-businesses.png')} alt="For Businesses" className="h-full w-auto object-contain" /> */}
                                {t('header.for_businesses')}
                            </button>
                            {user && (
                                <button 
                                    onClick={() => handlePageChange('trips')} 
                                    className={`w-full h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                                        currentPage === 'trips' 
                                            ? 'backdrop-blur-md border-cyan-400/50 shadow-lg shadow-cyan-500/30' 
                                            : ''
                                    }`}
                                    style={(() => {
                                      const fallback = { color: '#40e0d0', fontSize: '0.85rem' } as any;
                                      if (!headerSettings) return fallback;
                                      const ctx = resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop);
                                      const btn = resolveButtonStyle(ctx, 'trips') || {} as any;
                                      const isSelected = currentPage === 'trips';
                                      const selectedBlur = btn.selectedBlur !== undefined ? btn.selectedBlur : 8;
                                      const selectedShadowColor = btn.selectedShadowColor || '#40e0d0';
                                      const selectedShadowIntensity = btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3;
                                      const shadowRgb = selectedShadowColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                                      const shadowR = shadowRgb ? parseInt(shadowRgb[1], 16) : 64;
                                      const shadowG = shadowRgb ? parseInt(shadowRgb[2], 16) : 224;
                                      const shadowB = shadowRgb ? parseInt(shadowRgb[3], 16) : 208;
                                      return {
                                        color: btn.color || '#40e0d0',
                                        fontSize: (btn.fontSize || 13.6) / 16 + 'rem',
                                        fontFamily: btn.fontFamily || undefined,
                                        fontWeight: btn.fontWeight || undefined,
                                        letterSpacing: btn.letterSpacing !== undefined ? `${btn.letterSpacing}em` : undefined,
                                        backgroundColor: isSelected ? (btn.selectedBg || 'rgba(64, 224, 208, 0.25)') : (btn.bg || 'transparent'),
                                        borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (themeMode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                                        backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                                        boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                                      } as React.CSSProperties;
                                    })()}
                                >
                                    {/* <img src={getBackendAssetUrl('/mytrips.png')} alt="My Trips" className="h-full w-auto object-contain" /> */}
                                    {t('header.my_trips')}
                                </button>
                            )}
                        </div>
                    </nav>

                    {currentPage === 'app' && (
                        <>
                            {/* Collapsible Controls Card */}
                            <div 
                              className="rounded-xl shadow-lg flex-shrink-0" 
                              data-onboarding="search-filters"
                              style={{
                                backgroundColor: headerSettings ? (resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop).sidebar?.cardBg || (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')) : (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')
                              }}
                            >
                                <button onClick={onToggleControls} className="w-full flex justify-between items-center p-2 md:p-3">
                                    <h2 className="text-base md:text-lg font-bold text-[rgb(var(--text-primary))]">{t('sidebar.search_filters')}</h2>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 md:w-5 h-4 md:h-5 text-[rgb(var(--text-secondary))] transition-transform duration-300 ${isControlsCollapsed ? '-rotate-180' : ''}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </button>
                                <div className={`collapsible-content ${isControlsCollapsed ? 'collapsed' : ''}`}>
                                    <div className="p-2 md:p-3 pt-0">
                                        <LocationSearch 
                                            onLocationFound={onLocationFound}
                                            allPlaces={allPlaces}
                                            allEvents={props.allEvents}
                                            tourRoutes={props.tourRoutes}
                                            onSuggestionSelect={onSuggestionSelect}
                                        />
                                        <div className="my-3 border-t border-[rgb(var(--border-color))]"></div>
                                        <FilterControls 
                                            selectedCategories={selectedCategories} 
                                            onCategoryChange={onCategoryChange}
                                            searchRadius={searchRadius}
                                            onRadiusChange={onRadiusChange}
                                            isRadiusEnabled={true}
                                            hasLocation={!!searchCenter}
                                            selectedBusRoute={selectedBusRoute}
                                            onBusRouteChange={onBusRouteChange}
                                            isGoModeActive={isGoModeActive}
                                        />
                                        
                                    </div>
                                </div>
                            </div>

                            {/* Places List / Details Card - Mobile Version */}
                            <div className="rounded-xl shadow-lg flex-1 flex flex-col lg:hidden" style={{
                              backgroundColor: headerSettings ? (resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop).sidebar?.cardBg || (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')) : (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')
                            }}>
                                {selectedGroupedBusStop ? (
                                    <div className="p-3">
                                        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">Bus Stops at {selectedGroupedBusStop.name}</h2>
                                        <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">Select a specific stop to see details:</p>
                                        <ul className="space-y-2">
                                            {selectedGroupedBusStop.stops.map(stop => (
                                                <li key={stop.id}>
                                                    <button 
                                                        onClick={() => onPlaceClick(stop)} 
                                                        className="w-full text-left p-2 rounded-md hover:bg-[rgb(var(--bg-hover))]"
                                                    >
                                                        {stop.routeId ? (
                                                            <span className="block bg-blue-500 text-white px-3 py-1 rounded-md text-center text-sm font-semibold hover:bg-blue-600 transition-colors duration-150">
                                                                {stop.routeId.replace(/_/g, ' ').replace(/-/g, ' ')}
                                                            </span>
                                                        ) : (
                                                            <span className="block bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-center text-sm font-semibold">
                                                                {stop.name} {stop.routeId && `(${stop.routeId})`}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        <button 
                                            onClick={onClosePlaceDetail} 
                                            className="mt-4 w-full text-center bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
                                        >
                                            Back to Map
                                        </button>
                                    </div>
                                ) : ( 
                                    <>
                                        <button onClick={onTogglePlacesList} className="w-full flex justify-between items-center p-3">
                                            <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">{t('sidebar.nearby_places')}</h2>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 text-[rgb(var(--text-secondary))] transition-transform duration-300 ${isPlacesListCollapsed ? '-rotate-180' : ''}`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </button>
                                        <div className={`collapsible-content ${isPlacesListCollapsed ? 'collapsed' : ''}`}>
                                            <PlacesList 
                                                places={filteredPlaces} 
                                                onPlaceClick={handlePlaceClickAndClose} 
                                                isLoading={isLoadingPlaces} 
                                                hasSearched={hasSearched} 
                                                isLocationAvailable={!!searchCenter} 
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Places List / Details Card - Desktop Version */}
                            <div className="rounded-xl shadow-lg flex-1 flex flex-col hidden lg:flex" style={{
                              backgroundColor: headerSettings ? (resolveHeaderContext(headerSettings, themeMode === 'dark' ? 'dark' : 'light', isDesktop).sidebar?.cardBg || (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')) : (themeMode === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)')
                            }}>
                                {selectedGroupedBusStop ? (
                                    <div className="p-3">
                                        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">Bus Stops at {selectedGroupedBusStop.name}</h2>
                                        <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">Select a specific stop to see details:</p>
                                        <ul className="space-y-2">
                                            {selectedGroupedBusStop.stops.map(stop => (
                                                <li key={stop.id}>
                                                    <button 
                                                        onClick={() => onPlaceClick(stop)} 
                                                        className="w-full text-left p-2 rounded-md hover:bg-[rgb(var(--bg-hover))]"
                                                    >
                                                        {stop.routeId ? (
                                                            <span className="block bg-blue-500 text-white px-3 py-1 rounded-md text-center text-sm font-semibold hover:bg-blue-600 transition-colors duration-150">
                                                                {stop.routeId.replace(/_/g, ' ').replace(/-/g, ' ')}
                                                            </span>
                                                        ) : (
                                                            <span className="block bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-center text-sm font-semibold">
                                                                {stop.name} {stop.routeId && `(${stop.routeId})`}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        <button 
                                            onClick={onClosePlaceDetail} 
                                            className="mt-4 w-full text-center bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
                                        >
                                            Back to Map
                                        </button>
                                    </div>
                                ) : !isSmallScreen && selectedTour ? (
                                    <PlaceDetailCard
                                        place={selectedTour}
                                        isLoadingAiDescription={isLoadingAiDescription}
                                        isLoadingImage={isLoadingImage}
                                        aiError={aiError}
                                        onGenerateDescription={onGenerateDescription}
                                        onSendMessage={onSendMessage}
                                        onClose={onCloseTour}
                                        onOpenGallery={onOpenGallery}
                                        onEdit={() => onEditPlace(selectedTour)}
                                        onAddToTrip={onAddToTrip}
                                        onLoginClick={onLoginClick}
                                        onPageChange={onPageChange}
                                        isSmallScreen={false}
                                        // Note: onShowTrailOnMap removed - hiking trails now use unified tour system
                                    />
                                ) : !isSmallScreen && selectedPlace ? (
                                    <PlaceDetailCard
                                        place={selectedPlace}
                                        isLoadingAiDescription={isLoadingAiDescription}
                                        isLoadingImage={isLoadingImage}
                                        aiError={aiError}
                                        onGenerateDescription={onGenerateDescription}
                                        onSendMessage={onSendMessage}
                                        onClose={onClosePlaceDetail}
                                        onOpenGallery={onOpenGallery}
                                        onEdit={() => onEditPlace(selectedPlace)}
                                        onAddToTrip={onAddToTrip}
                                        onLoginClick={onLoginClick}
                                        onPageChange={onPageChange}
                                        isSmallScreen={false}
                                    />
                                ) : ( 
                                    <>
                                        <button onClick={onTogglePlacesList} className="w-full flex justify-between items-center p-2 md:p-3">
                                            <h2 className="text-base md:text-lg font-bold text-[rgb(var(--text-primary))]">{t('sidebar.nearby_places')}</h2>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 md:w-5 h-4 md:h-5 text-[rgb(var(--text-secondary))] transition-transform duration-300 ${isPlacesListCollapsed ? '-rotate-180' : ''}`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </button>
                                        <div className={`collapsible-content ${isPlacesListCollapsed ? 'collapsed' : ''}`}>
                                            <PlacesList 
                                                places={filteredPlaces} 
                                                onPlaceClick={handlePlaceClickAndClose} 
                                                isLoading={isLoadingPlaces} 
                                                hasSearched={hasSearched} 
                                                isLocationAvailable={!!searchCenter} 
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-shrink-0 p-2 md:p-3 border-t border-[rgb(var(--border-color))]">
                    <div className="flex items-center justify-between gap-2">
                        <LanguageSelector />
                        <PrivacySettings theme={theme} />
                        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
                        <button
                            onClick={() => {
                                if (typeof window !== 'undefined' && (window as any).startOnboarding) {
                                    (window as any).startOnboarding();
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-[rgb(var(--bg-light))] transition-colors"
                            title={t('sidebar.show_tour') || 'Show Tour'}
                            aria-label={t('sidebar.show_tour') || 'Show Tour'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[rgb(var(--text-secondary))]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SidebarMenu;