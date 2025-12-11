import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/merchant.dart';
import '../services/api_service.dart';
import '../services/local_storage_service.dart';

class AuthProvider with ChangeNotifier {

  AuthProvider() {
    _loadAuthState();
  }
  final ApiService _apiService = ApiService();
  
  Merchant? _merchant;
  String? _token;
  bool _isLoading = false;
  String? _error;

  Merchant? get merchant => _merchant;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && _merchant != null;
  String? get error => _error;

  Future<void> _loadAuthState() async {
    _setLoading(true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('merchant_token');
      final merchantData = prefs.getString('merchant_data');

      if (token != null && merchantData != null) {
        _token = token;
        _merchant = Merchant.fromJson(json.decode(merchantData));
        _apiService.setToken(token);
      }
    } catch (e) {
      debugPrint('Error loading auth state: $e');
      await _clearAuthState();
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> login(String email, String password) async {
    debugPrint('🔑 [AUTH] Login attempt started for: $email');
    _setLoading(true);
    _setError(null);

    try {
      debugPrint('🔑 [AUTH] Calling API service login...');
      final response = await _apiService.login(email, password);
      debugPrint('🔑 [AUTH] API service returned response');
      debugPrint('🔑 [AUTH] Response keys: ${response.keys}');
      
      if (response['token'] == null) {
        debugPrint('❌ [AUTH] No token in response!');
        _setError('Login failed: No token received');
        return false;
      }
      
      if (response['merchant'] == null) {
        debugPrint('❌ [AUTH] No merchant data in response!');
        _setError('Login failed: No merchant data received');
        return false;
      }
      
      _token = response['token'];
      debugPrint('🔑 [AUTH] Token set: ${_token!.substring(0, 20)}...');
      
      _merchant = Merchant.fromJson(response['merchant']);
      debugPrint('🔑 [AUTH] Merchant loaded: ${_merchant!.name}');

      // Save to local storage
      debugPrint('🔑 [AUTH] Saving to local storage...');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('merchant_token', _token!);
      await prefs.setString('merchant_data', json.encode(_merchant!.toJson()));
      debugPrint('🔑 [AUTH] Saved to local storage');

      // Clear previous merchant's validation history to prevent cross-merchant data leakage
      try {
        await LocalStorageService.clearAllValidatedTickets();
      } catch (e) {
        // Ignore errors when clearing validation history
        debugPrint('Warning: Could not clear validation history: $e');
      }

      debugPrint('✅ [AUTH] Login successful, notifying listeners');
      notifyListeners();
      return true;
    } catch (e, stackTrace) {
      debugPrint('❌ [AUTH] Login error: $e');
      debugPrint('❌ [AUTH] Stack trace: $stackTrace');
      _setError(e.toString());
      return false;
    } finally {
      _setLoading(false);
      debugPrint('🔑 [AUTH] Login attempt finished');
    }
  }

  Future<void> logout() async {
    _setLoading(true);
    
    try {
      await _apiService.logout();
      await _clearAuthState();
    } catch (e) {
      debugPrint('Error during logout: $e');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> refreshToken() async {
    if (_token == null) return;
    
    try {
      final response = await _apiService.refreshToken();
      
      _token = response['token'];
      _merchant = Merchant.fromJson(response['merchant']);

      // Save to local storage
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('merchant_token', _token!);
      await prefs.setString('merchant_data', json.encode(_merchant!.toJson()));

      // Clear previous merchant's validation history to prevent cross-merchant data leakage
      try {
        await LocalStorageService.clearAllValidatedTickets();
      } catch (e) {
        // Ignore errors when clearing validation history
        print('Warning: Could not clear validation history: $e');
      }

      notifyListeners();
    } catch (e) {
      debugPrint('Token refresh failed: $e');
      // If refresh fails, logout the user
      await logout();
    }
  }

  Future<void> forceLogout() async {
    debugPrint('Forcing logout due to authentication failure');
    await _clearAuthState();
  }

  Future<void> _clearAuthState() async {
    _merchant = null;
    _token = null;
    _error = null;

    // Clear local storage
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('merchant_token');
    await prefs.remove('merchant_data');

    // Clear local validation history to prevent cross-merchant data leakage
    try {
      await LocalStorageService.clearAllValidatedTickets();
    } catch (e) {
      // Ignore errors when clearing validation history
      print('Warning: Could not clear validation history: $e');
    }

    notifyListeners();
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void clearError() {
    _setError(null);
  }
}


