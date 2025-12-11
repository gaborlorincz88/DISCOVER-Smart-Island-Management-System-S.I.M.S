
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Place } from '../types'; // Using Place as a base type for events
import { getApiBaseUrl } from '../services/config';
import { getPageBackground } from '../services/pageBackgroundService';

// Define a more specific Event interface based on backend data
interface Event {
    id: number | string;
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    start_datetime?: string;
    end_datetime?: string;
    image_urls: string; // This is a JSON string from the backend
    website?: string;
    category?: string;
}

const EVENT_CATEGORIES = [
    'Culture & Heritage',
    'Music & Festivals',
    'Food & Drink',
    'Outdoors & Adventure',
    'Family, Arts & Wellness'
] as const;

interface EventsPageProps {
    onShowOnMap: (event: Event) => void;
}

const EventsPage: React.FC<EventsPageProps> = ({ onShowOnMap }) => {
    const { t, i18n } = useTranslation();
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEventId, setExpandedEventId] = useState<number | string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [pageBackground, setPageBackground] = useState<string | null>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    
    const filteredEvents = selectedCategory 
        ? events.filter(event => event.category === selectedCategory)
        : events;

    // Add CSS animations for modal - must be before early returns
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
        return () => {
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        };
    }, []);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await fetch(`${getApiBaseUrl()}/api/events`);
                if (!response.ok) {
                    throw new Error('Failed to fetch events.');
                }
                const data: any[] = await response.json();
                
                // Safely parse image_urls for each event
                // Backend already returns image_urls as an array, but handle both cases for safety
                const processedEvents = data.map(event => {
                    // Handle image_urls - backend should return it as an array, but handle string case too
                    let imageUrls: string[] = [];
                    if (event.image_urls) {
                        if (Array.isArray(event.image_urls)) {
                            // Already an array from backend
                            imageUrls = event.image_urls;
                        } else if (typeof event.image_urls === 'string') {
                            // Check if it's a JSON array string or a simple path string
                            if (event.image_urls.trim().startsWith('[')) {
                                try {
                                    imageUrls = JSON.parse(event.image_urls);
                                } catch (e) {
                                    // If parsing fails, treat as single path
                                    imageUrls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
                                }
                            } else if (event.image_urls.trim().startsWith('/')) {
                                // It's a simple path string like "/uploads/image.jpg"
                                imageUrls = [event.image_urls.trim()];
                            } else {
                                imageUrls = event.image_urls.trim() ? [event.image_urls.trim()] : [];
                            }
                        }
                    }
                    
                    return {
                        ...event,
                        image_urls: imageUrls,
                        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null
                    };
                });
                
                const uniqueEvents = Array.from(new Map(processedEvents.map(event => [event.id, event])).values());

                uniqueEvents.sort((a, b) => {
                    const dateA = a.start_datetime ? new Date(a.start_datetime).getTime() : 0;
                    const dateB = b.start_datetime ? new Date(b.start_datetime).getTime() : 0;
                    return dateB - dateA;
                });

                setEvents(uniqueEvents);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const formatDate = useCallback((start?: string, end?: string) => {
        if (!start) return { date: t('events.date_tbc'), time: '' };
        const startDate = new Date(start);
        const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
        
        let dateString = startDate.toLocaleDateString(i18n.language, dateOptions);
        let timeString = `${t('events.starts')}: ${startDate.toLocaleTimeString(i18n.language, timeOptions)}`;

        if (end) {
            const endDate = new Date(end);
            if (startDate.toDateString() !== endDate.toDateString()) {
                dateString = `${startDate.toLocaleDateString(i18n.language, dateOptions)} - ${endDate.toLocaleDateString(i18n.language, dateOptions)}`;
            }
            timeString = `${startDate.toLocaleTimeString(i18n.language, timeOptions)} - ${endDate.toLocaleTimeString(i18n.language, timeOptions)}`;
        }
        return { date: dateString, time: timeString };
    }, [t, i18n.language]);

    // Load page background from settings
    useEffect(() => {
        console.log('EventsPage: useEffect triggered, isDarkMode:', isDarkMode);
        console.log('EventsPage: getPageBackground type:', typeof getPageBackground);
        
        const loadBackground = async () => {
            console.log('EventsPage: loadBackground called');
            try {
                console.log('EventsPage: Calling getPageBackground...');
                const bg = await getPageBackground('events', isDarkMode ? 'dark' : 'light');
                console.log('EventsPage: getPageBackground returned:', bg);
                
                if (bg) {
                    console.log('EventsPage: Setting pageBackground to:', bg);
                    setPageBackground(bg);
                } else {
                    console.log('EventsPage: No background returned, using fallback');
                    // Fallback to default
                    const fallback = isDarkMode
                        ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                        : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))';
                    setPageBackground(fallback);
                }
            } catch (error) {
                console.error('EventsPage: Error loading page background:', error);
                // Fallback to default
                const fallback = isDarkMode
                    ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
                    : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))';
                setPageBackground(fallback);
            }
        };
        
        loadBackground();
        
        // Listen for updates from other tabs/windows
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'dg_header_settings_updated') {
                console.log('EventsPage: Header settings updated, reloading background');
                loadBackground();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        
        // Also listen via BroadcastChannel if available
        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('dg-header');
            bc.onmessage = () => {
                console.log('EventsPage: Header settings updated via BroadcastChannel, reloading background');
                loadBackground();
            };
        } catch (e) {
            console.warn('EventsPage: BroadcastChannel not supported');
        }
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            if (bc) bc.close();
        };
    }, [isDarkMode]);

    const getGradient = () => {
        return pageBackground || (isDarkMode
            ? 'linear-gradient(to bottom right, rgb(229, 231, 235), rgb(6, 182, 212), rgb(239, 68, 68))'
            : 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(165, 243, 252), rgb(254, 202, 202))');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen" style={{ background: getGradient() }}>
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-cyan-500 dark:border-cyan-400"></div>
            </div>
        );
    }

    if (error) {
        return <div className="text-center p-8 text-red-600 dark:text-red-400 text-xl min-h-screen" style={{ background: getGradient() }}>{t('events.error', { message: error })}</div>;
    }

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
                    background: getGradient()
                }}
            ></div>
            
            <div className="relative min-h-screen pb-8 w-full" style={{ zIndex: 10 }}>
            <div className="container mx-auto p-3 sm:p-4 lg:p-8">
                <header className="text-center mb-6 sm:mb-8 lg:mb-12">
                    <h1 className="text-4xl sm:text-3xl md:text-5xl font-bold text-[rgb(var(--text-primary))] mb-2 sm:mb-4 tracking-tight">{t('events.title')}</h1>
                    <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] max-w-2xl mx-auto mb-4">{t('events.subtitle')}</p>
                    
                    {/* Category Filter Buttons */}
                    <div className="flex flex-wrap justify-center gap-2 px-4">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 ${
                                selectedCategory === null
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'bg-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] hover:bg-slate-300'
                            }`}
                        >
                            {t('events.all_events')}
                        </button>
                        {EVENT_CATEGORIES.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 ${
                                    selectedCategory === category
                                        ? 'bg-cyan-500 text-white shadow-md'
                                        : 'bg-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] hover:bg-slate-300'
                                }`}
                            >
                                {t(`events.categories.${category}`, category)}
                            </button>
                        ))}
                    </div>
                </header>

                {filteredEvents.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 sm:h-24 sm:w-24 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h2 className="mt-4 text-lg sm:text-2xl font-semibold text-[rgb(var(--text-primary))]">
                            {selectedCategory 
                                ? t('events.no_events_in_category', { category: selectedCategory })
                                : t('events.no_events')
                            }
                        </h2>
                        <p className="mt-2 text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                            {selectedCategory 
                                ? t('events.try_different_category')
                                : t('events.check_back_later')
                            }
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Mobile / Small screens: Professional Timeline */}
                        <div className="md:hidden">
                            <div className="relative max-w-full mx-auto pb-8">
                                {/* Vertical Timeline Line */}
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-cyan-400 to-cyan-500"></div>
                                
                                {filteredEvents.map((event, index) => {
                                    const { date, time } = formatDate(event.start_datetime, event.end_datetime);
                                    // image_urls is already parsed as an array from the fetchEvents function
                                    const imageUrls = Array.isArray(event.image_urls) ? event.image_urls : (event.image_urls ? [event.image_urls] : []);
                                    const posterImage = imageUrls.length > 0 ? `${getApiBaseUrl()}${imageUrls[0]}` : 'https://source.unsplash.com/random/800x600/?gozo';
                                    const expanded = expandedEventId === event.id;
                                    
                                    return (
                                        <div
                                            key={event.id}
                                            data-event-id={event.id}
                                            className="relative mb-6 pl-12"
                                        >
                                            {/* Timeline Dot */}
                                            <div className="absolute left-2 top-3 z-10">
                                                <div className="w-5 h-5 rounded-full bg-cyan-500 border-4 border-cyan-50 dark:border-slate-900 shadow-lg flex items-center justify-center">
                                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                                </div>
                                            </div>
                                            
                                            {/* Event Card */}
                                            <div
                                                className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg overflow-hidden border border-[rgb(var(--border-color))] transition-all duration-300 active:scale-[0.98] cursor-pointer"
                                                onClick={() => setSelectedEvent(event)}
                                            >
                                                {/* Event Image */}
                                                <div className="relative h-40 overflow-hidden">
                                                    <img 
                                                        src={posterImage.includes('?') ? posterImage : `${posterImage}?nocache=${Date.now()}`}
                                                        alt={event.name} 
                                                        className="w-full h-full object-cover transition-transform duration-300"
                                                        crossOrigin="anonymous"
                                                    />
                                                    <div className="absolute top-2 right-2 bg-cyan-500/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                                                        {date.split(',')[0]}
                                                    </div>
                                                </div>
                                                
                                                {/* Event Content */}
                                                <div className="p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                                        <h3 className="font-bold text-[rgb(var(--text-primary))] text-base leading-tight flex-1">
                                                            {event.name}
                                                        </h3>
                                                        {event.category && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 font-semibold whitespace-nowrap flex-shrink-0">
                                                                {t(`events.categories.${event.category}`, event.category)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Date & Time */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <span className="text-xs text-cyan-600 font-semibold">{date}</span>
                                                    </div>
                                                    
                                                    {expanded && time && (
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            <span className="text-xs text-[rgb(var(--text-secondary))]">{time}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Description */}
                                                    <p className={`text-xs text-[rgb(var(--text-secondary))] leading-relaxed mb-3 ${expanded ? 'line-clamp-none' : 'line-clamp-2'}`}>
                                                        {event.description}
                                                    </p>
                                                    
                                                    {/* Action Buttons */}
                                                    <div className="flex flex-col gap-2">
                                                        {expanded && (
                                                            <>
                                                                {event.website && (
                                                                    <a
                                                                        href={event.website}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center justify-center gap-2 bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                        </svg>
                                                                        {t('events.visit_website')}
                                                                    </a>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onShowOnMap(event); }}
                                                                    className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-cyan-600 transition-colors"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    </svg>
                                                                    {t('events.show_on_map')}
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setExpandedEventId(expanded ? null : event.id); }}
                                                            className="text-xs text-cyan-600 font-semibold py-1.5 flex items-center justify-center gap-1"
                                                        >
                                                            {expanded ? (
                                                                <>
                                                                    <span>{t('events.show_less')}</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                    </svg>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>{t('events.show_more')}</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Desktop / Larger screens: timeline */}
                        <div className="hidden md:block">
                            <div className="relative max-w-4xl mx-auto">
                                <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-[rgb(var(--border-color))] rounded-full"></div>
                                {filteredEvents.map((event, index) => {
                                    const { date, time } = formatDate(event.start_datetime, event.end_datetime);
                                    // image_urls is already parsed as an array from the fetchEvents function
                                    const imageUrls = Array.isArray(event.image_urls) ? event.image_urls : (event.image_urls ? [event.image_urls] : []);
                                    const posterImage = imageUrls.length > 0 ? `${getApiBaseUrl()}${imageUrls[0]}` : 'https://source.unsplash.com/random/800x600/?gozo';
                                    return (
                                        <div key={event.id} data-event-id={event.id} className="mb-12 flex items-center w-full">
                                            <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                                                <p className="text-cyan-600 font-semibold">{date}</p>
                                                <p className="text-[rgb(var(--text-secondary))] text-sm">{time}</p>
                                            </div>
                                            <div className="z-10 w-12 h-12 rounded-full bg-cyan-500 shadow-lg flex items-center justify-center text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <div className={`w-1/2 ${index % 2 === 0 ? 'pl-8' : 'pr-8'}`}>
                                                <div 
                                                    className="bg-[rgb(var(--card-bg))] rounded-lg shadow-xl overflow-hidden transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer"
                                                    onClick={() => setSelectedEvent(event)}
                                                >
                                                    <img 
                                                        src={posterImage.includes('?') ? posterImage : `${posterImage}?nocache=${Date.now()}`} 
                                                        alt={event.name} 
                                                        className="w-full h-56 object-cover"
                                                        crossOrigin="anonymous"
                                                    />
                                                    <div className="p-6">
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <h3 className="font-bold text-[rgb(var(--text-primary))] text-2xl flex-1">{event.name}</h3>
                                                            {event.category && (
                                                                <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-700 font-semibold whitespace-nowrap">
                                                                    {event.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[rgb(var(--text-secondary))] leading-relaxed mb-4 line-clamp-3">{event.description}</p>
                                                        <div className="flex items-center gap-4">
                                                            {event.website && (
                                                                <a 
                                                                    href={event.website} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="text-blue-600 hover:underline font-semibold"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {t('events.visit_website')}
                                                                </a>
                                                            )}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onShowOnMap(event); }}
                                                                className="bg-cyan-500 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-cyan-600 transition-all active:scale-95"
                                                            >
                                                                {t('events.show_on_map')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
            </div>
            
            {/* Event Detail Modal */}
            {selectedEvent && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedEvent(null)}
                    style={{ animation: 'fadeIn 0.3s ease-out' }}
                >
                    <div 
                        className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                        style={{ animation: 'slideUp 0.3s ease-out' }}
                    >
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex-1">
                                    <h2 className="text-3xl font-bold text-white mb-2">{selectedEvent.name}</h2>
                                    {selectedEvent.category && (
                                        <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-semibold">
                                            {t(`events.categories.${selectedEvent.category}`, selectedEvent.category)}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:text-red-300 transition-all duration-300 hover:scale-110 flex-shrink-0"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Event Image */}
                            {(() => {
                                const imageUrls = Array.isArray(selectedEvent.image_urls) ? selectedEvent.image_urls : (selectedEvent.image_urls ? [selectedEvent.image_urls] : []);
                                const posterImage = imageUrls.length > 0 ? `${getApiBaseUrl()}${imageUrls[0]}` : 'https://source.unsplash.com/random/800x600/?gozo';
                                return (
                                    <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                                        <img 
                                            src={posterImage.includes('?') ? posterImage : `${posterImage}?nocache=${Date.now()}`}
                                            alt={selectedEvent.name} 
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                        <div className="absolute top-4 right-4 bg-cyan-500/95 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
                                            {formatDate(selectedEvent.start_datetime, selectedEvent.end_datetime).date.split(',')[0]}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Date & Time */}
                            <div className="mb-6 space-y-3">
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-white/70 text-sm">Date</p>
                                        <p className="text-white font-semibold">{formatDate(selectedEvent.start_datetime, selectedEvent.end_datetime).date}</p>
                                    </div>
                                </div>
                                {formatDate(selectedEvent.start_datetime, selectedEvent.end_datetime).time && (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <p className="text-white/70 text-sm">Time</p>
                                            <p className="text-white font-semibold">{formatDate(selectedEvent.start_datetime, selectedEvent.end_datetime).time}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="mb-6">
                                <h3 className="text-white font-bold text-lg mb-3">About this Event</h3>
                                <p className="text-white/90 leading-relaxed">{selectedEvent.description}</p>
                            </div>

                            {/* Image Gallery */}
                            {(() => {
                                const imageUrls = Array.isArray(selectedEvent.image_urls) ? selectedEvent.image_urls : (selectedEvent.image_urls ? [selectedEvent.image_urls] : []);
                                if (imageUrls.length > 1) {
                                    return (
                                        <div className="mb-6">
                                            <h3 className="text-white font-bold text-lg mb-3">Gallery</h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                {imageUrls.slice(1, 7).map((url, index) => (
                                                    <img 
                                                        key={index}
                                                        src={`${getApiBaseUrl()}${url}`}
                                                        alt={`${selectedEvent.name} - Image ${index + 2}`}
                                                        className="w-full h-24 object-cover rounded-lg"
                                                        crossOrigin="anonymous"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {selectedEvent.website && (
                                    <a
                                        href={selectedEvent.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 bg-blue-500 text-white text-sm font-semibold py-3 px-6 rounded-xl hover:bg-blue-600 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        {t('events.visit_website')}
                                    </a>
                                )}
                                <button
                                    onClick={() => {
                                        onShowOnMap(selectedEvent);
                                        setSelectedEvent(null);
                                    }}
                                    className="flex items-center justify-center gap-2 bg-cyan-500 text-white text-sm font-semibold py-3 px-6 rounded-xl hover:bg-cyan-600 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {t('events.show_on_map')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventsPage;
