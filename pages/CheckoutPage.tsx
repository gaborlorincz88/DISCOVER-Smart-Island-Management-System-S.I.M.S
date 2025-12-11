import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TourPoint {
    placeId: string;
    order: number;
    name: string;
    coordinates: [number, number];
}

interface Tour {
    id: string;
    name: string;
    description: string;
    coordinates: [number, number][];
    points: TourPoint[];
    category?: string;
    duration?: string;
    price?: number; // legacy single price
    maxParticipants?: number;
    images?: string[];
    currency?: string;
    prices?: { adult?: number; child?: number; senior?: number };
}

interface Booking {
    tourId: string;
    tourName: string;
    date: string;
    participants: number; // aggregate
    adults?: number;
    children?: number;
    seniors?: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    specialRequests: string;
    ticketNumber: string;
}

interface PaymentForm {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardholderName: string;
}

interface CheckoutPageProps {
    booking: (BookingForm & { ticketNumber: string }) | null;
    tour: Tour | null;
    onBack: () => void;
    onComplete: () => void;
    onMyTickets: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ booking, tour, onBack, onComplete, onMyTickets }) => {
    const { t } = useTranslation();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentForm, setPaymentForm] = useState<PaymentForm>({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: ''
    });
    const [showTicket, setShowTicket] = useState(false);
    const checkoutStartTime = React.useRef<number>(Date.now());
    
    // Track checkout abandonment on unmount if not completed
    React.useEffect(() => {
        return () => {
            if (!showTicket && booking && tour) {
                const timeSpent = Math.round((Date.now() - checkoutStartTime.current) / 1000);
                if (timeSpent > 5) { // Only track if user spent more than 5 seconds
                    import('../services/analyticsService').then(({ trackCheckoutAbandon }) => {
                        trackCheckoutAbandon(tour.id, tour.name, timeSpent);
                    });
                }
            }
        };
    }, [showTicket, booking, tour]);

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        
        try {
            // Simulate payment processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Track booking completion if we have booking data
            if (booking && tour) {
                const { trackBookingComplete } = await import('../services/analyticsService');
                const quantity = booking.participants || booking.adults || 1;
                const totalPrice = booking.totalPrice || 0;
                await trackBookingComplete(
                    tour.id, 
                    tour.name, 
                    booking.ticketNumber || '', 
                    quantity, 
                    totalPrice
                );
            }
            
            // Show ticket confirmation
            setShowTicket(true);
        } catch (error) {
            console.error('Payment failed:', error);
            alert('Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPaymentForm(prev => ({ ...prev, [name]: value }));
    };

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = matches && matches[0] || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return v;
        }
    };

    const calculateTotal = () => {
        if (!booking) return 0;
        const adultPrice = tour?.prices?.adult ?? tour?.price ?? 0;
        const childPrice = tour?.prices?.child ?? adultPrice;
        const seniorPrice = tour?.prices?.senior ?? adultPrice;
        const adults = booking.adults ?? booking.participants ?? 0;
        const children = booking.children ?? 0;
        const seniors = booking.seniors ?? 0;
        const subtotal = adults * adultPrice + children * childPrice + seniors * seniorPrice;
        const discount = subtotal * 0.1; // 10% discount
        return subtotal - discount;
    };

    const getCurrencySymbol = (currency?: string) => {
        switch ((currency || 'EUR').toUpperCase()) {
            case 'USD': return '$';
            case 'GBP': return '£';
            case 'EUR':
            default: return '€';
        }
    };

    if (!booking || !tour) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">No booking information found</p>
                    <button
                        onClick={() => onBack()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Back to Excursions
                    </button>
                </div>
            </div>
        );
    }

    if (showTicket) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-primary))] flex items-center justify-center p-6">
                <div className="max-w-2xl w-full bg-[rgb(var(--card-bg))] rounded-xl shadow-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-[rgb(var(--text-primary))] mb-4">
                        Booking Confirmed! 🎉
                    </h1>
                    
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-6 rounded-xl mb-6">
                        <h2 className="text-xl font-semibold mb-2">Your Ticket</h2>
                        <div className="text-3xl font-mono font-bold tracking-wider">
                            {booking.ticketNumber}
                        </div>
                        <p className="text-sm opacity-90 mt-2">Keep this number for your records</p>
                    </div>

                    <div className="space-y-4 mb-8 text-left">
                        <div className="flex justify-between">
                            <span className="text-[rgb(var(--text-secondary))]">Tour:</span>
                            <span className="font-semibold text-[rgb(var(--text-primary))]">{tour.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[rgb(var(--text-secondary))]">Date:</span>
                            <span className="font-semibold text-[rgb(var(--text-primary))]">
                                {new Date(booking.date).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[rgb(var(--text-secondary))]">Participants:</span>
                            <span className="font-semibold text-[rgb(var(--text-primary))]">{booking.participants}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[rgb(var(--text-secondary))]">Total Paid:</span>
                            <span className="font-semibold text-green-600">€{calculateTotal().toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-blue-800 mb-2">What's Next?</h3>
                        <ul className="text-sm text-blue-700 space-y-1 text-left">
                            <li>• You'll receive a confirmation email shortly</li>
                            <li>• Your tour guide will contact you 24h before the tour</li>
                            <li>• Meet at the designated location on your tour date</li>
                            <li>• Bring your ticket number and ID for verification</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={onMyTickets}
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            🎫 View My Tickets
                        </button>
                        <button
                            onClick={onComplete}
                            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
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
                        Back to Tour Details
                    </button>
                    <h1 className="text-4xl font-bold mb-2">Complete Your Booking</h1>
                    <p className="text-xl text-white/90">Secure payment and instant confirmation</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Order Summary */}
                    <div className="space-y-6">
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-4">Order Summary</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    {tour.images && tour.images[0] && (
                                        <img 
                                            src={tour.images[0]} 
                                            alt={tour.name}
                                            className="w-20 h-20 object-cover rounded-lg"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-[rgb(var(--text-primary))]">{tour.name}</h3>
                                        <p className="text-sm text-[rgb(var(--text-secondary))]">
                                            {new Date(booking.date).toLocaleDateString()} • {booking.participants} {booking.participants === 1 ? 'person' : 'people'}
                                        </p>
                                    </div>
                                </div>

                                <hr className="border-[rgb(var(--border-color))]" />

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[rgb(var(--text-secondary))]">Subtotal:</span>
                                        <span className="text-[rgb(var(--text-primary))]">{getCurrencySymbol(tour.currency)}{(calculateTotal() / 0.9).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-green-600">
                                        <span>10% Discount:</span>
                                        <span>-{getCurrencySymbol(tour.currency)}{((calculateTotal() / 0.9) * 0.1).toFixed(2)}</span>
                                    </div>
                                    <hr className="border-[rgb(var(--border-color))]" />
                                    <div className="flex justify-between text-lg font-bold text-[rgb(var(--text-primary))]">
                                        <span>Total:</span>
                                        <span className="text-green-600">{getCurrencySymbol(tour.currency)}{calculateTotal().toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-4">Customer Details</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-[rgb(var(--text-secondary))]">Name:</span>
                                    <span className="text-[rgb(var(--text-primary))]">{booking.customerName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[rgb(var(--text-secondary))]">Email:</span>
                                    <span className="text-[rgb(var(--text-primary))]">{booking.customerEmail}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[rgb(var(--text-secondary))]">Phone:</span>
                                    <span className="text-[rgb(var(--text-primary))]">{booking.customerPhone}</span>
                                </div>
                                {booking.specialRequests && (
                                    <div className="flex justify-between">
                                        <span className="text-[rgb(var(--text-secondary))]">Special Requests:</span>
                                        <span className="text-[rgb(var(--text-primary))]">{booking.specialRequests}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Payment Widget */}
                    <div>
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-6">Payment Information</h2>
                            
                            {/* Payment Widget Integration */}
                            <PaymentWidget
                                amount={calculateTotal()}
                                currency={tour.currency || 'EUR'}
                                description={`${tour.name} - ${booking.participants} participants`}
                                customerEmail={booking.customerEmail}
                                customerName={booking.customerName}
                                onSuccess={(result) => {
                                    console.log('Payment successful!', result);
                                    setShowTicket(true);
                                }}
                                onError={(error) => {
                                    console.error('Payment failed:', error);
                                    alert('Payment failed: ' + error.message);
                                }}
                            />

                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center space-x-2 text-blue-800">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span className="text-sm font-medium">Secure Payment</span>
                                </div>
                                <p className="text-xs text-blue-700 mt-1">
                                    Your payment information is encrypted and secure. We never store your card details.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// HYELLO Payment Widget - Standalone Component
// NO NPM packages required! Works immediately after installation.
// Accepts ANY amount/currency as props

interface PaymentWidgetProps {
    amount: number;
    currency: string;
    description: string;
    customerEmail: string;
    customerName: string;
    onSuccess: (result: any) => void;
    onError: (error: any) => void;
}

const PaymentWidget: React.FC<PaymentWidgetProps> = ({
    amount,
    currency,
    description,
    customerEmail,
    customerName,
    onSuccess,
    onError
}) => {
    const [loading, setLoading] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState(customerName || '');
    const [selectedCrypto, setSelectedCrypto] = useState('BTC');
    const [walletAddress, setWalletAddress] = useState('');

    // TEST MODE: Set to true to bypass real payment processing for demo/testing
    const TEST_MODE = true;
    
    const API_KEY = 'YOUR_API_KEY_HERE';
    const THEME = 'dark';
    const PRIMARY_COLOR = '#ffd700';
    const BORDER_RADIUS = 'large';
    const BORDER_THICKNESS = 'thick';
    const LOGO_TYPE = 'square';
    const ICON_POSITION = 'top-center';
    const apiBaseUrl = 'http://localhost:3000';
    
    // HYELLO Logo - using extracted logo image
    const CUSTOM_IMAGE = '/hyello-logo.png';

    const handleCardPayment = async () => {
        setLoading(true);
        try {
            // Basic validation - check that required fields are filled
            const cleanCardNumber = cardNumber.replace(/\s/g, '');
            if (!cleanCardNumber || cleanCardNumber.length < 13) {
                throw new Error('Please enter a valid card number');
            }
            if (!expiry || !expiry.includes('/')) {
                throw new Error('Please enter a valid expiry date (MM/YY)');
            }
            if (!cvv || cvv.length < 3) {
                throw new Error('Please enter a valid CVV');
            }
            if (!cardholderName || cardholderName.trim().length < 2) {
                throw new Error('Please enter the cardholder name');
            }

            // TEST MODE: Simulate payment processing without real API calls
            if (TEST_MODE) {
                // Simulate processing delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Return mock success response
                const mockResult = {
                    authorization_id: `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'approved',
                    amount: Math.round(amount * 100),
                    currency: currency,
                    card_last4: cleanCardNumber.slice(-4),
                    message: 'Payment successful (TEST MODE)'
                };
                
                onSuccess(mockResult);
                return;
            }

            // PRODUCTION MODE: Real API calls
            // Step 1: Tokenize card
            const tokenResponse = await fetch(`${apiBaseUrl}/v1/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    number: cleanCardNumber,
                    exp_month: parseInt(expiry.split('/')[0]),
                    exp_year: parseInt('20' + expiry.split('/')[1]),
                    cvc: cvv,
                    name: cardholderName
                })
            });

            if (!tokenResponse.ok) throw new Error('Card tokenization failed');
            const tokenData = await tokenResponse.json();

            // Step 2: Authorize payment
            const authResponse = await fetch(`${apiBaseUrl}/v1/authorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'Idempotency-Key': `idem_${Date.now()}_${Math.random()}`
                },
                body: JSON.stringify({
                    card_token: tokenData.token,
                    amount: Math.round(amount * 100),
                    currency: currency,
                    description: description,
                    capture: true
                })
            });

            if (!authResponse.ok) throw new Error('Payment authorization failed');
            const result = await authResponse.json();

            onSuccess(result);
        } catch (error: any) {
            onError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCryptoPayment = async () => {
        setLoading(true);
        try {
            // Basic validation
            if (!walletAddress || walletAddress.trim().length < 10) {
                throw new Error('Please enter a valid wallet address');
            }

            // TEST MODE: Simulate payment processing without real API calls
            if (TEST_MODE) {
                // Simulate processing delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Return mock success response
                const mockResult = {
                    transaction_id: `CRYPTO_TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'approved',
                    crypto: selectedCrypto,
                    amount: amount,
                    currency: currency,
                    wallet_address: walletAddress,
                    message: 'Crypto payment successful (TEST MODE)'
                };
                
                onSuccess(mockResult);
                return;
            }

            // PRODUCTION MODE: Real API calls
            const cryptoResponse = await fetch(`${apiBaseUrl}/v1/crypto/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    crypto: selectedCrypto,
                    amount: amount,
                    currency: currency,
                    description: description,
                    customer_wallet: walletAddress
                })
            });

            if (!cryptoResponse.ok) throw new Error('Crypto payment failed');
            const result = await cryptoResponse.json();

            onSuccess(result);
        } catch (error: any) {
            onError(error);
        } finally {
            setLoading(false);
        }
    };

    const borderRadiusMap = { none: '0px', small: '4px', medium: '8px', large: '16px' };
    const borderThicknessMap = { none: '0px', thin: '1px', medium: '2px', thick: '3px' };
    const radius = borderRadiusMap[BORDER_RADIUS as keyof typeof borderRadiusMap] || '8px';
    const thickness = borderThicknessMap[BORDER_THICKNESS as keyof typeof borderThicknessMap] || '2px';
    const isDark = THEME === 'dark';

    const getCurrencySymbol = (curr: string) => {
        switch (curr.toUpperCase()) {
            case 'USD': return '$';
            case 'GBP': return '£';
            case 'EUR':
            default: return '€';
        }
    };

    return (
        <div className="hyello-widget p-6 rounded-xl shadow-2xl" style={{
            background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: radius,
            borderWidth: thickness,
            borderStyle: 'solid',
            borderColor: PRIMARY_COLOR + '40',
            maxWidth: '400px',
            margin: '0 auto'
        }}>
            {/* Test Mode Banner */}
            {TEST_MODE && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/20 border-2 border-yellow-500/50">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-semibold">TEST MODE ACTIVE</span>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Payments are simulated for demo purposes. No real transactions will be processed.
                    </p>
                </div>
            )}

            {/* Header with HYELLO Logo */}
            <div className={`mb-6 ${
                ICON_POSITION.includes('center') ? 'flex flex-col items-center text-center' :
                ICON_POSITION.includes('left') ? 'flex items-center gap-3' :
                'flex items-center gap-3 flex-row-reverse'
            }`}>
                {/* Logo/Icon */}
                {CUSTOM_IMAGE ? (
                    <div className="flex-shrink-0" style={{ maxWidth: '120px', maxHeight: '80px' }}>
                        <img 
                            src={CUSTOM_IMAGE} 
                            alt="HYELLO Logo"
                            style={{
                                width: 'auto',
                                height: 'auto',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                ) : (
                    <>
                        {LOGO_TYPE === 'square' && (
                            <div 
                                className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-black text-xl flex-shrink-0"
                                style={{ backgroundColor: PRIMARY_COLOR }}
                            >
                                H
                            </div>
                        )}
                        {LOGO_TYPE === 'circle' && (
                            <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-black text-xl flex-shrink-0"
                                style={{ backgroundColor: PRIMARY_COLOR }}
                            >
                                H
                            </div>
                        )}
                        {LOGO_TYPE === 'minimal' && (
                            <div 
                                className="w-12 h-12 flex items-center justify-center font-bold text-2xl flex-shrink-0"
                                style={{ color: PRIMARY_COLOR }}
                            >
                                H
                            </div>
                        )}
                    </>
                )}
                
                {/* Text - Only show HYELLO branding if NOT using custom image */}
                {(!CUSTOM_IMAGE || CUSTOM_IMAGE.includes('brand-icon.png')) && (
                    <div className={ICON_POSITION.includes('center') ? 'mt-2' : ''}>
                        <h3 className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                            HYELLO
                        </h3>
                        <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                            Secure Payment Processing
                        </p>
                    </div>
                )}
            </div>

            {/* Amount */}
            <div className="text-center mb-6 p-4 rounded-lg" style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: PRIMARY_COLOR + '20'
            }}>
                <div className="text-3xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                    {getCurrencySymbol(currency)}{amount.toFixed(2)}
                </div>
                <div className="text-sm mt-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {description}
                </div>
            </div>

            {/* Card Payment Form */}
            <div className="space-y-4 mb-4">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                        Card Number
                    </label>
                    <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
                            setCardNumber(val);
                        }}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
                        style={{
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                            color: isDark ? '#fff' : '#000',
                            borderColor: PRIMARY_COLOR + '30',
                            borderRadius: radius
                        }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                            Expiry
                        </label>
                        <input
                            type="text"
                            value={expiry}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length >= 2) val = val.slice(0,2) + '/' + val.slice(2,4);
                                setExpiry(val);
                            }}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full px-4 py-3 border rounded-lg"
                            style={{
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                color: isDark ? '#fff' : '#000',
                                borderColor: PRIMARY_COLOR + '30',
                                borderRadius: radius
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                            CVV
                        </label>
                        <input
                            type="text"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0,4))}
                            placeholder="123"
                            maxLength={4}
                            className="w-full px-4 py-3 border rounded-lg"
                            style={{
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                color: isDark ? '#fff' : '#000',
                                borderColor: PRIMARY_COLOR + '30',
                                borderRadius: radius
                            }}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                        Cardholder Name
                    </label>
                    <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 border rounded-lg"
                        style={{
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                            color: isDark ? '#fff' : '#000',
                            borderColor: PRIMARY_COLOR + '30',
                            borderRadius: radius
                        }}
                    />
                </div>

                <button
                    onClick={handleCardPayment}
                    disabled={loading}
                    className="w-full py-4 font-bold shadow-lg transition-all hover:opacity-90"
                    style={{
                        backgroundColor: PRIMARY_COLOR,
                        color: '#000',
                        borderRadius: radius,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Processing...' : `Pay ${getCurrencySymbol(currency)}${amount.toFixed(2)}`}
                </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 my-4">
                <div className="h-px flex-1" style={{ background: PRIMARY_COLOR + '30' }}></div>
                <span className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    OR PAY WITH CRYPTO
                </span>
                <div className="h-px flex-1" style={{ background: PRIMARY_COLOR + '30' }}></div>
            </div>

            {/* Crypto Payment */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                        Select Cryptocurrency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {['BTC', 'ETH', 'USDT', 'USDC'].map((crypto) => (
                            <button
                                key={crypto}
                                type="button"
                                onClick={() => setSelectedCrypto(crypto)}
                                className="p-3 rounded-lg border-2 transition-all text-left"
                                style={{
                                    background: selectedCrypto === crypto ? PRIMARY_COLOR + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)'),
                                    borderColor: selectedCrypto === crypto ? PRIMARY_COLOR : PRIMARY_COLOR + '30',
                                    borderRadius: radius
                                }}
                            >
                                <div className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                                    {crypto === 'BTC' ? '₿ Bitcoin' : crypto === 'ETH' ? 'Ξ Ethereum' : crypto === 'USDT' ? '₮ Tether' : '💵 USDC'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: PRIMARY_COLOR }}>
                        Your Wallet Address
                    </label>
                    <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f24aAa"
                        className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
                        style={{
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                            color: isDark ? '#fff' : '#000',
                            borderColor: PRIMARY_COLOR + '30',
                            borderRadius: radius
                        }}
                    />
                </div>

                <button
                    onClick={handleCryptoPayment}
                    disabled={loading}
                    className="w-full py-4 font-bold shadow-lg transition-all hover:opacity-90"
                    style={{
                        backgroundColor: PRIMARY_COLOR,
                        color: '#000',
                        borderRadius: radius,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Processing...' : `Pay ${getCurrencySymbol(currency)}${amount.toFixed(2)} in ${selectedCrypto}`}
                </button>
            </div>

            {/* Security Badges */}
            <div className="flex items-center justify-center gap-4 mt-6 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                <span>🔒 SSL</span>
                <span>🛡️ PCI</span>
                <span>✅ 3DS</span>
            </div>
        </div>
    );
};

export default CheckoutPage;
