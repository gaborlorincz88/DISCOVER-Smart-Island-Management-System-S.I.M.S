import React, { useState, useEffect } from 'react';
import { TripPlan } from '../types';

interface CreateTripModalProps {
    onClose: () => void;
    onSave: (name: string, icon: string, tripId?: string) => void;
    tripToEdit?: TripPlan | null;
}

const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onSave, tripToEdit }) => {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('🗺️');
    const [error, setError] = useState('');
    
    useEffect(() => {
        if (tripToEdit) {
            setName(tripToEdit.name);
            setIcon(tripToEdit.icon);
        } else {
            setName('');
            setIcon('🗺️');
        }
    }, [tripToEdit]);

    const popularIcons = ['🗺️', '✈️', '🚗', '🏖️', '⛰️', '🏙️', '🏰', '🎉', '💼'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please give your trip a name.');
            return;
        }
        onSave(name, icon, tripToEdit?.id);
    };
    
    const isEditing = !!tripToEdit;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[rgb(var(--card-bg))] rounded-lg shadow-2xl p-8 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-2 right-2 text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-2xl font-bold text-center text-[rgb(var(--text-primary))] mb-6">
                    {isEditing ? 'Edit Trip Plan' : 'Create a New Trip Plan'}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-[rgb(var(--text-primary))] text-sm font-bold mb-2" htmlFor="trip-name">
                            Trip Name
                        </label>
                        <input
                            id="trip-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="shadow appearance-none border border-[rgb(var(--border-color))] rounded w-full py-2 px-3 text-[rgb(var(--text-primary))] leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--input-bg))]"
                            placeholder="e.g., Summer in Italy"
                        />
                    </div>
                     <div className="mb-6">
                        <label className="block text-[rgb(var(--text-primary))] text-sm font-bold mb-2">
                            Choose an Icon
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {popularIcons.map(ic => (
                                <button
                                    key={ic}
                                    type="button"
                                    onClick={() => setIcon(ic)}
                                    className={`text-3xl p-2 rounded-lg transition-all duration-150 ${icon === ic ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-[rgb(var(--input-bg))] hover:bg-[rgb(var(--bg-hover))]'}`}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors"
                    >
                        {isEditing ? 'Save Changes' : 'Create Trip'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateTripModal;