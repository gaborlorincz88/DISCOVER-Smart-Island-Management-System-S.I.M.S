
import React, { useState, useEffect } from 'react';
import { Place } from '../types';
import { getApiBaseUrl } from '../services/config';
import { useAuth } from '../auth/AuthContext';
import { uploadImage, deletePlaceImage } from '../services/backendService';

interface EditPlaceModalProps {
  place: Place;
  onSave: (updatedPlace: Place) => void;
  onClose: () => void;
}

const EditPlaceModal: React.FC<EditPlaceModalProps> = ({ place, onSave, onClose }) => {
  const { user } = useAuth();
  const [icon, setIcon] = useState(place.icon || '');
  const [iconSize, setIconSize] = useState(place.iconSize || 24);
  const [businessUrl, setBusinessUrl] = useState(place.businessUrl || '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [iconDragActive, setIconDragActive] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>(place.galleryImages || []);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setUploadError(null);
  };

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedIconFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleIconDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIconDragActive(true);
    } else if (e.type === 'dragleave') {
      setIconDragActive(false);
    }
  };

  const handleIconDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIconDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedIconFile(e.dataTransfer.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async (overrides: Partial<Place> = {}) => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const basePlace = { ...place, ...overrides };
      let latestPlace: Place | null = null;
      
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        console.log('Uploading file:', file.name);
        
        // Calculate base progress for this file
        const baseProgress = (index / selectedFiles.length) * 100;
        
        const updatedFromServer = await uploadImage(
          basePlace.id, 
          file,
          (fileProgress) => {
            // Update progress: base progress + (file progress * file weight)
            const fileWeight = 100 / selectedFiles.length;
            const currentFileProgress = (fileProgress / 100) * fileWeight;
            setUploadProgress(Math.round(baseProgress + currentFileProgress));
          }
        );
        latestPlace = updatedFromServer;
        setGalleryImages(updatedFromServer.galleryImages || []);
      }
      
      setUploadProgress(100);
      
      const sourcePlace = latestPlace || basePlace;
      const mergedDescription = sourcePlace.description?.trim()
        ? sourcePlace.description
        : sourcePlace.shortDescription?.trim()
          ? sourcePlace.shortDescription
          : '';

      const updatedPlace: Place = {
        ...sourcePlace,
        icon: (overrides.icon ?? icon) ?? sourcePlace.icon,
        iconSize: Number(overrides.iconSize ?? iconSize),
        businessUrl: (overrides.businessUrl ?? businessUrl) ?? sourcePlace.businessUrl,
        description: mergedDescription,
        shortDescription: mergedDescription || sourcePlace.shortDescription,
        galleryImages: galleryImages,
        imageUrl: galleryImages && galleryImages.length > 0
          ? galleryImages[0]
          : sourcePlace.imageUrl,
        mainImage: galleryImages && galleryImages.length > 0
          ? galleryImages[0]
          : sourcePlace.mainImage,
      };

      onSave(updatedPlace);
      setSelectedFiles([]);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload images. Please try again.';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    if (selectedIconFile || selectedFiles.length > 0) {
      // Handle icon upload if there's a selected icon file
      if (selectedIconFile) {
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('icon', selectedIconFile);
          
          const response = await fetch(`${getApiBaseUrl()}/api/upload-config`, {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const data = await response.json();
            const uploadedIconUrl = data.optimizedImages?.icon?.[0]?.optimized || data.files?.icon?.[0];
            const mergedDescription = place.description?.trim()
              ? place.description
              : place.shortDescription?.trim()
                ? place.shortDescription
                : '';
            const basePlaceWithIcon = {
              ...place,
              icon: uploadedIconUrl || icon || undefined,
              iconSize: Number(iconSize),
              businessUrl: businessUrl || undefined,
              description: mergedDescription,
              shortDescription: mergedDescription || place.shortDescription,
            };
            
            // Now save the place with the new icon
            if (selectedFiles.length > 0) {
              await handleUpload(basePlaceWithIcon);
              return;
            } else {
              setSelectedIconFile(null);
              onSave({
                ...basePlaceWithIcon,
              });
              onClose();
              return;
            }
          }
        } catch (error) {
          console.error('Icon upload error:', error);
          setUploadError('Failed to upload icon');
          setUploading(false);
          return;
        }
      } else if (selectedFiles.length > 0) {
        await handleUpload();
        return;
      }
    } else {
      const mergedDescription = place.description?.trim()
        ? place.description
        : place.shortDescription?.trim()
          ? place.shortDescription
          : '';

      onSave({
        ...place,
        icon: icon || undefined,
        iconSize: Number(iconSize),
        businessUrl: businessUrl || undefined,
        description: mergedDescription,
        shortDescription: mergedDescription || place.shortDescription
      });
      setSelectedIconFile(null);
      onClose();
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setDeletingImage(imageUrl);
    try {
      const updatedPlace = await deletePlaceImage(place.id, imageUrl);
      setGalleryImages(updatedPlace.galleryImages || []);
      
      // Update the parent component
      const mergedDescription = updatedPlace.description?.trim()
        ? updatedPlace.description
        : updatedPlace.shortDescription?.trim()
          ? updatedPlace.shortDescription
          : '';
      
      onSave({
        ...updatedPlace,
        description: mergedDescription,
        shortDescription: mergedDescription || updatedPlace.shortDescription,
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      setUploadError('Failed to delete image. Please try again.');
    } finally {
      setDeletingImage(null);
    }
  };

  // Update gallery images when place prop changes
  useEffect(() => {
    setGalleryImages(place.galleryImages || []);
  }, [place.galleryImages]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Edit Place</h2>
        <p className="text-gray-600 mb-6 font-semibold">{place.name}</p>

        <div className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="icon">
              Custom Icon (Emoji or Image File)
            </label>
            <input
              id="icon"
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              placeholder="e.g., 🍕"
              maxLength={2}
            />
            
            {/* Icon File Upload with Drag & Drop */}
            <div>
              <input
                type="file"
                id="iconFile"
                accept="image/*"
                onChange={handleIconSelect}
                className="hidden"
              />
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  iconDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleIconDrag}
                onDragLeave={handleIconDrag}
                onDragOver={handleIconDrag}
                onDrop={handleIconDrop}
                onClick={() => document.getElementById('iconFile')?.click()}
              >
                {selectedIconFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={URL.createObjectURL(selectedIconFile)}
                      alt="Icon preview"
                      className="w-12 h-12 object-cover rounded"
                    />
                    <span className="text-sm text-gray-600">{selectedIconFile.name}</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm text-gray-600">
                      <span className="font-medium text-blue-600 hover:text-blue-500">
                        Click to upload
                      </span>{' '}
                      or drag and drop
                    </span>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="iconSize">
              Icon Size on Map (pixels)
            </label>
            <input
              id="iconSize"
              type="range"
              min="16"
              max="48"
              step="1"
              value={iconSize}
              onChange={(e) => setIconSize(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-sm text-gray-500 mt-1">{iconSize}px</div>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="businessUrl">
              Business URL (e.g., Website, Booking Link)
            </label>
            <input
              id="businessUrl"
              type="url"
              value={businessUrl}
              onChange={(e) => setBusinessUrl(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/menu"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="images">
              Upload Images
            </label>
            {user?.role !== 'admin' && (
              <div className="mb-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-sm">
                ⚠️ You must be logged in as an admin to upload images.
              </div>
            )}
            <input
              id="images"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={user?.role !== 'admin' || uploading}
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                user?.role !== 'admin' || uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-2">Selected files:</p>
                <ul className="text-sm text-gray-500">
                  {selectedFiles.map((file, index) => (
                    <li key={index}>• {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                  ))}
                </ul>
              </div>
            )}
            {uploadError && (
              <div className="mt-2 text-red-600 text-sm">{uploadError}</div>
            )}
            {uploading && (
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>

          {/* Existing Images Gallery */}
          {galleryImages.length > 0 && (
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Existing Images ({galleryImages.length})
              </label>
              <div className="grid grid-cols-3 gap-3">
                {galleryImages.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Gallery image ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.png';
                      }}
                    />
                    <button
                      onClick={() => handleDeleteImage(imageUrl)}
                      disabled={deletingImage === imageUrl || uploading}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete image"
                    >
                      {deletingImage === imageUrl ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={uploading}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPlaceModal;