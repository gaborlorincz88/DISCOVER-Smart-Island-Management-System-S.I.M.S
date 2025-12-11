-- Migration: Add comprehensive analytics tables
-- Date: 2024-01-XX
-- Description: Add tables for enhanced analytics tracking including sessions, device info, and geographic data

-- Create analytics_sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    device_info TEXT, -- JSON string with device, browser, OS info
    location_info TEXT, -- JSON string with country, region info
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INTEGER, -- Duration in seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to analytics_events table
ALTER TABLE analytics_events ADD COLUMN session_id TEXT;
ALTER TABLE analytics_events ADD COLUMN user_id TEXT;
ALTER TABLE analytics_events ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_start_time ON analytics_sessions(start_time);

-- Update existing analytics_events records to have current timestamp
UPDATE analytics_events SET timestamp = CURRENT_TIMESTAMP WHERE timestamp IS NULL;

-- Create view for easy analytics queries
CREATE VIEW IF NOT EXISTS analytics_summary AS
SELECT 
    event_type,
    COUNT(*) as total_events,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users,
    DATE(timestamp) as event_date,
    strftime('%H', timestamp) as event_hour
FROM analytics_events 
WHERE timestamp IS NOT NULL
GROUP BY event_type, DATE(timestamp), strftime('%H', timestamp);

-- Create view for geographic analytics
CREATE VIEW IF NOT EXISTS analytics_geographic AS
SELECT 
    json_extract(event_data, '$.latitude') as latitude,
    json_extract(event_data, '$.longitude') as longitude,
    json_extract(event_data, '$.place_name') as place_name,
    json_extract(event_data, '$.category') as category,
    COUNT(*) as visit_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics_events 
WHERE event_type = 'view_place' 
    AND json_extract(event_data, '$.latitude') IS NOT NULL
    AND json_extract(event_data, '$.longitude') IS NOT NULL
GROUP BY latitude, longitude, place_name, category;

-- Create view for device analytics
CREATE VIEW IF NOT EXISTS analytics_devices AS
SELECT 
    json_extract(device_info, '$.device_type') as device_type,
    json_extract(device_info, '$.browser') as browser,
    json_extract(device_info, '$.os') as os,
    json_extract(device_info, '$.screen_resolution') as screen_resolution,
    COUNT(*) as session_count,
    AVG(duration) as avg_duration,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics_sessions 
WHERE device_info IS NOT NULL
GROUP BY device_type, browser, os, screen_resolution;
