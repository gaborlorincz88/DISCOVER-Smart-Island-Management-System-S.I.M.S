# Discover Gozo - Merchant Ticket Validator

A React Native mobile app for merchants to scan and validate customer tickets for Discover Gozo tours.

## Features

- **Merchant Authentication**: Secure login system for authorized merchants
- **QR Code Scanning**: Scan customer ticket QR codes using device camera
- **Ticket Validation**: Validate tickets and update their status in the backend
- **Ticket Details**: View complete ticket information including customer details
- **Validation History**: Track all ticket validations performed by the merchant
- **Profile Management**: View merchant profile and logout functionality

## Setup Instructions

### Prerequisites

1. **Node.js** (v16 or higher)
2. **Expo CLI**: `npm install -g @expo/cli`
3. **Expo Go app** on your mobile device (iOS/Android)
4. **Backend server** running on `http://192.168.1.104:3003`

### Installation

1. Navigate to the project directory:
   ```bash
   cd MobileAPP/TicketValidator
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Scan the QR code with Expo Go app on your mobile device

### Backend Configuration

Make sure your backend server is running and accessible at `http://192.168.1.104:3003`. The app expects the following API endpoints:

- `POST /api/merchant/login` - Merchant authentication
- `POST /api/merchant/validate-ticket` - Validate a ticket
- `GET /api/merchant/tickets/:ticketId/qr-data` - Get ticket details
- `GET /api/merchant/tickets/validated` - Get validation history

### Testing

1. **Login Credentials**:
   - Email: `merchant@discovergozo.com`
   - Password: `merchant123`

2. **Test Flow**:
   - Open the app and login with the credentials above
   - Grant camera permission when prompted
   - Scan a QR code from a valid ticket
   - View ticket details and validate if needed
   - Check validation history

## App Screens

### 1. Login Screen
- Email and password input fields
- Login button
- Help text with test credentials

### 2. Scanner Screen
- Camera view for QR code scanning
- Menu buttons for History and Profile
- Logout functionality

### 3. Ticket Details Screen
- Complete ticket information display
- Customer details (name, email, phone)
- Booking details (quantity, price, date)
- Validation status
- Validate button

### 4. History Screen
- List of all validated tickets
- Validation details (time, type, status)
- Location and notes if available

### 5. Profile Screen
- Merchant information display
- Logout functionality

## Technical Details

- **Framework**: React Native with Expo
- **Navigation**: State-based navigation (no external navigation library)
- **Storage**: AsyncStorage for token persistence
- **Camera**: Expo BarCodeScanner for QR code scanning
- **API**: Fetch API for backend communication
- **Authentication**: JWT token-based authentication

## Troubleshooting

### Common Issues

1. **Camera Permission Denied**:
   - Go to device settings and enable camera permission for the app
   - Restart the app after granting permission

2. **Network Connection Issues**:
   - Ensure the backend server is running
   - Check that the IP address in the code matches your server's IP
   - Verify both devices are on the same network

3. **QR Code Not Scanning**:
   - Ensure good lighting conditions
   - Hold the device steady
   - Make sure the QR code is clearly visible and not damaged

4. **Login Issues**:
   - Verify the backend server is running
   - Check that the merchant account exists in the database
   - Ensure the API endpoints are accessible

### Development Notes

- The app uses a simplified navigation system to avoid dependency conflicts
- Camera permissions are requested automatically on first use
- All API calls include proper error handling and user feedback
- The app maintains login state using AsyncStorage

## Future Enhancements

- Offline mode support
- Push notifications for new validations
- Advanced reporting and analytics
- Multi-language support
- Enhanced UI/UX with animations