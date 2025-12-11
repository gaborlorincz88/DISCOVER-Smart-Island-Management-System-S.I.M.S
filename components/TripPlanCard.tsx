import React from 'react';
import { Place, TripPlan } from '../types';
import { CATEGORY_INFO } from '../constants';
import { getApiBaseUrl } from '../services/config';

interface TripPlanCardProps {
    trip: TripPlan;
    onSelectPlace: (place: Place) => void;
    onViewOnMap: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const TripPlanCard: React.FC<TripPlanCardProps> = ({ trip, onSelectPlace, onViewOnMap, onEdit, onDelete }) => {
    return (
        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5">
            <div className="p-5 bg-[rgb(var(--card-bg))] border-b border-[rgb(var(--border-color))]">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="text-4xl">{trip.icon}</span>
                        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] truncate">{trip.name}</h2>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={onEdit} className="p-2 text-[rgb(var(--text-secondary))] hover:text-blue-600 hover:bg-[rgb(var(--bg-hover))] rounded-full transition-colors" title="Edit trip">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button onClick={onDelete} className="p-2 text-[rgb(var(--text-secondary))] hover:text-red-600 hover:bg-[rgb(var(--bg-hover))] rounded-full transition-colors" title="Delete trip">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
                {trip.places.length === 0 ? (
                    <p className="text-center text-[rgb(var(--text-secondary))] py-4">No places added to this trip yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {trip.places.map(place => (
                            <li key={place.id}>
                                <button
                                    onClick={() => onSelectPlace(place)}
                                    className="w-full text-left p-3 hover:bg-[rgb(var(--bg-hover))] rounded-lg cursor-pointer border border-transparent hover:border-[rgb(var(--border-color))] transition-all duration-150 flex items-center gap-3"
                                >
                                    <span className="w-6 h-6 flex items-center justify-center">
                                        {place.icon && (place.icon.startsWith('/uploads/') || place.icon.startsWith('http')) ? (
                                            <img src={`${place.icon.startsWith('/uploads/') ? getApiBaseUrl() : ''}${place.icon}`} alt="icon" crossOrigin="anonymous" className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-2xl">{place.icon || CATEGORY_INFO[place.category]?.icon || '📍'}</span>
                                        )}
                                    </span>
                                    <span className="font-medium text-sm text-[rgb(var(--text-primary))]">{place.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
             <div className="p-3 bg-[rgb(var(--card-bg))] border-t border-[rgb(var(--border-color))] flex justify-between items-center">
                <span className="text-sm text-[rgb(var(--text-secondary))]">{trip.places.length} {trip.places.length === 1 ? 'place' : 'places'}</span>
                <button
                    onClick={onViewOnMap}
                    className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow transition-colors active:scale-95 disabled:bg-[rgb(var(--text-secondary))]"
                    disabled={trip.places.length === 0}
                >
                    View on Map
                </button>
            </div>
        </div>
    );
};

export default TripPlanCard;