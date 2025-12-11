
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { geocodeLocation } from '../services/locationService';
import { Coordinates, Place } from '../types';
import { getApiBaseUrl } from '../services/config';

interface LocationSearchProps {
    onLocationFound: (coordinates: Coordinates) => void;
    allPlaces: Place[];
    allEvents?: Place[];
    tourRoutes?: Place[];
    onSuggestionSelect: (place: Place) => void;
}

// Keyword synonyms for better search matching
const SEARCH_SYNONYMS: { [key: string]: string[] } = {
    'bus': ['route', 'transport', 'public transport', 'line'],
    'route': ['bus', 'line', 'transport'],
    'beach': ['bay', 'coast', 'shore', 'swimming'],
    'restaurant': ['food', 'dining', 'eat', 'cafe', 'bar'],
    'church': ['chapel', 'cathedral', 'basilica', 'temple'],
    'tour': ['excursion', 'trip', 'activity', 'experience'],
    'hiking': ['walk', 'trail', 'trekking', 'walking'],
    'diving': ['scuba', 'snorkeling', 'underwater'],
    'event': ['festival', 'celebration', 'concert', 'show'],
    'museum': ['gallery', 'exhibition', 'art'],
    'historical': ['historic', 'ancient', 'heritage', 'monument'],
};

