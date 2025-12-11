import { getApiBaseUrl } from './config';

export interface TreasureHunt {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TreasureHuntClue {
  id: number;
  treasure_hunt_id: number;
  clue_number: number;
  title?: string;
  clue_text: string;
  answer: string;
  latitude: number;
  longitude: number;
  icon?: string;
  hint?: string;
  created_at: string;
  updated_at: string;
}

export interface TreasureHuntProgress {
  id: number;
  user_id: string;
  treasure_hunt_id: number;
  current_clue_number: number;
  completed_clues: string; // JSON array of clue IDs
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TreasureHuntWithClues extends TreasureHunt {
  clues: TreasureHuntClue[];
}

class TreasureHuntService {
  private baseUrl = `${getApiBaseUrl()}/api/treasure-hunts`;

  async getTreasureHunts(): Promise<TreasureHunt[]> {
    try {
      const response = await fetch(this.baseUrl, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch treasure hunts');
      return await response.json();
    } catch (error) {
      console.error('Error fetching treasure hunts:', error);
      return [];
    }
  }

  async getHuntDetails(huntId: number): Promise<TreasureHuntWithClues | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${huntId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch hunt details');
      return await response.json();
    } catch (error) {
      console.error('Error fetching hunt details:', error);
      return null;
    }
  }

  async startHunt(huntId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${huntId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (response.status === 401) {
        return { success: false, error: 'Please log in to start a treasure hunt' };
      }
      if (!response.ok) throw new Error(data.error || 'Failed to start hunt');
      return { success: true };
    } catch (error: any) {
      console.error('Error starting hunt:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserProgress(huntId: number): Promise<TreasureHuntProgress | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${huntId}/progress`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        // User not authenticated or session expired
        return null;
      }
      if (!response.ok) throw new Error('Failed to fetch progress');
      return await response.json();
    } catch (error) {
      console.error('Error fetching progress:', error);
      return null;
    }
  }

  async solveClue(
    huntId: number,
    clueNumber: number,
    answer: string,
    userLocation: { lat: number; lng: number }
  ): Promise<{ success: boolean; error?: string; nextClue?: TreasureHuntClue; completed?: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/${huntId}/solve-clue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clue_number: clueNumber,
          answer: answer,
          userLatitude: userLocation.lat,
          userLongitude: userLocation.lng
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to solve clue');
      console.log('Backend response:', data);
      return { success: true, nextClue: data.nextClue, completed: data.completed || data.progress?.is_completed || false };
    } catch (error: any) {
      console.error('Error solving clue:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentClue(huntId: number): Promise<TreasureHuntClue | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${huntId}/current-clue`, {
        credentials: 'include'
      });
      if (response.status === 401) {
        // User not authenticated or session expired
        return null;
      }
      if (response.status === 404) {
        // No clue found (hunt not started or completed)
        return null;
      }
      if (!response.ok) throw new Error('Failed to fetch current clue');
      const data = await response.json();
      // Backend returns { clue: {...}, progress: {...} }, extract just the clue
      return data.clue || null;
    } catch (error) {
      console.error('Error fetching current clue:', error);
      return null;
    }
  }

  // Note: We no longer delete progress when "stopping" a hunt
  // Progress is preserved so users can resume later
  // This method is kept for backwards compatibility but not used
  async stopHunt(_huntId: number): Promise<{ success: boolean; error?: string }> {
    // Just return success - we don't actually delete progress
    return { success: true };
  }
}

export const treasureHuntService = new TreasureHuntService();

