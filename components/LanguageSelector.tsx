import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', countryCode: 'gb' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', countryCode: 'de' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', countryCode: 'fr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', countryCode: 'es' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', countryCode: 'it' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', countryCode: 'pl' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺', countryCode: 'hu' },
];

// Helper function to get flag URL from CDN
const getFlagUrl = (countryCode: string, size: number = 40) => {
  // Try multiple CDNs for reliability
  // Primary: flagcdn.com
  return `https://flagcdn.com/w${size}/${countryCode}.png`;
};

// Alternative flag URL (fallback)
const getFlagUrlAlt = (countryCode: string) => {
  // Fallback: flagsapi.com
  return `https://flagsapi.com/${countryCode.toUpperCase()}/flat/32.png`;
};

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);
  const [useEmojiFlags, setUseEmojiFlags] = useState(false);

  const currentLanguage = LANGUAGES.find(lang => lang.code === i18n.language) || LANGUAGES[0];

  // Detect if we should use emoji flags (for mobile or if images fail)
  useEffect(() => {
    const testImage = new Image();
    testImage.onerror = () => setUseEmojiFlags(true);
    testImage.onload = () => setUseEmojiFlags(false);
    testImage.src = getFlagUrl('gb', 40);
  }, []);

  // Update dropdown width when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Small delay to ensure button is fully rendered
      const timer = setTimeout(() => {
        if (buttonRef.current) {
          const width = buttonRef.current.offsetWidth;
          setDropdownWidth(width);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const changeLanguage = useCallback((lng: string) => {
    // Close dropdown immediately
    setIsOpen(false);
    // Change language synchronously but wrapped in try-catch
    try {
    i18n.changeLanguage(lng);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  }, [i18n]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg bg-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200 ease-in-out shadow-sm active:scale-95 transform border border-[rgb(var(--border-color))]"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <div 
          className="flex items-center justify-center flex-shrink-0"
          style={{ 
            width: '20px',
            height: '20px',
            minWidth: '20px',
            minHeight: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {useEmojiFlags ? (
            <span 
              className="emoji-flag"
              style={{ 
                fontSize: '1.25rem',
                lineHeight: '1',
                display: 'inline-block'
              }}
            >
              {currentLanguage.flag}
            </span>
          ) : (
            <img 
              key={`flag-btn-${currentLanguage.code}-${i18n.language}`}
              src={getFlagUrl(currentLanguage.countryCode, 40)} 
              alt={`${currentLanguage.name} flag`}
              style={{ 
                width: '20px',
                height: '20px',
                objectFit: 'cover',
                borderRadius: '2px',
                border: '1px solid rgba(0,0,0,0.1)',
                display: 'block',
                flexShrink: 0
              }}
              loading="eager"
              crossOrigin="anonymous"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Try alternative CDN
                if (!target.dataset.triedAlt) {
                  target.dataset.triedAlt = 'true';
                  target.src = getFlagUrlAlt(currentLanguage.countryCode);
                  return;
                }
                // If both fail, switch to emoji flags
                setUseEmojiFlags(true);
                target.style.display = 'none';
              }}
            />
          )}
        </div>
        <span>{currentLanguage.code.toUpperCase()}</span>
        <svg 
          className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 bottom-full mb-2 bg-[rgb(var(--card-bg))] border border-[rgb(var(--border-color))] rounded-lg shadow-xl z-[9999] overflow-hidden" 
          style={{ width: dropdownWidth ? `${dropdownWidth}px` : 'auto', minWidth: 'fit-content' }}
        >
          <div className="py-1">
      {LANGUAGES.map(lang => (
        <button
                type="button"
          key={lang.code}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  changeLanguage(lang.code);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-150 ${
            i18n.language === lang.code
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold'
                    : 'text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                <div 
                  className="flex items-center justify-center flex-shrink-0" 
                  style={{ 
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    minHeight: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent'
                  }}
                >
                  {useEmojiFlags ? (
                    <span 
                      className="emoji-flag"
                      style={{ 
                        fontSize: '1.5rem',
                        lineHeight: '1',
                        display: 'inline-block'
                      }}
                    >
                      {lang.flag}
                    </span>
                      ) : (
                        <img 
                          key={`dropdown-flag-${lang.code}`}
                          src={getFlagUrl(lang.countryCode, 40)} 
                          alt={`${lang.name} flag`}
                          style={{ 
                            width: '20px',
                            height: '20px',
                            objectFit: 'cover',
                            borderRadius: '2px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            display: 'block',
                            flexShrink: 0
                          }}
                          loading="eager"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Try alternative CDN
                            if (!target.dataset.triedAlt) {
                              target.dataset.triedAlt = 'true';
                              target.src = getFlagUrlAlt(lang.countryCode);
                              return;
                            }
                            // If both fail, switch to emoji flags globally
                            setUseEmojiFlags(true);
                            target.style.display = 'none';
                          }}
                        />
                      )}
                </div>
                <span className="text-xs md:text-sm font-medium">{lang.code.toUpperCase()}</span>
                {i18n.language === lang.code && (
                  <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
        </button>
      ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;