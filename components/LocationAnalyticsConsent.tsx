import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveConsent, shouldShowConsentDialog } from '../services/consentManager';

interface LocationAnalyticsConsentProps {
  onConsentGiven?: () => void;
}

const LocationAnalyticsConsent: React.FC<LocationAnalyticsConsentProps> = ({ onConsentGiven }) => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    // Check if we should show the consent dialog
    if (shouldShowConsentDialog()) {
      // Small delay to ensure smooth UI rendering
      setTimeout(() => {
        setShowDialog(true);
        setTimeout(() => setIsVisible(true), 100);
      }, 1000);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAccept = () => {
    saveConsent(true);
    setIsVisible(false);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('consentChanged', { detail: { consented: true } }));
    setTimeout(() => {
      setShowDialog(false);
      if (onConsentGiven) {
        onConsentGiven();
      }
    }, 300);
  };

  const handleDecline = () => {
    saveConsent(false);
    setIsVisible(false);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('consentChanged', { detail: { consented: false } }));
    setTimeout(() => {
      setShowDialog(false);
    }, 300);
  };

  if (!showDialog) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: isMobile ? '10px' : '20px',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={(e) => {
        // Close on backdrop click (but not on dialog click)
        if (e.target === e.currentTarget) {
          handleDecline();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '16px' : '32px',
          maxWidth: isMobile ? '95%' : '400px',
          width: '100%',
          maxHeight: isMobile ? '85vh' : 'auto',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: isMobile ? '12px' : '24px' }}>
          <h2
            style={{
              fontSize: isMobile ? '16px' : '24px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: isMobile ? '6px' : '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: isMobile ? '18px' : '28px' }}>📍</span>
            <span>Location Analytics</span>
          </h2>
          <p
            style={{
              fontSize: isMobile ? '13px' : '16px',
              color: '#666',
              lineHeight: '1.4',
              marginBottom: isMobile ? '10px' : '20px',
            }}
          >
            To help improve tourism services, we collect anonymous location data when you use location features.
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: isMobile ? '10px' : '20px',
            marginBottom: isMobile ? '12px' : '24px',
            border: '1px solid #e9ecef',
          }}
        >
          <h3
            style={{
              fontSize: isMobile ? '13px' : '18px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: isMobile ? '6px' : '12px',
            }}
          >
            What we collect:
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: isMobile ? '11px' : '14px',
              color: '#555',
              lineHeight: '1.5',
            }}
          >
            <li style={{ marginBottom: isMobile ? '4px' : '8px', paddingLeft: '18px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>
              Approximate location (when GPS enabled)
            </li>
            <li style={{ marginBottom: isMobile ? '4px' : '8px', paddingLeft: '18px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>
              Device information
            </li>
            <li style={{ marginBottom: isMobile ? '4px' : '8px', paddingLeft: '18px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>
              Usage patterns
            </li>
          </ul>
        </div>

        <div
          style={{
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            padding: isMobile ? '10px' : '16px',
            marginBottom: isMobile ? '12px' : '24px',
            border: '1px solid #90caf9',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? '11px' : '14px',
              color: '#1565c0',
              lineHeight: '1.4',
              margin: 0,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: isMobile ? '14px' : '18px', flexShrink: 0 }}>ℹ️</span>
            <span>
              <strong>Your privacy matters:</strong> All data is anonymous and used to improve tourism services. 
              You can opt-out anytime in settings.
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexDirection: 'column' }}>
          <button
            onClick={handleAccept}
            style={{
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: isMobile ? '10px 14px' : '14px 24px',
              fontSize: isMobile ? '13px' : '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5568d3';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Accept & Continue
          </button>
          <button
            onClick={handleDecline}
            style={{
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: isMobile ? '9px 14px' : '12px 24px',
              fontSize: isMobile ? '12px' : '15px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#999';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#ddd';
            }}
          >
            {isMobile ? 'Decline' : 'Decline (Location features will still work)'}
          </button>
        </div>

        <p
          style={{
            fontSize: isMobile ? '10px' : '12px',
            color: '#999',
            textAlign: 'center',
            marginTop: isMobile ? '10px' : '20px',
            marginBottom: 0,
          }}
        >
          By continuing, you agree to our{' '}
          <a
            href="/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#667eea', textDecoration: 'underline' }}
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default LocationAnalyticsConsent;

