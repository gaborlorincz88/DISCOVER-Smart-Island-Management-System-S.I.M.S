import { TripPlan } from '../types';
import { getApiBaseUrl } from './config';

const API_BASE_URL = `${getApiBaseUrl()}/api/trips`;

export interface TripData {
  id: string;
  userId: string;
  name: string;
  icon: string;
  places: any[];
  routeInfo?: any;
}

export const tripsService = {
  // Get all trips for a user
  async getUserTrips(userId: string): Promise<TripPlan[]> {
    try {
      const response = await fetch(`${API_BASE_URL}?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trips: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching trips:', error);
      throw error;
    }
  },

  // Create a new trip
  async createTrip(tripData: TripData): Promise<{ message: string; id: string }> {
    try {
      console.log('=== TRIPS SERVICE: Creating trip ===');
      console.log('API URL:', API_BASE_URL);
      console.log('Trip data:', tripData);
      
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        throw new Error(`Failed to create trip: ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Trip created successfully:', result);
      return result;
    } catch (error) {
      console.error('=== TRIPS SERVICE ERROR ===');
      console.error('Error creating trip:', error);
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Update an existing trip
  async updateTrip(tripId: string, tripData: Partial<TripData>): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/${tripId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update trip: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  },

  // Delete a trip
  async deleteTrip(tripId: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/${tripId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete trip: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  },
};
