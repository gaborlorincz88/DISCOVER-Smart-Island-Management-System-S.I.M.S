/**
 * Consent Manager - GDPR Compliant Consent Management
 * Handles user consent for location analytics tracking
 */

const CONSENT_STORAGE_KEY = 'discover_gozo_location_analytics_consent';
const CONSENT_TIMESTAMP_KEY = 'discover_gozo_location_analytics_consent_timestamp';
const CONSENT_VERSION_KEY = 'discover_gozo_location_analytics_consent_version';

// Current consent version - increment when privacy policy changes
const CURRENT_CONSENT_VERSION = '1.0';

export interface ConsentStatus {
  hasConsented: boolean;
  consentTimestamp: string | null;
  consentVersion: string | null;
}

/**
 * Check if user has consented to location analytics tracking
 */
export const hasLocationAnalyticsConsent = (): boolean => {
  try {
    const consent = localStorage.getItem(CONSENT_STORAGE_KEY);
    const version = localStorage.getItem(CONSENT_VERSION_KEY);
    
    // If consent version changed, require new consent
    if (version !== CURRENT_CONSENT_VERSION) {
      return false;
    }
    
    return consent === 'true';
  } catch (error) {
    console.warn('Error checking consent:', error);
    return false;
  }
};

/**
 * Get full consent status
 */
export const getConsentStatus = (): ConsentStatus => {
  try {
    return {
      hasConsented: hasLocationAnalyticsConsent(),
      consentTimestamp: localStorage.getItem(CONSENT_TIMESTAMP_KEY),
      consentVersion: localStorage.getItem(CONSENT_VERSION_KEY)
    };
  } catch (error) {
    return {
      hasConsented: false,
      consentTimestamp: null,
      consentVersion: null
    };
  }
};

/**
 * Save user consent
 */
export const saveConsent = (consented: boolean): void => {
  try {
    if (consented) {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());
      localStorage.setItem(CONSENT_VERSION_KEY, CURRENT_CONSENT_VERSION);
    } else {
      // Remove consent
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
      localStorage.removeItem(CONSENT_VERSION_KEY);
    }
  } catch (error) {
    console.error('Error saving consent:', error);
  }
};

/**
 * Revoke consent (opt-out)
 */
export const revokeConsent = (): void => {
  saveConsent(false);
};

/**
 * Check if consent dialog should be shown
 */
export const shouldShowConsentDialog = (): boolean => {
  // Show if no consent has been given or version changed
  return !hasLocationAnalyticsConsent();
};

