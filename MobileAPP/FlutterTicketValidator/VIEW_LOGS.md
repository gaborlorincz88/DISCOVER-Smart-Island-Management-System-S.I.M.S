# How to View Login Debug Logs

## Method 1: Using Flutter Run (Recommended)

1. Connect your Android device via USB or start an emulator
2. Open PowerShell/Terminal in the FlutterTicketValidator directory
3. Run:
   ```powershell
   flutter run --release
   ```
4. Try logging in - you'll see logs prefixed with:
   - 🔐 [LOGIN] - Login API calls
   - 🔑 [AUTH] - Authentication provider
   - 🌐 [API] - HTTP requests/responses
   - ❌ - Errors
   - ✅ - Success

## Method 2: Using ADB Logcat (Android Only)

1. Connect your Android device via USB
2. Enable USB Debugging on your device
3. Run:
   ```powershell
   adb logcat | Select-String -Pattern "LOGIN|AUTH|API|ERROR|Flutter"
   ```

## Method 3: Filter Specific Logs

To see only login-related logs:
```powershell
adb logcat | Select-String -Pattern "\[LOGIN\]|\[AUTH\]|\[API\]"
```

## Common Issues to Check:

1. **Network Error**: Check if device can reach `https://api.discover-gozo.com`
2. **SSL Certificate**: Android might reject self-signed certificates
3. **CORS**: Backend might be blocking requests
4. **Response Format**: Check if backend returns expected JSON structure

## What to Look For:

- `🔐 [LOGIN] Starting login for: [email]` - Login attempt started
- `🌐 [API] POST https://api.discover-gozo.com/api/merchant/login` - API call made
- `🌐 [API] Response status: 200` - Success (or 401/500 for errors)
- `❌ [LOGIN] Error occurred: ...` - Error details
- `✅ [LOGIN] Login successful` - Success








