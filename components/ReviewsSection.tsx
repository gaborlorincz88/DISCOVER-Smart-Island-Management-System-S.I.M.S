import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Place } from '../types';
import { reviewsService, Review, ReviewStats, CreateReviewData } from '../services/reviewsService';
import { useTranslation } from 'react-i18next';

interface ReviewsSectionProps {
  place: Place;
  onLoginClick: () => void;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({ place, onLoginClick }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadReviews();
    loadStats();
  }, [place.id]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      // For tours, extract ID from "tour-XXX" format (XXX can be numeric or string like "green-bus")
      let itemId: string | number = place.id;
      if (place.type === 'tour') {
        // Extract ID after "tour-" prefix
        if (place.id.startsWith('tour-')) {
          const extractedId = place.id.substring(5); // Remove "tour-" prefix
          // Keep as string - can be "green-bus" or "123" (both are valid)
          itemId = extractedId;
        } else {
          // If ID doesn't start with "tour-", use it directly
          itemId = place.id;
        }
      }
      // Load ALL reviews for this place/tour (don't filter by user)
      // IMPORTANT: For tours, only pass tour_id, never pass place_id
      // tour_id can be string (like "green-bus") or number
      const data = await reviewsService.getReviews(
        place.type === 'tour' ? undefined : itemId,
        place.type === 'tour' ? itemId : undefined,
        10,
        0
        // Don't pass userId - we want to see all reviews
      );
      setReviews(data.reviews);
      
