import 'package:flutter/material.dart';

class AppColors {
  // Light Theme Colors
  static const Color lightPrimary = Color(0xFF3B82F6);
  static const Color lightPrimaryDark = Color(0xFF2563EB);
  static const Color lightPrimaryLight = Color(0xFF60A5FA);
  
  static const Color lightSecondary = Color(0xFF10B981);
  static const Color lightSecondaryDark = Color(0xFF059669);
  static const Color lightSecondaryLight = Color(0xFF34D399);
  
  static const Color lightBackground = Color(0xFFF8FAFC);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightCardBackground = Color(0xFFFFFFFF);
  
  static const Color lightTextPrimary = Color(0xFF1F2937);
  static const Color lightTextSecondary = Color(0xFF6B7280);
  static const Color lightTextTertiary = Color(0xFF9CA3AF);
  static const Color lightTextWhite = Color(0xFFFFFFFF);
  
  static const Color lightBorder = Color(0xFFE5E7EB);
  static const Color lightBorderLight = Color(0xFFF3F4F6);
  
  static const Color lightInputBackground = Color(0xFFF9FAFB);
  static const Color lightInputBorder = Color(0xFFE5E7EB);
  static const Color lightInputBorderFocused = Color(0xFF3B82F6);
  
  static const Color lightSuccess = Color(0xFF10B981);
  static const Color lightSuccessLight = Color(0xFFF0FDF4);
  static const Color lightWarning = Color(0xFFF59E0B);
  static const Color lightWarningLight = Color(0xFFFEF3C7);
  static const Color lightError = Color(0xFFEF4444);
  static const Color lightErrorLight = Color(0xFFFEF2F2);
  static const Color lightInfo = Color(0xFF3B82F6);
  static const Color lightInfoLight = Color(0xFFF0F9FF);
  
  static const Color lightShadow = Color(0x1A000000);
  static const Color lightShadowLight = Color(0x0A000000);

  // Dark Theme Colors
  static const Color darkPrimary = Color(0xFF60A5FA);
  static const Color darkPrimaryDark = Color(0xFF3B82F6);
  static const Color darkPrimaryLight = Color(0xFF93C5FD);
  
  static const Color darkSecondary = Color(0xFF34D399);
  static const Color darkSecondaryDark = Color(0xFF10B981);
  static const Color darkSecondaryLight = Color(0xFF6EE7B7);
  
  static const Color darkBackground = Color(0xFF0F172A);
  static const Color darkSurface = Color(0xFF1E293B);
  static const Color darkCardBackground = Color(0xFF334155);
  
  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFFCBD5E1);
  static const Color darkTextTertiary = Color(0xFF94A3B8);
  static const Color darkTextWhite = Color(0xFFFFFFFF);
  
  static const Color darkBorder = Color(0xFF475569);
  static const Color darkBorderLight = Color(0xFF64748B);
  
  static const Color darkInputBackground = Color(0xFF1E293B);
  static const Color darkInputBorder = Color(0xFF475569);
  static const Color darkInputBorderFocused = Color(0xFF60A5FA);
  
  static const Color darkSuccess = Color(0xFF34D399);
  static const Color darkSuccessLight = Color(0xFF064E3B);
  static const Color darkWarning = Color(0xFFFBBF24);
  static const Color darkWarningLight = Color(0xFF78350F);
  static const Color darkError = Color(0xFFF87171);
  static const Color darkErrorLight = Color(0xFF7F1D1D);
  static const Color darkInfo = Color(0xFF60A5FA);
  static const Color darkInfoLight = Color(0xFF1E3A8A);
  
  static const Color darkShadow = Color(0x40000000);
  static const Color darkShadowLight = Color(0x20000000);

  // Legacy colors for backward compatibility (default to light theme)
  static const Color primary = lightPrimary;
  static const Color primaryDark = lightPrimaryDark;
  static const Color primaryLight = lightPrimaryLight;
  static const Color secondary = lightSecondary;
  static const Color secondaryDark = lightSecondaryDark;
  static const Color secondaryLight = lightSecondaryLight;
  static const Color background = lightBackground;
  static const Color surface = lightSurface;
  static const Color cardBackground = lightCardBackground;
  static const Color textPrimary = lightTextPrimary;
  static const Color textSecondary = lightTextSecondary;
  static const Color textTertiary = lightTextTertiary;
  static const Color textWhite = lightTextWhite;
  static const Color border = lightBorder;
  static const Color borderLight = lightBorderLight;
  static const Color inputBackground = lightInputBackground;
  static const Color inputBorder = lightInputBorder;
  static const Color inputBorderFocused = lightInputBorderFocused;
  static const Color success = lightSuccess;
  static const Color successLight = lightSuccessLight;
  static const Color warning = lightWarning;
  static const Color warningLight = lightWarningLight;
  static const Color error = lightError;
  static const Color errorLight = lightErrorLight;
  static const Color info = lightInfo;
  static const Color infoLight = lightInfoLight;
  static const Color shadow = lightShadow;
  static const Color shadowLight = lightShadowLight;

  // Gradient Colors (theme-aware)
  static LinearGradient get primaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
  );
  
  static LinearGradient get secondaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF10B981), Color(0xFF059669)],
  );
}


