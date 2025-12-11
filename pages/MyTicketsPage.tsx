import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { ticketService } from '../services/ticketService';
import { tourService } from '../services/tourService';
import { getApiBaseUrl } from '../services/config';

interface Ticket {
    id: string;
    ticketNumber: string;
    tourName: string;
    tourId: string;
    tourDescription?: string;
    importantInfo?: string;
    date: string;
    participants: number;
    participantDetails?: string;
    adults?: number;
    children?: number;
    seniors?: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests: string;
    totalPaid: number;
    status: 'confirmed' | 'completed' | 'cancelled';
    createdAt: string;
    image?: string;
    qrCode?: string;
}

interface MyTicketsPageProps {
    onBack: () => void;
}

const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [qrCodeLoading, setQrCodeLoading] = useState<string | null>(null);
    const [tourData, setTourData] = useState<{ [key: string]: any }>({});

    useEffect(() => {
        const loadTickets = async () => {
            // Force console logs to appear
            console.log('%c=== MY TICKETS PAGE: Loading tickets ===', 'background: #222; color: #bada55; font-size: 16px; padding: 4px;');
            console.log('User object:', user);
            console.log('User ID:', user?.id);
            console.log('Is user authenticated:', !!user?.id);
            console.log('API Base URL:', getApiBaseUrl());
            
            try {
                if (!user?.id) {
                    console.warn('%c⚠️ USER NOT AUTHENTICATED - Cannot load tickets', 'background: #ff0000; color: white; padding: 4px; font-weight: bold;');
                    setTickets([]);
                    setIsLoading(false);
                    return;
                }
                
                console.log('%c🚀 Loading tickets from backend for user: ' + user.id, 'background: #0066cc; color: white; padding: 4px; font-weight: bold;');
                console.log('API URL will be:', `${getApiBaseUrl()}/api/admin/user/${user.id}/reservations`);
                
                // Load tickets from backend
                const userTickets = await ticketService.getUserTickets(user.id);
                    console.log('%c=== TICKETS LOADED ===', 'background: #00cc00; color: white; font-size: 14px; padding: 4px;');
                    console.log('Number of tickets:', userTickets.length);
                    console.log('Tickets with images:', userTickets.filter(t => t.image).length);
                    userTickets.forEach((ticket, idx) => {
                        const hasImage = ticket.image ? '✅ HAS IMAGE' : '❌ NO IMAGE';
                        console.log(`%cTicket ${idx + 1}: "${ticket.tourName}" - ${hasImage}: ${ticket.image || 'NONE'}`, 
                            ticket.image ? 'color: green; font-weight: bold;' : 'color: red; font-weight: bold;');
                    });
                    setTickets(userTickets);
                    
                    // Load tour data for each ticket
                    // Use the same method as ExcursionsPage - load by category and find matching tour
                    const tourDataMap: { [key: string]: any } = {};
                    
                    // NO HARDCODED MAPPINGS - Get categories dynamically from API
                    let allCategories: string[] = [];
                    try {
                        const categoriesResponse = await fetch(`${getApiBaseUrl()}/api/tour-categories`);
                        if (categoriesResponse.ok) {
                            const categoriesData = await categoriesResponse.json();
                            allCategories = categoriesData.map((cat: any) => cat.id);
                            console.log(`📋 Available tour categories from API:`, allCategories);
                        }
                    } catch (error) {
                        console.error('Error fetching tour categories:', error);
                        // Fallback to common categories if API fails
                        allCategories = ['sightseeing', 'boat-tour', 'jeep-tours', 'quad-tours', 'hiking', 'parasailing'];
                    }
                    
                    // Group tickets by category - dynamically infer from tour name
                    const ticketsByCategory: { [category: string]: Ticket[] } = {};
                    for (const ticket of userTickets) {
                        let category: string | null = null;
                        
                        // Dynamically infer category from tour name (no hardcoding)
                        if (ticket.tourName) {
                            const tourNameLower = ticket.tourName.toLowerCase().trim();
                            
                            // Check against all available categories to find the best match
                            for (const cat of allCategories) {
                                const catLower = cat.toLowerCase();
                                // Simple keyword matching - if tour name contains category keywords
                                if ((catLower.includes('jeep') && (tourNameLower.includes('jeep') || tourNameLower.includes('adventure'))) ||
                                    (catLower.includes('boat') && (tourNameLower.includes('boat') || tourNameLower.includes('comino')) && !tourNameLower.includes('walk')) ||
                                    (catLower.includes('quad') && (tourNameLower.includes('quad') || tourNameLower.includes('coastal'))) ||
                                    (catLower.includes('hiking') && (tourNameLower.includes('walk') || tourNameLower.includes('hiking') || tourNameLower.includes('trail'))) ||
                                    (catLower.includes('parasailing') && tourNameLower.includes('parasailing')) ||
                                    (catLower.includes('sightseeing') && (tourNameLower.includes('bus') || tourNameLower.includes('sightseeing')))) {
                                    category = cat;
                                    console.log(`✅ Detected category "${cat}" for "${ticket.tourName}"`);
                                    break;
                                }
                            }
                        }
                        
                        // If still no category, default to first available or sightseeing
                        if (!category) {
                            category = allCategories[0] || 'sightseeing';
                            console.log(`📋 Using default category "${category}" for "${ticket.tourName}"`);
                        }
                        
                        if (!ticketsByCategory[category]) {
                            ticketsByCategory[category] = [];
                        }
                        ticketsByCategory[category].push(ticket);
                    }
                    
                    console.log(`📊 Tickets grouped by category:`, Object.keys(ticketsByCategory).map(cat => `${cat}: ${ticketsByCategory[cat].length} tickets`));
                    
                    // Load tours for each category (same way as ExcursionsPage)
                    for (const [category, tickets] of Object.entries(ticketsByCategory)) {
                        try {
                            console.log(`Loading tours for category: ${category}`);
                            const response = await fetch(`${getApiBaseUrl()}/api/tours/${category}`);
                            if (response.ok) {
                                const tours = await response.json();
                                console.log(`Loaded ${tours.length} tours for category ${category}`);
                                
                                // Find matching tours for each ticket - match by tour name (same as ExcursionsPage)
                                for (const ticket of tickets) {
                                    console.log(`\n🔍 Looking for tour for ticket:`, {
                                        ticketId: ticket.id,
                                        ticketTourId: ticket.tourId,
                                        ticketTourName: ticket.tourName,
                                        category: category
                                    });
                                    
                                    if (!ticket.tourName) {
                                        console.warn(`⚠️ Ticket ${ticket.id} has no tourName`);
                                        continue;
                                    }
                                    
                                    console.log(`📋 Available tours in category "${category}":`, tours.map((t: any) => ({
                                        id: t.id,
                                        name: t.name,
                                        mainImage: t.mainImage,
                                        images: t.images?.[0]
                                    })));
                                    
                                    // Try to find matching tour - NO HARDCODED MAPPINGS
                                    let matchingTour = null;
                                    
                                    // First try: exact name match
                                    matchingTour = tours.find((tour: any) => {
                                        if (!tour.name) return false;
                                        return tour.name.toLowerCase().trim() === ticket.tourName.toLowerCase().trim();
                                    });
                                    if (matchingTour) {
                                        console.log(`✅ Matched by exact name: "${matchingTour.name}"`);
                                    }
                                    
                                    // Second try: flexible name matching (keyword-based)
                                    if (!matchingTour) {
                                        const ticketNameLower = ticket.tourName.toLowerCase().trim();
                                        const commonWords = ['tour', 'bus', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'];
                                        const ticketWords = ticketNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
                                        
                                        matchingTour = tours.find((tour: any) => {
                                            if (!tour.name) return false;
                                            const tourNameLower = tour.name.toLowerCase().trim();
                                            const tourWords = tourNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
                                            
                                            // Check if significant words match
                                            const matchingWords = ticketWords.filter(w => tourWords.includes(w));
                                            const hasSignificantMatch = matchingWords.length > 0 && matchingWords.length >= Math.min(2, Math.min(ticketWords.length, tourWords.length));
                                            
                                            // Also check if one contains the other
                                            const containsMatch = tourNameLower.includes(ticketNameLower) || ticketNameLower.includes(tourNameLower);
                                            
                                            return hasSignificantMatch || containsMatch;
                                        });
                                        if (matchingTour) {
                                            console.log(`✅ Matched by flexible name matching: "${matchingTour.name}"`);
                                        }
                                    }
                                    
                                    // Third try: match by tour ID if ticket has a tour ID that matches
                                    if (!matchingTour && ticket.tourId) {
                                        matchingTour = tours.find((tour: any) => tour.id === ticket.tourId);
                                        if (matchingTour) {
                                            console.log(`✅ Matched by tour ID: ${matchingTour.id}`);
                                        }
                                    }
                                    
                                    if (matchingTour) {
                                        // Use the SAME image logic as ExcursionsPage: mainImage || images[0]
                                        const imageUrl = matchingTour.mainImage || matchingTour.images?.[0];
                                        
                                        console.log(`🖼️ Image URL for tour "${matchingTour.name}":`, imageUrl);
                                        console.log(`   mainImage: ${matchingTour.mainImage || 'none'}`);
                                        console.log(`   images array: ${matchingTour.images?.length || 0} images`);
                                        
                                        // Store the tour with the image (same format as ExcursionsPage)
                                        // Store by multiple keys for easy lookup
                                        tourDataMap[ticket.tourId] = {
                                            ...matchingTour,
                                            mainImage: imageUrl // Store the resolved image (mainImage || images[0])
                                        };
                                        
                                        // Also store by tour's actual ID
                                        if (matchingTour.id && matchingTour.id !== ticket.tourId) {
                                            tourDataMap[matchingTour.id] = {
                                                ...matchingTour,
                                                mainImage: imageUrl
                                            };
                                        }
                                        
                                        // Also store by tour name (normalized) for easy lookup
                                        if (matchingTour.name) {
                                            const normalizedName = matchingTour.name.toLowerCase().trim().replace(/\s+/g, '-');
                                            tourDataMap[normalizedName] = {
                                                ...matchingTour,
                                                mainImage: imageUrl
                                            };
                                        }
                                        
                                        console.log(`✅ FINAL: Stored tour data for ticket "${ticket.tourName}" with image: ${imageUrl || 'NONE'}`);
                                        console.log(`   Stored under keys: ${ticket.tourId}, ${matchingTour.id}, ${matchingTour.name?.toLowerCase().trim().replace(/\s+/g, '-')}`);
                                    } else {
                                        console.error(`❌ FAILED: No matching tour found for ticket "${ticket.tourName}" in category ${category}`);
                                        console.error(`   Ticket tourId: ${ticket.tourId}`);
                                        console.error(`   Expected tour IDs: ${expectedTourIds.join(', ')}`);
                                        console.error(`   Available tour names:`, tours.map((t: any) => t.name));
                                        console.error(`   Available tour IDs:`, tours.map((t: any) => t.id));
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`Error loading tours for category ${category}:`, error);
                        }
                    }
                    
                    console.log('=== FINAL TOUR DATA MAP ===');
                    console.log('Tour data entries:', Object.keys(tourDataMap).length);
                    Object.entries(tourDataMap).forEach(([key, tour]) => {
                        console.log(`Tour ${key}: "${tour.name}" - mainImage: ${tour.mainImage || 'NONE'}`);
                    });
                    setTourData(tourDataMap);
            } catch (error) {
                console.error('%c❌ ERROR loading tickets:', 'background: #ff0000; color: white; padding: 4px; font-weight: bold;', error);
                // Don't fallback to localStorage - require authentication
                setTickets([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadTickets();
    }, [user?.id]);

    const loadQRCode = async (ticketId: string, ticketNumber: string) => {
        setQrCodeLoading(ticketId);
        try {
            const qrCode = await ticketService.generateQRCode(ticketNumber);
            
            // Update tickets array
            setTickets(prevTickets => 
                prevTickets.map(t => 
                    t.id === ticketId ? { ...t, qrCode } : t
                )
            );
            
            // Update selectedTicket if it matches
            setSelectedTicket(prevSelected => {
                if (prevSelected && prevSelected.id === ticketId) {
                    return { ...prevSelected, qrCode };
                }
                return prevSelected;
            });
            
        } catch (error) {
            console.error('Error loading QR code:', error);
        } finally {
            setQrCodeLoading(null);
        }
    };

    // Auto-load QR code when ticket is selected
    const handleTicketSelect = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        // Automatically load QR code when ticket is selected
        if (!ticket.qrCode) {
            loadQRCode(ticket.id, ticket.ticketNumber);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'completed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'cancelled':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed':
                return '✅';
            case 'completed':
                return '🎉';
            case 'cancelled':
                return '❌';
            default:
                return '⏳';
        }
    };

    // Helper function to get the image URL for a ticket
    // Uses the same logic as ExcursionsPage
    const getTicketImageUrl = (ticket: Ticket): string | undefined => {
        console.log('=== getTicketImageUrl called ===');
        console.log('Ticket:', ticket);
        console.log('Ticket tourId:', ticket.tourId);
        console.log('Ticket image:', ticket.image);
        console.log('TourData keys:', Object.keys(tourData));
        console.log('TourData for ticket.tourId:', tourData[ticket.tourId]);
        
        // First try to get image from ticket.image
        let imageUrl = ticket.image;
        console.log('Image from ticket.image:', imageUrl);
        
        // If no image in ticket, try to get it from tourData (same as ExcursionsPage)
        if (!imageUrl && tourData[ticket.tourId]) {
            const tour = tourData[ticket.tourId];
            console.log('Tour from tourData:', tour);
            console.log('Tour mainImage:', tour.mainImage);
            console.log('Tour images:', tour.images);
            imageUrl = tour.mainImage || tour.images?.[0];
            console.log('Image from tourData:', imageUrl);
        }
        
        // Filter out Unsplash URLs and empty strings
        if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('unsplash.com') || imageUrl.includes('source.unsplash')) {
            console.log('Image filtered out or empty');
            return undefined;
        }
        
        // Use the exact same URL formatting as ExcursionsPage
        const finalUrl = `${(imageUrl.startsWith('/uploads/') ? getApiBaseUrl() : '')}${imageUrl}`;
        console.log('Final image URL:', finalUrl);
        return finalUrl;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-[rgb(var(--text-secondary))]">Loading your tickets...</p>
                </div>
            </div>
        );
    }

    // Show login prompt if user is not authenticated
    if (!user) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-8">
                    <div className="max-w-6xl mx-auto px-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-white/80 hover:text-white transition-colors mb-4"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Excursions
                        </button>
                        <h1 className="text-4xl font-bold mb-2">My Tickets</h1>
                        <p className="text-xl text-white/90">Please log in to view your tickets</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">Login Required</h2>
                        <p className="text-[rgb(var(--text-secondary))] mb-6">
                            You need to be logged in to view your tickets. Please log in to access your tour bookings.
                        </p>
                        <button
                            onClick={onBack}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            Back to Excursions
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-8">
                <div className="max-w-6xl mx-auto px-6">
                    <button
                        onClick={onBack}
                        className="flex items-center text-white/80 hover:text-white transition-colors mb-4"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Excursions
                    </button>
                    <h1 className="text-4xl font-bold mb-2">My Tickets</h1>
                    <p className="text-xl text-white/90">All your tour bookings in one place</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {tickets.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">No Tickets Yet</h2>
                        <p className="text-[rgb(var(--text-secondary))] mb-6">
                            You haven't booked any tours yet. Start exploring Gozo and book your first adventure!
                        </p>
                        <button
                            onClick={onBack}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            Browse Tours
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl p-4 md:p-6 text-center border border-[rgb(var(--border-color))]">
                                <div className="text-2xl md:text-3xl font-bold text-cyan-600 mb-2">{tickets.length}</div>
                                <div className="text-xs md:text-sm text-[rgb(var(--text-secondary))]">Total Tickets</div>
                            </div>
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl p-4 md:p-6 text-center border border-[rgb(var(--border-color))]">
                                <div className="text-2xl md:text-3xl font-bold text-green-600 mb-2">
                                    {tickets.filter(t => t.status === 'confirmed').length}
                                </div>
                                <div className="text-xs md:text-sm text-[rgb(var(--text-secondary))]">Confirmed</div>
                            </div>
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl p-4 md:p-6 text-center border border-[rgb(var(--border-color))]">
                                <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-2">
                                    {tickets.filter(t => t.status === 'completed').length}
                                </div>
                                <div className="text-xs md:text-sm text-[rgb(var(--text-secondary))]">Completed</div>
                            </div>
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl p-4 md:p-6 text-center border border-[rgb(var(--border-color))]">
                                <div className="text-2xl md:text-3xl font-bold text-cyan-600 mb-2">
                                    {tickets.reduce((sum, t) => sum + t.totalPaid, 0).toFixed(2)}€
                                </div>
                                <div className="text-xs md:text-sm text-[rgb(var(--text-secondary))]">Total Spent</div>
                            </div>
                        </div>

                        {/* Tickets List */}
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="bg-[rgb(var(--card-bg))] rounded-xl border border-[rgb(var(--border-color))] overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                    onClick={() => handleTicketSelect(ticket)}
                                >
                                    <div className="flex">
                                        {/* Tour Image - Same logic as ExcursionsPage */}
                                        {(() => {
                                            // Debug: Log what we have - FORCE VISIBLE
                                            const debugInfo = {
                                                ticketId: ticket.id,
                                                tourName: ticket.tourName,
                                                ticketImage: ticket.image,
                                                ticketImageType: typeof ticket.image,
                                                ticketImageLength: ticket.image?.length || 0,
                                                tourId: ticket.tourId,
                                                tourDataExists: !!tourData[ticket.tourId],
                                                tourDataImage: tourData[ticket.tourId]?.mainImage || tourData[ticket.tourId]?.images?.[0],
                                                tourDataKeys: Object.keys(tourData)
                                            };
                                            console.log(`%c[MyTicketsPage] Image lookup for "${ticket.tourName}"`, 'background: #ff6600; color: white; padding: 4px; font-weight: bold;', debugInfo);
                                            
                                            // Also log to page for debugging
                                            if (process.env.NODE_ENV === 'development') {
                                                console.table(debugInfo);
                                            }
                                            
                                            // FIRST: Check if ticket.image is a generic category image (should be ignored)
                                            const genericImages = ['bus-tour.jpg', 'quad-bike.jpg', 'comino-boat.jpg', 'hiking-trail.jpg', 'parasailing.jpg'];
                                            const isGenericImage = ticket.image && genericImages.some(gen => ticket.image.includes(gen));
                                            
                                            if (isGenericImage) {
                                                console.log(`%c[MyTicketsPage] ⚠️ Ignoring generic category image: ${ticket.image}`, 'background: #ff9900; color: white; padding: 4px; font-weight: bold;');
                                            }
                                            
                                            // Use ticket.image from backend ONLY if it's not a generic category image
                                            let imageUrl = null;
                                            if (ticket.image && !isGenericImage) {
                                                imageUrl = ticket.image;
                                                // Filter out empty strings, null, undefined - be very strict
                                                if (!imageUrl || 
                                                    typeof imageUrl !== 'string' || 
                                                    imageUrl.trim() === '' || 
                                                    imageUrl === 'null' || 
                                                    imageUrl === 'undefined' ||
                                                    imageUrl === '""' ||
                                                    imageUrl.length === 0) {
                                                    imageUrl = null;
                                                } else {
                                                    console.log(`%c[MyTicketsPage] ✅ Using backend image (not generic): ${imageUrl}`, 'background: #00cc00; color: white; padding: 4px;');
                                                }
                                            }
                                            
                                            // SECOND: ALWAYS use tourData if ticket.image is generic or not available
                                            if (!imageUrl || isGenericImage) {
                                                console.log(`%c[MyTicketsPage] 🔍 Looking in tourData for "${ticket.tourName}" (tourId: ${ticket.tourId})`, 'background: #0066cc; color: white; padding: 4px; font-weight: bold;');
                                                console.log(`[MyTicketsPage] tourData keys:`, Object.keys(tourData));
                                                console.log(`[MyTicketsPage] tourData entries:`, Object.entries(tourData).map(([key, t]: [string, any]) => ({ key, id: t.id, name: t.name, hasImage: !!(t.mainImage || t.images?.[0]) })));
                                                
                                                // Try multiple ways to find the tour in tourData
                                                let tour = null;
                                                
                                                // Method 1: Find by normalized name key FIRST (most reliable - tourData keys are normalized IDs)
                                                // e.g., "Gozo Jeep Tour" -> "gozo-jeep-tour" matches key "gozo-jeep-tour"
                                                if (ticket.tourName) {
                                                    const normalizedTicketName = ticket.tourName.toLowerCase().trim().replace(/\s+/g, '-');
                                                    console.log(`[MyTicketsPage] Trying normalized key lookup: "${normalizedTicketName}"`);
                                                    
                                                    // Try exact normalized match first
                                                    if (tourData[normalizedTicketName]) {
                                                        tour = tourData[normalizedTicketName];
                                                        console.log(`%c✅✅✅ Found tour in tourData by EXACT normalized key: "${normalizedTicketName}"`, 'background: #00cc00; color: white; padding: 6px; font-weight: bold; font-size: 14px;');
                                                    }
                                                    // Try partial normalized match (check if any key contains the normalized name or vice versa)
                                                    if (!tour) {
                                                        for (const [key, t] of Object.entries(tourData)) {
                                                            const keyLower = key.toLowerCase();
                                                            if (keyLower === normalizedTicketName || 
                                                                keyLower.includes(normalizedTicketName) || 
                                                                normalizedTicketName.includes(keyLower)) {
                                                                tour = t as any;
                                                                console.log(`%c✅ Found tour in tourData by partial normalized key match: "${key}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                
                                                // Method 2: Find by tour name (exact match)
                                                if (!tour) {
                                                    tour = Object.values(tourData).find((t: any) => 
                                                        t.name?.toLowerCase().trim() === ticket.tourName?.toLowerCase().trim()
                                                    ) as any;
                                                    if (tour) {
                                                        console.log(`%c✅ Found tour in tourData by EXACT name match: "${tour.name}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                    }
                                                }
                                                
                                                // Method 2: Find by normalized name key (e.g., "gozo jeep tour" -> "gozo-jeep-tour")
                                                if (!tour && ticket.tourName) {
                                                    const normalizedTicketName = ticket.tourName.toLowerCase().trim().replace(/\s+/g, '-');
                                                    // Try exact normalized match
                                                    if (tourData[normalizedTicketName]) {
                                                        tour = tourData[normalizedTicketName];
                                                        console.log(`%c✅ Found tour in tourData by normalized name key: "${normalizedTicketName}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                    }
                                                    // Try partial normalized match (check if any key contains the normalized name)
                                                    if (!tour) {
                                                        for (const [key, t] of Object.entries(tourData)) {
                                                            if (key.includes(normalizedTicketName) || normalizedTicketName.includes(key)) {
                                                                tour = t as any;
                                                                console.log(`%c✅ Found tour in tourData by partial normalized key match: "${key}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                
                                                // Method 3: Find by tour name (flexible keyword match)
                                                if (!tour && ticket.tourName) {
                                                    const ticketNameLower = ticket.tourName.toLowerCase().trim();
                                                    const commonWords = ['tour', 'bus', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'];
                                                    const ticketWords = ticketNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
                                                    
                                                    tour = Object.values(tourData).find((t: any) => {
                                                        if (!t.name) return false;
                                                        const tourNameLower = t.name.toLowerCase().trim();
                                                        const tourWords = tourNameLower.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
                                                        
                                                        // Check if significant words match
                                                        const matchingWords = ticketWords.filter(w => tourWords.includes(w));
                                                        const hasSignificantMatch = matchingWords.length > 0 && matchingWords.length >= Math.min(2, Math.min(ticketWords.length, tourWords.length));
                                                        
                                                        // Also check if one contains the other
                                                        const containsMatch = tourNameLower.includes(ticketNameLower) || ticketNameLower.includes(tourNameLower);
                                                        
                                                        return hasSignificantMatch || containsMatch;
                                                    }) as any;
                                                    
                                                    if (tour) {
                                                        console.log(`%c✅ Found tour in tourData by KEYWORD match: "${tour.name}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                    }
                                                }
                                                
                                                // Method 4: Direct key match by ticket.tourId
                                                if (!tour && tourData[ticket.tourId]) {
                                                    tour = tourData[ticket.tourId];
                                                    console.log(`%c✅ Found tour in tourData by ticket.tourId key: ${ticket.tourId}`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                }
                                                
                                                // Method 4: Find by tour ID in tour data (check both tour.id and tourData keys)
                                                if (!tour) {
                                                    // First, try to find by tour.id matching ticket.tourId
                                                    tour = Object.values(tourData).find((t: any) => 
                                                        t.id === ticket.tourId || 
                                                        t.id?.toLowerCase() === ticket.tourName?.toLowerCase()
                                                    ) as any;
                                                    
                                                    // Also try direct key lookup by normalized ticket name
                                                    if (!tour && ticket.tourName) {
                                                        const normalizedName = ticket.tourName.toLowerCase().trim().replace(/\s+/g, '-');
                                                        // Check if any tourData key matches the normalized name
                                                        for (const [key, t] of Object.entries(tourData)) {
                                                            if (key === normalizedName || key.includes(normalizedName) || normalizedName.includes(key)) {
                                                                tour = t as any;
                                                                console.log(`%c✅ Found tour in tourData by key match: "${key}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    
                                                    // Also check if tour.id matches normalized ticket name
                                                    if (!tour && ticket.tourName) {
                                                        const normalizedName = ticket.tourName.toLowerCase().trim().replace(/\s+/g, '-');
                                                        tour = Object.values(tourData).find((t: any) => 
                                                            t.id?.toLowerCase() === normalizedName
                                                        ) as any;
                                                        if (tour) {
                                                            console.log(`%c✅ Found tour in tourData by tour.id match: "${tour.id}"`, 'background: #00cc00; color: white; padding: 4px; font-weight: bold;');
                                                        }
                                                    }
                                                }
                                                
                                                if (tour) {
                                                    imageUrl = tour.mainImage || tour.images?.[0];
                                                    console.log(`%c[MyTicketsPage] ✅✅✅ USING tourData image: ${imageUrl}`, 'background: #00cc00; color: white; padding: 8px; font-weight: bold; font-size: 14px;');
                                                    // Filter out empty strings from tourData too
                                                    if (imageUrl && (
                                                        typeof imageUrl !== 'string' || 
                                                        imageUrl.trim() === '' || 
                                                        imageUrl === 'null' || 
                                                        imageUrl === 'undefined' ||
                                                        imageUrl === '""' ||
                                                        imageUrl.length === 0
                                                    )) {
                                                        imageUrl = null;
                                                        console.warn(`%c[MyTicketsPage] ⚠️ tourData image is empty/invalid`, 'background: #ff9900; color: white; padding: 4px;');
                                                    }
                                                } else {
                                                    console.warn(`%c[MyTicketsPage] ❌❌❌ NO tour found in tourData for ticket.tourId="${ticket.tourId}", tourName="${ticket.tourName}"`, 'background: #ff0000; color: white; padding: 4px; font-weight: bold;');
                                                    console.warn(`[MyTicketsPage] Available tourData:`, Object.entries(tourData).map(([key, t]: [string, any]) => ({ key, id: t.id, name: t.name, mainImage: t.mainImage || t.images?.[0] || 'NONE' })));
                                                }
                                            }
                                            
                                            // Validate image URL before attempting to render
                                            const isValidImageUrl = imageUrl && 
                                                typeof imageUrl === 'string' && 
                                                imageUrl.trim() !== '' && 
                                                imageUrl.trim().length > 0 &&
                                                !imageUrl.includes('unsplash.com') && 
                                                !imageUrl.includes('source.unsplash');
                                            
                                            if (isValidImageUrl) {
                                                // Same URL formatting as ExcursionsPage
                                                const finalUrl = imageUrl.startsWith('/uploads/') 
                                                    ? `${getApiBaseUrl()}${imageUrl}` 
                                                    : imageUrl.startsWith('http') 
                                                        ? imageUrl 
                                                        : `${getApiBaseUrl()}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                                                
                                                console.log(`[MyTicketsPage] ✅ Rendering image for "${ticket.tourName}": ${finalUrl}`);
                                                return (
                                                    <div className="w-32 h-32 flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-100">
                                                        <img 
                                                            src={finalUrl} 
                                                            alt={ticket.tourName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                console.error(`[MyTicketsPage] ❌ Failed to load image: ${finalUrl}`);
                                                                // Replace with placeholder on error instead of hiding
                                                                const container = (e.target as HTMLImageElement).parentElement;
                                                                if (container) {
                                                                    container.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs">No Image</div>';
                                                                }
                                                            }}
                                                            onLoad={() => {
                                                                console.log(`[MyTicketsPage] ✅ Successfully loaded image: ${finalUrl}`);
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            }
                                            
                                            // Show placeholder immediately when no valid image exists
                                            const debugMsg = `No image: ticket.image="${ticket.image || 'null'}" (type: ${typeof ticket.image}), tourData=${!!tourData[ticket.tourId]}, tourDataImage="${tourData[ticket.tourId]?.mainImage || tourData[ticket.tourId]?.images?.[0] || 'none'}"`;
                                            console.warn(`%c[MyTicketsPage] ⚠️ No valid image for "${ticket.tourName}"`, 'background: #ff0000; color: white; padding: 4px; font-weight: bold;', {
                                                ticketImage: ticket.image,
                                                ticketImageType: typeof ticket.image,
                                                ticketImageIsEmpty: !ticket.image || ticket.image.trim() === '',
                                                tourDataImage: tourData[ticket.tourId]?.mainImage || tourData[ticket.tourId]?.images?.[0] || 'none',
                                                tourDataExists: !!tourData[ticket.tourId],
                                                tourDataKeys: Object.keys(tourData),
                                                allTicketImages: tickets.map(t => ({ name: t.tourName, image: t.image }))
                                            });
                                            return (
                                                <div className="w-32 h-32 flex-shrink-0 bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs" title={debugMsg}>
                                                    <div className="text-center">
                                                        <div>No Image</div>
                                                        <div className="text-[8px] mt-1 opacity-75">{ticket.tourName}</div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        
                                        {/* Ticket Content */}
                                        <div className="flex-1 p-6">
                                            {/* Large Screen Layout */}
                                            <div className="hidden md:block">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3 mb-2">
                                                            <h3 className="text-xl font-bold text-[rgb(var(--text-primary))]">
                                                                {ticket.tourName}
                                                            </h3>
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                                                                {getStatusIcon(ticket.status)} {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[rgb(var(--text-secondary))] mb-3">
                                                            {new Date(ticket.date).toLocaleDateString('en-US', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-cyan-600 mb-1">
                                                            €{ticket.totalPaid.toFixed(2)}
                                                        </div>
                                                        <div className="text-sm text-[rgb(var(--text-secondary))]">
                                                            {ticket.participants} {ticket.participants === 1 ? 'person' : 'people'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-[rgb(var(--text-secondary))]">Ticket Number:</span>
                                                        <div className="font-mono font-bold text-[rgb(var(--text-primary))] mt-1">
                                                            {ticket.ticketNumber}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[rgb(var(--text-secondary))]">Customer:</span>
                                                        <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                            {ticket.customerName}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[rgb(var(--text-secondary))]">Contact:</span>
                                                        <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                            {ticket.customerPhone}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Small Screen Layout */}
                                            <div className="md:hidden">
                                                {/* Header with title and status */}
                                                <div className="mb-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="text-lg font-bold text-[rgb(var(--text-primary))] flex-1 pr-2">
                                                            {ticket.tourName}
                                                        </h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(ticket.status)}`}>
                                                            {getStatusIcon(ticket.status)} {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[rgb(var(--text-secondary))] text-sm">
                                                        {new Date(ticket.date).toLocaleDateString('en-US', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                </div>

                                                {/* Price and participants row */}
                                                <div className="flex items-center justify-between mb-4 p-3 bg-[rgb(var(--bg-light))] rounded-lg">
                                                    <div>
                                                        <div className="text-lg font-bold text-cyan-600">
                                                            €{ticket.totalPaid.toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-[rgb(var(--text-secondary))]">
                                                            {ticket.participants} {ticket.participants === 1 ? 'person' : 'people'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-[rgb(var(--text-secondary))]">Ticket #</div>
                                                        <div className="font-mono font-bold text-[rgb(var(--text-primary))] text-sm">
                                                            {ticket.ticketNumber}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Customer info */}
                                                <div className="grid grid-cols-1 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-[rgb(var(--text-secondary))]">Customer:</span>
                                                        <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                            {ticket.customerName}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[rgb(var(--text-secondary))]">Contact:</span>
                                                        <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                            {ticket.customerPhone}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {ticket.specialRequests && (
                                                <div className="mt-4 p-3 bg-[rgb(var(--bg-light))] rounded-lg">
                                                    <span className="text-sm font-medium text-[rgb(var(--text-secondary))]">Special Requests:</span>
                                                    <p className="text-sm text-[rgb(var(--text-primary))] mt-1">{ticket.specialRequests}</p>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
                    <div className="bg-[rgb(var(--card-bg))] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">Ticket Details</h2>
                                <button
                                    onClick={() => setSelectedTicket(null)}
                                    className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Tour Image Section - Use ticket.image first, then fall back to tourData */}
                                {(() => {
                                    // FIRST: Use ticket.image from backend (this is the correct tour image from JSON file)
                                    let imageUrl = selectedTicket?.image;
                                    
                                    // Filter out empty strings, null, undefined
                                    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '' || imageUrl === 'null' || imageUrl === 'undefined') {
                                        imageUrl = null;
                                    }
                                    
                                    // SECOND: Fall back to tourData if ticket.image is not available
                                    if (!imageUrl && selectedTicket) {
                                        const tour = tourData[selectedTicket.tourId];
                                        imageUrl = tour?.mainImage || tour?.images?.[0];
                                        // Filter out empty strings from tourData too
                                        if (imageUrl && (typeof imageUrl !== 'string' || imageUrl.trim() === '' || imageUrl === 'null' || imageUrl === 'undefined')) {
                                            imageUrl = null;
                                        }
                                    }
                                    
                                    // Validate image URL before attempting to render
                                    const isValidImageUrl = imageUrl && 
                                        typeof imageUrl === 'string' && 
                                        imageUrl.trim() !== '' && 
                                        !imageUrl.includes('unsplash.com') && 
                                        !imageUrl.includes('source.unsplash');
                                    
                                    if (isValidImageUrl) {
                                        // Same URL formatting as ExcursionsPage
                                        const finalUrl = `${(imageUrl.startsWith('/uploads/') ? getApiBaseUrl() : '')}${imageUrl}`;
                                        console.log(`[MyTicketsPage Modal] Displaying image for "${selectedTicket.tourName}": ${finalUrl}`);
                                        return (
                                            <div className="text-center">
                                                <div className="flex justify-center">
                                                    <img 
                                                        src={finalUrl} 
                                                        alt={selectedTicket.tourName}
                                                        className="w-full max-w-lg h-64 object-cover rounded-xl border border-[rgb(var(--border-color))]"
                                                        onError={(e) => {
                                                            console.error(`[MyTicketsPage Modal] Failed to load image: ${finalUrl}`);
                                                            // Hide the image container on error
                                                            const container = (e.target as HTMLImageElement).parentElement?.parentElement;
                                                            if (container) {
                                                                container.style.display = 'none';
                                                            }
                                                        }}
                                                        onLoad={() => {
                                                            console.log(`[MyTicketsPage Modal] Successfully loaded image: ${finalUrl}`);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    // Show placeholder immediately when no valid image exists
                                    console.log(`[MyTicketsPage Modal] No valid image for "${selectedTicket.tourName}"`);
                                    return (
                                        <div className="text-center">
                                            <div className="flex justify-center">
                                                <div className="w-full max-w-lg h-64 bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white rounded-xl border border-[rgb(var(--border-color))]">
                                                    No Image Available
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-6 rounded-xl text-center">
                                    <h3 className="text-xl font-semibold mb-2">Your Ticket</h3>
                                    <div className="text-4xl font-mono font-bold tracking-wider">
                                        {selectedTicket.ticketNumber}
                                    </div>
                                    <p className="text-sm opacity-90 mt-2">Show this to your tour guide</p>
                                </div>

                                {/* QR Code Section */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">QR Code</h3>
                                    {selectedTicket.qrCode ? (
                                        <div className="flex flex-col items-center">
                                            <img 
                                                src={selectedTicket.qrCode} 
                                                alt="Ticket QR Code"
                                                className="w-48 h-48 border border-gray-300 rounded-lg"
                                            />
                                            <p className="text-sm text-gray-600 mt-3">
                                                Scan this QR code for quick ticket validation
                                            </p>
                                        </div>
                                    ) : qrCodeLoading === selectedTicket.id ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-48 h-48 border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                                                <div className="flex flex-col items-center space-y-3">
                                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm text-gray-600">Generating QR Code...</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-3">
                                                Please wait while we generate your QR code
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <div className="w-48 h-48 border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                                                <div className="flex flex-col items-center space-y-3">
                                                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                    </svg>
                                                    <span className="text-sm text-gray-600">QR Code will appear here</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-3">
                                                QR code is being generated automatically
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Customer Details Section */}
                                <div className="bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-4">Customer Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-[rgb(var(--text-secondary))]">Name:</span>
                                            <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                {selectedTicket.customerName}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[rgb(var(--text-secondary))]">Email:</span>
                                            <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                {selectedTicket.customerEmail}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[rgb(var(--text-secondary))]">Phone:</span>
                                            <div className="font-medium text-[rgb(var(--text-primary))] mt-1">
                                                {selectedTicket.customerPhone}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[rgb(var(--text-secondary))]">Ticket Number:</span>
                                            <div className="font-mono font-bold text-[rgb(var(--text-primary))] mt-1">
                                                {selectedTicket.ticketNumber}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {selectedTicket.specialRequests && (
                                        <div className="mt-4 p-3 bg-[rgb(var(--card-bg))] rounded-lg">
                                            <span className="text-sm font-medium text-[rgb(var(--text-secondary))]">Special Requests:</span>
                                            <p className="text-sm text-[rgb(var(--text-primary))] mt-1">{selectedTicket.specialRequests}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Tour Information Section */}
                                <div className="bg-[rgb(var(--bg-light))] border border-[rgb(var(--border-color))] rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-4">Tour Information</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm font-medium text-[rgb(var(--text-secondary))]">Tour Name:</span>
                                            <div className="font-semibold text-[rgb(var(--text-primary))] mt-1">{selectedTicket.tourName}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-[rgb(var(--text-secondary))]">Description:</span>
                                            <div className="text-sm text-[rgb(var(--text-primary))] mt-1 leading-relaxed">
                                                {selectedTicket.tourDescription || "Explore the beautiful sights and experiences of Gozo with our guided tour. This adventure will take you through stunning landscapes, historical sites, and provide you with unforgettable memories of your time on the island."}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-sm text-[rgb(var(--text-secondary))]">Tour:</span>
                                        <div className="font-semibold text-[rgb(var(--text-primary))]">{selectedTicket.tourName}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-[rgb(var(--text-secondary))]">Date:</span>
                                        <div className="font-semibold text-[rgb(var(--text-primary))]">
                                            {new Date(selectedTicket.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-sm text-[rgb(var(--text-secondary))]">Participants:</span>
                                        <div className="font-semibold text-[rgb(var(--text-primary))]">
                                            {selectedTicket.participants} person{selectedTicket.participants !== 1 ? 's' : ''} total
                                            {selectedTicket.participantDetails ? (
                                                <div className="text-sm font-normal text-[rgb(var(--text-secondary))] mt-1">
                                                    {selectedTicket.participantDetails}
                                                </div>
                                            ) : (
                                                <div className="text-sm font-normal text-[rgb(var(--text-secondary))] mt-1">
                                                    (Participant breakdown not available)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-[rgb(var(--text-secondary))]">Total Paid:</span>
                                        <div className="font-semibold text-green-600">€{selectedTicket.totalPaid.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h3 className="font-semibold text-blue-800 mb-2">Important Information</h3>
                                    {(() => {
                                        console.log('=== IMPORTANT INFO DEBUG ===');
                                        console.log('selectedTicket:', selectedTicket);
                                        console.log('selectedTicket.tourId:', selectedTicket?.tourId);
                                        console.log('tourData:', tourData);
                                        console.log('tourData[selectedTicket.tourId]:', selectedTicket ? tourData[selectedTicket.tourId] : 'No selected ticket');
                                        console.log('importantInfo:', selectedTicket ? tourData[selectedTicket.tourId]?.importantInfo : 'No selected ticket');
                                        
                                        if (selectedTicket && tourData[selectedTicket.tourId]?.importantInfo) {
                                            return (
                                                <div className="text-sm text-blue-700">
                                                    {tourData[selectedTicket.tourId].importantInfo.split('\n').map((line: string, index: number) => (
                                                        <div key={index} className="mb-1">
                                                            {line.startsWith('•') ? line : `• ${line}`}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <ul className="text-sm text-blue-700 space-y-1">
                                                    <li>• Arrive 15 minutes before your tour start time</li>
                                                    <li>• Your ticket number and QR code will be needed for validating the tickets, please make sure the tickets will be available for scanning</li>
                                                    <li>• Contact us if you need to make changes</li>
                                                </ul>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTicketsPage;
