import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { getApiBaseUrl } from '../services/config';
import { fetchHeaderSettings, resolveHeaderContext, resolveButtonStyle } from '../services/headerSettings';

interface HeaderProps {
  onLoginClick: () => void;
  onPageChange: (page: 'app' | 'business' | 'trips' | 'events' | 'excursions') => void;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  currentPage?: 'app' | 'business' | 'trips' | 'events' | 'excursions' | 'tour-detail' | 'checkout' | 'my-tickets';
}

const Header: React.FC<HeaderProps> = ({ onLoginClick, onPageChange, onToggleSidebar, isSidebarOpen, currentPage = 'app' }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [headerSettings, setHeaderSettings] = useState<any>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    fetchHeaderSettings().then(setHeaderSettings).catch(() => {});
  }, []);
  // Live update when admin saves from editor (storage/BroadcastChannel)
  useEffect(() => {
    if (typeof window === 'undefined') return;
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

  const backendBaseUrl = useMemo(() => {
    const url = getApiBaseUrl();
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }, []);

  const getBackendAssetUrl = useCallback(
    (path: string) => `${backendBaseUrl}${path.startsWith('/') ? path : `/${path}`}`,
    [backendBaseUrl]
  );

  return (
    <header className="bg-gray-800 text-white p-4 flex items-center justify-between shadow-lg z-20 relative"
      style={(() => {
        if (!headerSettings) return undefined;
        const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
        const bg = ctx.header?.bg;
        const shadow = ctx.header?.shadow;
        const borderColor = ctx.header?.borderColor;
        return {
          background: bg || undefined,
          boxShadow: shadow || undefined,
          borderColor: borderColor || undefined
        } as React.CSSProperties;
      })()}
    >
      <div className="flex-1 flex items-center gap-4">
        <button 
          onClick={onToggleSidebar} 
          className="md:hidden"
          data-menu-trigger
          style={(() => {
            const fallback = { padding: '8px', backgroundColor: 'transparent', borderRadius: '4px' };
            if (!headerSettings) return fallback;
            const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', false); // Always mobile for burger menu
            const burger = ctx.burgerMenu || {};
            return {
              padding: `${burger.padding || 8}px`,
              backgroundColor: burger.bg === 'transparent' ? 'transparent' : (burger.bg || 'transparent'),
              borderRadius: `${burger.borderRadius || 4}px`
            } as React.CSSProperties;
          })()}
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            style={(() => {
              const fallback = { width: '24px', height: '24px' };
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', false); // Always mobile for burger menu
              const burger = ctx.burgerMenu || {};
              return {
                width: `${burger.size || 24}px`,
                height: `${burger.size || 24}px`
              } as React.CSSProperties;
            })()}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              stroke={headerSettings ? (resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', false).burgerMenu?.color || '#ffffff') : '#ffffff'}
              strokeWidth={headerSettings ? (resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', false).burgerMenu?.strokeWidth || 2) : 2} 
              d="M4 6h16M4 12h16M4 18h16" 
            />
          </svg>
        </button>
        
        <nav className="hidden md:flex items-center gap-2 lg:gap-3 xl:gap-4">
          <button 
            onClick={() => onPageChange('app')} 
            className={`h-10 flex items-center justify-center px-2 lg:px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
              currentPage === 'app' 
                ? 'backdrop-blur-md' 
                : ''
            }`}
            style={(() => {
              const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
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
                textShadow: btn.shadow || '0 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
              } as React.CSSProperties;
            })()}
          >
            {/* <img src={getBackendAssetUrl('/explorer.png')} alt="Explorer" className="h-full w-auto object-contain lg:scale-150 xl:scale-200" /> */}
            {t('header.explorer')}
          </button>
          <button 
            onClick={() => onPageChange('events')} 
            className={`h-10 flex items-center justify-center px-2 lg:px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
              currentPage === 'events' 
                ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                : ''
            }`}
            style={(() => {
              const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
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
                textShadow: btn.shadow || '0 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
              } as React.CSSProperties;
            })()}
          >
            {/* <img src={getBackendAssetUrl('/events.png')} alt="Events" className="h-full w-auto object-contain max-w-[65%] lg:max-w-[95%] xl:max-w-full lg:scale-150 xl:scale-200" /> */}
            {t('header.events')}
          </button>
          <button 
            onClick={() => onPageChange('excursions')} 
            className={`h-10 flex items-center justify-center px-2 lg:px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
              (currentPage === 'excursions' || currentPage === 'tour-detail' || currentPage === 'checkout' || currentPage === 'my-tickets')
                ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                : ''
            }`}
            style={(() => {
              const fallback = { color: '#ff6b35', fontSize: '0.85rem' } as any;
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
              const btn = resolveButtonStyle(ctx, 'excursions') || {} as any;
              const selected = (currentPage === 'excursions' || currentPage === 'tour-detail' || currentPage === 'checkout' || currentPage === 'my-tickets');
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
                textShadow: btn.shadow || '0 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: selected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                borderColor: selected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                backdropFilter: selected ? `blur(${selectedBlur}px)` : undefined,
                boxShadow: selected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
              } as React.CSSProperties;
            })()}
          >
            {/* <img src={getBackendAssetUrl('/excursions.png')} alt="Excursions" className="h-full w-auto object-contain lg:scale-150 xl:scale-200" /> */}
            {t('header.excursions')}
          </button>
          <button 
            onClick={() => onPageChange('business')} 
            className={`h-10 flex items-center justify-center px-2 lg:px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
              currentPage === 'business' 
                ? 'backdrop-blur-md border-orange-400/50 shadow-lg shadow-orange-500/30' 
                : ''
            }`}
            style={(() => {
              const fallback = { color: '#ff6b35', fontSize: '0.8rem' } as any;
              if (!headerSettings) return fallback;
              const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
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
                textShadow: btn.shadow || '0 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: isSelected ? (btn.selectedBg || 'rgba(255, 107, 53, 0.25)') : (btn.bg || 'transparent'),
                borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
              } as React.CSSProperties;
            })()}
          >
            {/* <img src={getBackendAssetUrl('/for-businesses.png')} alt="For Businesses" className="h-full w-auto object-contain lg:scale-150 xl:scale-200" /> */}
            {t('header.for_businesses')}
          </button>
          {user && (
             <button 
                onClick={() => onPageChange('trips')}
                className={`h-10 flex items-center justify-center px-2 lg:px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 menu-button-text border ${
                  currentPage === 'trips' 
                    ? 'backdrop-blur-md border-cyan-400/50 shadow-lg shadow-cyan-500/30' 
                    : ''
                }`}
                style={(() => {
                  const fallback = { color: '#40e0d0', fontSize: '0.85rem' } as any;
                  if (!headerSettings) return fallback;
                  const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
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
                    textShadow: btn.shadow || '0 2px 4px rgba(0,0,0,0.5)',
                    backgroundColor: isSelected ? (btn.selectedBg || 'rgba(64, 224, 208, 0.25)') : (btn.bg || 'transparent'),
                    borderColor: isSelected ? (btn.selectedBorderColor || undefined) : (btn.borderColor || (isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)')),
                    backdropFilter: isSelected ? `blur(${selectedBlur}px)` : undefined,
                    boxShadow: isSelected ? `0 4px 12px rgba(${shadowR}, ${shadowG}, ${shadowB}, ${selectedShadowIntensity})` : undefined
                  } as React.CSSProperties;
                })()}
             >
                {/* <img src={getBackendAssetUrl('/mytrips.png')} alt="My Trips" className="h-full w-auto object-contain lg:scale-150 xl:scale-200" /> */}
                {t('header.my_trips')}
             </button>
          )}
        </nav>
      </div>
      
      <div className="flex-1 flex justify-center">
        {(() => {
          if (!headerSettings) {
            // Fallback to original static logo
            return (
              <img
                src={getBackendAssetUrl('/logo.png')}
                alt="Discover Gozo Logo"
                className="h-10 cursor-pointer"
                onClick={() => onPageChange('app')}
              />
            );
          }
          const ctx = resolveHeaderContext(headerSettings, isDarkMode ? 'dark' : 'light', isDesktop);
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
              onClick={() => onPageChange('app')}
            />
          );
        })()}
      </div>

      <div className="flex-1 flex justify-end items-center gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:inline">
              {t('header.welcome')}, <span className="font-semibold">{user.role === 'admin' ? 'Admin' : 'Explorer'}</span>
            </span>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition-all active:scale-95"
            >
              {t('header.logout')}
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition-all active:scale-95"
            data-onboarding="login-button"
          >
            {t('header.login')}
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;