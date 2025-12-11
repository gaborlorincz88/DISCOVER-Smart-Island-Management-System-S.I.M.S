
import React, { useState, useEffect } from 'react';
import { Place } from '../types';

interface MapImagePreviewProps {
  place: Place;
  position: { x: number; y: number };
}

const MapImagePreview: React.FC<MapImagePreviewProps> = ({ place, position }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const hasImage = !!place.imageUrl;

  return (
    <div
      className={`map-preview-bubble ${isVisible ? 'visible' : ''}`}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <div className="preview-title">{place.name}</div>
      {hasImage ? (
        <img src={place.imageUrl} alt={place.name} />
      ) : (
        <div className="loader">
          <div className="map-preview-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default MapImagePreview;