import React, { useState, useEffect, useRef } from 'react';
import { downloadAllTiles, cachePlacesData, DownloadProgress } from '../services/offlineDataManager';
import { Place } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface OfflineDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  onDownloadComplete: () => void;
}

const OfflineDownloadModal: React.FC<OfflineDownloadModalProps> = ({
  isOpen,
  onClose,
  places,
  onDownloadComplete
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>({
    total: 0,
    downloaded: 0,
    failed: 0,
    currentTask: '',
    percentage: 0
  });
  const [downloadStage, setDownloadStage] = useState<'tiles' | 'places' | 'complete' | 'installing'>('tiles');
  const [error, setError] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setIsDownloading(false);
      setProgress({
        total: 0,
        downloaded: 0,
        failed: 0,
        currentTask: '',
        percentage: 0
      });
      setDownloadStage('tiles');
      setError(null);
      setShowInstallPrompt(false);
    }
  }, [isOpen]);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event for later use
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      console.log('✅ PWA install prompt available');
    };

    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      console.log('App is already installed');
      setIsInstalled(true);
    } else {
      console.log('App not installed, waiting for install prompt...');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check periodically if prompt becomes available (for delayed events)
    const checkInterval = setInterval(() => {
      if (!deferredPromptRef.current && !isInstalled) {
        // Prompt might have been fired before listener was attached
        // This is a workaround for browsers that fire the event early
        console.log('Checking for install prompt availability...');
      }
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(checkInterval);
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadStage('tiles');

    try {
      // Step 1: Download all map tiles
      const tileResult = await downloadAllTiles((progress) => {
        setProgress(progress);
      });

      if (tileResult.failed > tileResult.success * 0.1) {
        // If more than 10% failed, show warning but continue
        console.warn('Some tiles failed to download:', tileResult.failed);
      }

      // Step 2: Cache places data
      setDownloadStage('places');
      setProgress({
        total: places.length,
        downloaded: 0,
        failed: 0,
        currentTask: 'Caching places data...',
        percentage: 0
      });

      const placesCached = await cachePlacesData(places);
      
      if (placesCached) {
        setProgress({
          total: places.length,
          downloaded: places.length,
          failed: 0,
          currentTask: 'Complete!',
          percentage: 100
        });
        setDownloadStage('complete');
        
        // Mark as downloaded in localStorage
        localStorage.setItem('offlineDataDownloaded', 'true');
        localStorage.setItem('offlineDataDownloadedAt', new Date().toISOString());
        
        // Always show install prompt after download (even if native prompt not available)
        // Wait a moment to ensure prompt is captured
        setTimeout(() => {
          if (!isInstalled) {
            console.log('Showing install prompt');
            setShowInstallPrompt(true);
            setDownloadStage('installing');
          } else {
            console.log('App already installed, closing modal');
            // Wait a moment then close
            setTimeout(() => {
              onDownloadComplete();
              onClose();
            }, 1500);
          }
        }, 500);
      } else {
        throw new Error('Failed to cache places data');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download offline data. Please try again.');
      setIsDownloading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('offlineDownloadSkipped', 'true');
    onClose();
  };

  const handleInstall = async () => {
    if (!deferredPromptRef.current) {
      // Fallback: Show manual install instructions based on platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      let instructions = '';
      if (isIOS) {
        instructions = 'Tap the Share button (□↑) and select "Add to Home Screen"';
      } else if (isAndroid) {
        instructions = 'Tap the menu (⋮) and select "Add to Home Screen" or "Install App"';
      } else {
        instructions = 'Use your browser menu to "Add to Home Screen" or "Install App"';
      }
      
      setError(`Install prompt not available. ${instructions}`);
      return;
    }

    try {
      // Show the install prompt
      await deferredPromptRef.current.prompt();
      
      // Wait for user response
      const { outcome } = await deferredPromptRef.current.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallPrompt(false);
        setProgress({
          ...progress,
          currentTask: 'App installed successfully!'
        });
        
        // Wait a moment then close
        setTimeout(() => {
          onDownloadComplete();
          onClose();
        }, 2000);
      } else {
        // User dismissed the prompt
        setShowInstallPrompt(false);
        setDownloadStage('complete');
        // Still close after a moment since download is complete
        setTimeout(() => {
          onDownloadComplete();
          onClose();
        }, 1500);
      }
      
      // Clear the deferred prompt
      deferredPromptRef.current = null;
    } catch (error: any) {
      console.error('Install error:', error);
      setError('Failed to install app. Please use your browser menu to "Add to Home Screen"');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#171717] rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-center">
          <div className="text-6xl mb-3">📱</div>
          <h2 className="text-2xl font-bold text-white mb-2">Use Discover Gozo Offline</h2>
          <p className="text-blue-100 text-sm">
            Download maps and places data to use the app without internet
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isDownloading && downloadStage === 'tiles' && (
            <>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🗺️</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Complete Map Coverage</h3>
                    <p className="text-gray-400 text-sm">
                      Download all map tiles for Gozo and Comino islands
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📍</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">All Places & Attractions</h3>
                    <p className="text-gray-400 text-sm">
                      Cache all places, tours, and events for offline access
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚡</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Instant Loading</h3>
                    <p className="text-gray-400 text-sm">
                      Everything loads instantly from your device storage
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-300 text-sm text-center">
                  💡 <strong>Tip:</strong> Connect to WiFi for faster download
                </p>
              </div>
            </>
          )}

          {isDownloading && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="inline-block animate-spin text-4xl mb-3">⚙️</div>
                <p className="text-white font-medium">{progress.currentTask}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {/* Progress Stats */}
              <div className="flex justify-between text-sm text-gray-400">
                <span>
                  {downloadStage === 'tiles' && (
                    <>Downloaded: {progress.downloaded} / {progress.total} tiles</>
                  )}
                  {downloadStage === 'places' && (
                    <>Cached: {progress.downloaded} / {progress.total} places</>
                  )}
                </span>
                <span>{progress.percentage}%</span>
              </div>

              {progress.failed > 0 && (
                <p className="text-yellow-400 text-xs text-center">
                  ⚠️ {progress.failed} items failed (will retry automatically)
                </p>
              )}

              {downloadStage === 'complete' && !showInstallPrompt && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-2">✅</div>
                  <p className="text-green-400 font-semibold">Download Complete!</p>
                  <p className="text-gray-400 text-sm mt-1">You can now use the app offline</p>
                </div>
              )}

              {downloadStage === 'installing' && showInstallPrompt && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-2">📱</div>
                  <p className="text-blue-400 font-semibold">Ready to Install!</p>
                  <p className="text-gray-400 text-sm mt-1">Add Discover Gozo to your home screen</p>
                  {!deferredPromptRef.current && (
                    <p className="text-yellow-400 text-xs mt-2">
                      💡 Use your browser menu to install
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Actions */}
          {!isDownloading && downloadStage === 'tiles' && (
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              >
                📱 Install & Download
              </button>
              <button
                onClick={handleSkip}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Maybe Later
              </button>
            </div>
          )}

          {isDownloading && downloadStage !== 'complete' && downloadStage !== 'installing' && (
            <button
              onClick={() => {
                setIsDownloading(false);
                setError('Download cancelled by user');
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors mt-4"
            >
              Cancel Download
            </button>
          )}

          {downloadStage === 'installing' && showInstallPrompt && (
            <div className="flex flex-col gap-3 mt-6">
              {deferredPromptRef.current ? (
                <button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  ➕ Add to Home Screen
                </button>
              ) : (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-2">
                  <p className="text-blue-300 text-sm text-center mb-3">
                    To install: Use your browser menu
                  </p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p><strong>Android:</strong> Menu (⋮) → "Add to Home Screen"</p>
                    <p><strong>iOS:</strong> Share (□↑) → "Add to Home Screen"</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setShowInstallPrompt(false);
                  setDownloadStage('complete');
                  setTimeout(() => {
                    onDownloadComplete();
                    onClose();
                  }, 1000);
                }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Continue Without Installing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineDownloadModal;

