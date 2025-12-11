import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Place, PlaceCategory, GroupedBusStop, Coordinates } from '../types';
import PlaceDetailCard from './PlaceDetailCard';
import PlacesList from './PlacesList';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPlace: Place | null;
    filteredPlaces: Place[];
    isLoadingPlaces: boolean;
    hasSearched: boolean;
    searchCenter: Coordinates | null;
    isLoadingAiDescription: boolean;
    isLoadingImage: boolean;
    aiError: string | null;
    onPlaceClick: (place: Place) => void;
    onGenerateDescription: (place: Place) => void;
    onSendMessage: (place: Place, message: string) => void;
    onClosePlaceDetail: () => void;
    onOpenGallery: (place: Place, imageIndex?: number) => void;
    onCloseGallery?: () => void;
    isGalleryOpen?: boolean;
    onEditPlace: (place: Place) => void;
    onAddToTrip: (place: Place) => void;
    onPageChange?: (page: 'app' | 'business' | 'trips' | 'events' | 'excursions') => void;
    selectedGroupedBusStop: GroupedBusStop | null;
    selectedTour: Place | null;
    onCloseTour: () => void;
    isSmallScreen: boolean;
    onLoginClick: () => void;
    onBack?: () => void; // New prop for back navigation
    showBackButton?: boolean; // Whether to show the back button
}

