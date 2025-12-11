
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface ImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  placeName: string;
}

const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({ isOpen, onClose, images, placeName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastTouchDistance = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  // Filter out Unsplash URLs to prevent CORS errors
  const filteredImages = images.filter((url: string) => 
    url && !url.includes('unsplash.com') && !url.includes('source.unsplash')
  );

  const handleNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredImages.length);
  }, [filteredImages.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + filteredImages.length) % filteredImages.length);
  }, [filteredImages.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);
  
  useEffect(() => {
    // Reset index and zoom when modal is opened with new images
    if (isOpen) {
        setCurrentIndex(0);
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(1, Math.min(5, scale * delta));
    setScale(newScale);
  }, [scale]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - start dragging
      isDragging.current = true;
      dragStart.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      isDragging.current = false;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistance.current = distance;
      lastTouchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current && scale > 1) {
      // Single touch - drag
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      setPosition({ x: newX, y: newY });
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scaleChange = distance / lastTouchDistance.current;
      const newScale = Math.max(1, Math.min(5, scale * scaleChange));
      setScale(newScale);
      lastTouchDistance.current = distance;
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  if (!isOpen || filteredImages.length === 0) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4" 
        onClick={(e) => {
          // Only close on background click, not on image click
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
    >
      <div className="relative w-full h-full flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between text-white">
            <h2 id="gallery-title" className="text-xl font-bold">{placeName}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20" aria-label="Close gallery">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Main Image View */}
        <div 
          ref={containerRef}
          className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            ref={imageRef}
            src={filteredImages[currentIndex]} 
            alt={`Image ${currentIndex + 1} of ${placeName}`}
            crossOrigin="anonymous"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
              touchAction: 'none',
              cursor: scale > 1 ? 'move' : 'default'
            }}
            draggable={false}
            onError={(e) => {
              // Hide image if it fails to load (e.g., CORS error)
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {filteredImages.length > 1 && scale === 1 && (
            <>
                <button onClick={handlePrev} className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/40 text-white p-3 rounded-full hover:bg-black/60 transition-colors mx-2 z-10" aria-label="Previous image">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <button onClick={handleNext} className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/40 text-white p-3 rounded-full hover:bg-black/60 transition-colors mx-2 z-10" aria-label="Next image">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </>
          )}
        </div>
        
        {/* Thumbnail Strip */}
        {filteredImages.length > 1 && (
            <div className="flex-shrink-0 w-full max-w-5xl mx-auto">
                <div className="flex space-x-2 p-2 overflow-x-auto">
                {filteredImages.map((image, index) => (
                    <button 
                        key={index} 
                        onClick={() => setCurrentIndex(index)}
                        className={`flex-shrink-0 w-24 h-16 rounded-md overflow-hidden transition-all duration-200 ${currentIndex === index ? 'ring-4 ring-white' : 'opacity-60 hover:opacity-100'}`}
                    >
                    <img 
                      src={image} 
                      alt={`Thumbnail ${index + 1}`} 
                      crossOrigin="anonymous" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Hide thumbnail if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    </button>
                ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageGalleryModal;