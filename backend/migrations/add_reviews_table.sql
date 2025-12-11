-- Migration: Add user reviews table
-- Date: 2024-01-XX
-- Description: Add table for user reviews and ratings for places and tours

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    place_id INTEGER, -- Can be null if it's a tour review
    tour_id INTEGER,  -- Can be null if it's a place review
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    is_approved BOOLEAN DEFAULT 1,
    is_visible BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
    CONSTRAINT check_place_or_tour CHECK (
        (place_id IS NOT NULL AND tour_id IS NULL) OR 
        (place_id IS NULL AND tour_id IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible);

-- Create view for review statistics
CREATE VIEW IF NOT EXISTS review_stats AS
SELECT 
    COALESCE(p.name, t.name) as item_name,
    COALESCE(p.category, t.category) as item_category,
    CASE 
        WHEN p.id IS NOT NULL THEN 'place'
        WHEN t.id IS NOT NULL THEN 'tour'
    END as item_type,
    COALESCE(r.place_id, r.tour_id) as item_id,
    COUNT(*) as total_reviews,
    AVG(r.rating) as average_rating,
    COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count,
    COUNT(CASE WHEN r.is_approved = 1 THEN 1 END) as approved_reviews,
    COUNT(CASE WHEN r.is_approved = 0 THEN 1 END) as pending_reviews,
    MAX(r.created_at) as last_review_date
FROM reviews r
LEFT JOIN places p ON r.place_id = p.id
LEFT JOIN tours t ON r.tour_id = t.id
WHERE r.is_visible = 1
GROUP BY COALESCE(r.place_id, r.tour_id), COALESCE(p.name, t.name), COALESCE(p.category, t.category);
