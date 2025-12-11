import { Place } from '../types';
import { getApiBaseUrl } from './config';

export interface Review {
  id: number;
  user_id: string;
  place_id?: number;
  tour_id?: number;
  rating: number;
  title?: string;
  comment?: string;
  username: string;
  email: string;
  place_name?: string;
  place_category?: string;
  tour_name?: string;
  tour_category?: string;
  is_approved: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  item_name: string;
  item_category: string;
  item_type: 'place' | 'tour';
  item_id: number;
  total_reviews: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  approved_reviews: number;
  pending_reviews: number;
  last_review_date: string;
}

export interface CreateReviewData {
  place_id?: number | string;
  tour_id?: number | string; // Can be numeric (database) or string (JSON files like "green-bus")
  rating: number;
  title?: string;
  comment?: string;
}

const API_BASE = getApiBaseUrl();

export const reviewsService = {
  // Get reviews for a specific place or tour
  async getReviews(placeId?: number | string, tourId?: number | string, limit: number = 10, offset: number = 0, userId?: string): Promise<{ reviews: Review[]; pagination: any }> {
    const params = new URLSearchParams();
    if (placeId !== undefined && placeId !== null) params.append('place_id', placeId.toString());
    if (tourId !== undefined && tourId !== null) params.append('tour_id', tourId.toString());
    // Only add user_id if provided (for admin functions)
    if (userId) params.append('user_id', userId);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('approved_only', 'true');

    const response = await fetch(`${API_BASE}/api/reviews?${params}`);

    if (!response.ok) {
      throw new Error('Failed to fetch reviews');
    }

    return response.json();
  },

  // Get review statistics for a place or tour
  async getReviewStats(placeId?: number | string, tourId?: number | string): Promise<{ stats: ReviewStats[] }> {
    const params = new URLSearchParams();
    if (placeId !== undefined && placeId !== null) params.append('place_id', placeId.toString());
    if (tourId !== undefined && tourId !== null) params.append('tour_id', tourId.toString());

    const response = await fetch(`${API_BASE}/api/reviews/stats?${params}`);

    if (!response.ok) {
      throw new Error('Failed to fetch review statistics');
    }

    return response.json();
  },

  // Create a new review
  async createReview(reviewData: CreateReviewData, userId: string): Promise<{ review: Review }> {
    const response = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...reviewData, userId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create review');
    }

    return response.json();
  },

  // Update a review
  async updateReview(reviewId: number, reviewData: Partial<CreateReviewData>, userId: string): Promise<{ review: Review }> {
    const response = await fetch(`${API_BASE}/api/reviews/${reviewId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...reviewData, userId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update review');
    }

    return response.json();
  },

  // Delete a review
  async deleteReview(reviewId: number, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete review');
    }
  },

  // Helper function to generate star display
  generateStars(rating: number, maxRating: number = 5): string {
    let stars = '';
    for (let i = 1; i <= maxRating; i++) {
      if (i <= rating) {
        stars += '★';
      } else {
        stars += '☆';
      }
    }
    return stars;
  },

  // Helper function to format date
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};
