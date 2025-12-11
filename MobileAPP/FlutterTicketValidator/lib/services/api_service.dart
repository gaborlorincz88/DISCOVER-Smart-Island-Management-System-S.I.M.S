import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/merchant.dart';
import '../models/ticket.dart';
import '../models/validation.dart';
import '../models/treasure_hunt_reward.dart';
import '../models/treasure_hunt_redemption.dart';
import 'local_storage_service.dart';

class ApiService {
  static String baseUrl = 'https://api.discover-gozo.com/api';
  String? _token;
  
  // Callback for authentication failures
  static Function()? onAuthenticationFailure;

  void setToken(String token) {
    _token = token;
  }

  void clearToken() {
    _token = null;
  }

  static void updateBaseUrl(String newUrl) {
    baseUrl = newUrl;
  }

  static Future<bool> testConnection(String testUrl) async {
    try {
      final response = await http.get(
        Uri.parse('$testUrl/merchant/test'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      
      // Accept any response (200-299) as successful connection
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (e) {
      return false;
    }
  }

  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString('api_base_url');
    if (savedUrl != null) {
      baseUrl = savedUrl;
    }
  }

  Map<String, String> get _headers {
    final headers = {
      'Content-Type': 'application/json',
    };
    
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    
    return headers;
  }

  Future<Map<String, dynamic>> _makeRequest(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$baseUrl$endpoint');
    print('🌐 [API] $method $url');
    if (body != null) {
      print('🌐 [API] Body: ${body.keys} (password hidden)');
    }
    
    try {
      http.Response response;
      
      switch (method.toUpperCase()) {
        case 'POST':
          response = await http.post(
            url,
            headers: _headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            url,
            headers: _headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(url, headers: _headers);
          break;
        default:
          response = await http.get(url, headers: _headers);
      }

      print('🌐 [API] Response status: ${response.statusCode}');
      print('🌐 [API] Response headers: ${response.headers}');
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (response.body.isEmpty) {
          print('🌐 [API] Empty response body');
          return {};
        }
        final decoded = json.decode(response.body);
        print('🌐 [API] Response decoded successfully');
        return decoded;
      } else {
        print('❌ [API] Error response: ${response.statusCode}');
        print('❌ [API] Error body: ${response.body}');
        final errorBody = response.body.isNotEmpty 
            ? json.decode(response.body) 
            : <String, dynamic>{};
        
        // If we get a 401 error, try to refresh the token once
        if (response.statusCode == 401 && _token != null) {
          try {
            await refreshToken();
            // Retry the original request with the new token
            return await _makeRequest(endpoint, method: method, body: body);
          } catch (refreshError) {
            // Token refresh failed, clear token and notify auth provider
            clearToken();
            onAuthenticationFailure?.call();
            throw ApiException(
              statusCode: 401,
              message: 'Authentication expired. Please login again.',
            );
          }
        }
        
        throw ApiException(
          statusCode: response.statusCode,
          message: errorBody['error'] ?? 'HTTP ${response.statusCode}',
        );
      }
    } catch (e) {
      print('❌ [API] Exception caught: $e');
      print('❌ [API] Exception type: ${e.runtimeType}');
      if (e is ApiException) {
        rethrow;
      }
      // Handle network errors
      final errorMsg = 'Network error: ${e.toString()}';
      print('❌ [API] Throwing ApiException: $errorMsg');
      throw ApiException(
        statusCode: 0,
        message: errorMsg,
      );
    }
  }

  // Authentication
  Future<Map<String, dynamic>> login(String email, String password) async {
    print('🔐 [LOGIN] Starting login for: $email');
    print('🔐 [LOGIN] API Base URL: $baseUrl');
    
    try {
      print('🔐 [LOGIN] Making request to: $baseUrl/merchant/login');
      final response = await _makeRequest(
        '/merchant/login',
        method: 'POST',
        body: {
          'email': email,
          'password': password,
        },
      );

      print('🔐 [LOGIN] Response received: ${response.keys}');
      
      if (response['token'] != null) {
        print('🔐 [LOGIN] Token received, setting token');
        setToken(response['token']);
      } else {
        print('⚠️ [LOGIN] No token in response!');
      }

      print('✅ [LOGIN] Login successful');
      return response;
    } catch (e) {
      print('❌ [LOGIN] Error occurred: $e');
      print('❌ [LOGIN] Error type: ${e.runtimeType}');
      
      if (e is ApiException) {
        print('❌ [LOGIN] API Exception - Status: ${e.statusCode}, Message: ${e.message}');
      }
      
      // Fallback for demo purposes when server is not available
      if (email == 'merchant@discovergozo.com' && password == 'merchant123') {
        print('⚠️ [LOGIN] Using demo mode fallback');
        final demoToken = 'demo_token_${DateTime.now().millisecondsSinceEpoch}';
        setToken(demoToken);
        return {
          'success': true,
          'token': demoToken,
          'merchant': {
            'id': 'demo_merchant',
            'name': 'Demo Merchant',
            'email': 'merchant@discovergozo.com',
            'business_name': 'Discover Gozo Demo',
            'phone': '+356 9999 9999',
            'address': 'Demo Address, Gozo',
          },
          'message': 'Demo mode - server connection failed'
        };
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> refreshToken() async {
    try {
      final response = await _makeRequest(
        '/merchant/refresh-token',
        method: 'POST',
      );

      if (response['token'] != null) {
        setToken(response['token']);
        return response;
      } else {
        throw ApiException(statusCode: 400, message: 'Token refresh failed: No token received');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    clearToken();
  }

  // Ticket Operations
  Future<Ticket> getTicketDetails(String ticketId) async {
    final response = await _makeRequest('/merchant/tickets/$ticketId/qr-data');
    return Ticket.fromJson(response);
  }

  Future<ValidationRecord> validateTicket(
    String ticketId, {
    String validationType = 'scan',
    String? location,
    String? notes,
  }) async {
    try {
      final response = await _makeRequest(
        '/merchant/validate-ticket',
        method: 'POST',
        body: {
          'ticket_id': ticketId,
          'validation_type': validationType,
          if (location != null) 'location': location,
          if (notes != null) 'notes': notes,
        },
      );

      // Extract validation data from response
      final validationData = response['validation'] ?? response;
      final validation = ValidationRecord.fromJson(validationData);
      
      // Ensure location is set to indicate online validation
      final onlineValidation = ValidationRecord(
        id: validation.id,
        ticketId: validation.ticketId,
        reservationId: validation.reservationId,
        merchantId: validation.merchantId,
        validationType: validation.validationType,
        status: validation.status,
        scannedAt: validation.scannedAt,
        location: validation.location ?? 'Online Server',
        notes: validation.notes,
        ticketName: validation.ticketName,
        customerEmail: validation.customerEmail,
        quantity: validation.quantity,
        totalPrice: validation.totalPrice,
        reservationDate: validation.reservationDate,
        reservationTime: validation.reservationTime,
      );
      
      // Save to local storage for offline access
      await LocalStorageService.saveValidatedTicket(onlineValidation);
      
      return onlineValidation;
    } catch (e) {
      // Check if it's a 401 error (invalid token)
      if (e is ApiException && e.statusCode == 401) {
        // Token is invalid, create a local validation with specific message
        final localValidation = ValidationRecord(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          ticketId: ticketId,
          reservationId: ticketId,
          merchantId: 'demo_merchant',
          validationType: ValidationType.fromString(validationType),
          status: ValidationRecordStatus.validated,
          scannedAt: DateTime.now(),
          location: 'Offline Mode',
          notes: 'Validated offline - authentication expired, please re-login',
        );
        
        // Save to local storage
        await LocalStorageService.saveValidatedTicket(localValidation);
        
        return localValidation;
      }
      
      // Check if it's a 403 error (unauthorized tour assignment)
      if (e is ApiException && e.statusCode == 403) {
        // Merchant is not authorized to validate this tour
        throw ApiException(
          statusCode: 403,
          message: e.message, // This will contain the detailed error message from backend
        );
      }
      
      // For other errors, create a local validation record
      final localValidation = ValidationRecord(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        ticketId: ticketId,
        reservationId: ticketId,
        merchantId: 'demo_merchant',
        validationType: ValidationType.fromString(validationType),
        status: ValidationRecordStatus.validated,
        scannedAt: DateTime.now(),
        location: location ?? 'Offline Mode',
        notes: notes ?? 'Validated offline - server unavailable',
      );
      
      // Save to local storage
      await LocalStorageService.saveValidatedTicket(localValidation);
      
      return localValidation;
    }
  }

  Future<List<ValidationRecord>> getValidationHistory({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await _makeRequest(
        '/merchant/tickets/validated?limit=$limit&offset=$offset',
      );

      final validations = response['validations'] as List<dynamic>? ?? [];
      final serverValidations = validations
          .map((json) => ValidationRecord.fromJson(json))
          .toList();
      
      // Get current merchant ID to filter local validations
      String? currentMerchantId;
      try {
        final merchant = await getMerchantProfile();
        currentMerchantId = merchant.id;
      } catch (e) {
        // If we can't get merchant profile, don't filter local validations
        currentMerchantId = null;
      }
      
      // Also get local validations filtered by merchant
      final localValidations = await LocalStorageService.getValidatedTickets(
        limit: limit,
        offset: offset,
        merchantId: currentMerchantId,
      );
      
      // Combine and sort by validation date
      final allValidations = [...serverValidations, ...localValidations];
      allValidations.sort((a, b) => b.scannedAt.compareTo(a.scannedAt));
      
      return allValidations.take(limit).toList();
    } catch (e) {
      // If server is not available, return local validations only
      String? currentMerchantId;
      try {
        final merchant = await getMerchantProfile();
        currentMerchantId = merchant.id;
      } catch (e) {
        currentMerchantId = null;
      }
      
      return await LocalStorageService.getValidatedTickets(
        limit: limit,
        offset: offset,
        merchantId: currentMerchantId,
      );
    }
  }

  // Merchant Operations
  Future<Merchant> getMerchantProfile() async {
    final response = await _makeRequest('/merchant/profile');
    return Merchant.fromJson(response['merchant']);
  }

  // Get merchant statistics from server
  Future<Map<String, dynamic>> getMerchantStatistics() async {
    final response = await _makeRequest('/merchant/statistics');
    return response;
  }

  Future<Merchant> updateMerchantProfile(Map<String, dynamic> updates) async {
    final response = await _makeRequest(
      '/merchant/profile',
      method: 'PUT',
      body: updates,
    );

    return Merchant.fromJson(response['merchant']);
  }

  // Treasure Hunt Operations
  Future<TreasureHuntReward> validateTreasureHuntReward(String qrData) async {
    try {
      final response = await _makeRequest(
        '/merchant/validate-treasure-hunt',
        method: 'POST',
        body: {
          'qr_data': qrData,
        },
      );

      return TreasureHuntReward.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }

  Future<List<TreasureHuntRedemption>> getTreasureHuntRedemptions({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      print('🏆 [API] Fetching treasure hunt redemptions...');
      final response = await _makeRequest(
        '/merchant/treasure-hunt-redemptions?limit=$limit&offset=$offset',
      );

      final redemptions = response['redemptions'] as List<dynamic>? ?? [];
      print('🏆 [API] Received ${redemptions.length} redemptions');
      final parsed = redemptions
          .map((json) => TreasureHuntRedemption.fromJson(json))
          .toList();
      print('🏆 [API] Parsed ${parsed.length} redemptions');
      return parsed;
    } catch (e) {
      print('❌ [API] Error fetching redemptions: $e');
      // If server is not available, return empty list
      return [];
    }
  }
}

class ApiException implements Exception {

  ApiException({required this.statusCode, required this.message});
  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException(statusCode: $statusCode, message: $message)';
}