const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    onClose,
    selectedPlace,
    filteredPlaces,
    isLoadingPlaces,
    hasSearched,
    searchCenter,
    isLoadingAiDescription,
    isLoadingImage,
    aiError,
    onPlaceClick,
    onGenerateDescription,
    onSendMessage,
    onClosePlaceDetail,
    onOpenGallery,
    onCloseGallery,
    isGalleryOpen = false,
    onEditPlace,
    onAddToTrip,
    onPageChange,
    selectedGroupedBusStop,
    selectedTour,
    onCloseTour,
    isSmallScreen,
    onLoginClick,
    onBack,
    showBackButton = false,
}) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [sheetHeight, setSheetHeight] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isExtended, setIsExtended] = useState(false);
    const startY = useRef(0);
    const startHeight = useRef(0);

    useEffect(() => {
        const MINIMIZED_HEIGHT = 30; // Consistent minimized height
        if (isSmallScreen) {
            if (isOpen) {
                // Set initial height when opening on small screens
                // If a place or tour is selected, open to 50% height, otherwise to minimized height
                setSheetHeight((selectedPlace || selectedTour) ? window.innerHeight * 0.5 : MINIMIZED_HEIGHT);
                setIsExtended(false); // Reset extended state when opening
                // Reset scroll position when a new place/tour is selected
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                }
            } else {
                setSheetHeight(0);
                setIsExtended(false);
            }
        } else {
            setSheetHeight(0); // Ensure it's closed on larger screens
            setIsExtended(false);
        }
    }, [isOpen, isSmallScreen, selectedPlace, selectedTour]);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!sheetRef.current || !isSmallScreen) return;
        
        // Only allow dragging if it's on the drag handle (gray bar)
        const target = e.target as HTMLElement;
        const isDragHandle = target.closest('.drag-handle');
        
        if (!isDragHandle) {
            return; // Don't start dragging if not on the drag handle
        }
        
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        startHeight.current = sheetRef.current.clientHeight;
        sheetRef.current.style.transition = 'none'; // Disable transition during drag
    }, [isSmallScreen]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging || !sheetRef.current || !isSmallScreen) return;
        
        // Prevent default to stop any content scrolling
        e.preventDefault();
        
        const deltaY = startY.current - e.touches[0].clientY;
        let newHeight = startHeight.current + deltaY;

        // Only allow height changes through the drag handle
        // No automatic extension based on scrolling
        const minHeight = window.innerHeight * 0.1;
        const maxHeight = window.innerHeight * 0.9;
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        setSheetHeight(newHeight);
        
        // Update extended state based on current height
        if (newHeight >= window.innerHeight * 0.8) {
            setIsExtended(true);
        } else {
            setIsExtended(false);
        }
    }, [isDragging, isSmallScreen]);

    const handleTouchEnd = useCallback(() => {
        if (!isDragging || !isSmallScreen) return;
        setIsDragging(false);
        sheetRef.current!.style.transition = 'height 0.3s ease-out'; // Re-enable transition

        const MINIMIZED_HEIGHT = 30; // Define minimized height
        const currentHeight = sheetRef.current!.clientHeight;

        // Simple snapping logic
        if (currentHeight < MINIMIZED_HEIGHT + 50) { // If pulled down close to minimized height
            setSheetHeight(MINIMIZED_HEIGHT);
            setIsExtended(false);
        } else if (currentHeight > window.innerHeight * 0.8) { // If pulled up significantly, maximize
            setSheetHeight(window.innerHeight * 0.9);
            setIsExtended(true);
        } else {
            // Maintain current height
            setSheetHeight(currentHeight);
        }
    }, [isDragging, isSmallScreen]);

    useEffect(() => {
        const sheet = sheetRef.current;
        if (sheet && isSmallScreen) {
            // touchstart can be passive since we don't preventDefault on it
            sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
            // touchmove needs passive: false because we call preventDefault()
            sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
            sheet.addEventListener('touchend', handleTouchEnd, { passive: true });
            return () => {
                sheet.removeEventListener('touchstart', handleTouchStart);
                sheet.removeEventListener('touchmove', handleTouchMove);
                sheet.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, isSmallScreen]);

    if (!isSmallScreen) {
        return null; // Don't render on larger screens
    }

    return (
        <div
            ref={sheetRef}
            className={`fixed bottom-0 left-0 right-0 bg-[rgb(var(--card-bg))] rounded-t-2xl shadow-lg z-40 flex flex-col transition-transform duration-300 ease-out
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ height: isOpen ? `${sheetHeight}px` : '0px' }}
        >
            <div className="flex-shrink-0 flex justify-between items-center touch-none pt-2 pb-1 px-4">
                <div className="flex-1 flex items-center gap-2">
                    {/* Back button - only show if showBackButton is true and onBack is provided */}
                    {showBackButton && onBack && (selectedPlace || selectedTour) && (
                        <button
                            onClick={onBack}
                            className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
                            aria-label="Go back"
                            title="Go back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="drag-handle w-16 h-2 bg-gray-400 rounded-full cursor-grab active:cursor-grabbing hover:bg-gray-500 transition-colors" />
                <div className="flex-1 flex justify-end items-center gap-2">
                    {(selectedPlace || selectedTour) && (
                        <button
                            onClick={() => {
                                const place = selectedPlace || selectedTour;
                                if (place) onAddToTrip(place);
                            }}
                            className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                            aria-label="Add to trip"
                            title="Add to trip"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            // If gallery is open, close it first
                            if (isGalleryOpen && onCloseGallery) {
                                onCloseGallery();
                            } else if (selectedPlace) {
                                onClosePlaceDetail();
                            } else if (selectedTour) {
                                onCloseTour();
                            } else {
                                onClose();
                            }
                        }}
                        className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        aria-label="Close"
                        title="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-3">
                {selectedGroupedBusStop ? (
                    <div className="p-3">
                        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">Bus Stops at {selectedGroupedBusStop.name}</h2>
                        <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">Select a specific stop to see details:</p>
                        <ul className="space-y-2">
                            {selectedGroupedBusStop.stops.map(stop => (
                                <li key={stop.id}>
                                    <button
                                        onClick={() => onPlaceClick(stop)}
                                        className="w-full text-left p-2 rounded-md hover:bg-[rgb(var(--bg-hover))]"
                                    >
                                        {stop.routeId ? (
                                            <span className="block bg-blue-500 text-white px-3 py-1 rounded-md text-center text-sm font-semibold hover:bg-blue-600 transition-colors duration-150">
                                                {stop.routeId.replace(/_/g, ' ').replace(/-/g, ' ')}
                                            </span>
                                        ) : (
                                            <span className="block bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-center text-sm font-semibold">
                                                {stop.name} {stop.routeId && `(${stop.routeId})`}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={onClosePlaceDetail}
                            className="mt-4 w-full text-center bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
                        >
                            Back to Map
                        </button>
                    </div>
                ) : selectedTour ? (
                    <PlaceDetailCard
                        place={selectedTour}
                        isLoadingAiDescription={isLoadingAiDescription}
                        isLoadingImage={isLoadingImage}
                        aiError={aiError}
                        onGenerateDescription={onGenerateDescription}
                        onSendMessage={onSendMessage}
                        onClose={onCloseTour}
                        onOpenGallery={onOpenGallery}
                        onEdit={() => onEditPlace(selectedTour)}
                        onAddToTrip={onAddToTrip}
                        onLoginClick={onLoginClick}
                        onPageChange={onPageChange}
                        isSmallScreen={true}
                        // Note: onShowTrailOnMap removed - hiking trails now use unified tour system
                    />
                ) : selectedPlace ? (
                    <PlaceDetailCard
                        place={selectedPlace}
                        isLoadingAiDescription={isLoadingAiDescription}
                        isLoadingImage={isLoadingImage}
                        aiError={aiError}
                        onGenerateDescription={onGenerateDescription}
                        onSendMessage={onSendMessage}
                        onClose={onClosePlaceDetail}
                        onOpenGallery={onOpenGallery}
                        onEdit={() => onEditPlace(selectedPlace)}
                        onAddToTrip={onAddToTrip}
                        onLoginClick={onLoginClick}
                        onPageChange={onPageChange}
                        isSmallScreen={true}
                    />
                ) : (
                    <PlacesList
                        places={filteredPlaces}
                        onPlaceClick={onPlaceClick}
                        isLoading={isLoadingPlaces}
                        hasSearched={hasSearched}
                        isLocationAvailable={!!searchCenter}
                    />
                )}
            </div>
        </div>
    );
};

export default BottomSheet;
