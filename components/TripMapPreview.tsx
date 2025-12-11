import React, { useState, useEffect } from 'react';
import { Place } from '../types';

interface TripMapPreviewProps {
  place: Place;
  position: { x: number; y: number };
  index: number;
}

const TripMapPreview: React.FC<TripMapPreviewProps> = ({ place, position, index }) => {
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
      <div className="trip-map-preview">
        <div className="header">
          <div className="number">{index + 1}</div>
          <div className="name">{place.name}</div>
        </div>
        {hasImage ? (
          <img src={place.imageUrl} alt={place.name} />
        ) : (
          <div className="loader bg-gray-200 rounded">
            <div className="map-preview-spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripMapPreview;