import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';

interface TourPoint {
    id: number;
    type: string;
    lat: number;
    lng: number;
    name: string;
    description: string;
}

interface Tour {
    id: string;
    name: string;
    type: string;
    description?: string;
    icon?: string;
    iconSize?: number;
    points: TourPoint[];
}

interface TourCategory {
    id: string;
    name: string;
}

const TourEditorPage: React.FC = () => {
    const { t } = useTranslation();
    const [tourCategories, setTourCategories] = useState<TourCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [tours, setTours] = useState<Tour[]>([]);
    const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form state for editing
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        icon: '',
        iconSize: 32,
        mainImage: ''
    });

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
            setTourCategories(data);
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
        setSelectedTour(null);
        setIsEditing(false);
    };

    const handleTourSelect = (tour: Tour) => {
        setSelectedTour(tour);
        setEditForm({
            name: tour.name,
            description: tour.description || '',
            icon: tour.icon || '/tours.svg',
            iconSize: tour.iconSize || 32,
            mainImage: tour.mainImage || ''
        });
        setIsEditing(false);
    };

    const handleEditTour = () => {
        setIsEditing(true);
    };

    const handleSaveTour = async () => {
        if (!selectedTour || !selectedCategory) return;

        try {
            const updatedTour = {
                ...selectedTour,
                name: editForm.name,
                description: editForm.description,
                icon: editForm.icon,
                iconSize: editForm.iconSize,
                mainImage: editForm.mainImage
            };

            const response = await fetch(`${getApiBaseUrl()}/api/tours/${selectedCategory}/${selectedTour.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedTour),
            });

            if (!response.ok) {
                throw new Error(`Failed to update tour: ${response.status}`);
            }

            // Update local state
            setTours(prev => prev.map(t => t.id === selectedTour.id ? updatedTour : t));
            setSelectedTour(updatedTour);
            setIsEditing(false);
            setSuccessMessage('Tour updated successfully!');
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error('Failed to update tour:', error);
            setError('Failed to update tour');
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditForm({
            name: selectedTour?.name || '',
            description: selectedTour?.description || '',
            icon: selectedTour?.icon || '/tours.svg',
            iconSize: selectedTour?.iconSize || 32
        });
    };

    const handleDeleteTour = async () => {
        if (!selectedTour || !selectedCategory) return;

        if (!confirm(`Are you sure you want to delete the tour "${selectedTour.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`${getApiBaseUrl()}/api/tours/${selectedCategory}/${selectedTour.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Failed to delete tour: ${response.status}`);
            }

            // Update local state
            setTours(prev => prev.filter(t => t.id !== selectedTour.id));
            setSelectedTour(null);
            setSuccessMessage('Tour deleted successfully!');
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error('Failed to delete tour:', error);
            setError('Failed to delete tour');
        }
    };

    const handleCreateTour = () => {
        const newTour: Tour = {
            id: `new-tour-${Date.now()}`,
            name: 'New Tour',
            type: selectedCategory || 'sightseeing',
            description: 'Tour description',
            icon: '/tours.svg',
            iconSize: 32,
            points: []
        };
        setSelectedTour(newTour);
        setEditForm({
            name: newTour.name,
            description: newTour.description,
            icon: newTour.icon,
            iconSize: newTour.iconSize,
            mainImage: newTour.mainImage || ''
        });
        setIsEditing(true);
    };

    const handleSaveNewTour = async () => {
        if (!selectedTour || !selectedCategory) return;

        try {
            const response = await fetch(`${getApiBaseUrl()}/api/tours/${selectedCategory}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(selectedTour),
            });

            if (!response.ok) {
                throw new Error(`Failed to create tour: ${response.status}`);
            }

            const savedTour = await response.json();
            
            // Update local state
            setTours(prev => [...prev, savedTour]);
            setSelectedTour(savedTour);
            setIsEditing(false);
            setSuccessMessage('Tour created successfully!');
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error('Failed to create tour:', error);
            setError('Failed to create tour');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-[rgb(var(--text-primary))] mb-4">
                    Tour Editor
                </h1>
                <p className="text-lg text-[rgb(var(--text-secondary))]">
                    Create, edit, and manage tour routes with custom icons and detailed information
                </p>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
                <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 text-red-700 hover:text-red-900"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Sidebar - Categories and Tours */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Tour Categories */}
                    <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-4">
                            Tour Categories
                        </h2>
                        <div className="space-y-2">
                            {tourCategories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategorySelect(category.id)}
                                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                                        selectedCategory === category.id
                                            ? 'bg-cyan-500 text-white'
                                            : 'bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--border-color))]'
                                    }`}
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tours List */}
                    {selectedCategory && (
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
                                    Tours
                                </h2>
                                <button
                                    onClick={handleCreateTour}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                                >
                                    + New
                                </button>
                            </div>
                            
                            {isLoading ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto"></div>
                                </div>
                            ) : tours.length === 0 ? (
                                <p className="text-[rgb(var(--text-secondary))] text-center py-4">
                                    No tours available. Create one!
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {tours.map((tour) => (
                                        <button
                                            key={tour.id}
                                            onClick={() => handleTourSelect(tour)}
                                            className={`w-full p-3 rounded-lg text-left transition-colors ${
                                                selectedTour?.id === tour.id
                                                    ? 'bg-cyan-500 text-white'
                                                    : 'bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--border-color))]'
                                            }`}
                                        >
                                            <div className="font-medium">{tour.name}</div>
                                            <div className="text-xs opacity-75">
                                                {tour.points.length} points
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side - Tour Editor */}
                <div className="lg:col-span-2">
                    {selectedTour ? (
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                                    {isEditing ? 'Edit Tour' : selectedTour.name}
                                </h2>
                                <div className="flex space-x-2">
                                    {!isEditing ? (
                                        <>
                                            <button
                                                onClick={handleEditTour}
                                                className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={handleDeleteTour}
                                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleSaveTour}
                                                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Tour Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                            className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                            rows={3}
                                            className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Icon Path
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.icon}
                                            onChange={(e) => setEditForm({...editForm, icon: e.target.value})}
                                            placeholder="/tours.svg or /uploads/custom-icon.png"
                                            className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]"
                                        />
                                        <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">
                                            Use /tours.svg for default icon or /uploads/your-icon.png for custom icons
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Icon Size
                                        </label>
                                        <input
                                            type="number"
                                            value={editForm.iconSize}
                                            onChange={(e) => setEditForm({...editForm, iconSize: parseInt(e.target.value) || 32})}
                                            min="16"
                                            max="64"
                                            className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Main Tour Image Path
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.mainImage || ''}
                                            onChange={(e) => setEditForm({...editForm, mainImage: e.target.value})}
                                            placeholder="/uploads/tour-image.jpg or leave empty"
                                            className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))]"
                                        />
                                        <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">
                                            Use /uploads/your-image.jpg for custom tour images
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Description
                                        </label>
                                        <p className="text-[rgb(var(--text-secondary))]">
                                            {selectedTour.description || 'No description available'}
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Icon
                                        </label>
                                        <div className="flex items-center space-x-3">
                                            <img 
                                                src={selectedTour.icon || '/tours.svg'} 
                                                alt="Tour icon" 
                                                className="w-8 h-8"
                                                onError={(e) => {
                                                    e.currentTarget.src = '/tours.svg';
                                                }}
                                            />
                                            <span className="text-[rgb(var(--text-secondary))]">
                                                {selectedTour.icon || '/tours.svg'} (Size: {selectedTour.iconSize || 32}px)
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Main Tour Image
                                        </label>
                                        {selectedTour.mainImage ? (
                                            <div className="space-y-2">
                                                <img 
                                                    src={selectedTour.mainImage} 
                                                    alt="Main tour image" 
                                                    className="w-full h-32 object-cover rounded-lg"
                                                    onError={(e) => {
                                                        e.currentTarget.src = '/tours.svg';
                                                    }}
                                                />
                                                <p className="text-xs text-[rgb(var(--text-secondary))]">
                                                    {selectedTour.mainImage}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[rgb(var(--text-muted))] italic">
                                                No main tour image uploaded
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                            Tour Points
                                        </label>
                                        <div className="space-y-2">
                                            {selectedTour.points.map((point, index) => (
                                                <div key={point.id} className="bg-[rgb(var(--bg-light))] p-3 rounded-lg">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium text-[rgb(var(--text-primary))]">
                                                            {index + 1}. {point.name}
                                                        </span>
                                                        <span className="text-xs text-[rgb(var(--text-secondary))]">
                                                            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                                                        </span>
                                                    </div>
                                                    {point.description && (
                                                        <p className="text-sm text-[rgb(var(--text-secondary))] mt-1">
                                                            {point.description}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-12 text-center">
                            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2">
                                Select a Tour to Edit
                            </h3>
                            <p className="text-[rgb(var(--text-secondary))]">
                                Choose a tour category and tour from the left sidebar to start editing
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TourEditorPage;
