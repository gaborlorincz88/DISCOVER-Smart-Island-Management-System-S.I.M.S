import { getApiBaseUrl } from './config';

const API_BASE = getApiBaseUrl();

export interface TourData {
  id: string;
  name: string;
  description: string;
  importantInfo?: string;
  icon: string;
  iconSize: number;
  polylineColor: string;
  mainImage: string;
  currency: string;
  prices: {
    adult: number;
    child?: number;
    senior?: number;
  };
  duration: string;
  maxParticipants?: number;
  coordinates: [number, number][];
  points: Array<{
    placeId: string;
    order: number;
    name: string;
    coordinates: [number, number];
    type: string;
    lat: number;
    lng: number;
    description: string;
    images: string[];
  }>;
}

export const tourService = {
  // Get tour data by ID (can be either tour ID or ticket ID)
  async getTourById(tourId: string): Promise<TourData | null> {
    try {
      console.log('=== TOUR SERVICE: Fetching tour data ===');
      console.log('Input ID:', tourId);
      
      // First, check if it's a ticket ID and map it to tour ID
      const ticketToTourMapping: { [key: string]: string } = {
        'ticket-1': 'gozo-bus-tour', // Gozo Bus Tour
        'ticket-2': 'comino-tour', // Comino Boat Trip
        'ticket-3': 'hiking-tour', // Hiking Trail Guide
        'ticket-4': 'coastal-explorer', // Quad Bike Adventure
        'ticket-5': 'parasailing-1', // Parasailing Adventure
      };
      
      // Map ticket ID to tour ID if needed
      const actualTourId = ticketToTourMapping[tourId] || tourId;
      console.log('Actual tour ID:', actualTourId);
      
      // Map tour ID to category and file name
      const tourMapping: { [key: string]: { category: string; fileName: string } } = {
        'parasailing-1': { category: 'parasailing', fileName: 'parasailing-1.json' },
        'comino-tour': { category: 'boat-tour', fileName: 'comino-tour.json' },
        'gozo-bus-tour': { category: 'sightseeing', fileName: 'gozo-bus-tour.json' },
        'green-bus': { category: 'sightseeing', fileName: 'green-bus.json' },
        'sightseeing-bus': { category: 'sightseeing', fileName: 'sightseeing-bus.json' },
        'hiking-tour': { category: 'hiking', fileName: 'hiking-tour.json' },
        'quad-tours': { category: 'quad-tours', fileName: 'quad-tours.json' },
        'coastal-explorer': { category: 'quad-tours', fileName: 'coastal-explorer.json' },
        'gozo-adventure': { category: 'jeep-tours', fileName: 'gozo-adventure.json' },
        'comino-walk': { category: 'hiking', fileName: 'comino-walk.json' },
        'daħlet-qorrot-walk': { category: 'hiking', fileName: 'daħlet-qorrot-walk.json' },
        'dwejra-walk': { category: 'hiking', fileName: 'dwejra-walk.json' },
        'ħondoq-ir-rummien-walk': { category: 'hiking', fileName: 'ħondoq-ir-rummien-walk.json' },
        'ta\'-ġurdan-walk': { category: 'hiking', fileName: 'ta\'-ġurdan-walk.json' },
        'xlendi-walk': { category: 'hiking', fileName: 'xlendi-walk.json' },
      };

      const mapping = tourMapping[actualTourId];
      if (!mapping) {
        console.log('No mapping found for tour ID:', actualTourId);
        return null;
      }

      const response = await fetch(`${API_BASE}/api/tours/${mapping.category}/${mapping.fileName.replace('.json', '')}`);
      
      if (!response.ok) {
        console.log('Tour not found or error:', response.status);
        return null;
      }

      const tourData = await response.json();
      console.log('Tour data fetched:', tourData);
      return tourData;
    } catch (error) {
      console.error('Error fetching tour data:', error);
      return null;
    }
  },

  // Get all tours by category
  async getToursByCategory(category: string): Promise<TourData[]> {
    try {
      const response = await fetch(`${API_BASE}/api/tours/${category}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tours');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching tours by category:', error);
      return [];
    }
  }
};
