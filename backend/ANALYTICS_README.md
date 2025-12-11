# Discover Gozo Analytics System

## Overview

The Discover Gozo Analytics System provides comprehensive tracking and visualization of user interactions, tourism patterns, and app usage statistics. This system is designed to provide valuable insights for the Ministry of Tourism and help optimize the tourism experience in Gozo.

## Features

### 🎯 **Core Analytics**
- **User Engagement**: Session tracking, page views, feature usage
- **Geographic Analytics**: Heatmap visualization of tourist traffic
- **Device Analytics**: Browser, OS, and device type statistics
- **Time-based Analytics**: Peak hours, daily trends, seasonal patterns
- **Economic Activity**: Commercial POI interactions and booking patterns

### 🗺️ **Gozo Heatmap**
- Real-time visualization of tourist traffic density
- Color-coded intensity levels (blue → red)
- Category filtering (beaches, historical sites, nature spots, etc.)
- Interactive markers for top visited places
- Legend showing traffic intensity levels

### 📊 **Dashboard Components**
- **Real-time Stats Cards**: Active users, total views, session duration
- **Comprehensive Charts**: 12+ different chart types
- **Real-time Activity Feed**: Live user activity monitoring
- **Export Functionality**: CSV/JSON data export for Ministry reports

### 🔄 **Real-time Monitoring**
- Live activity feed with 5-second updates
- Current popular places tracking
- Active session monitoring
- Real-time event streaming

## API Endpoints

### Analytics Events
- `POST /api/analytics/event` - Track user events
- `POST /api/analytics/session` - Track user sessions
- `GET /api/analytics/summary` - Basic analytics summary
- `GET /api/analytics/comprehensive` - Full analytics data
- `GET /api/analytics/real-time` - Real-time analytics
- `GET /api/analytics/export` - Export analytics data

### Parameters
- `period`: Time period filter (7d, 30d, 90d, 1y)
- `format`: Export format (json, csv)

## Database Schema

### Tables
- `analytics_events` - Individual user events
- `analytics_sessions` - User session data
- `analytics_summary` - Pre-computed summary view
- `analytics_geographic` - Geographic analytics view
- `analytics_devices` - Device analytics view

### Event Types Tracked
- `page_load` - Page load events
- `page_view` - Page navigation
- `view_place` - Place viewing
- `search_query` - Search interactions
- `create_trip` - Trip creation
- `bookmark_place` - Place bookmarking
- `add_to_trip` - Adding places to trips
- `map_interaction` - Map interactions
- `button_click` - Button clicks
- `error` - Error tracking

## Frontend Integration

### Analytics Tracker
Include the analytics tracker in your HTML:
```html
<script src="/analytics-tracker.js"></script>
```

### Usage Examples
```javascript
// Track page view
analytics.trackPageView('Home Page');

// Track place view
analytics.trackPlaceView('place-123', 'Ramla Bay', 'Beach', 36.045, 14.25);

// Track search
analytics.trackSearch('beaches', 15);

// Track trip creation
analytics.trackTripCreation('My Gozo Adventure', 5);

// Track button clicks
analytics.trackButtonClick('Book Now', 'Tour Details');

// Track map interactions
analytics.trackMapInteraction('zoom', { zoom_level: 12 });
```

## Dashboard Features

### 📈 **Analytics Controls**
- Time period selector (7d, 30d, 90d, 1y)
- Refresh button for real-time updates
- Export button for data download
- Heatmap toggle and category filtering

### 🗺️ **Gozo Heatmap**
- Interactive Leaflet map with Gozo tiles
- Heatmap layer showing traffic intensity
- Individual markers for top places
- Category filtering (All, Beaches, Historical, etc.)
- Color-coded legend (Blue → Red intensity)

### 📊 **Chart Types**
1. **User Engagement Trends** - Line chart
2. **Device & Browser Usage** - Doughnut chart
3. **Peak Usage Hours** - Line chart
4. **Daily Activity Trends** - Bar chart
5. **Top Viewed Places** - Horizontal bar chart
6. **Category Popularity** - Doughnut chart
7. **Search Analytics** - Horizontal bar chart
8. **Economic Activity** - Horizontal bar chart
9. **Trip Analytics** - Multiple chart types
10. **Real-time Activity Feed** - Live event stream

## Installation & Setup

### 1. Database Migration
Run the migration script to create analytics tables:
```sql
-- Run the migration
.read migrations/add_analytics_tables.sql
```

### 2. Backend Setup
The analytics routes are automatically included in your Express app.

### 3. Frontend Integration
Add the analytics tracker to your HTML pages:
```html
<script src="/analytics-tracker.js"></script>
```

### 4. Admin Dashboard
Access the analytics dashboard at `/admin.html` and click the "Analytics" tab.

## Data Privacy & Compliance

### Anonymization
- No personal identifiers stored
- Session-based tracking only
- IP addresses not stored
- User data aggregated for insights

### GDPR Compliance
- Anonymous data collection
- No cookies for tracking
- Data retention policies
- Export/delete capabilities

## Ministry Benefits

### Tourism Insights
- **Popular Destinations**: Identify most visited places
- **Seasonal Patterns**: Understand peak tourism periods
- **Geographic Distribution**: See where tourists spend time
- **Economic Impact**: Track commercial activity

### Planning & Development
- **Infrastructure Needs**: Identify areas needing development
- **Marketing Opportunities**: Target under-visited areas
- **Capacity Planning**: Manage tourist density
- **Sustainability**: Monitor environmental impact

### Reporting
- **Automated Reports**: Regular data exports
- **Custom Periods**: Flexible time range analysis
- **Real-time Monitoring**: Live tourism activity
- **Data Export**: CSV/JSON for further analysis

## Technical Specifications

### Performance
- Optimized database queries with indexes
- Cached analytics views
- Efficient real-time updates
- Minimal impact on app performance

### Scalability
- Horizontal scaling support
- Database optimization
- Caching strategies
- CDN integration ready

### Security
- Input validation
- SQL injection prevention
- Rate limiting
- Secure data transmission

## Troubleshooting

### Common Issues
1. **Charts not loading**: Check browser console for errors
2. **Heatmap not showing**: Verify Leaflet.js is loaded
3. **Real-time feed stopped**: Check network connection
4. **Export not working**: Verify file permissions

### Debug Mode
Enable debug logging in the analytics tracker:
```javascript
window.analytics.debug = true;
```

## Future Enhancements

### Planned Features
- **Predictive Analytics**: Tourism forecasting
- **AI Insights**: Automated pattern detection
- **Mobile App Integration**: Native app tracking
- **Advanced Visualizations**: 3D maps, animations
- **API Integrations**: Weather, events, social media

### Customization
- **Custom Event Types**: Add your own tracking
- **Custom Charts**: Create specialized visualizations
- **Custom Reports**: Generate specific analytics
- **Custom Dashboards**: Build targeted views

## Support

For technical support or feature requests, contact the development team or create an issue in the project repository.

---

**Note**: This analytics system is designed to provide valuable insights while respecting user privacy and maintaining high performance standards.
