import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_colors.dart';

class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = 'theme_mode';
  
  ThemeMode _themeMode = ThemeMode.system;
  bool _isDarkMode = false;

  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _isDarkMode;

  ThemeProvider() {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final themeIndex = prefs.getInt(_themeKey) ?? 0;
    _themeMode = ThemeMode.values[themeIndex];
    _isDarkMode = _themeMode == ThemeMode.dark;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    _isDarkMode = mode == ThemeMode.dark;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_themeKey, mode.index);
    
    notifyListeners();
  }

  void toggleTheme() {
    if (_themeMode == ThemeMode.light) {
      setThemeMode(ThemeMode.dark);
    } else {
      setThemeMode(ThemeMode.light);
    }
  }

  // Theme-aware color getters
  Color get primaryColor => _isDarkMode ? AppColors.darkPrimary : AppColors.lightPrimary;
  Color get primaryDarkColor => _isDarkMode ? AppColors.darkPrimaryDark : AppColors.lightPrimaryDark;
  Color get primaryLightColor => _isDarkMode ? AppColors.darkPrimaryLight : AppColors.lightPrimaryLight;
  
  Color get secondaryColor => _isDarkMode ? AppColors.darkSecondary : AppColors.lightSecondary;
  Color get secondaryDarkColor => _isDarkMode ? AppColors.darkSecondaryDark : AppColors.lightSecondaryDark;
  Color get secondaryLightColor => _isDarkMode ? AppColors.darkSecondaryLight : AppColors.lightSecondaryLight;
  
  Color get backgroundColor => _isDarkMode ? AppColors.darkBackground : AppColors.lightBackground;
  Color get surfaceColor => _isDarkMode ? AppColors.darkSurface : AppColors.lightSurface;
  Color get cardBackgroundColor => _isDarkMode ? AppColors.darkCardBackground : AppColors.lightCardBackground;
  
  Color get textPrimaryColor => _isDarkMode ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
  Color get textSecondaryColor => _isDarkMode ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
  Color get textTertiaryColor => _isDarkMode ? AppColors.darkTextTertiary : AppColors.lightTextTertiary;
  Color get textWhiteColor => _isDarkMode ? AppColors.darkTextWhite : AppColors.lightTextWhite;
  
  Color get borderColor => _isDarkMode ? AppColors.darkBorder : AppColors.lightBorder;
  Color get borderLightColor => _isDarkMode ? AppColors.darkBorderLight : AppColors.lightBorderLight;
  
  Color get inputBackgroundColor => _isDarkMode ? AppColors.darkInputBackground : AppColors.lightInputBackground;
  Color get inputBorderColor => _isDarkMode ? AppColors.darkInputBorder : AppColors.lightInputBorder;
  Color get inputBorderFocusedColor => _isDarkMode ? AppColors.darkInputBorderFocused : AppColors.lightInputBorderFocused;
  
  Color get successColor => _isDarkMode ? AppColors.darkSuccess : AppColors.lightSuccess;
  Color get successLightColor => _isDarkMode ? AppColors.darkSuccessLight : AppColors.lightSuccessLight;
  Color get warningColor => _isDarkMode ? AppColors.darkWarning : AppColors.lightWarning;
  Color get warningLightColor => _isDarkMode ? AppColors.darkWarningLight : AppColors.lightWarningLight;
  Color get errorColor => _isDarkMode ? AppColors.darkError : AppColors.lightError;
  Color get errorLightColor => _isDarkMode ? AppColors.darkErrorLight : AppColors.lightErrorLight;
  Color get infoColor => _isDarkMode ? AppColors.darkInfo : AppColors.lightInfo;
  Color get infoLightColor => _isDarkMode ? AppColors.darkInfoLight : AppColors.lightInfoLight;
  
  Color get shadowColor => _isDarkMode ? AppColors.darkShadow : AppColors.lightShadow;
  Color get shadowLightColor => _isDarkMode ? AppColors.darkShadowLight : AppColors.lightShadowLight;
}
