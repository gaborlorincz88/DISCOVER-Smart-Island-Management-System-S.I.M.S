import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../services/config';
import { treasureHuntService, TreasureHunt, TreasureHuntClue, TreasureHuntProgress } from '../services/treasureHuntService';
import { Coordinates } from '../types';
import { useAuth } from '../auth/AuthContext';

interface TreasureHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: Coordinates | null;
  theme?: 'light' | 'dark';
  onHuntStarted?: (huntId?: number) => void; // Optional huntId to make active
  preselectedHuntId?: number | null;
  activeHuntId?: number | null; // ID of the hunt currently active on the map
  showTreasureHuntClues?: boolean;
  onToggleTreasureHuntClues?: () => void;
}

const TreasureHuntModal: React.FC<TreasureHuntModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  theme = 'dark',
  onHuntStarted,
  preselectedHuntId,
  activeHuntId,
  showTreasureHuntClues = true,
  onToggleTreasureHuntClues
}) => {
  const { user } = useAuth();
  const [hunts, setHunts] = useState<TreasureHunt[]>([]);
  const [selectedHunt, setSelectedHunt] = useState<TreasureHunt | null>(null);
  const [huntDetails, setHuntDetails] = useState<any>(null);
  const [progress, setProgress] = useState<TreasureHuntProgress | null>(null);
  const [currentClue, setCurrentClue] = useState<TreasureHuntClue | null>(null);
  const [answer, setAnswer] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [huntProgressMap, setHuntProgressMap] = useState<Map<number, TreasureHuntProgress>>(new Map());
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'clue'>('list');
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Calculate distance to clue location
  const calculateDistance = (coords1: Coordinates, coords2: Coordinates) => {
    if (!coords1 || !coords2) return Infinity;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // distance in meters
  };

  // Verify session on mount
  useEffect(() => {
    if (isOpen && user) {
      verifySession();
    }
  }, [isOpen, user]);

  // Load hunts on mount
  useEffect(() => {
    if (isOpen) {
      loadHunts();
    }
  }, [isOpen]);

  // Auto-select hunt if preselectedHuntId is provided
  useEffect(() => {
    if (isOpen && preselectedHuntId !== null && preselectedHuntId !== undefined && hunts.length > 0) {
      const hunt = hunts.find(h => h.id === preselectedHuntId);
      if (hunt && !selectedHunt) {
        setSelectedHunt(hunt);
      }
    }
  }, [isOpen, preselectedHuntId, hunts, selectedHunt]);

  // Verify user has valid backend session
  const verifySession = async () => {
    if (!user) {
      setAuthError('Please log in to use treasure hunts');
      return;
    }

    try {
      // Check session status
      const response = await fetch(`${getApiBaseUrl()}/api/auth/status`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!data.authenticated) {
        setAuthError('Your session has expired. Please log out and log back in to continue.');
      } else {
        setAuthError(null);
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      setAuthError('Unable to verify authentication. Please try logging out and back in.');
    }
  };

  // Load progress for all hunts when modal opens
  useEffect(() => {
    if (isOpen && hunts.length > 0) {
      const loadAllProgress = async () => {
        const progressMap = new Map<number, TreasureHuntProgress>();
        for (const hunt of hunts) {
          try {
            const progress = await treasureHuntService.getUserProgress(hunt.id);
            if (progress) {
              progressMap.set(hunt.id, progress);
            }
          } catch (error) {
            // Continue
          }
        }
        setHuntProgressMap(progressMap);
      };
      loadAllProgress();
    }
  }, [isOpen, hunts]);

  // Load hunt details and progress when hunt is selected and in clue or details view
  useEffect(() => {
    if (selectedHunt && isOpen && (viewMode === 'clue' || viewMode === 'details')) {
      // Load details first, then progress (which will load clue if progress exists)
      loadHuntDetails(viewMode);
      if (viewMode === 'clue') {
        loadProgress();
      }
    }
  }, [selectedHunt, isOpen, viewMode]);

  // Reset view mode when modal opens/closes - MUST run BEFORE auto-select
  useEffect(() => {
    if (isOpen) {
      // When modal opens from button (no preselectedHuntId), always start with list view
      if (!preselectedHuntId) {
        setViewMode('list');
        setSelectedHunt(null);
        setHuntDetails(null);
        setProgress(null);
        setCurrentClue(null);
      }
      // If preselectedHuntId is set (clicked from clue marker), DON'T reset - let the auto-select handle it
    } else {
      // When modal closes, reset everything
      setViewMode('list');
      setSelectedHunt(null);
      setHuntDetails(null);
      setProgress(null);
      setCurrentClue(null);
    }
  }, [isOpen, preselectedHuntId]);

  // If modal opens from clue marker click (with preselectedHuntId), auto-select that hunt and show clue view IMMEDIATELY
  // This MUST run AFTER the reset effect
  useEffect(() => {
    if (isOpen && preselectedHuntId && hunts.length > 0) {
      // Only auto-select if opened from clue marker (preselectedHuntId is set)
      const hunt = hunts.find(h => h.id === preselectedHuntId);
      if (hunt && (!selectedHunt || selectedHunt.id !== preselectedHuntId)) {
        // Immediately set the hunt and clue view - don't wait for progress check
        setSelectedHunt(hunt);
        setViewMode('clue');
      }
    }
  }, [isOpen, preselectedHuntId, hunts, selectedHunt]);

  // Update distance when user location or current clue changes
  useEffect(() => {
    if (currentClue && userLocation) {
      const dist = calculateDistance(userLocation, {
        lat: currentClue.latitude,
        lng: currentClue.longitude
      });
      setDistance(dist);
    } else {
      setDistance(null);
    }
  }, [currentClue, userLocation]);

  const loadHunts = async () => {
    try {
      const huntsData = await treasureHuntService.getTreasureHunts();
      setHunts(huntsData.filter(h => h.is_active === 1));
    } catch (error) {
      console.error('Error loading hunts:', error);
      setError('Failed to load treasure hunts');
    }
  };


  const loadHuntDetails = async (mode?: 'clue' | 'details') => {
    if (!selectedHunt) return;
    setLoading(true);
    try {
      const details = await treasureHuntService.getHuntDetails(selectedHunt.id);
      if (details) {
        setHuntDetails(details);
        // Don't load clue here - let loadProgress handle it to avoid duplicate calls
        // and ensure we only call getCurrentClue when progress exists
      }
    } catch (error) {
      console.error('Error loading hunt details:', error);
      setError('Failed to load hunt details');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!selectedHunt) return;
    try {
      const progressData = await treasureHuntService.getUserProgress(selectedHunt.id);
      setProgress(progressData);
      // If no progress, user hasn't started the hunt yet
      if (!progressData) {
        setCurrentClue(null);
      } else {
        // If progress exists, load the current clue
        const clue = await treasureHuntService.getCurrentClue(selectedHunt.id);
        setCurrentClue(clue);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
      setProgress(null);
      setCurrentClue(null);
    }
  };

  const handleStartHunt = async (huntId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await treasureHuntService.startHunt(huntId);
      if (result.success) {
        // Reload progress for this hunt
        const newProgress = await treasureHuntService.getUserProgress(huntId);
        if (newProgress) {
          const newMap = new Map(huntProgressMap);
          newMap.set(huntId, newProgress);
          setHuntProgressMap(newMap);
        }
        
        // Select the hunt and show clue view
        const hunt = hunts.find(h => h.id === huntId);
        if (hunt) {
          setSelectedHunt(hunt);
          setViewMode('clue');
          await loadHuntDetails();
          await loadProgress();
        }
        
        // Notify parent that hunt was started/resumed - make this hunt active on the map
        if (onHuntStarted) {
          onHuntStarted(huntId);
        }
      } else {
        setError(result.error || 'Failed to start hunt');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to start hunt');
    } finally {
      setLoading(false);
    }
  };

  const handleSolveClue = async () => {
    if (!selectedHunt || !currentClue || !userLocation) {
      setError('Location required to solve clues');
      return;
    }

    if (!answer.trim()) {
      setError('Please enter an answer');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await treasureHuntService.solveClue(
        selectedHunt.id,
        currentClue.clue_number,
        answer.trim(),
        userLocation
      );

      console.log('Solve clue result:', result);

      if (result.success) {
        setAnswer('');
        if (result.completed) {
          console.log('Hunt completed! Showing animation...');
          // Hunt completed - show animation then modal
          setShowCompletionAnimation(true);
          // Update progress to reflect completion and get prize
          await loadHuntDetails();
          // Reload progress to get the newly generated prize
          const updatedProgress = await treasureHuntService.getUserProgress(selectedHunt.id);
          if (updatedProgress) {
            setProgress(updatedProgress);
            // Update progress map with prize info
            const newMap = new Map(huntProgressMap);
            newMap.set(selectedHunt.id, updatedProgress);
            setHuntProgressMap(newMap);
          }
          // After animation, show completion modal
          setTimeout(() => {
            setShowCompletionAnimation(false);
            setShowCompletionModal(true);
          }, 3000); // Show animation for 3 seconds
          // Clear current clue since hunt is completed
          setCurrentClue(null);
        } else {
          setSuccess('Correct! 🎉');
          
          // If we have the next clue from the result, set it immediately
          if (result.nextClue) {
            setCurrentClue(result.nextClue);
            // Reload hunt details and progress in background
            loadHuntDetails();
            const updatedProgress = await treasureHuntService.getUserProgress(selectedHunt.id);
            if (updatedProgress) {
              setProgress(updatedProgress);
              // Update progress map
              const newMap = new Map(huntProgressMap);
              newMap.set(selectedHunt.id, updatedProgress);
              setHuntProgressMap(newMap);
            }
          } else {
            // No next clue - reload hunt details and progress first
            await loadHuntDetails();
            const updatedProgress = await treasureHuntService.getUserProgress(selectedHunt.id);
            if (updatedProgress) {
              setProgress(updatedProgress);
              // Update progress map
              const newMap = new Map(huntProgressMap);
              newMap.set(selectedHunt.id, updatedProgress);
              setHuntProgressMap(newMap);
            }
            
            // Try to reload current clue from backend
            const clue = await treasureHuntService.getCurrentClue(selectedHunt.id);
            if (clue) {
              setCurrentClue(clue);
            } else {
              // No clue returned - might be completed
              if (updatedProgress && huntDetails) {
                const totalClues = huntDetails.clues?.length || 0;
                // Check if completed (either has completed_at or current_clue_number exceeds total)
                const isCompleted = (updatedProgress as any).completed_at || updatedProgress.current_clue_number > totalClues;
                if (isCompleted) {
                  // All clues completed
                  setShowCompletionAnimation(true);
                  setTimeout(() => {
                    setShowCompletionAnimation(false);
                    setShowCompletionModal(true);
                  }, 3000);
                }
              }
              setCurrentClue(null);
            }
          }
        }
      } else {
        setError(result.error || 'Incorrect answer. Try again!');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to solve clue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Completion Animation Overlay */}
      {showCompletionAnimation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60]">
          <div className="w-full max-w-2xl h-auto max-h-[80vh] flex items-center justify-center">
            <img 
              src="/treasure-hunt/congratulations.gif"
              alt="Congratulations"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60]" onClick={async () => {
          setShowCompletionModal(false);
          setViewMode('list');
          setSelectedHunt(null);
          setHuntDetails(null);
          setProgress(null);
          setCurrentClue(null);
          // Reload all hunts and progress to update completion status
          const huntsData = await treasureHuntService.getTreasureHunts();
          setHunts(huntsData);
          const progressMap = new Map<number, TreasureHuntProgress>();
          for (const hunt of huntsData) {
            try {
              const progress = await treasureHuntService.getUserProgress(hunt.id);
              if (progress) {
                progressMap.set(hunt.id, progress);
              }
            } catch (error) {
              // Continue
            }
          }
          setHuntProgressMap(progressMap);
        }}>
          <div 
            className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">🎉 Treasure Hunt Completed! 🎉</h2>
              <p className="text-white/80 text-sm">
                Congratulations! You've successfully completed <strong>{selectedHunt?.name}</strong>!
              </p>
            </div>
            <div className="space-y-3">
              {huntDetails && huntDetails.clues && progress && (
                <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <p className="text-white/70 text-xs mb-1">Final Progress</p>
                  <p className="text-white font-semibold text-lg">
                    {huntDetails.clues.length} / {huntDetails.clues.length} Clues
                  </p>
                </div>
              )}
              
              {/* Prize Display - Get from progress, not hunt */}
              {progress && progress.prize && progress.prize.coupon_code && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border-2 border-yellow-500/40">
                  <h3 className="text-yellow-400 font-bold text-lg mb-2">🎁 Your Prize!</h3>
                  <p className="text-white/90 text-base mb-3">
                    <strong>{progress.prize.discount_percentage}%</strong> Discount Code
                  </p>
                  
                  <div className="flex flex-col items-center gap-2 mb-2">
                    {progress.prize.qr_code && (
                      <div className="p-2 bg-white rounded-lg">
                        <img 
                          src={progress.prize.qr_code} 
                          alt="QR Code" 
                          className="w-24 h-24 object-contain"
                        />
                      </div>
                    )}
                    
                    <div className="w-full">
                      <p className="text-white/70 text-xs mb-1">Coupon Code:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-black/30 border-2 border-yellow-500/50 rounded-lg text-yellow-400 font-mono text-base font-bold text-center">
                          {progress.prize.coupon_code}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(progress.prize?.coupon_code || '');
                            alert('Coupon code copied to clipboard!');
                          }}
                          className="p-2 bg-yellow-500/30 hover:bg-yellow-500/40 border border-yellow-500/50 rounded-lg text-yellow-200 transition-all flex items-center justify-center"
                          title="Copy coupon code"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-white/70 text-xs text-center mt-2">
                    Use this code at checkout or show the QR code at participating locations
                  </p>
                </div>
              )}
              
              <button
                onClick={async () => {
                  setShowCompletionModal(false);
                  setViewMode('list');
                  setSelectedHunt(null);
                  setHuntDetails(null);
                  setProgress(null);
                  setCurrentClue(null);
                  // Reload all hunts and progress to update completion status
                  const huntsData = await treasureHuntService.getTreasureHunts();
                  setHunts(huntsData);
                  const progressMap = new Map<number, TreasureHuntProgress>();
                  for (const hunt of huntsData) {
                    try {
                      const progress = await treasureHuntService.getUserProgress(hunt.id);
                      if (progress) {
                        progressMap.set(hunt.id, progress);
                      }
                    } catch (error) {
                      // Continue
                    }
                  }
                  setHuntProgressMap(progressMap);
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg"
              >
                Back to Treasure Hunts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="treasure-hunt-modal bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <style>{`
          .treasure-hunt-modal * {
            user-select: none;
            cursor: default;
          }
          .treasure-hunt-modal input[type="text"],
          .treasure-hunt-modal textarea {
            user-select: text;
            cursor: text;
          }
          .treasure-hunt-modal button {
            cursor: pointer;
          }
        `}</style>
        <div className="p-6 text-center">
          <div className="flex justify-end items-center mb-4">
            <img 
              src="/treasure-hunt/x.png"
              alt="Close"
              onClick={onClose}
              className="w-6 h-6 object-contain cursor-pointer transition-all duration-300 hover:scale-110"
            />
          </div>
          {viewMode === 'list' && (
            <div className="mb-6 w-full">
              <img 
                src="/treasure-hunt/thlogo.png"
                alt="Treasure Hunt"
                className="w-full max-w-full h-auto max-h-[40vh] mx-auto object-contain"
              />
            </div>
          )}
          {viewMode === 'details' && selectedHunt && (
            <div className="mb-6 w-full">
              {(() => {
                const icon = selectedHunt.icon || '🏴‍☠️';
                const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.includes('.png') || icon.includes('.gif') || icon.includes('.jpg') || icon.includes('.jpeg') || icon.includes('.webp');
                if (isImageUrl) {
                  const imgSrc = icon.startsWith('data:image') ? icon : icon.startsWith('/uploads/') || icon.startsWith('/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}/uploads/${icon}`;
                  return <img src={imgSrc} alt="Hunt icon" className="w-full max-w-full h-auto max-h-[40vh] mx-auto object-contain" />;
                }
                return <div className="text-6xl text-center">{icon}</div>;
              })()}
            </div>
          )}

          {authError && (
            <div className="mb-4 p-4 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-sm">
              <p className="font-semibold mb-2">⚠️ Authentication Required</p>
              <p>{authError}</p>
              <p className="mt-2 text-xs opacity-80">
                If you just logged in, try refreshing the page or logging out and back in.
              </p>
            </div>
          )}

          {viewMode === 'list' ? (
            // Hunt selection view
            <div>
              <div className="flex items-center justify-center gap-4 mb-4">
                <h3 className="text-xl font-semibold text-white">Show clues on the map</h3>
                {onToggleTreasureHuntClues && activeHuntId && (
                  <div 
                    className="relative w-16 h-16 overflow-hidden cursor-pointer"
                    onClick={onToggleTreasureHuntClues}
                    title={showTreasureHuntClues ? 'Hide clue icon on map' : 'Show clue icon on map'}
                  >
                    {/* Eye icon - always static */}
                    <img 
                      src="/treasure-hunt/eye.png"
                      alt="Eye icon"
                      className="absolute top-0 left-0 w-16 h-16 object-contain"
                    />
                    {/* Patch icon - slides in front */}
                    <img 
                      src="/treasure-hunt/patch.png"
                      alt="Patch icon"
                      className={`absolute top-0 left-0 w-16 h-16 object-contain transition-transform duration-300 ease-in-out ${
                        showTreasureHuntClues ? '-translate-x-full' : 'translate-x-0'
                      }`}
                    />
                  </div>
                )}
              </div>
              {hunts.length === 0 ? (
                <p className="text-white/70 text-center py-8">No active treasure hunts available</p>
              ) : (
                <div className="space-y-3">
                  {hunts.map(hunt => {
                    const huntProgress = huntProgressMap.get(hunt.id);
                    const isStarted = !!huntProgress;
                    // Check if completed - completed_at is set by backend when hunt is finished
                    const isCompleted = huntProgress && huntProgress.completed_at !== null && huntProgress.completed_at !== undefined;
                    return (
                      <div
                        key={hunt.id}
                        className="w-full p-4 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 transition-all duration-300"
                      >
                        {/* Layout: icon on top, description in middle, buttons at bottom */}
                        <div className="flex flex-col gap-3">
                          {/* Icon - always on top */}
                          <div className="w-full text-center flex items-center justify-center">
                            {(() => {
                              const icon = hunt.icon || '🏴‍☠️';
                              const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.endsWith('.png') || icon.endsWith('.gif') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp');
                              if (isImageUrl) {
                                const imgSrc = icon.startsWith('data:image') ? icon : icon.startsWith('/uploads/') || icon.startsWith('/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}/uploads/${icon}`;
                                return <img src={imgSrc} alt="Hunt icon" className="w-full max-w-full h-auto max-h-[20vh] object-contain rounded-lg mx-auto" />;
                              }
                              return <span className="text-3xl">{icon}</span>;
                            })()}
                          </div>
                          
                          {/* Content area - description */}
                          <div className="w-full">
                            <h4 className="text-white font-semibold text-lg">{hunt.name}</h4>
                            {hunt.description && (
                              <p className="text-white/70 text-sm mt-1 break-words">{hunt.description}</p>
                            )}
                          </div>
                          
                          {/* Buttons - below description */}
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setSelectedHunt(hunt);
                                setViewMode('details');
                                setHuntDetails(null);
                                await loadHuntDetails('details');
                              }}
                              className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-sm font-semibold transition-all w-full sm:w-auto flex-shrink-0"
                            >
                              Details
                            </button>
                            {isCompleted ? (
                              <button
                                disabled
                                className="px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm font-semibold opacity-75 cursor-not-allowed w-full sm:w-auto"
                              >
                                ✓ Completed
                              </button>
                            ) : isStarted ? (
                              activeHuntId === hunt.id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Already active, just show clue view
                                    setSelectedHunt(hunt);
                                    setViewMode('clue');
                                    loadHuntDetails();
                                    loadProgress();
                                  }}
                                  disabled={loading}
                                  className="px-4 py-2 rounded-xl bg-yellow-500/30 hover:bg-yellow-500/40 border-2 border-yellow-500/60 text-yellow-100 text-sm font-semibold transition-all disabled:opacity-50 w-full sm:w-auto"
                                >
                                  Active
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Switch to this hunt and make it active on the map
                                    setSelectedHunt(hunt);
                                    setViewMode('clue');
                                    loadHuntDetails();
                                    loadProgress();
                                    // Notify parent to make this hunt active (this will update the map)
                                    if (onHuntStarted) {
                                      onHuntStarted(hunt.id);
                                    }
                                  }}
                                  disabled={loading}
                                  className="px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-200 text-sm font-semibold transition-all disabled:opacity-50 w-full sm:w-auto"
                                >
                                  Resume
                                </button>
                              )
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartHunt(hunt.id);
                                }}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-200 text-sm font-semibold transition-all disabled:opacity-50 w-full sm:w-auto"
                              >
                                Start
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Status - at bottom of card, separate from description */}
                        {isCompleted ? (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-xs text-yellow-400 font-semibold">
                              🏆 Completed
                            </p>
                          </div>
                        ) : isStarted && huntProgress ? (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className={`text-xs ${activeHuntId === hunt.id ? 'text-yellow-400 font-semibold' : 'text-green-400'}`}>
                              {activeHuntId === hunt.id ? '🟢 Active - ' : ''}In progress - Clue {huntProgress.current_clue_number}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : viewMode === 'details' && selectedHunt ? (
            // Hunt details view
            <div>
              <button
                onClick={() => {
                  setSelectedHunt(null);
                  setViewMode('list');
                  setHuntDetails(null);
                }}
                className="mb-4 text-white/70 hover:text-white flex items-center gap-2"
              >
                ← Back to hunts
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {selectedHunt.name}
                </h3>
                {selectedHunt.description && (
                  <p className="text-white/70">{selectedHunt.description}</p>
                )}
              </div>

              {loading && !huntDetails ? (
                <div className="text-center py-8">
                  <p className="text-white/70">Loading hunt details...</p>
                </div>
              ) : huntDetails ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                    <h4 className="text-white font-semibold mb-2">Hunt Information</h4>
                    <div className="space-y-2 text-white/80 text-sm">
                      <p><strong>Total Clues:</strong> {huntDetails.clues?.length || 0}</p>
                      {(() => {
                        const huntProgress = huntProgressMap.get(selectedHunt.id);
                        const isCompleted = huntProgress && ((huntProgress as any).completed_at || (huntDetails && huntDetails.clues && huntProgress.current_clue_number > huntDetails.clues.length));
                        
                        if (isCompleted) {
                          return (
                            <>
                              <p className="text-yellow-400 font-semibold">
                                <strong>Status:</strong> 🏆 Completed
                              </p>
                              {/* Show prize if available - get from progress */}
                              {(() => {
                                const huntProgress = huntProgressMap.get(selectedHunt.id);
                                const userPrize = huntProgress && (huntProgress as any).prize;
                                if (userPrize && userPrize.coupon_code) {
                                  return (
                                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40">
                                      <p className="text-yellow-400 font-semibold mb-2">🎁 Prize: {userPrize.discount_percentage}% Discount</p>
                                      <div className="flex items-center gap-2">
                                        <code className="flex-1 px-3 py-2 bg-black/30 border border-yellow-500/50 rounded-lg text-yellow-400 font-mono text-sm font-bold text-center">
                                          {userPrize.coupon_code}
                                        </code>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(userPrize.coupon_code || '');
                                            alert('Coupon code copied!');
                                          }}
                                          className="p-2 bg-yellow-500/30 hover:bg-yellow-500/40 border border-yellow-500/50 rounded-lg text-yellow-200 transition-all flex items-center justify-center"
                                          title="Copy coupon code"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        </button>
                                      </div>
                                      {userPrize.qr_code && (
                                        <div className="mt-3 flex justify-center">
                                          <img 
                                            src={userPrize.qr_code} 
                                            alt="QR Code" 
                                            className="w-32 h-32 object-contain bg-white p-2 rounded-lg"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          );
                        } else if (huntProgress) {
                          return (
                            <p>
                              <strong>Progress:</strong> Clue {huntProgress.current_clue_number} of {huntDetails.clues?.length || 0}
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-white/60 italic">Not started yet</p>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {huntDetails.clues && huntDetails.clues.length > 0 && (
                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                      <h4 className="text-white font-semibold mb-3">Clues</h4>
                      <div className="space-y-2">
                        {huntDetails.clues
                          .sort((a: any, b: any) => a.clue_number - b.clue_number)
                          .map((clue: any) => {
                            const currentProgress = huntProgressMap.get(selectedHunt.id);
                            const isCurrentClue = currentProgress && currentProgress.current_clue_number === clue.clue_number;
                            const icon = clue.icon || selectedHunt.icon || '🏴‍☠️';
                            const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.includes('.png') || icon.includes('.gif') || icon.includes('.jpg') || icon.includes('.jpeg') || icon.includes('.webp');
                            
                            return (
                              <div 
                                key={clue.id} 
                                className={`p-3 rounded-xl bg-white/5 border ${
                                  isCurrentClue 
                                    ? 'border-yellow-500 border-2 shadow-lg shadow-yellow-500/20' 
                                    : 'border-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {isImageUrl ? (
                                    <img 
                                      src={icon.startsWith('data:image') ? icon : icon.startsWith('/uploads/') || icon.startsWith('/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}/uploads/${icon}`}
                                      alt="Clue icon"
                                      className="w-6 h-6 object-contain rounded"
                                    />
                                  ) : (
                                    <span className="text-lg">{icon}</span>
                                  )}
                                  <span className="text-yellow-400 font-semibold">#{clue.clue_number}</span>
                                </div>
                                {clue.clue_text && (
                                  <p className="text-white/70 text-sm mt-1">
                                    {clue.clue_text.substring(0, 100)}{clue.clue_text.length > 100 ? '...' : ''}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {(() => {
                      const huntProgress = huntProgressMap.get(selectedHunt.id);
                      const isCompleted = huntProgress && ((huntProgress as any).completed_at || (huntDetails && huntDetails.clues && huntProgress.current_clue_number > huntDetails.clues.length));
                      
                      if (isCompleted) {
                        return (
                          <button
                            disabled
                            className="w-full px-6 py-3 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-semibold rounded-xl opacity-75 cursor-not-allowed"
                          >
                            ✓ Treasure Hunt Completed
                          </button>
                        );
                      } else if (huntProgress) {
                        return (
                          <>
                            <button
                              onClick={() => {
                                setViewMode('clue');
                                loadProgress();
                              }}
                              className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg"
                            >
                              Continue Hunt
                            </button>
                            <button
                              onClick={() => {
                                setViewMode('list');
                                setSelectedHunt(null);
                                setHuntDetails(null);
                                setProgress(null);
                                setCurrentClue(null);
                                if (onHuntStarted && selectedHunt) {
                                  onHuntStarted(selectedHunt.id);
                                }
                              }}
                              className="px-6 py-3 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 text-gray-200 font-semibold rounded-xl transition-all"
                            >
                              Back to List
                            </button>
                          </>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => handleStartHunt(selectedHunt.id)}
                            disabled={loading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg disabled:opacity-50"
                          >
                            {loading ? 'Loading...' : 'Start Treasure Hunt'}
                          </button>
                        );
                      }
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/70">Loading hunt details...</p>
                </div>
              )}
            </div>
          ) : selectedHunt ? (
            // Clue view (when actively playing)
            <div>
              <button
                onClick={() => {
                  setSelectedHunt(null);
                  setViewMode('list');
                  setHuntDetails(null);
                  setProgress(null);
                  setCurrentClue(null);
                  setAnswer('');
                  setError(null);
                  setSuccess(null);
                }}
                className="mb-4 text-white/70 hover:text-white flex items-center gap-2"
              >
                ← Back to hunts
              </button>

              <div className="mb-6 w-full">
                {(() => {
                  const icon = selectedHunt.icon || '🏴‍☠️';
                  const isImageUrl = icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('/uploads/') || icon.startsWith('data:') || icon.includes('.png') || icon.includes('.gif') || icon.includes('.jpg') || icon.includes('.jpeg') || icon.includes('.webp');
                  if (isImageUrl) {
                    const imgSrc = icon.startsWith('data:image') ? icon : icon.startsWith('/uploads/') || icon.startsWith('/') ? `${getApiBaseUrl()}${icon}` : `${getApiBaseUrl()}/uploads/${icon}`;
                    return <img src={imgSrc} alt="Hunt icon" className="w-full max-w-full h-auto max-h-[40vh] mx-auto object-contain" />;
                  }
                  return <div className="text-6xl text-center">{icon}</div>;
                })()}
              </div>

              {error && error.includes('log in') && (
                <div className="mb-4 p-4 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-sm">
                  <p className="font-semibold mb-2">⚠️ Authentication Required</p>
                  <p>Please log in to start and play treasure hunts. Your session may have expired.</p>
                </div>
              )}

              {!progress ? (
                // Not started
                <div className="text-center py-8">
                  <p className="text-white/70 mb-6">Ready to start your adventure?</p>
                  <button
                    onClick={() => handleStartHunt(selectedHunt.id)}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Starting...' : 'Start Treasure Hunt'}
                  </button>
                </div>
              ) : (
                // In progress
                <div>
                  {currentClue ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/70 text-sm">Clue #{currentClue.clue_number}</span>
                        </div>
                        {currentClue.title && (() => {
                          const title = currentClue.title;
                          const isImageUrl = title.startsWith('http') || title.startsWith('/') || title.startsWith('/uploads/') || title.startsWith('data:') || title.includes('.png') || title.includes('.gif') || title.includes('.jpg') || title.includes('.jpeg') || title.includes('.webp');
                          if (isImageUrl) {
                            const imgSrc = title.startsWith('data:image') ? title : title.startsWith('/uploads/') || title.startsWith('/') ? `${getApiBaseUrl()}${title}` : `${getApiBaseUrl()}/uploads/${title}`;
                            return (
                              <div className="mb-4 w-full">
                                <img 
                                  src={imgSrc}
                                  alt="Clue title"
                                  className="w-full max-w-full h-auto max-h-[50vh] mx-auto object-contain"
                                />
                              </div>
                            );
                          }
                          return <h4 className="text-white font-semibold text-lg mb-2">{title}</h4>;
                        })()}
                        <p className="text-white text-base mb-4">{currentClue.clue_text}</p>
                        {currentClue.hint && (
                          <details className="mt-2">
                            <summary className="text-white/70 text-sm cursor-pointer hover:text-white">
                              💡 Need a hint?
                            </summary>
                            <p className="text-white/80 text-sm mt-2 pl-4">{currentClue.hint}</p>
                          </details>
                        )}
                      </div>

                      {error && (
                        <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm">
                          {error}
                        </div>
                      )}

                      {success && (
                        <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/40 text-green-200 text-sm">
                          {success}
                        </div>
                      )}

                      <div className="space-y-3">
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSolveClue()}
                          placeholder="Enter your answer..."
                          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                          disabled={loading || (distance !== null && distance > 100)}
                        />
                        <button
                          onClick={handleSolveClue}
                          disabled={loading || !answer.trim() || (distance !== null && distance > 100) || !userLocation}
                          className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Checking...' : !userLocation ? 'Turn on GPS' : distance !== null && distance > 100 ? `Get closer! (${Math.round(distance)}m away)` : 'Submit Answer'}
                        </button>
                      </div>

                      {!userLocation ? (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <img 
                            src={`${getApiBaseUrl()}/satelite.png`} 
                            alt="GPS" 
                            className="w-5 h-5"
                          />
                          <p className="text-yellow-400 text-sm text-center">
                            Turn on GPS to see your distance and solve clues
                          </p>
                        </div>
                      ) : distance !== null && distance > 100 ? (
                        <p className="text-yellow-400 text-sm text-center mt-2">
                          You need to be within 100m of the clue location to solve it
                        </p>
                      ) : distance !== null && distance <= 100 ? (
                        <p className="text-green-400 text-sm text-center mt-2">
                          ✓ You're close enough! You can solve this clue.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-white/70">Loading clue...</p>
                    </div>
                  )}

                  {/* Progress indicator */}
                  {huntDetails && huntDetails.clues && (() => {
                    const totalClues = huntDetails.clues.length;
                    const completedClues = progress.current_clue_number - 1;
                    const progressPercentage = totalClues > 0 ? (completedClues / totalClues) * 100 : 0;
                    
                    // Determine which progress bar image to use
                    let progressImage = 'progress bar 0%.png';
                    if (progressPercentage >= 100) {
                      progressImage = 'progress bar 100%.png';
                    } else if (progressPercentage >= 90) {
                      progressImage = 'progress bar 90%.png';
                    } else if (progressPercentage >= 75) {
                      progressImage = 'progress bar 75%.png';
                    } else if (progressPercentage >= 60) {
                      progressImage = 'progress bar 60%.png';
                    } else if (progressPercentage >= 45) {
                      progressImage = 'progress bar 45%.png';
                    } else if (progressPercentage >= 30) {
                      progressImage = 'progress bar 30%.png';
                    } else if (progressPercentage >= 15) {
                      progressImage = 'progress bar 15%.png';
                    }
                    
                    // URL encode the filename to handle spaces and special characters
                    const encodedImageName = encodeURIComponent(progressImage);
                    
                    return (
                      <div className="mt-6 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/70 text-sm">Progress</span>
                          <span className="text-white font-semibold">
                            {completedClues} / {totalClues}
                          </span>
                        </div>
                        <div className="w-full">
                          <img 
                            src={`/treasure-hunt/${encodedImageName}`}
                            alt={`Progress ${Math.round(progressPercentage)}%`}
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              console.error('Failed to load progress image:', `/treasure-hunt/${encodedImageName}`);
                              // Fallback to default if image fails to load
                              e.currentTarget.src = '/treasure-hunt/progress%20bar%200%25.png';
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
};

export default TreasureHuntModal;

