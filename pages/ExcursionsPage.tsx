
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';
import { getPageBackground } from '../services/pageBackgroundService';

interface TourCategory {
    id: string;
    name: string;
    description?: string;
    image?: string;
    icon?: string;
    color?: string;
    active?: boolean;
    order?: number;
}

interface Tour {
    id: string;
    name: string;
    description: string;
    coordinates: [number, number][];
    points: Array<{
        placeId: string;
        order: number;
        name: string;
        coordinates: [number, number];
    }>;
    mainImage?: string;
    images?: string[];
    duration?: string;
    price?: number;
    currency?: string;
    prices?: {
        adult?: number;
        child?: number;
        senior?: number;
    };
}

interface ExcursionsPageProps {
    onTourSelect: (tour: Tour) => void;
    onMyTickets: () => void;
    onShowOnMap?: (tour: Tour) => void;
}

const ExcursionsPage: React.FC<ExcursionsPageProps> = ({ onTourSelect, onMyTickets, onShowOnMap }) => {
    const { t } = useTranslation();
    const [tourCategories, setTourCategories] = useState<TourCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [tours, setTours] = useState<Tour[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const [pageBackground, setPageBackground] = useState<string | null>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Load page background from settings
    useEffect(() => {
        const loadBackground = async () => {
            try {
                if (typeof getPageBackground === 'function') {
                    const bg = await getPageBackground('excursions', isDarkMode ? 'dark' : 'light');
                    if (bg) {
                        setPageBackground(bg);
                    } else {
                        // Fallback to default
                        setPageBackground(
                            isDarkMode
                                ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                                : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))'
                        );
                    }
                } else {
                    console.warn('getPageBackground is not available, using default gradient');
                    // Fallback to default
                    setPageBackground(
                        isDarkMode
                            ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                            : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))'
                    );
                }
            } catch (error) {
                console.error('Error loading page background:', error);
                // Fallback to default
                setPageBackground(
                    isDarkMode
                        ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                        : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))'
                );
            }
        };
        loadBackground();
    }, [isDarkMode]);

    useEffect(() => {
        fetchTourCategories();
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            fetchTours(selectedCategory);
        } else {
            setTours([]);
        }
    }, [selectedCategory]);

    const fetchTourCategories = async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/tour-categories`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Normalize image URLs - remove localhost URLs and ensure relative paths
            const normalizedData = data.map((category: TourCategory) => {
                if (category.image) {
                    // Remove localhost URLs if present
                    if (category.image.startsWith('http://localhost:3003') || category.image.startsWith('https://localhost:3003')) {
                        category.image = category.image.replace(/https?:\/\/localhost:3003/, '');
                    }
                    // If it's already a full URL (not localhost), keep it; otherwise it's already a relative path
                    console.log(`[ExcursionsPage] Category ${category.id} (${category.name}) - Image: ${category.image}`);
                } else {
                    console.log(`[ExcursionsPage] Category ${category.id} (${category.name}) - NO IMAGE`);
                }
                return category;
            });
            
            setTourCategories(normalizedData);
        } catch (error) {
            console.error('Failed to fetch tour categories:', error);
            setError('Failed to load tour categories');
        }
    };

    const fetchTours = async (categoryId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/tours/${categoryId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setTours(data);
        } catch (error) {
            console.error('Failed to fetch tours:', error);
            setError('Failed to load tours for this category');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    };

    return (
        <div className="relative w-full h-full min-h-screen" style={{ background: 'transparent' }}>
            {/* Decorative background elements - fixed to viewport */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 -left-40 w-80 h-80 bg-red-300/20 dark:bg-red-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 right-1/4 w-80 h-80 bg-cyan-400/20 dark:bg-cyan-500/10 rounded-full blur-3xl"></div>
            </div>
            
            {/* Gradient background that extends with content - works on all screen sizes */}
            <div 
                className="fixed inset-0 pointer-events-none" 
                style={{ 
                    zIndex: 0,
                    background: pageBackground || (isDarkMode
                        ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                        : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))')
                }}
            ></div>
            
            <div className="relative min-h-screen p-6 max-w-6xl mx-auto pb-8 w-full" style={{ zIndex: 10 }}>
            <div className="flex flex-col items-center text-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-[rgb(var(--text-primary))] mb-4">
                        {t('tours.main_title')}
                    </h1>
                    <p className="text-lg text-[rgb(var(--text-secondary))]">
                        {t('tours.main_subtitle')}
                    </p>
                </div>
                <button
                    onClick={onMyTickets}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span>{t('tours.my_tickets')}</span>
                </button>
            </div>

            {/* Tour Categories Grid - Large Screens */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {tourCategories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`relative overflow-hidden rounded-xl shadow-lg transition-all duration-200 text-left group ${
                            selectedCategory === category.id
                                ? 'ring-2 ring-cyan-500 ring-offset-2'
                                : 'hover:shadow-xl hover:scale-105'
                        }`}
                    >
                        {/* Category Image */}
                        {category.image && (
                            <div className="relative h-48 w-full">
                                <img
                                    src={category.image.startsWith('http') 
                                        ? category.image 
                                        : `${getApiBaseUrl()}${category.image}?nocache=${Date.now()}`}
                                    alt={category.name}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                        const imgSrc = category.image.startsWith('http') 
                                            ? category.image 
                                            : `${getApiBaseUrl()}${category.image}`;
                                        console.error(`[ExcursionsPage Desktop] Failed to load category image for ${category.id}:`, imgSrc);
                                        console.error(`[ExcursionsPage Desktop] Original image path:`, category.image);
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                        console.log(`[ExcursionsPage Desktop] Successfully loaded image for ${category.id}:`, category.image);
                                    }}
                                />
                                <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent ${
                                    selectedCategory === category.id ? 'from-cyan-500/80' : ''
                                }`} />
                            </div>
                        )}
                        
                        {/* Category Content */}
                        <div className={`p-6 ${category.image ? 'absolute bottom-0 left-0 right-0' : ''}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`text-xl font-semibold ${
                                    selectedCategory === category.id || category.image 
                                        ? 'text-white' 
                                        : 'text-[rgb(var(--text-primary))]'
                                }`}>
                                    {category.name}
                                </h3>
                                {selectedCategory === category.id && (
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <p className={`text-sm ${
                                selectedCategory === category.id || category.image 
                                    ? 'text-white/90' 
                                    : 'text-[rgb(var(--text-secondary))]'
                            }`}>
                                {category.description || t(`tours.categories.${category.id}.description`, 'Click to explore available tours')}
                            </p>
                        </div>
                        
                        {/* Fallback for categories without images */}
                        {!category.image && (
                            <div className="p-6 bg-[rgb(var(--card-bg))]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
                                        {category.name}
                                    </h3>
                                    {selectedCategory === category.id && (
                                        <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <p className="text-sm text-[rgb(var(--text-secondary))]">
                                    {category.description || t(`tours.categories.${category.id}.description`, 'Click to explore available tours')}
                                </p>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Tour Categories Vertical Layout - Small Screens */}
            <div className="md:hidden space-y-8">
                {tourCategories.map((category) => (
                    <div key={category.id} className="space-y-4">
                        {/* Category Card */}
                        <button
                            onClick={() => handleCategorySelect(category.id)}
                            className={`w-full relative overflow-hidden rounded-xl shadow-lg transition-all duration-200 text-left group ${
                                selectedCategory === category.id
                                    ? 'ring-2 ring-cyan-500 ring-offset-2'
                                    : 'hover:shadow-xl hover:scale-105'
                            }`}
                        >
                        {/* Category Image */}
                        {category.image && (
                            <div className="relative h-48 w-full">
                                <img
                                    src={category.image.startsWith('http') 
                                        ? category.image 
                                        : `${getApiBaseUrl()}${category.image}?nocache=${Date.now()}`}
                                    alt={category.name}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                        const imgSrc = category.image.startsWith('http') 
                                            ? category.image 
                                            : `${getApiBaseUrl()}${category.image}`;
                                        console.error(`[ExcursionsPage] Failed to load category image for ${category.id}:`, imgSrc);
                                        console.error(`[ExcursionsPage] Original image path:`, category.image);
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                        console.log(`[ExcursionsPage] Successfully loaded image for ${category.id}:`, category.image);
                                    }}
                                />
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent ${
                                        selectedCategory === category.id ? 'from-cyan-500/80' : ''
                                    }`} />
                                </div>
                            )}
                            
                            {/* Category Content */}
                            <div className={`p-6 ${category.image ? 'absolute bottom-0 left-0 right-0' : 'bg-[rgb(var(--card-bg))]'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className={`text-xl font-semibold ${
                                        selectedCategory === category.id || category.image 
                                            ? 'text-white' 
                                            : 'text-[rgb(var(--text-primary))]'
                                    }`}>
                                        {category.name}
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        {selectedCategory === category.id && (
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        <svg className={`w-5 h-5 transition-transform duration-200 ${
                                            selectedCategory === category.id ? 'rotate-180' : ''
                                        } ${category.image ? 'text-white' : 'text-[rgb(var(--text-secondary))]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <p className={`text-sm ${
                                    selectedCategory === category.id || category.image 
                                        ? 'text-white/90' 
                                        : 'text-[rgb(var(--text-secondary))]'
                                }`}>
                                    {category.description || t(`tours.categories.${category.id}.description`, 'Click to explore available tours')}
                                </p>
                            </div>
                        </button>

                        {/* Tours for this category - shown directly under the category on mobile */}
                        {selectedCategory === category.id && (
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                                        {category.name} - {t('tours.available_tours')}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {isLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                                        <p className="text-[rgb(var(--text-secondary))]">{t('tours.loading_tours')}</p>
                                    </div>
                                ) : error ? (
                                    <div className="text-center py-8">
                                        <p className="text-red-500 mb-4">{error}</p>
                                        <button
                                            onClick={() => fetchTours(selectedCategory)}
                                            className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors"
                                        >
                                            {t('tours.try_again')}
                                        </button>
                                    </div>
                                ) : tours.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-[rgb(var(--text-secondary))] mb-4">{t('tours.no_tours_available')}</p>
                                        <p className="text-sm text-[rgb(var(--text-secondary))]">{t('tours.check_back_later')}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {tours.map((tour) => {
                                            // Check if this is a hiking tour (we'll exclude these from booking)
                                            const isHikingTour = tour.name.toLowerCase().includes('hiking') || 
                                                               tour.name.toLowerCase().includes('trail') ||
                                                               selectedCategory === 'hiking';
                                            
                                            return (
                                                <div
                                                    key={tour.id}
                                                    className={`bg-[rgb(var(--bg-light))] rounded-lg overflow-hidden border border-[rgb(var(--border-color))] transition-all duration-200 ${
                                                        isHikingTour 
                                                            ? 'cursor-default' 
                                                            : 'cursor-pointer hover:border-cyan-500 hover:shadow-lg hover:scale-105'
                                                    }`}
                                                    onClick={async () => {
                                                        if (!isHikingTour) {
                                                            // Track tour view
                                                            const { trackTourView } = await import('../services/analyticsService');
                                                            await trackTourView(tour.id, tour.name, selectedCategory || undefined);
                                                            // Call the onTourSelect prop to navigate to tour detail
                                                            onTourSelect(tour);
                                                        }
                                                    }}
                                                >
                                                    {/* Tour Image */}
                                                    {(tour.mainImage || (tour.images && tour.images[0])) && (
                                                        <div className="relative h-48 w-full">
                                                            <img
                                                                src={`${(tour.mainImage || tour.images?.[0])?.startsWith('/uploads/') ? getApiBaseUrl() : ''}${tour.mainImage || tour.images?.[0]}`}
                                                                alt={tour.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    // Hide image if it fails to load
                                                                    e.currentTarget.style.display = 'none';
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                            {tour.duration && (
                                                                <div className="absolute top-3 right-3 bg-white/90 text-black text-xs px-2 py-1 rounded-full font-medium">
                                                                    {tour.duration}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Tour Content */}
                                                    <div className="p-4">
                                                        <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2">
                                                            {tour.name}
                                                        </h3>
                                                        <p className="text-sm text-[rgb(var(--text-secondary))] mb-3 line-clamp-2">
                                                            {tour.description}
                                                        </p>
                                                        <div className="flex items-center justify-between text-xs text-[rgb(var(--text-secondary))] mb-3">
                                                            <span>{tour.points.length} {t('tours.points_of_interest')}</span>
                                                            <span className="bg-cyan-500 text-white px-2 py-1 rounded-full">
                                                                {tour.coordinates.length} {t('tours.waypoints')}
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Price Information */}
                                                        {(tour.price || tour.prices) && !isHikingTour && (
                                                            <div className="mb-3">
                                                                {tour.prices ? (
                                                                    <div className="text-sm">
                                                                        <span className="text-[rgb(var(--text-secondary))]">{t('tours.from')} </span>
                                                                        <span className="font-semibold text-cyan-600">
                                                                            {tour.currency || '€'}{Math.min(...Object.values(tour.prices).filter(p => p !== undefined) as number[])}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm font-semibold text-cyan-600">
                                                                        {tour.currency || '€'}{tour.price}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {!isHikingTour && (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm text-cyan-600 font-medium">
                                                                {t('tours.book_now_save')}
                                                                    </span>
                                                                    <span className="text-xs text-[rgb(var(--text-secondary))]">
                                                                {t('tours.click_to_view_details')}
                                                                    </span>
                                                                </div>
                                                                {onShowOnMap && tour.coordinates && tour.coordinates.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            onShowOnMap(tour); 
                                                                        }}
                                                                        className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-cyan-600 transition-colors w-full"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        </svg>
                                                                        {t('events.show_on_map', 'Show on map')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isHikingTour && (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="text-xs text-[rgb(var(--text-secondary))] italic">
                                                                    {t('tours.self_guided_hiking')}
                                                                </div>
                                                                {onShowOnMap && tour.coordinates && tour.coordinates.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            onShowOnMap(tour); 
                                                                        }}
                                                                        className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-cyan-600 transition-colors w-full"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        </svg>
                                                                        {t('events.show_on_map', 'Show on map')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Tours List - Large Screens */}
            {selectedCategory && (
                <div className="hidden md:block bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                            {tourCategories.find(c => c.id === selectedCategory)?.name} - Available Tours
                        </h2>
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                            <p className="text-[rgb(var(--text-secondary))]">Loading tours...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={() => fetchTours(selectedCategory)}
                                className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : tours.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-[rgb(var(--text-secondary))] mb-4">No tours available for this category yet.</p>
                            <p className="text-sm text-[rgb(var(--text-secondary))]">Check back later or contact us for more information.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {tours.map((tour) => {
                                // Check if this is a hiking tour (we'll exclude these from booking)
                                const isHikingTour = tour.name.toLowerCase().includes('hiking') || 
                                                   tour.name.toLowerCase().includes('trail') ||
                                                   selectedCategory === 'hiking';
                                
                                return (
                                    <div
                                        key={tour.id}
                                        className={`bg-[rgb(var(--bg-light))] rounded-lg overflow-hidden border border-[rgb(var(--border-color))] transition-all duration-200 ${
                                            isHikingTour 
                                                ? 'cursor-default' 
                                                : 'cursor-pointer hover:border-cyan-500 hover:shadow-lg hover:scale-105'
                                        }`}
                                        onClick={() => {
                                            if (!isHikingTour) {
                                                // Call the onTourSelect prop to navigate to tour detail
                                                onTourSelect(tour);
                                            }
                                        }}
                                    >
                                        {/* Tour Image */}
                                        {(tour.mainImage || (tour.images && tour.images[0])) && (
                                            <div className="relative h-48 w-full">
                                                <img
                                                    src={`${(tour.mainImage || tour.images?.[0])?.startsWith('/uploads/') ? getApiBaseUrl() : ''}${tour.mainImage || tour.images?.[0]}`}
                                                    alt={tour.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        // Hide image if it fails to load
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                {tour.duration && (
                                                    <div className="absolute top-3 right-3 bg-white/90 text-black text-xs px-2 py-1 rounded-full font-medium">
                                                        {tour.duration}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Tour Content */}
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2">
                                                {tour.name}
                                            </h3>
                                            <p className="text-sm text-[rgb(var(--text-secondary))] mb-3 line-clamp-2">
                                                {tour.description}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-[rgb(var(--text-secondary))] mb-3">
                                                <span>{tour.points.length} points of interest</span>
                                                <span className="bg-cyan-500 text-white px-2 py-1 rounded-full">
                                                    {tour.coordinates.length} waypoints
                                                </span>
                                            </div>
                                            
                                            {/* Price Information */}
                                            {(tour.price || tour.prices) && !isHikingTour && (
                                                <div className="mb-3">
                                                    {tour.prices ? (
                                                        <div className="text-sm">
                                                            <span className="text-[rgb(var(--text-secondary))]">{t('tours.from')} </span>
                                                            <span className="font-semibold text-cyan-600">
                                                                {tour.currency || '€'}{Math.min(...Object.values(tour.prices).filter(p => p !== undefined) as number[])}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-semibold text-cyan-600">
                                                            {tour.currency || '€'}{tour.price}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {!isHikingTour && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-cyan-600 font-medium">
                                                                {t('tours.book_now_save')}
                                                        </span>
                                                        <span className="text-xs text-[rgb(var(--text-secondary))]">
                                                                {t('tours.click_to_view_details')}
                                                        </span>
                                                    </div>
                                                    {onShowOnMap && tour.coordinates && tour.coordinates.length > 0 && (
                                                        <button
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                onShowOnMap(tour); 
                                                            }}
                                                            className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-cyan-600 transition-colors w-full"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {t('events.show_on_map', 'Show on map')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {isHikingTour && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="text-xs text-[rgb(var(--text-secondary))] italic">
                                                        🥾 Self-guided hiking trail - no booking required
                                                    </div>
                                                    {onShowOnMap && tour.coordinates && tour.coordinates.length > 0 && (
                                                        <button
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                onShowOnMap(tour); 
                                                            }}
                                                            className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-cyan-600 transition-colors w-full"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {t('events.show_on_map', 'Show on map')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* No Category Selected State - Large Screens */}
            {!selectedCategory && (
                <div className="hidden md:block text-center py-12 bg-[rgb(var(--card-bg))] rounded-xl shadow-lg">
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2">
                        {t('tours.select_tour_category')}
                    </h3>
                    <p className="text-[rgb(var(--text-secondary))]">
                        {t('tours.choose_category_explore')}
                    </p>
                </div>
            )}

            </div>
        </div>
    );
};

export default ExcursionsPage;
