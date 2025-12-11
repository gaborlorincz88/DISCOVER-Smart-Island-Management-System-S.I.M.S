import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';
import { useAuth } from '../auth/AuthContext';
import { ticketService } from '../services/ticketService';

interface TourPoint {
    placeId: string;
    order: number;
    name: string;
    coordinates: [number, number];
    type?: string;
}

interface Tour {
    id: string;
    name: string;
    description: string;
    coordinates: [number, number][];
    points: TourPoint[];
    category?: string;
    duration?: string;
    // Legacy single price (fallback)
    price?: number;
    maxParticipants?: number;
    images?: string[];
    mainImage?: string;
    // New pricing model
    currency?: string; // e.g., 'EUR', 'USD'
    prices?: {
        adult?: number;
        child?: number;
        senior?: number;
    };
}

interface BookingForm {
    tourId: string;
    tourName: string;
    date: string;
    // Aggregate participants (for backward compatibility)
    participants: number;
    // New detailed counts
    adults?: number;
    children?: number;
    seniors?: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests: string;
}

interface TourDetailPageProps {
    tour: Tour | null;
    onBack: () => void;
    onBookingComplete: (booking: BookingForm & { ticketNumber: string }) => void;
}

const TourDetailPage: React.FC<TourDetailPageProps> = ({ tour: propTour, onBack, onBookingComplete }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    
    const [tour, setTour] = useState<Tour | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingForm, setBookingForm] = useState<BookingForm>({
        tourId: '',
        tourName: '',
        date: '',
        participants: 1,
        adults: 1,
        children: 0,
        seniors: 0,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        specialRequests: ''
    });

    useEffect(() => {
        if (propTour) {
            setTour(propTour);
            setBookingForm(prev => ({ ...prev, tourId: propTour.id, tourName: propTour.name }));
            setIsLoading(false);
            
            // Track tour detail view
            import('../services/analyticsService').then(({ trackTourDetailView }) => {
                trackTourDetailView(propTour.id, propTour.name, propTour.category);
            });
        } else {
            setError('No tour information provided');
            setIsLoading(false);
        }
    }, [propTour]);

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBooking(true);
        
        try {
            // Check if user is logged in
            if (!user?.id) {
                console.error('User not authenticated when trying to book:', { user, userId: user?.id });
                setError('Please log in to book a tour.');
                setIsBooking(false);
                return;
            }

            console.log('User authenticated for booking:', { userId: user.id, email: user.email });

            // Generate unique ticket number
            const ticketNumber = `GOZO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            
            // Calculate total (tiered pricing if available) with 10% discount
            const adultPrice = tour?.prices?.adult ?? tour?.price ?? 0;
            const childPrice = tour?.prices?.child ?? adultPrice;
            const seniorPrice = tour?.prices?.senior ?? adultPrice;
            const adults = bookingForm.adults ?? 0;
            const children = bookingForm.children ?? 0;
            const seniors = bookingForm.seniors ?? 0;
            const participantsTotal = Math.max(1, adults + children + seniors);
            const subtotal = adults * adultPrice + children * childPrice + seniors * seniorPrice;
            const discount = subtotal * 0.1;
            const totalPaid = subtotal - discount;
            
            // Create reservation data for backend
            const reservationData = {
                userId: user.id,
                ticketId: tour?.id || 'comino-tour', // Use tour ID, ticketService will map it
                tourName: tour?.name || 'Unknown Tour', // Include the actual tour name
                quantity: participantsTotal,
                totalPrice: totalPaid,
                reservationDate: bookingForm.date,
                reservationTime: '10:00', // Default time
                specialRequests: bookingForm.specialRequests,
                contactEmail: bookingForm.customerEmail,
                contactPhone: bookingForm.customerPhone,
                customerName: bookingForm.customerName,
                adults: adults,
                children: children,
                seniors: seniors
            };

            // Track checkout start
            const { trackCheckoutStart } = await import('../services/analyticsService');
            await trackCheckoutStart(tour?.id || '', tour?.name || '', participantsTotal, totalPaid);
            
            // Save reservation to backend
            try {
                const result = await ticketService.createReservation(reservationData);
                console.log('Reservation saved to backend successfully');
                
                // Track booking completion
                const { trackBookingComplete } = await import('../services/analyticsService');
                await trackBookingComplete(
                    tour?.id || '', 
                    tour?.name || '', 
                    result.reservationId || ticketNumber, 
                    participantsTotal, 
                    totalPaid
                );
            } catch (backendError) {
                console.error('Error saving to backend, falling back to localStorage:', backendError);
                
                // Fallback to localStorage if backend fails
                const ticket = {
                    id: `ticket-${Date.now()}`,
                    ticketNumber,
                    tourName: tour?.name || '',
                    tourId: tour?.id || '',
                    date: bookingForm.date,
                    participants: participantsTotal,
                    customerName: bookingForm.customerName,
                    customerEmail: bookingForm.customerEmail,
                    customerPhone: bookingForm.customerPhone,
                    specialRequests: bookingForm.specialRequests,
                    totalPaid,
                    status: 'confirmed' as const,
                    createdAt: new Date().toISOString()
                };
                
                ticketService.saveTicketToLocalStorage(ticket);
            }
            
            // Simulate API call to create booking
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Call the onBookingComplete prop with booking data
            onBookingComplete({ ...bookingForm, participants: participantsTotal, ticketNumber });
        } catch (error) {
            console.error('Booking failed:', error);
            setError('Failed to create booking. Please try again.');
        } finally {
            setIsBooking(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        // Numeric fields
        if (name === 'participants' || name === 'adults' || name === 'children' || name === 'seniors') {
            const num = Math.max(0, parseInt(value || '0'));
            setBookingForm(prev => ({ ...prev, [name]: num } as any));
            return;
        }
        setBookingForm(prev => ({ ...prev, [name]: value }));
    };

    const getCurrencySymbol = (currency?: string) => {
        switch ((currency || 'EUR').toUpperCase()) {
            case 'USD': return '$';
            case 'GBP': return '£';
            case 'EUR':
            default: return '€';
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-[rgb(var(--text-secondary))]">Loading tour details...</p>
                </div>
            </div>
        );
    }

    if (error || !tour) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || 'Tour not found'}</p>
                    <button
                        onClick={onBack}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Back to Excursions
                    </button>
                </div>
            </div>
        );
    }

    // Resolve hero image URL (prefer mainImage, then first image). Prefix backend URL for uploads
    const rawHero = tour.mainImage || (tour.images && tour.images[0]);
    const heroImageUrl = rawHero ? (rawHero.startsWith('/uploads/') ? `${getApiBaseUrl()}${rawHero}` : rawHero) : '';

    return (
        <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
            {/* Hero Header */}
            <div className="relative">
                <div className="relative h-64 md:h-80 w-full">
                    {heroImageUrl ? (
                        <>
                            <img src={heroImageUrl} alt={tour.name} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600" />
                    )}
                </div>
                <div className="absolute inset-0">
                    <div className="max-w-6xl mx-auto px-6 h-full flex flex-col justify-between py-4 text-white">
                        <div>
                            <button
                                onClick={onBack}
                                className="flex items-center text-white/90 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Excursions
                            </button>
                        </div>
                        <div className="pb-4">
                            <h1 className="text-3xl md:text-4xl font-bold mb-1">{tour.name}</h1>
                            <p className="text-white/90 text-lg">{tour.category} • {tour.duration}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Tour Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tour Images */}
                        {tour.images && tour.images.length > 0 && (
                            <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg overflow-hidden">
                                <img 
                                    src={tour.images[0]} 
                                    alt={tour.name}
                                    className="w-full h-64 object-cover"
                                />
                            </div>
                        )}

                        {/* Tour Description */}
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">About This Tour</h2>
                            <p className="text-[rgb(var(--text-secondary))] leading-relaxed mb-6">
                                {tour.description}
                            </p>
                            
                            {/* Tour Highlights */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[rgb(var(--text-primary))]">Duration</p>
                                        <p className="text-sm text-[rgb(var(--text-secondary))]">{tour.duration}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[rgb(var(--text-primary))]">Max Group Size</p>
                                        <p className="text-sm text-[rgb(var(--text-secondary))]">{tour.maxParticipants} people</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tour Points */}
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">Tour Highlights</h2>
                            <div className="space-y-3">
                                {tour.points
                                    .filter(point => point.type === 'stop')
                                    .map((point, index) => (
                                        <div key={point.placeId} className="flex items-center space-x-4">
                                            <div className="w-8 h-8 bg-cyan-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[rgb(var(--text-primary))]">{point.name}</h3>
                                                <p className="text-sm text-[rgb(var(--text-secondary))]">
                                                    {point.coordinates[0].toFixed(4)}, {point.coordinates[1].toFixed(4)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Booking Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6 sticky top-6">
                            <div className="text-center mb-6">
                                {tour.prices ? (
                                    <div>
                                        <div className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">Pricing</div>
                                        <div className="grid grid-cols-3 gap-2 text-sm text-[rgb(var(--text-secondary))]">
                                            <div>Adult: <span className="font-semibold text-[rgb(var(--text-primary))]">{getCurrencySymbol(tour.currency)}{tour.prices.adult ?? '-'}</span></div>
                                            <div>Child: <span className="font-semibold text-[rgb(var(--text-primary))]">{getCurrencySymbol(tour.currency)}{tour.prices.child ?? '-'}</span></div>
                                            <div>Senior: <span className="font-semibold text-[rgb(var(--text-primary))]">{getCurrencySymbol(tour.currency)}{tour.prices.senior ?? '-'}</span></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-3xl font-bold text-[rgb(var(--text-primary))] mb-2">
                                        {getCurrencySymbol(tour.currency)}{tour.price ?? '-'}
                                    </div>
                                )}
                                <div className="text-sm text-[rgb(var(--text-secondary))] mb-4">Save 10% when booking here</div>
                                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">🎉 Instant confirmation</div>
                            </div>

                            <form onSubmit={handleBookingSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        Tour Date
                                    </label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={bookingForm.date}
                                        onChange={handleInputChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                        className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))]"
                                    />
                                </div>

                                {tour.prices ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Adults</label>
                                            <input type="number" name="adults" min={0} max={tour.maxParticipants || 99} value={bookingForm.adults}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))]" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Children</label>
                                            <input type="number" name="children" min={0} max={tour.maxParticipants || 99} value={bookingForm.children}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))]" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Seniors</label>
                                            <input type="number" name="seniors" min={0} max={tour.maxParticipants || 99} value={bookingForm.seniors}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))]" />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Number of Participants</label>
                                        <select name="participants" value={bookingForm.participants} onChange={handleInputChange} required
                                            className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))]">
                                            {Array.from({ length: tour.maxParticipants || 10 }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={bookingForm.customerName}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        name="customerEmail"
                                        value={bookingForm.customerEmail}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        name="customerPhone"
                                        value={bookingForm.customerPhone}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        Special Requests (Optional)
                                    </label>
                                    <textarea
                                        name="specialRequests"
                                        value={bookingForm.specialRequests}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-[rgb(var(--border-color))] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))]"
                                        placeholder="Any dietary requirements, accessibility needs, or other special requests..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isBooking}
                                    className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    {isBooking ? 'Processing...' : 'Book Now & Save 10%'}
                                </button>
                            </form>

                            <div className="mt-4 text-xs text-[rgb(var(--text-secondary))] text-center">
                                By booking, you agree to our terms and conditions
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TourDetailPage;
