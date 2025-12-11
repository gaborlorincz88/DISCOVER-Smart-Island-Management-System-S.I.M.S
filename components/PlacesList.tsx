
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Place, PlaceCategory } from '../types';
import { CATEGORY_INFO } from '../constants';
import ProgressiveIcon from './ProgressiveIcon';
import { getApiBaseUrl } from '../services/config';
import { useViewIconPreloading } from '../hooks/useIconPreloading';

interface PlacesListProps {
  places: Place[];
  onPlaceClick: (place: Place) => void;
  isLoading: boolean;
  hasSearched: boolean;
  isLocationAvailable: boolean;
}

const PlacesList: React.FC<PlacesListProps> = ({ places, onPlaceClick, isLoading, hasSearched, isLocationAvailable }) => {
  const { t } = useTranslation();

  // Preload icons for this view
  useViewIconPreloading('places-list');

  if (isLoading) {
    return (
        <div className="p-4">
            <div className="h-6 bg-[rgb(var(--border-color))] rounded w-1/2 mb-4 animate-pulse"></div>
            <ul className="space-y-3">
                {[...Array(6)].map((_, i) => (
                    <li key={i} className="p-3 rounded-lg bg-[rgb(var(--bg-light))] animate-pulse">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[rgb(var(--border-color))] rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-[rgb(var(--border-color))] rounded w-3/4"></div>
                                <div className="h-3 bg-[rgb(var(--border-color))] rounded w-1/2"></div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
  }

  if (places.length === 0) {
    if (hasSearched) {
      return (
        <div className="p-6 text-center text-[rgb(var(--text-secondary))] flex flex-col justify-center items-center py-16">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-20 w-20 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m-6 10V7" />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-[rgb(var(--text-primary))]">{t('places.no_places_found')}</h3>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">{t('places.try_changing_filters')}</p>
        </div>
      );
    }
    
    return (
         <div className="p-6 text-center text-[rgb(var(--text-secondary))] flex flex-col justify-center items-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-20 w-20 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 10.5a6.15 6.15 0 11-12.3 0 6.15 6.15 0 0112.3 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21a9 9 0 100-18 9 9 0 000 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 10.5h16" />
            </svg>
            <h3 className="mt-4 text-2xl font-semibold text-[rgb(var(--text-primary))]">{t('places.welcome')}</h3>
            {isLocationAvailable ? (
                <p className="mt-2 text-base max-w-xs mx-auto">
                    {t('places.select_category')}
                </p>
            ) : (
                <p className="mt-2 text-base max-w-xs mx-auto">
                    {t('places.enable_location')}
                </p>
            )}
         </div>
    );
  }

  // Calculate max height to show approximately 6 places
  // Each place item is roughly 68px tall (padding + content), so 6 items = ~408px
  // Add some padding/margin for the container
  const maxHeight = 6 * 68 + 16; // 6 items + container padding

  return (
    <div className="p-2 sm:p-4">
      <ul 
        className="space-y-2"
        style={{
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {places.map((place) => {
          const iconValue = place.icon || CATEGORY_INFO[place.category]?.icon || '📍';
          const isIconUrl = iconValue.startsWith('/uploads/') || iconValue.startsWith('http');
          // For bus stops, use mainImage if imageUrl is not available
          let imageUrl = place.imageUrl || (place.category === PlaceCategory.BUS_STOP ? place.mainImage : null);
          
          // Ensure imageUrl is properly formatted with API base URL if it starts with /uploads/
          if (imageUrl && imageUrl.startsWith('/uploads/')) {
            imageUrl = `${getApiBaseUrl()}${imageUrl}`;
          }

          return (
            <li
              key={place.id}
              onClick={() => onPlaceClick(place)}
              className="p-3 hover:bg-sky-500/10 rounded-lg cursor-pointer border border-transparent hover:border-sky-500/20 transition-all duration-200 transform hover:-translate-y-px"
              role="button"
              tabIndex={0}
              onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onPlaceClick(place); }}
            >
              <div className="flex items-center">
                  <div className="mr-4 w-12 h-12 flex-shrink-0 flex items-center justify-center bg-[rgb(var(--bg-light))] rounded-full overflow-hidden">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={place.name}
                        className="w-full h-full object-cover" 
                      />
                    ) : isIconUrl ? (
                      <ProgressiveIcon
                        src={`${iconValue.startsWith('/uploads/') ? getApiBaseUrl() : ''}${iconValue}`}
                        alt={place.name}
                        className="w-full h-full object-cover"
                        size={48}
                        priority="normal"
                      />
                    ) : (
                      <span className="text-2xl">{iconValue}</span>
                    )}
                  </div>
                  <div>
                      <div className="font-semibold text-md text-[rgb(var(--text-primary))]">{place.name.replace(/_/g, ' ').replace(/-/g, ' ')}</div>
                      <div className="text-sm text-[rgb(var(--text-secondary))]">{t(`categories.${place.category}`, place.category)} &bull; {t('places.km_away', { distance: place.distance?.toFixed(1) })}</div>
                  </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlacesList;