# Discover Gozo - Ticket Validator (Flutter)

A Flutter mobile application for merchants to validate tickets for Discover Gozo tours and activities.

## Features

- **Authentication**: Secure merchant login with token-based authentication
- **QR Code Scanning**: Real-time QR code scanning for ticket validation
- **Manual Ticket Lookup**: Enter reservation IDs manually for validation
- **Ticket Details**: View comprehensive ticket information
- **Validation History**: Track all validated tickets
- **Profile Management**: View merchant profile information
- **Offline Support**: Local storage for authentication state

## Screens

1. **Login Screen**: Merchant authentication with demo credentials
2. **Scanner Screen**: Main dashboard with QR scanning and manual input options
3. **QR Scanner Screen**: Camera-based QR code scanning
4. **Ticket Details Screen**: Detailed ticket information and validation
5. **History Screen**: List of all validated tickets
6. **Profile Screen**: Merchant profile and app information

## Demo Credentials

- **Email**: merchant@discovergozo.com
- **Password**: merchant123

## API Integration

The app connects to the Discover Gozo backend API at `http://192.168.1.106:3003/api` with the following endpoints:

- `POST /merchant/login` - Merchant authentication
- `GET /merchant/tickets/{ticketId}/qr-data` - Get ticket details
- `POST /merchant/validate-ticket` - Validate a ticket
- `GET /merchant/tickets/validated` - Get validation history

## Dependencies

- **flutter**: SDK
- **http**: HTTP client for API calls
- **mobile_scanner**: QR code scanning
- **permission_handler**: Camera permissions
- **shared_preferences**: Local storage
- **provider**: State management
- **intl**: Date formatting

## Setup Instructions

1. **Install Flutter**: Ensure Flutter SDK is installed and configured
2. **Install Dependencies**: Run `flutter pub get`
3. **Configure API URL**: Update the API base URL in `lib/services/api_service.dart` if needed
4. **Run the App**: Use `flutter run` for development

## Building for Production

### Android
```bash
flutter build apk --release
```

### iOS
```bash
flutter build ios --release
```

## Permissions

### Android
- `CAMERA`: Required for QR code scanning

### iOS
- `NSCameraUsageDescription`: Required for QR code scanning

## Architecture

- **Models**: Data models for Merchant, Ticket, Validation, and QRData
- **Services**: API service for backend communication
- **Providers**: State management using Provider pattern
- **Screens**: UI screens for different app functionalities
- **Widgets**: Reusable UI components
- **Utils**: App colors and utility functions

## Styling

The app uses a consistent design system with:
- Primary color: Blue (#3B82F6)
- Secondary color: Green (#10B981)
- Discover Gozo branding with wave emoji (🌊)
- Material Design principles
- Custom widgets for consistent UI

## Error Handling

- Network error handling with user-friendly messages
- Validation error display
- Loading states for better UX
- Retry mechanisms for failed operations

## Security

- Token-based authentication
- Secure local storage of credentials
- Input validation and sanitization
- HTTPS API communication (when available)

## Testing

The app includes comprehensive error handling and user feedback:
- Loading indicators
- Error messages
- Success confirmations
- Input validation

## Support

For support or questions, contact the Discover Gozo development team.

---

**© 2025 Discover Gozo - Powered by Technology**


