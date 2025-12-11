
import React from 'react';
import { Place, TripPlan } from '../types';
import TripPlanCard from '../components/TripPlanCard';

interface TripPlannerPageProps {
    tripPlans: TripPlan[];
    onCreateTrip: () => void;
    onSelectPlace: (place: Place) => void;
    onViewOnMap: (tripId: string) => void;
    onEditTrip: (trip: TripPlan) => void;
    onDeleteTrip: (tripId: string) => void;
}

const TripPlannerPage: React.FC<TripPlannerPageProps> = ({ tripPlans, onCreateTrip, onSelectPlace, onViewOnMap, onEditTrip, onDeleteTrip }) => {
    return (
        <div className="flex-1 bg-[rgb(var(--bg-light))] p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold text-[rgb(var(--text-primary))] tracking-tight">My Trips</h1>
                    <button
                        onClick={onCreateTrip}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-2.5 px-5 rounded-lg shadow-lg hover:shadow-blue-500/40 transition-all duration-200 ease-in-out flex items-center gap-2 transform hover:-translate-y-0.5 active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Create New Trip
                    </button>
                </div>

                {tripPlans.length === 0 ? (
                    <div className="text-center bg-[rgb(var(--card-bg))] p-12 rounded-xl shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-20 w-20 text-[rgb(var(--text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v11.494m-5.747-5.747h11.494" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21.75 12a9.75 9.75 0 1 1-19.5 0 9.75 9.75 0 0 1 19.5 0Z" />
                        </svg>
                        <h2 className="mt-4 text-2xl font-semibold text-[rgb(var(--text-primary))]">Your adventure awaits!</h2>
                        <p className="mt-2 text-[rgb(var(--text-secondary))]">You haven't created any trip plans yet. Click the button above to start planning your next journey.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {tripPlans.map(plan => (
                            <TripPlanCard 
                                key={plan.id} 
                                trip={plan} 
                                onSelectPlace={onSelectPlace} 
                                onViewOnMap={() => onViewOnMap(plan.id)}
                                onEdit={() => onEditTrip(plan)}
                                onDelete={() => onDeleteTrip(plan.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TripPlannerPage;
