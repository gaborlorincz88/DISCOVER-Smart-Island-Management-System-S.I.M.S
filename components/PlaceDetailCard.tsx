import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Place, PlaceCategory, ChatMessage } from '../types';
import { useAuth } from '../auth/AuthContext';
import BusTimetable from './BusTimetable';
import PlaceTimetable from './PlaceTimetable';
import { getApiBaseUrl } from '../services/config';
import { aisService, AISPosition } from '../services/aisService';
import ReviewsSection from './ReviewsSection';

interface PlaceDetailCardProps {
  place: Place | null;
  isLoadingAiDescription: boolean;
  isLoadingImage: boolean;
  aiError: string | null;
  onGenerateDescription: (place: Place) => void;
  onSendMessage: (place: Place, message: string) => void;
  onClose: () => void;
      onOpenGallery: (place: Place, imageIndex?: number) => void;
  onEdit: () => void;
  onAddToTrip: (place: Place) => void;
  onLoginClick: () => void;
  onPageChange?: (page: 'app' | 'business' | 'trips' | 'events' | 'excursions') => void;
  isSmallScreen?: boolean; // If false or undefined, show buttons on image overlay (large screen)
  // Note: onShowTrailOnMap removed - hiking trails now use unified tour system
}

const AiChatInterface: React.FC<{
  place: Place;
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
}> = ({ place, isLoading, error, onSendMessage }) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Cleanup function to stop audio if the component unmounts
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [place.chatHistory, isLoading]);

    const handleSpeak = async (text: string) => {
        if (isSpeaking && audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
            return;
        }

        setIsSpeaking(true);
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audio from server.');
            }

            const { audioContent } = await response.json();
            const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
            audioRef.current = audio;
            
            audio.play();
            audio.onended = () => setIsSpeaking(false);
            audio.onerror = () => {
                console.error("Error playing audio.");
                setIsSpeaking(false);
            };

        } catch (err) {
            console.error(err);
            alert('Sorry, there was an error with the text-to-speech service.');
            setIsSpeaking(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isLoading) return;
        onSendMessage(message);
        setMessage('');
    };

    const lastModelMessage = place.chatHistory?.filter(m => m.role === 'model').pop()?.text;

    return (
        <div className="bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] p-4 rounded-lg">
            <div className="max-h-64 overflow-y-auto space-y-4 pr-2 mb-4">
                {place.chatHistory?.map((chat, index) => (
                    <div key={index} className={`flex items-end gap-2 ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-xs xl:max-w-md p-3 text-sm rounded-2xl ${
                            chat.role === 'user' 
                                ? 'bg-sky-500 text-white ml-auto' 
                                : 'bg-gradient-to-r from-cyan-400 to-teal-500 text-white'
                        }`}>
                            {chat.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="max-w-xs p-3 text-sm bg-gradient-to-r from-cyan-400 to-teal-500 text-white rounded-2xl flex items-center gap-2">
                           <div className="typing-indicator">
                               <span></span><span></span><span></span>
                           </div>
                        </div>
                    </div>
                )}
                 <div ref={chatEndRef} />
            </div>
            
            {lastModelMessage && (
                <button 
                    onClick={() => handleSpeak(lastModelMessage)}
                    className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 mb-3 ${
                        isSpeaking 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-sky-100 hover:bg-sky-200 text-sky-800'
                    }`}
                >
                    {isSpeaking ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                            {t('place_details.stop_speaking')}
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 3.5a.5.5 0 01.5.5v12a.5.5 0 01-1 0v-12a.5.5 0 01.5-.5zM4 8a.5.5 0 01.5.5v3a.5.5 0 01-1 0v-3A.5.5 0 014 8zm12 0a.5.5 0 01.5.5v3a.5.5 0 01-1 0v-3a.5.5 0 01.5-.5zM7 6a.5.5 0 01.5.5v7a.5.5 0 01-1 0v-7A.5.5 0 017 6zm6 0a.5.5 0 01.5.5v7a.5.5 0 01-1 0v-7A.5.5 0 0113 6z" />
                            </svg>
                            {t('place_details.speak_aloud')}
                        </>
                    )}
                </button>
            )}

             {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-sm mb-3">{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('place_details.ask_follow_up')}
                        className="flex-grow p-2 bg-[rgb(var(--card-bg))] border border-[rgb(var(--border-color))] rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-[rgb(var(--text-primary))]"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="bg-cyan-500 text-white p-2 rounded-lg hover:bg-cyan-600 transition-all shadow-md active:scale-95 disabled:bg-cyan-300 disabled:cursor-not-allowed"
                        disabled={isLoading || !message.trim()}
                        aria-label={t('place_details.send_message')}
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.768 59.768 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
};


const PlaceDetailCard: React.FC<PlaceDetailCardProps> = ({ place, isLoadingAiDescription, isLoadingImage, aiError, onGenerateDescription, onSendMessage, onClose, onOpenGallery, onEdit, onAddToTrip, onLoginClick, onPageChange, isSmallScreen = true }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [routeDisplayName, setRouteDisplayName] = useState<string | null>(null);

  // Fetch route name when place has routeId
  useEffect(() => {
    const fetchRouteName = async () => {
      if (!place?.routeId) {
        setRouteDisplayName(null);
        return;
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/bus-routes`);
        const routes = await response.json();
        const route = routes.find((r: { id: string }) => r.id === place.routeId);
        if (route) {
          setRouteDisplayName(route.displayedName || route.name);
        } else {
          setRouteDisplayName(null);
        }
      } catch (error) {
        console.error('Failed to fetch route name:', error);
        setRouteDisplayName(null);
      }
    };

    fetchRouteName();
  }, [place?.routeId]);

  if (!place) {
    return null;
  }

  const hasGallery = (place.galleryImages?.length ?? 0) > 0 || place.mainImage || (place.images?.length ?? 0) > 0;
  const showAiSection = place.category !== PlaceCategory.BUS_STOP && 
                        place.category !== PlaceCategory.BUS_TERMINUS && 
                        place.category !== PlaceCategory.BUS_ROUTE;


  // No fallback image URL - we'll use a placeholder div instead
  const hasImage = place.mainImage || place.imageUrl;

  return (
    <div className="bg-[rgb(var(--card-bg))] h-full">
      <div className="relative">
        {isLoadingImage ? (
          <div className="w-full h-56 bg-[rgb(var(--border-color))] animate-pulse"></div>
        ) : (
          <>
            <button 
              onClick={() => {
                if (place.mainImage) {
                  onOpenGallery({ ...place, images: [place.mainImage] } as Place, 0);
                } else {
                  onOpenGallery(place);
                }
              }} 
              className="w-full h-56 block relative group bg-[rgb(var(--border-color))]"
              aria-label={t('place_details.view_gallery_aria', { name: place.name })}
              disabled={!hasGallery}
            >
              {hasImage ? (
                <img 
                  src={
                    place.mainImage ? (place.mainImage.startsWith('/uploads/') ? `${getApiBaseUrl()}${place.mainImage}` : 
                      // Filter out Unsplash URLs to prevent CORS errors
                      place.mainImage.includes('unsplash.com') ? undefined : place.mainImage) :
                    place.imageUrl ? (place.imageUrl.startsWith('/uploads/') ? `${getApiBaseUrl()}${place.imageUrl}` : 
                      // Filter out Unsplash URLs
                      place.imageUrl.includes('unsplash.com') ? undefined : place.imageUrl) :
                    undefined
                  } 
                  alt={place.name} 
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide image if it fails to load (e.g., CORS error)
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                  <div className="text-center p-4">
                    <div className="text-6xl mb-2">📍</div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{place.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{place.category}</div>
                  </div>
                </div>
              )}
              {hasGallery && (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                  <div className="p-3 bg-white/80 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                  </div>
                </div>
              )}
            </button>
            {/* Show + and X buttons on large screens only - positioned outside the image button */}
            {!isSmallScreen && (
              <div className="absolute top-2 right-2 flex gap-2 z-10">
                <button
                  onClick={() => {
                    onAddToTrip(place);
                  }}
                  className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg"
                  aria-label="Add to trip"
                  title="Add to trip"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  aria-label="Close"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-6">
        <h2 className="text-3xl font-bold mb-2 text-[rgb(var(--text-primary))]">{place.name}</h2>
        
        {/* Show tour context if this is a tour stop */}
        {place.type === 'tour-stop' && place.tourName && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Tour Stop:</span> This is part of the <strong>{place.tourName}</strong> tour
            </p>
          </div>
        )}
        
        {/* Show hiking trail context if this is a hiking stop */}
        {place.type === 'hiking-stop' && place.tourName && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Trail Stop:</span> This is part of the <strong>{place.tourName}</strong> hiking trail
            </p>
          </div>
        )}
        
        {/* Add Back to Tour button for tour stops */}
        {(place.type === 'tour-stop' || place.type === 'hiking-stop') && place.tourName && (
          <div className="mb-3">
            <button 
              onClick={() => {
                // This will be handled by the parent component to show the full tour
                // For now, we'll just close the current view
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              ← Back to {place.type === 'tour-stop' ? 'Tour' : 'Trail'}
            </button>
          </div>
        )}
        
        <span className="inline-block bg-cyan-100 text-cyan-800 text-sm font-semibold px-3 py-1 rounded-full mb-1">
          {t(`categories.${place.category}`, place.category)}
        </span>
        {place.routeId && (
            <span className="inline-block bg-yellow-200 text-yellow-800 text-sm font-semibold px-3 py-1 rounded-full mb-3 ml-2">
                Route: {routeDisplayName || place.routeId}
            </span>
        )}
        {place.distance && (
            <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">{t('place_details.km_away', { distance: place.distance.toFixed(1) })}</p>
        )}
        {/* Event-specific information */}
        {place.category === PlaceCategory.EVENT && (place.start_datetime || place.end_datetime || place.website) && (
          <div className="mb-6 p-4 bg-[rgb(var(--bg-light))] rounded-lg border border-[rgb(var(--border-color))]">
            <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-cyan-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Event Details
            </h3>
            <div className="space-y-3">
              {place.start_datetime && (
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[rgb(var(--text-primary))]">Start Time</p>
                    <p className="text-sm text-[rgb(var(--text-secondary))]">{new Date(place.start_datetime).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {place.end_datetime && (
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[rgb(var(--text-primary))]">End Time</p>
                    <p className="text-sm text-[rgb(var(--text-secondary))]">{new Date(place.end_datetime).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {place.website && (
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-500 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[rgb(var(--text-primary))]">Website</p>
                    <a 
                      href={place.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-500 hover:text-cyan-400 hover:underline break-all"
                    >
                      {place.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ferry Status for Dynamic Locations */}
        {place.is_dynamic_location && place.ais_mmsi && (() => {
          const FerryStatusDisplay: React.FC = () => {
            const [aisPosition, setAisPosition] = useState<AISPosition | null>(null);
            
            useEffect(() => {
              if (!place.ais_mmsi) {
                console.warn('⚠️ Ferry place missing ais_mmsi:', place.name);
                return;
              }
              
              // Ensure AIS service is connected
              aisService.connect();
              
              // Get initial position
              const mmsiList = place.ais_mmsi.split(',').map(m => m.trim()).filter(m => m);
              console.log(`🚢 Ferry ${place.name} - Looking for MMSI:`, mmsiList);
              
              const checkPosition = () => {
                if (mmsiList.length > 0) {
                  // Check all MMSI numbers, not just the first one
                  for (const mmsi of mmsiList) {
                    const position = aisService.getPosition(mmsi);
                    if (position) {
                      console.log(`✅ Found position for ${place.name} (MMSI ${mmsi}):`, position);
                      setAisPosition(position);
                      return;
                    }
                  }
                  // Log if no position found (only once per minute to avoid spam)
                  if (!aisPosition && Date.now() % 60000 < 2000) {
                    console.warn(`⚠️ No position found for ${place.name} with MMSI:`, mmsiList);
                  }
                }
              };
              
              // Check immediately
              checkPosition();
              
              // Subscribe to updates
              const unsubscribe = aisService.onPositionUpdate((position: AISPosition) => {
                if (mmsiList.includes(position.mmsi)) {
                  console.log(`📍 Position update received for ${place.name} (MMSI ${position.mmsi})`);
                  setAisPosition(position);
                }
              });
              
              // Also poll periodically in case subscription doesn't fire (every 2 seconds)
              const pollInterval = setInterval(() => {
                checkPosition();
              }, 2000);
              
              return () => {
                unsubscribe();
                clearInterval(pollInterval);
              };
            }, [place.ais_mmsi, place.name]);
            
            if (!aisPosition) {
              return (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2 flex items-center gap-2">
                    <span className="text-2xl">🚢</span>
                    Ferry Status
                  </h3>
                  <p className="text-sm text-[rgb(var(--text-secondary))]">Waiting for position data...</p>
                </div>
              );
            }
            
            // Determine status based on speed and location
            const speedKnots = aisPosition.speed || 0;
            const course = aisPosition.course;
            const status = speedKnots < 0.5 ? 'Docked' : speedKnots < 2 ? 'Boarding/Waiting' : 'In Transit';
            const statusColor = status === 'Docked' ? 'green' : status === 'Boarding/Waiting' ? 'yellow' : 'blue';
            
            return (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-3 flex items-center gap-2">
                  <span className="text-2xl">🚢</span>
                  Ferry Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      statusColor === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {status}
                    </span>
                  </div>
                  {speedKnots !== null && speedKnots !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Speed:</span>
                      <span className="text-sm text-[rgb(var(--text-secondary))]">{speedKnots.toFixed(1)} knots</span>
                    </div>
                  )}
                  {course !== null && course !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Course:</span>
                      <span className="text-sm text-[rgb(var(--text-secondary))]">{Math.round(course)}°</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[rgb(var(--text-primary))]">MMSI:</span>
                    <span className="text-sm text-[rgb(var(--text-secondary))] font-mono">{aisPosition.mmsi}</span>
                  </div>
                  {aisPosition.timestamp && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Last Update:</span>
                      <span className="text-sm text-[rgb(var(--text-secondary))]">
                        {new Date(aisPosition.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          };
          
          return <FerryStatusDisplay />;
        })()}

        <div className="mb-6">
          {(place.shortDescription || place.description) && (
            <>
              <div className="text-[rgb(var(--text-secondary))] mb-2 text-base place-description" dangerouslySetInnerHTML={{ __html: place.shortDescription || place.description || '' }}></div>
              {place.category !== PlaceCategory.BUS_STOP && (
                <a
                  href={`https://translate.google.com/?sl=en&tl=${i18n.language}&text=${encodeURIComponent((place.shortDescription || place.description || '').replace(/<[^>]*>/g, ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-600 hover:underline"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21l-5.25-11.25L10.5 21z" />
                  </svg>
                  {t('place_details.translate_with_google')}
                </a>
              )}
            </>
          )}
        </div>

        {/* Tour-specific content */}
        {place.type === 'tour' && place.points && place.points.length > 0 && (
          <div className="my-6 border-t border-[rgb(var(--border-color))] pt-6">
            <h3 className="text-xl font-bold mb-4 text-[rgb(var(--text-secondary))]">All Tour Stops:</h3>
            <div className="space-y-3">
              {place.points
                .filter((point: any) => point.type === 'stop')
                .map((point: any, index) => (
                  <div 
                    key={index} 
                    className="p-3 bg-[rgb(var(--bg-secondary))] rounded-md border border-[rgb(var(--border))] cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-[rgb(var(--text-secondary))] bg-[rgb(var(--bg-primary))] px-2 py-1 rounded-full">#{index + 1}</span>
                          <span className="font-medium text-[rgb(var(--text-primary))]">{point.name}</span>
                        </div>
                        {point.description && (
                          <div className="text-sm text-[rgb(var(--text-secondary))] mb-2 tour-point-description">{point.description}</div>
                        )}
                        
                        {/* Image Placeholders */}
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-[rgb(var(--text-secondary))] mb-1">Images:</h4>
                          {point.images && point.images.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {point.images
                                .filter((image: string) => 
                                  image && !image.includes('unsplash.com') && !image.includes('source.unsplash')
                                )
                                .map((image: string, imgIndex: number) => (
                                <div key={imgIndex} className="relative group">
                                  <img 
                                    src={image.startsWith('/uploads/') ? `${getApiBaseUrl()}${image}` : image} 
                                    alt={`${point.name} image ${imgIndex + 1}`}
                                    crossOrigin="anonymous"
                                    className="w-full h-16 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => onOpenGallery({ ...point, images: point.images } as Place, imgIndex)}
                                    onError={(e) => {
                                      // Hide image if it fails to load
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs">View</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-[rgb(var(--text-muted))] italic">No images uploaded yet</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Hiking trail-specific content (now unified with tour system) */}
        {place.type === 'hiking-trail' && place.points && place.points.length > 0 && (
          <div className="my-6 border-t border-[rgb(var(--border-color))] pt-6">
            <h3 className="text-xl font-bold mb-4 text-[rgb(var(--text-secondary))]">All Trail Stops:</h3>
            <div className="space-y-3">
              {place.points
                .filter((point: any) => point.type === 'stop')
                .map((point: any, index) => (
                  <div 
                    key={index} 
                    className="p-3 bg-[rgb(var(--bg-secondary))] rounded-md border border-[rgb(var(--border))] cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-[rgb(var(--text-secondary))] bg-[rgb(var(--bg-primary))] px-2 py-1 rounded-full">#{index + 1}</span>
                          <span className="font-medium text-[rgb(var(--text-primary))]">{point.name}</span>
                        </div>
                        {point.description && (
                          <div className="text-sm text-[rgb(var(--text-secondary))] mb-2 tour-point-description">{point.description}</div>
                        )}
                        
                        {/* Image Placeholders */}
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-[rgb(var(--text-secondary))] mb-1">Images:</h4>
                          {point.images && point.images.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {point.images
                                .filter((image: string) => 
                                  image && !image.includes('unsplash.com') && !image.includes('source.unsplash')
                                )
                                .map((image: string, imgIndex: number) => (
                                <div key={imgIndex} className="relative group">
                                  <img 
                                    src={image.startsWith('/uploads/') ? `${getApiBaseUrl()}${image}` : image} 
                                    alt={`${point.name} image ${imgIndex + 1}`}
                                    crossOrigin="anonymous"
                                    className="w-full h-16 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => onOpenGallery({ ...point, images: point.images } as Place, imgIndex)}
                                    onError={(e) => {
                                      // Hide image if it fails to load
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs">View</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-[rgb(var(--text-muted))] italic">No images uploaded yet</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {place.category === PlaceCategory.HIKING_TRAIL && place.pointsOfInterest && (
          <div className="my-6 border-t border-[rgb(var(--border-color))] pt-6">
            <h3 className="text-xl font-bold mb-4 text-[rgb(var(--text-secondary))]">Points of Interest</h3>
            <ul className="space-y-4">
              {place.pointsOfInterest.map((poi: any, index: number) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-cyan-500 text-white rounded-full flex items-center justify-center font-bold">{index + 1}</div>
                  <div>
                    <h4 className="font-semibold text-md text-[rgb(var(--text-primary))]">{poi.name}</h4>
                    <p className="text-sm text-[rgb(var(--text-secondary))] tour-point-description">{poi.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {place.category === PlaceCategory.BUS_STOP && place.routeId && (
          <div className="border-t border-[rgb(var(--border-color))] pt-2 mt-2">
            <BusTimetable routeId={place.routeId} stopName={place.name} />
          </div>
        )}

        {/* Show timetable for places with timetable_file (like Ferries) */}
        {(() => {
          console.log('🚢 PlaceDetailCard - Checking timetable for place:', place.name, {
            hasTimetableFile: !!place.timetable_file,
            timetableFile: place.timetable_file,
            hasId: !!place.id,
            placeId: place.id,
            allPlaceKeys: Object.keys(place)
          });
          
          if (place.timetable_file && place.id) {
            console.log('🚢 Rendering PlaceTimetable for place:', place.name, 'timetable_file:', place.timetable_file);
            return (
              <div className="border-t border-[rgb(var(--border-color))] pt-2 mt-2">
                <PlaceTimetable placeId={place.id} />
              </div>
            );
          } else {
            console.log('🚢 NOT rendering PlaceTimetable - missing timetable_file or id', {
              hasTimetableFile: !!place.timetable_file,
              hasId: !!place.id
            });
          }
          return null;
        })()}

        {/* Website buttons - show businessUrl first, then general website */}
        {place.businessUrl && (
            <a
                href={place.businessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center gap-2 mb-4 transform hover:-translate-y-0.5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                {t('place_details.visit_website')}
            </a>
        )}

        {place.website && !place.businessUrl && (
            <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center gap-2 mb-4 transform hover:-translate-y-0.5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                {t('place_details.visit_website')}
            </a>
        )}

        {/* More Info button for events */}
        {place.category === PlaceCategory.EVENT && (
            <button
                onClick={() => {
                    // Navigate to events page if onPageChange is available
                    if (onPageChange) {
                        onPageChange('events');
                        // Scroll to the event after a short delay to allow page to load
                        setTimeout(() => {
                            const eventId = place.id.replace('event-', '');
                            const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
                            if (eventElement) {
                                eventElement.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'center' 
                                });
                                // Highlight the event
                                eventElement.style.backgroundColor = '#e0e7ff';
                                eventElement.style.border = '2px solid #3b82f6';
                                setTimeout(() => {
                                    eventElement.style.backgroundColor = '';
                                    eventElement.style.border = '';
                                }, 3000);
                            }
                        }, 1000); // Increased delay to ensure page loads
                    } else {
                        console.warn('More Info button clicked but onPageChange not available');
                    }
                }}
                className="w-full text-center bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center gap-2 mb-4 transform hover:-translate-y-0.5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                More Info
            </button>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          {/* AI Chat Button - Hide for bus stops */}
          {place.category !== PlaceCategory.BUS_STOP && (
            <button
              onClick={() => {
                // Scroll to AI chat section
                const aiSection = document.querySelector('.ai-chat-section');
                if (aiSection) {
                  aiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="flex-1 text-center bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              AI
            </button>
          )}
          
          {/* Directions Button */}
           <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.coordinates.lat},${place.coordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            {t('place_details.directions')}
          </a>
          {place.wikipediaUrl && (
            <a href={place.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-[rgb(var(--border-color))] hover:bg-slate-300 text-[rgb(var(--text-primary))] font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-200 active:scale-95">
              {t('place_details.read_on_wikipedia')}
            </a>
          )}
           {user?.role === 'admin' && (
            <button onClick={onEdit} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors duration-150 flex items-center justify-center gap-2 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                {t('place_details.edit_place')}
            </button>
           )}
        </div>

        {/* Reviews Section - Hide for bus stops */}
        {place.category !== PlaceCategory.BUS_STOP && (
          <ReviewsSection place={place} onLoginClick={onLoginClick} />
        )}

        {showAiSection && (
          <div className="ai-chat-section my-6 border-t border-[rgb(var(--border-color))] pt-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 bg-clip-text text-transparent mb-2">
                ✨ Gozo AI ✨
              </h3>
              <div className="w-24 h-1 bg-gradient-to-r from-sky-500 to-teal-500 mx-auto rounded-full"></div>
            </div>
            
            {user ? (
              /* User is signed in - show chat interface */
              place.chatHistory ? (
                <AiChatInterface 
                    place={place}
                    isLoading={isLoadingAiDescription}
                    error={aiError}
                    onSendMessage={(message) => onSendMessage(place, message)}
                />
              ) : (
                /* Show initial chat interface for new conversations */
                <div className="bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] p-4 rounded-lg">
                  <div className="text-center mb-4">
                    <p className="text-[rgb(var(--text-secondary))] mb-4">
                      {t('ai.ask_anything')}
                    </p>
                  </div>
                  
                  {/* Show sources if available */}
                  {place.sources && place.sources.length > 0 && (
                    <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <h4 className="text-md font-semibold text-cyan-800 mb-2">📚 Sources Available</h4>
                      <p className="text-sm text-cyan-700 mb-2">I have information from these sources to help answer your questions:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-cyan-700">
                        {place.sources.map((source, index) => source.web && (
                          <li key={index}>
                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-700 hover:underline">{source.web.title || source.web.uri}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Chat input form */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      onSendMessage(place, input.value.trim());
                      input.value = '';
                    }
                  }} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t('ai.ask_placeholder')}
                      className="flex-grow p-2 bg-[rgb(var(--card-bg))] border border-[rgb(var(--border-color))] rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-[rgb(var(--text-primary))]"
                      disabled={isLoadingAiDescription}
                    />
                    <button
                      type="submit"
                      className="bg-cyan-500 text-white p-2 rounded-lg hover:bg-cyan-600 transition-all shadow-md active:scale-95 disabled:bg-cyan-300 disabled:cursor-not-allowed"
                      disabled={isLoadingAiDescription}
                      aria-label="Send message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    </button>
                  </form>
                  
                  {/* Loading indicator */}
                  {isLoadingAiDescription && (
                    <div className="flex items-center justify-center text-[rgb(var(--text-secondary))] mt-4">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {t('ai.thinking')}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* User is not signed in - show login prompt */
              <div className="bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] p-6 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 text-sky-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a4.5 4.5 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                </svg>
                <h4 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2">{t('ai.unlock_title')}</h4>
                <p className="text-[rgb(var(--text-secondary))] mb-4">{t('ai.unlock_description')}</p>
                <button 
                  onClick={onLoginClick}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                >
                  {t('ai.sign_up_button')}
                </button>
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  );
};

export default PlaceDetailCard;