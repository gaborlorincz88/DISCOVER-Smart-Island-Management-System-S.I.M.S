# AI Agent Instructions for Discover Gozo Ticket Validator

## Project Overview
Flutter mobile application for merchants to validate tickets for Discover Gozo tours. The app enables QR code scanning, ticket validation, and history tracking through a REST API integration.

## Architecture Patterns

### State Management
- Uses Provider pattern for app-wide state (`lib/providers/auth_provider.dart`)
- Authentication state persisted locally via SharedPreferences
- Each screen has its own local state management when needed

### Service Layer
- Centralized API communication through `ApiService` (`lib/services/api_service.dart`)
- All HTTP requests require Bearer token authentication
- Base URL: `http://192.168.1.102:3003/api`

### Data Models
Key models in `lib/models/`:
- `merchant.dart`: Merchant profile and authentication
- `ticket.dart`: Ticket details and validation status
- `qr_data.dart`: QR code scanning response structure
- `validation.dart`: Ticket validation records

### Screen Flow
1. `login_screen.dart` → Authentication
2. `scanner_screen.dart` → Main dashboard
3. `qr_scanner_screen.dart` → Camera scanning
4. `ticket_details_screen.dart` → Validation
5. `history_screen.dart` → Past validations

## Development Workflow

### Common Operations
- Local auth testing: Use demo credentials (merchant@discovergozo.com / merchant123)
- QR scanning requires camera permissions (handled by permission_handler)
- API responses are cached in local storage for offline support

### Error Handling
- Network errors are displayed via SnackBar
- Authentication errors trigger automatic logout
- Camera permission denials show instructions for manual settings access

## Key Integration Points

### API Endpoints
```dart
POST /merchant/login           // Authenticate merchant
GET /merchant/tickets/{id}/qr  // Fetch ticket data
POST /merchant/validate-ticket // Mark ticket as used
GET /merchant/tickets/history  // List past validations
```

### Local Storage Keys
- 'merchant_token': JWT authentication token
- 'merchant_data': Cached merchant profile
- 'validation_history': Offline validation records

## Conventions
- All HTTP requests must go through ApiService
- Screen widgets handle their own loading states
- Date formatting uses intl package with 'en_US' locale
- Custom widgets in lib/widgets/ for consistent UI elements