// User Reviews Management Functions
let allReviews = [];
let filteredReviews = [];
let currentFilters = {
    status: 'all',
    type: 'all',
    search: ''
};

async function loadReviews() {
    try {
        const response = await fetch('/api/reviews/admin/all?limit=1000', { credentials: 'include' });
        const data = await response.json();
        
        allReviews = data.reviews || [];
        applyFilters();
        
        // Load statistics
        loadStatistics();
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        document.getElementById('reviews-container').innerHTML = 
            '<div class="error">Failed to load reviews. Please try again.</div>';
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/reviews/admin/stats', { credentials: 'include' });
        const data = await response.json();
        
        const overall = data.overall;
        
        document.getElementById('total-reviews').textContent = overall.total_reviews || 0;
        document.getElementById('average-rating').textContent = 
            overall.average_rating ? overall.average_rating.toFixed(1) : '-';
        document.getElementById('pending-reviews').textContent = overall.pending_reviews || 0;
        document.getElementById('hidden-reviews').textContent = overall.hidden_reviews || 0;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function applyFilters() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    
    currentFilters = {
        status: statusFilter,
        type: typeFilter,
        search: searchInput
    };
    
    filteredReviews = allReviews.filter(review => {
        // Status filter
        if (statusFilter === 'approved') {
            if (!review.is_approved || !review.is_visible) return false;
        } else if (statusFilter === 'pending') {
            if (review.is_approved) return false;
        } else if (statusFilter === 'hidden') {
            if (review.is_visible) return false;
        }
        
        // Type filter
        if (typeFilter === 'place' && !review.place_id) return false;
        if (typeFilter === 'tour' && !review.tour_id) return false;
        
        // Search filter
        if (searchInput) {
            const searchText = [
                review.title || '',
                review.comment || '',
                review.username || '',
                review.place_name || '',
                review.tour_name || ''
            ].join(' ').toLowerCase();
            
            if (!searchText.includes(searchInput)) return false;
        }
        
        return true;
    });
    
    displayReviews(filteredReviews);
}

function displayReviews(reviews) {
    const container = document.getElementById('reviews-container');
    
    if (reviews.length === 0) {
        container.innerHTML = '<div class="no-reviews">No reviews found matching your criteria.</div>';
        return;
    }

    container.innerHTML = reviews.map(review => `
        <div class="review-item ${getReviewStatusClass(review)}">
            <div class="review-header">
                <div class="review-info">
                    <h3 class="review-title">${review.title || 'No Title'}</h3>
                    <p class="review-meta">
                        ${review.username} • 
                        ${review.place_name || review.tour_name || 'Unknown Item'} • 
                        ${new Date(review.created_at).toLocaleDateString()}
                    </p>
                    <div class="review-rating">
                        ${generateStars(review.rating)}
                    </div>
                </div>
                <div>
                    <span class="status-badge ${getStatusBadgeClass(review)}">
                        ${getReviewStatus(review)}
                    </span>
                </div>
            </div>
            
            ${review.comment ? `
                <div class="review-content">
                    ${review.comment}
                </div>
            ` : ''}
            
            ${review.politeness_score !== undefined ? `
                <div class="politeness-info">
                    <div class="politeness-score">
                        <i class="fas fa-shield-alt"></i>
                        Politeness Score: ${review.politeness_score}/100
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${review.politeness_score}%; background-color: ${review.politeness_score <= 20 ? '#10b981' : review.politeness_score <= 50 ? '#f59e0b' : '#ef4444'};"></div>
                        </div>
                    </div>
                    ${review.moderation_reasons ? `
                        <div class="moderation-reasons">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>Moderation Reasons:</strong>
                            <ul>
                                ${JSON.parse(review.moderation_reasons).map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="review-actions">
                ${!review.is_approved ? `
                    <button class="btn-approve" onclick="approveReview(${review.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-reject" onclick="rejectReview(${review.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
                
                ${review.is_visible ? `
                    <button class="btn-hide" onclick="hideReview(${review.id})">
                        <i class="fas fa-eye-slash"></i> Hide
                    </button>
                ` : `
                    <button class="btn-show" onclick="showReview(${review.id})">
                        <i class="fas fa-eye"></i> Show
                    </button>
                `}
                
                <button class="btn-delete" onclick="deleteReview(${review.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star star"></i>';
        } else {
            stars += '<i class="fas fa-star star empty"></i>';
        }
    }
    return stars;
}

function getReviewStatus(review) {
    if (!review.is_approved) return 'Pending';
    if (!review.is_visible) return 'Hidden';
    return 'Approved';
}

function getReviewStatusClass(review) {
    if (!review.is_approved) return 'pending';
    if (!review.is_visible) return 'hidden';
    return 'approved';
}

function getStatusBadgeClass(review) {
    if (!review.is_approved) return 'status-pending';
    if (!review.is_visible) return 'status-hidden';
    return 'status-approved';
}

async function approveReview(reviewId) {
    if (!confirm('Are you sure you want to approve this review?')) return;
    
    try {
        const response = await fetch(`/api/reviews/admin/${reviewId}/approve`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            // Update local data
            const review = allReviews.find(r => r.id === reviewId);
            if (review) {
                review.is_approved = 1;
                review.is_visible = 1;
            }
            
            applyFilters();
            loadStatistics();
            
            // Show success message
            showNotification('Review approved successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Failed to approve review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error approving review:', error);
        showNotification('Failed to approve review. Please try again.', 'error');
    }
}

async function hideReview(reviewId) {
    if (!confirm('Are you sure you want to hide this review?')) return;
    
    try {
        const response = await fetch(`/api/reviews/admin/${reviewId}/hide`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            // Update local data
            const review = allReviews.find(r => r.id === reviewId);
            if (review) {
                review.is_visible = 0;
            }
            
            applyFilters();
            loadStatistics();
            
            // Show success message
            showNotification('Review hidden successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Failed to hide review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error hiding review:', error);
        showNotification('Failed to hide review. Please try again.', 'error');
    }
}

async function approveReview(reviewId) {
    try {
        const response = await fetch(`/api/reviews/${reviewId}/approve`, {
            method: 'PUT',
            credentials: 'include'
        });
        
        if (response.ok) {
            loadReviews();
            showNotification('Review approved successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Error approving review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error approving review:', error);
        showNotification('Failed to approve review. Please try again.', 'error');
    }
}

async function rejectReview(reviewId) {
    const reason = prompt('Please provide a reason for rejecting this review:');
    if (reason === null) return; // User cancelled
    
    try {
        const response = await fetch(`/api/reviews/${reviewId}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ reason: reason || 'No reason provided' })
        });
        
        if (response.ok) {
            loadReviews();
            showNotification('Review rejected successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Error rejecting review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error rejecting review:', error);
        showNotification('Failed to reject review. Please try again.', 'error');
    }
}

async function showReview(reviewId) {
    try {
        const response = await fetch(`/api/reviews/${reviewId}/show`, {
            method: 'PUT',
            credentials: 'include'
        });
        
        if (response.ok) {
            loadReviews();
            showNotification('Review shown successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Error showing review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error showing review:', error);
        showNotification('Failed to show review. Please try again.', 'error');
    }
}

async function deleteReview(reviewId) {
    if (!confirm('Are you sure you want to permanently delete this review? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/reviews/admin/${reviewId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            // Remove from local data
            allReviews = allReviews.filter(r => r.id !== reviewId);
            
            applyFilters();
            loadStatistics();
            
            // Show success message
            showNotification('Review deleted successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(`Failed to delete review: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting review:', error);
        showNotification('Failed to delete review. Please try again.', 'error');
    }
}

function refreshReviews() {
    loadReviews();
}

// Event listeners
document.getElementById('status-filter').addEventListener('change', applyFilters);
document.getElementById('type-filter').addEventListener('change', applyFilters);
document.getElementById('search-input').addEventListener('input', applyFilters);

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        font-weight: 500;
        max-width: 300px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadReviews();
});
