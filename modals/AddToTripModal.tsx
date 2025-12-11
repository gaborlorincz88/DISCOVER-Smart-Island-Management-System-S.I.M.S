
import React from 'react';
import { TripPlan } from '../types';

interface AddToTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripPlans: TripPlan[];
    onSelectTrip: (tripId: string) => void;
}

const AddToTripModal: React.FC<AddToTripModalProps> = ({ isOpen, onClose, tripPlans, onSelectTrip }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
                 <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Add to which trip?</h2>
                <ul className="space-y-3 max-h-60 overflow-y-auto">
                    {tripPlans.map(plan => (
                        <li key={plan.id}>
                            <button
                                onClick={() => onSelectTrip(plan.id)}
                                className="w-full text-left p-4 hover:bg-gray-100 rounded-md cursor-pointer border border-gray-200 hover:border-blue-300 transition-all duration-150 flex items-center gap-4"
                            >
                                <span className="text-3xl">{plan.icon}</span>
                                <span className="font-semibold text-gray-700">{plan.name}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AddToTripModal;