      // Check if user has already reviewed this place/tour
      if (user) {
        const existingReview = data.reviews.find(review => review.user_id === user.id);
        setUserReview(existingReview || null);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      setError(t('reviews.failed_to_load'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // For tours, extract ID from "tour-XXX" format (XXX can be numeric or string like "green-bus")
      let itemId: string | number = place.id;
      if (place.type === 'tour') {
        // Extract ID after "tour-" prefix
        if (place.id.startsWith('tour-')) {
          const extractedId = place.id.substring(5); // Remove "tour-" prefix
          // Keep as string - can be "green-bus" or "123" (both are valid)
          itemId = extractedId;
        } else {
          // If ID doesn't start with "tour-", use it directly
          itemId = place.id;
        }
      }
      // IMPORTANT: For tours, only pass tour_id, never pass place_id
      // tour_id can be string (like "green-bus") or number
      const data = await reviewsService.getReviewStats(
        place.type === 'tour' ? undefined : itemId,
        place.type === 'tour' ? itemId : undefined
      );
      if (data.stats.length > 0) {
        setStats(data.stats[0]);
      }
    } catch (error) {
      console.error('Error loading review stats:', error);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      onLoginClick();
      return;
    }

    if (userReview) {
      // Update existing review
      try {
        setSubmitting(true);
        await reviewsService.updateReview(userReview.id, {
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined
        }, user.id);
        
        // Reload reviews and stats
        await loadReviews();
        await loadStats();
        setShowReviewForm(false);
        setError(null);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Create new review
      try {
        setSubmitting(true);
        setError(null); // Clear any previous errors
        // For tours, extract ID from "tour-XXX" format (XXX can be numeric or string like "green-bus")
        let itemId: string | number = place.id;
        if (place.type === 'tour') {
          console.log('[Reviews] Extracting tour ID from:', place.id);
          // Extract ID after "tour-" prefix
          if (place.id.startsWith('tour-')) {
            const extractedId = place.id.substring(5); // Remove "tour-" prefix
            console.log('[Reviews] Extracted ID after "tour-":', extractedId);
            // Keep as string - can be "green-bus" or "123" (both are valid)
            itemId = extractedId;
            console.log('[Reviews] Using tour ID (string):', itemId);
          } else {
            // If ID doesn't start with "tour-", use it directly
            console.log('[Reviews] Tour ID does not start with "tour-", using directly');
            itemId = place.id;
          }
        }
        console.log('[Reviews] Submitting review with:', {
          place_type: place.type,
          itemId,
          tour_id: place.type === 'tour' ? itemId : undefined,
          place_id: place.type === 'tour' ? undefined : itemId
        });
        // IMPORTANT: For tours, only pass tour_id, never pass place_id
        // tour_id can be string (like "green-bus") or number
        await reviewsService.createReview({
          place_id: place.type === 'tour' ? undefined : itemId,
          tour_id: place.type === 'tour' ? itemId : undefined,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined
        }, user.id);
        
        // Reload reviews and stats
        await loadReviews();
        await loadStats();
        setShowReviewForm(false);
        setTitle('');
        setComment('');
        setRating(5);
        setError(null);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview || !user || !confirm(t('reviews.delete_confirm'))) return;

    try {
      await reviewsService.deleteReview(userReview.id, user.id);
      setUserReview(null);
      await loadReviews();
      await loadStats();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const StarRating: React.FC<{ rating: number; interactive?: boolean; onRatingChange?: (rating: number) => void }> = ({ 
    rating, 
    interactive = false, 
    onRatingChange 
  }) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRatingChange?.(star)}
            className={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-[rgb(var(--bg-light))] rounded-lg border border-[rgb(var(--border-color))]">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <span className="ml-3 text-[rgb(var(--text-secondary))]">{t('reviews.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-[rgb(var(--bg-light))] rounded-lg border border-[rgb(var(--border-color))]">
      <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))] mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
        {t('reviews.title')}
      </h3>

      {/* Review Statistics */}
      {stats && (
        <div className="mb-6 p-4 bg-[rgb(var(--bg-primary))] rounded-lg border border-[rgb(var(--border-color))]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <StarRating rating={Math.round(stats.average_rating)} />
              <span className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                {stats.average_rating.toFixed(1)}
              </span>
            </div>
            <span className="text-sm text-[rgb(var(--text-secondary))]">
              {stats.total_reviews === 1 
                ? t('reviews.reviews_count', { count: stats.total_reviews })
                : t('reviews.reviews_count_plural', { count: stats.total_reviews })}
            </span>
          </div>
          
          {/* Rating breakdown */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = star === 5 ? stats.five_star_count :
                           star === 4 ? stats.four_star_count :
                           star === 3 ? stats.three_star_count :
                           star === 2 ? stats.two_star_count :
                           stats.one_star_count;
              const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
              
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm text-[rgb(var(--text-secondary))] w-8">{star}★</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-[rgb(var(--text-secondary))] w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Form */}
      {user ? (
        <div className="mb-6">
          {userReview ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-800">{t('reviews.your_review')}</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="text-sm text-green-600 hover:text-green-800 font-medium"
                  >
                    {showReviewForm ? t('reviews.cancel') : t('reviews.edit')}
                  </button>
                  <button
                    onClick={handleDeleteReview}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    {t('reviews.delete')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={userReview.rating} />
                <span className="text-sm text-green-700">{userReview.title}</span>
              </div>
              {userReview.comment && (
                <p className="text-sm text-green-700">{userReview.comment}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowReviewForm(true)}
              className="w-full text-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center gap-2 mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              {t('reviews.write_review')}
            </button>
          )}

          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="p-4 bg-[rgb(var(--bg-primary))] rounded-lg border border-[rgb(var(--border-color))]">
              <h4 className="font-semibold text-[rgb(var(--text-primary))] mb-3">
                {userReview ? t('reviews.edit_review') : t('reviews.write_review')}
              </h4>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                  {t('reviews.rating')} *
                </label>
                <StarRating 
                  rating={rating} 
                  interactive={true} 
                  onRatingChange={setRating} 
                />
              </div>

              <div className="mb-4">
                <label htmlFor="review-title" className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                  {t('reviews.title_label')}
                </label>
                <input
                  type="text"
                  id="review-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))] focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder={t('reviews.title_placeholder')}
                />
              </div>

              <div className="mb-4">
                <label htmlFor="review-comment" className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                  {t('reviews.comment_label')}
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--bg-light))] text-[rgb(var(--text-primary))] focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder={t('reviews.comment_placeholder')}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  {submitting ? t('reviews.submitting') : (userReview ? t('reviews.update_review') : t('reviews.submit_review'))}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewForm(false);
                    setError(null);
                    if (!userReview) {
                      setTitle('');
                      setComment('');
                      setRating(5);
                    }
                  }}
                  className="px-4 py-3 border border-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
                >
                  {t('reviews.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 mb-3">
            {t('reviews.sign_in_to_review')}
          </p>
          <button
            onClick={onLoginClick}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            {t('reviews.sign_in_button')}
          </button>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-semibold text-[rgb(var(--text-primary))]">
            {t('reviews.recent_reviews', { count: reviews.length })}
          </h4>
          {reviews.map((review) => (
            <div key={review.id} className="p-3 bg-[rgb(var(--bg-primary))] rounded-lg border border-[rgb(var(--border-color))]">
              {/* Stars centered at top */}
              <div className="flex justify-center mb-0.5">
                <StarRating rating={review.rating} />
              </div>
              
              {/* Title centered below stars */}
              {review.title && (
                <h5 className="font-semibold text-[rgb(var(--text-primary))] mb-0.5 text-center text-sm">{review.title}</h5>
              )}
              
              {/* Review text unchanged */}
              {review.comment && (
                <p className="text-[rgb(var(--text-secondary))] text-sm leading-snug mb-1">{review.comment}</p>
              )}
              
              {/* Username and date in bottom right corner */}
              <div className="flex justify-end mt-0.5">
                <div className="text-right">
                  <div className="font-medium text-[rgb(var(--text-primary))] text-xs">{review.username}</div>
                  <div className="text-xs text-[rgb(var(--text-secondary))]">
                    {reviewsService.formatDate(review.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[rgb(var(--text-secondary))]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-4 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
          <p>{t('reviews.no_reviews')}</p>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
