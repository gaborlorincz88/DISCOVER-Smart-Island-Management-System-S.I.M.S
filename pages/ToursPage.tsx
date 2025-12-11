import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../services/config';

interface TourCategory {
    id: string;
    name: string;
}

interface Tour {
    id: string;
    name: string;
    description: string;
    coordinates: [number, number][];
    points: Array<{
        placeId: string;
        order: number;
        name: string;
        coordinates: [number, number];
    }>;
}

const ToursPage: React.FC = () => {
    const { t } = useTranslation();
    const [tourCategories, setTourCategories] = useState<TourCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [tours, setTours] = useState<Tour[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-[rgb(var(--text-primary))] mb-4">
                    {t('tours.title', 'Discover Tours')}
                </h1>
                <p className="text-lg text-[rgb(var(--text-secondary))]">
                    {t('tours.subtitle', 'Explore Gozo through guided tours, hiking trails, and adventure experiences')}
                </p>
            </div>

            {/* Tour Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {tourCategories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`p-6 rounded-xl shadow-lg transition-all duration-200 text-left ${
                            selectedCategory === category.id
                                ? 'bg-cyan-500 text-white shadow-cyan-500/25'
                                : 'bg-[rgb(var(--card-bg))] text-[rgb(var(--text-primary))] hover:shadow-xl hover:scale-105'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-semibold">{category.name}</h3>
                            {selectedCategory === category.id && (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <p className={`text-sm ${selectedCategory === category.id ? 'text-cyan-100' : 'text-[rgb(var(--text-secondary))]'}`}>
                            {t(`tours.categories.${category.id}.description`, 'Click to explore available tours')}
                        </p>
                    </button>
                ))}
            </div>

            {/* Tours List */}
            {selectedCategory && (
                <div className="bg-[rgb(var(--card-bg))] rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
                            {tourCategories.find(c => c.id === selectedCategory)?.name} - Available Tours
                        </h2>
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                            <p className="text-[rgb(var(--text-secondary))]">Loading tours...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={() => fetchTours(selectedCategory)}
                                className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : tours.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-[rgb(var(--text-secondary))] mb-4">No tours available for this category yet.</p>
                            <p className="text-sm text-[rgb(var(--text-secondary))]">Check back later or contact us for more information.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {tours.map((tour) => (
                                <div
                                    key={tour.id}
                                    className="bg-[rgb(var(--bg-light))] rounded-lg p-4 border border-[rgb(var(--border-color))] hover:border-cyan-500 transition-colors"
                                >
                                    <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-2">
                                        {tour.name}
                                    </h3>
                                    <p className="text-sm text-[rgb(var(--text-secondary))] mb-3">
                                        {tour.description}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
                                        <span>{tour.points.length} points of interest</span>
                                        <span className="bg-cyan-500 text-white px-2 py-1 rounded-full">
                                            {tour.coordinates.length} waypoints
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* No Category Selected State */}
            {!selectedCategory && (
                <div className="text-center py-12 bg-[rgb(var(--card-bg))] rounded-xl shadow-lg">
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2">
                        Select a Tour Category
                    </h3>
                    <p className="text-[rgb(var(--text-secondary))]">
                        Choose a category above to explore available tours and experiences
                    </p>
                </div>
            )}
        </div>
    );
};

export default ToursPage;