const LocationSearch: React.FC<LocationSearchProps> = ({ 
    onLocationFound, 
    allPlaces, 
    allEvents = [], 
    tourRoutes = [], 
    onSuggestionSelect 
}) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Place[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    // Helper function to normalize text for searching (handle Maltese characters, case, dashes, etc.)
    const normalizeSearchText = (text: string): string => {
        return text
            .toLowerCase()
            // Normalize Maltese characters to their basic Latin equivalents
            .replace(/[ġĠ]/g, 'g')
            .replace(/[ħĤ]/g, 'h')
            .replace(/[ċĊ]/g, 'c')
            .replace(/[żŻ]/g, 'z')
            // Remove or normalize dashes, spaces, and other separators
            .replace(/[-–—]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Get expanded search terms including synonyms
    const getSearchTerms = (query: string): string[] => {
        const normalized = normalizeSearchText(query);
        const words = normalized.split(' ');
        const terms = [normalized, ...words];
        
        // Add synonyms for each word
        words.forEach(word => {
            if (SEARCH_SYNONYMS[word]) {
                terms.push(...SEARCH_SYNONYMS[word]);
            }
        });
        
        return [...new Set(terms)]; // Remove duplicates
    };

    // Calculate match score for ranking
    const calculateMatchScore = (place: Place, searchTerms: string[]): number => {
        let score = 0;
        const normalizedName = normalizeSearchText(place.name || '');
        const normalizedCategory = normalizeSearchText(place.category || '');
        const normalizedDescription = normalizeSearchText(place.shortDescription || '');
        
        searchTerms.forEach(term => {
            if (!term) return; // Skip empty terms
            
            // Exact name match (highest priority)
            if (normalizedName === term) {
                score += 100;
            }
            // Name starts with term
            if (normalizedName.startsWith(term)) {
                score += 50;
            }
            // Name contains term
            if (normalizedName.includes(term)) {
                score += 30;
            }
            
            // Category matches
            if (normalizedCategory.includes(term)) {
                score += 20;
            }
            
            // Description matches
            if (normalizedDescription.includes(term)) {
                score += 10;
            }
            
            // Partial word matches (fuzzy) - check each word in the name
            const nameWords = normalizedName.split(' ');
            nameWords.forEach(word => {
                if (word && term) {
                    // Word starts with search term
                    if (word.startsWith(term)) {
                        score += 15;
                    }
                    // Word contains search term
                    if (word.includes(term) && word !== term) {
                        score += 8;
                    }
                    // Search term starts with word (for single char searches)
                    if (term.length >= 1 && word.startsWith(term)) {
                        score += 5;
                    }
                }
            });
            
            // Category word matches
            const categoryWords = normalizedCategory.split(' ');
            categoryWords.forEach(word => {
                if (word && word.startsWith(term)) {
                    score += 5;
                }
            });
        });
        
        return score;
    };

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        
        if (value.length > 0) {
            // Combine all searchable items
            const allItems = [
                ...allPlaces,
                ...allEvents,
                ...tourRoutes.map(tour => ({
                    ...tour,
                    category: tour.category || 'Tours', // Ensure tours have a category
                }))
            ];
            
            const searchTerms = getSearchTerms(value);
            
            // Filter and score all items
            const scoredItems = allItems
                .map(item => ({
                    item,
                    score: calculateMatchScore(item, searchTerms)
                }))
                .filter(({ score }) => score > 0); // Only items with matches
            
            const topResults = scoredItems
                .sort((a, b) => b.score - a.score) // Sort by score descending
                .slice(0, 10) // Show top 10 results
                .map(({ item }) => item);
            
            setSuggestions(topResults);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (place: Place) => {
        setQuery(place.name);
        setSuggestions([]);
        onSuggestionSelect(place);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuggestions([]);
        try {
            const coordinates = await geocodeLocation(query);
            onLocationFound(coordinates);
            setQuery(''); // Clear input on success
            setSuggestions([]); // Ensure suggestions are cleared
            // Blur the input to remove focus and ensure the search UI is completely reset
            if (inputRef.current) {
                inputRef.current.blur();
            }
        } catch (err: any) {
            setError(err.message || 'Could not find location.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div ref={searchContainerRef} className="relative">
            <form onSubmit={handleSearch}>
                <label htmlFor="location-search" className="text-lg font-semibold text-[rgb(var(--text-secondary))] mb-3 block">
                    {t('search.title')}
                </label>
                <div className="relative">
                    <input
                        id="location-search"
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder={t('search.placeholder_input')}
                        className="w-full p-3 pr-10 bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-[rgb(var(--text-primary))]"
                        disabled={isLoading}
                        autoComplete="off"
                        ref={inputRef}
                        data-onboarding="search-field"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.229-3.228A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                {query && suggestions.length === 0 && (
                    <p className="text-sm text-[rgb(var(--text-secondary))] mt-2">{t('search.no_results')}</p>
                )}
            </form>
            {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[rgb(var(--card-bg))] border-2 border-cyan-500/50 rounded-lg shadow-2xl z-[1000] overflow-hidden max-h-[500px] overflow-y-auto">
                    {/* Results header */}
                    <div className="px-4 py-2 bg-cyan-500/10 border-b border-[rgb(var(--border-color))] sticky top-0">
                        <p className="text-sm font-semibold text-cyan-500">
                            {suggestions.length === 1 
                              ? t('search.results_found', { count: suggestions.length })
                              : t('search.results_found_plural', { count: suggestions.length })}
                        </p>
                    </div>
                    <ul>
                    {suggestions.map(place => {
                        // Get the best available image
                        const getPlaceImage = (place: Place): string | null => {
                            return place.mainImage || 
                                   place.imageUrl || 
                                   (place.image_urls && place.image_urls.length > 0 ? place.image_urls[0] : null) ||
                                   (place.galleryImages && place.galleryImages.length > 0 ? place.galleryImages[0] : null);
                        };
                        
                        // Determine item type for badge
                        const getItemType = (place: Place): { label: string; color: string } => {
                            if (place.category === 'Event' || place.start_datetime) {
                                return { label: 'Event', color: 'bg-purple-500' };
                            } else if (place.category === 'Tours' || place.points) {
                                return { label: 'Tour', color: 'bg-green-500' };
                            } else {
                                return { label: 'Place', color: 'bg-blue-500' };
                            }
                        };
                        
                        const placeImage = getPlaceImage(place);
                        const itemType = getItemType(place);
                        
                        return (
                            <li 
                                key={place.id}
                                className="px-4 py-3 cursor-pointer hover:bg-sky-100/10 transition-colors duration-150 flex items-center gap-3 border-b border-[rgb(var(--border-color))] last:border-b-0"
                                onClick={() => handleSuggestionClick(place)}
                            >
                                {placeImage ? (
                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden">
                                        <img 
                                            src={placeImage.startsWith('/uploads/') ? `${getApiBaseUrl()}${placeImage}` : placeImage} 
                                            alt={place.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // Hide image if it fails to load
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                                            {place.category.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-[rgb(var(--text-primary))] truncate">{place.name}</p>
                                        <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${itemType.color} flex-shrink-0`}>
                                            {itemType.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[rgb(var(--text-secondary))] truncate">{t(`categories.${place.category}`, place.category)}</p>
                                </div>
                            </li>
                        );
                    })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default LocationSearch;
