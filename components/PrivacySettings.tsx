import React, { useState, useEffect } from 'react';
import { hasLocationAnalyticsConsent, getConsentStatus, saveConsent, revokeConsent } from '../services/consentManager';

interface PrivacySettingsProps {
  theme?: 'light' | 'dark';
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ theme = 'dark' }) => {
  const [consentStatus, setConsentStatus] = useState(getConsentStatus());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setConsentStatus(getConsentStatus());
    
    // Listen for consent changes (when user accepts/declines in the modal)
    const handleConsentChange = () => {
      setConsentStatus(getConsentStatus());
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'discover_gozo_location_analytics_consent') {
        setConsentStatus(getConsentStatus());
      }
    };
    
    window.addEventListener('consentChanged', handleConsentChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('consentChanged', handleConsentChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleToggleConsent = () => {
    if (consentStatus.hasConsented) {
      revokeConsent();
    } else {
      saveConsent(true);
    }
    // Update state immediately
    const newStatus = getConsentStatus();
    setConsentStatus(newStatus);
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const bgColor = theme === 'dark' ? 'bg-slate-800' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const secondaryText = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <>
      {/* Compact Settings Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
          theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'
        }`}
        style={{
          padding: '8px 12px',
          minWidth: '40px',
        }}
        title="Privacy & Analytics Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-5 h-5 ${textColor}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Bottom Sheet Menu */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setIsExpanded(false)}
          />
          {/* Bottom Sheet */}
          <div
            className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} ${borderColor} border-t rounded-t-xl shadow-2xl max-h-[70vh] overflow-y-auto`}
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-base font-semibold ${textColor} flex items-center gap-2`}>
                  <span>🔒</span>
                  <span>Privacy & Analytics</span>
                </h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className={`${secondaryText} hover:opacity-70 transition-opacity`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className={`${borderColor} border-t pt-3`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className={`text-sm font-medium ${textColor}`}>Location Analytics</p>
                    <p className={`text-xs ${secondaryText} mt-1`}>
                      Help improve tourism services by sharing anonymous location data
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentStatus.hasConsented}
                      onChange={handleToggleConsent}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {consentStatus.hasConsented && consentStatus.consentTimestamp && (
                  <p className={`text-xs ${secondaryText} mt-2`}>
                    Consent given: {new Date(consentStatus.consentTimestamp).toLocaleDateString()}
                  </p>
                )}

                <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} border ${theme === 'dark' ? 'border-blue-800' : 'border-blue-200'}`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                    <strong>What we collect:</strong> Approximate location (rounded to ~100m), device info, and usage patterns. 
                    All data is anonymous and used solely to improve tourism services and infrastructure planning.
                  </p>
                </div>
              </div>

              <div className={`${borderColor} border-t pt-3`}>
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} hover:underline flex items-center gap-2`}
                >
                  <span>📄</span>
                  <span>View Privacy Policy</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default PrivacySettings;

