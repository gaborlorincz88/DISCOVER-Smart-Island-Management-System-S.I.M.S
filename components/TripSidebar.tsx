import React, { useState, useRef, useEffect } from 'react';
import { Place, TripPlan, TravelMode } from '../types';
import ProgressiveIcon from './ProgressiveIcon';
import { getApiBaseUrl } from '../services/config';
import { useViewIconPreloading } from '../hooks/useIconPreloading';

interface TripSidebarProps {
    trip: TripPlan;
    onReorder: (tripId: string, sourceIndex: number, destinationIndex: number) => void;
    onRemovePlace: (tripId: string, placeId: string) => void;
    onHoverPlace: (placeId: string | null) => void;
    onBack: () => void;
    activeTravelMode: TravelMode;
    onTravelModeChange: (mode: TravelMode) => void;
}

const formatDuration = (totalSeconds: number): string => {
    if (totalSeconds < 60) return "< 1 min";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    
    let result = '';
    if (hours > 0) {
        result += `${hours}h `;
    }
    if (minutes > 0 || hours === 0) {
        result += `${minutes} min`;
    }
    return result.trim();
};

const TripSidebar: React.FC<TripSidebarProps> = ({ trip, onReorder, onRemovePlace, onHoverPlace, onBack, activeTravelMode, onTravelModeChange }) => {
    const [draggedItem, setDraggedItem] = useState<number | null>(null);
    const dragNode = useRef<HTMLLIElement | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    // Preload icons for this view
    useViewIconPreloading('trip-planner');

    const generateGoogleMapsUrl = () => {
        if (trip.places.length === 0) return 'https://www.google.com/maps';
        if (trip.places.length < 2) return `https://www.google.com/maps/search/?api=1&query=${trip.places[0]?.coordinates.lat},${trip.places[0]?.coordinates.lng}`;

        const origin = `${trip.places[0].coordinates.lat},${trip.places[0].coordinates.lng}`;
        const destination = `${trip.places[trip.places.length - 1].coordinates.lat},${trip.places[trip.places.length - 1].coordinates.lng}`;
        const waypoints = trip.places.slice(1, -1).map(p => `${p.coordinates.lat},${p.coordinates.lng}`).join('|');
        const googleTravelMode = activeTravelMode === 'foot-walking' ? 'walking' : 'driving';

        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=${googleTravelMode}`;
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        setDraggedItem(index);
        dragNode.current = e.currentTarget;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', ''); // For Firefox compatibility
        
        setTimeout(() => {
            e.currentTarget.classList.add('dragging');
        }, 0);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        if (draggedItem !== null && draggedItem !== index) {
            setOverIndex(index);
        }
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        if (draggedItem !== null && overIndex !== null && draggedItem !== overIndex) {
            onReorder(trip.id, draggedItem, overIndex);
        }
        
        e.currentTarget.classList.remove('dragging');
        setDraggedItem(null);
        setOverIndex(null);
        dragNode.current = null;
    };

    const currentRouteInfo = trip.routeInfo?.[activeTravelMode];

    return (
        <div className="lg:w-1/3 xl:w-1/4 w-full flex flex-col gap-4 bg-[rgb(var(--card-bg))] shadow-lg rounded-xl h-full max-h-[90vh]">
            <div className="p-4 border-b border-[rgb(var(--border-color))]">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))] rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-3xl">{trip.icon}</span>
                    <h2 className="text-xl font-bold text-[rgb(var(--text-primary))] truncate">{trip.name}</h2>
                </div>
                <div className="w-full bg-[rgb(var(--bg-light))] rounded-lg p-1 flex mt-4">
                    <button
                        onClick={() => onTravelModeChange('driving-car')}
                        className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${activeTravelMode === 'driving-car' ? 'bg-[rgb(var(--card-bg))] shadow' : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))]'}`}
                    >
                        <span>🚗</span> Driving
                    </button>
                    <button
                        onClick={() => onTravelModeChange('foot-walking')}
                        className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${activeTravelMode === 'foot-walking' ? 'bg-[rgb(var(--card-bg))] shadow' : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))]'}`}
                    >
                        <span>🚶</span> Walking
                    </button>
                </div>
                 {trip.places.length > 1 && (
                    <div className="mt-3 bg-[rgb(var(--bg-light))] p-3 rounded-lg">
                        {currentRouteInfo ? (
                            <div className="flex justify-around items-center text-sm text-[rgb(var(--text-primary))]">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[rgb(var(--text-secondary))]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 2.586a2 2 0 012.828 0l2 2a2 2 0 010 2.828l-7.5 7.5a2 2 0 01-2.828 0l-7.5-7.5a2 2 0 010-2.828l2-2a2 2 0 012.828 0L10 5.172l2.586-2.586zM10 12a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                                    <span className="font-semibold">{(currentRouteInfo.distance / 1000).toFixed(1)} km</span>
                                </div>
                                <div className="border-l h-5 border-[rgb(var(--border-color))]"></div>
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[rgb(var(--text-secondary))]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                    <span className="font-semibold">{formatDuration(currentRouteInfo.duration)}</span>
                                </div>
                            </div>
                        ) : (
                             <div className="flex justify-around items-center text-sm text-[rgb(var(--text-secondary))] animate-pulse">
                                <div className="h-4 bg-[rgb(var(--border-color))] rounded w-20"></div>
                                <div className="h-4 bg-[rgb(var(--border-color))] rounded w-20"></div>
                             </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-0 pb-4 max-h-[60vh]">
                {trip.places.length > 0 ? (
                    <ul className="space-y-2" onDragOver={e => e.preventDefault()}>
                        {trip.places.map((place, index) => (
                            <li
                                key={place.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => setOverIndex(null)}
                                onMouseOver={() => onHoverPlace(place.id)}
                                onMouseOut={() => onHoverPlace(null)}
                                className={`p-3 bg-[rgb(var(--bg-light))] rounded-lg border flex items-center gap-4 draggable-item transition-all duration-200 ${overIndex === index ? 'border-sky-500 scale-105' : 'border-[rgb(var(--border-color))]'} ${draggedItem === index ? 'dragging' : ''}`}
                            >
                                <span className="font-bold text-[rgb(var(--text-secondary))] w-5 text-center">{index + 1}</span>
                                <span className="w-6 h-6 flex items-center justify-center">
                                    {place.icon && (place.icon.startsWith('/uploads/') || place.icon.startsWith('http')) ? (
                                        <ProgressiveIcon
                                            src={`${place.icon.startsWith('/uploads/') ? getApiBaseUrl() : ''}${place.icon}`}
                                            alt="icon"
                                            className="w-full h-full object-contain"
                                            size={24}
                                            priority="normal"
                                        />
                                    ) : (
                                        <span className="text-2xl">{place.icon}</span>
                                    )}
                                </span>
                                <div className="flex-grow">
                                    <p className="font-medium text-sm text-[rgb(var(--text-primary))]">{place.name}</p>
                                    <p className="text-xs text-[rgb(var(--text-secondary))]">{place.category}</p>
                                </div>
                                <button
                                    onClick={() => onRemovePlace(trip.id, place.id)}
                                    className="p-1.5 text-[rgb(var(--text-secondary))] hover:text-red-600 hover:bg-red-100/20 rounded-full flex-shrink-0 transition-colors"
                                    title={`Remove ${place.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-[rgb(var(--text-secondary))] py-4">This trip is empty. Go back to the explorer to add places!</p>
                )}
            </div>
            <div className="p-4 border-t border-[rgb(var(--border-color))]">
                <a
                    href={generateGoogleMapsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-auto mx-auto text-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-teal-500/40 transition-all duration-200 ease-in-out flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:scale-95 ${trip.places.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.528-1.973 6.012 6.012 0 011.912 2.706C16.27 8.57 16.5 9.26 16.5 10c0 .74-.23 1.43-.668 1.973a6.012 6.012 0 01-1.912 2.706C14.026 14.27 13.526 14 13 14a1.5 1.5 0 01-1.5-1.5v-.5a2 2 0 00-4 0 2 2 0 01-1.528 1.973 6.012 6.012 0 01-1.912-2.706C4.73 11.43 4.5 10.74 4.5 10c0-.74.23-1.43.668-1.973z" clipRule="evenodd" />
                    </svg>
                    Open in Google Maps
                </a>
            </div>
        </div>
    );
};

export default TripSidebar;