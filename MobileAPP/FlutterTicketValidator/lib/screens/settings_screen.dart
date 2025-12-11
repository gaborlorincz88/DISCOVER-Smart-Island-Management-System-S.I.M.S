import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../widgets/custom_button.dart';
import '../widgets/custom_text_field.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _ipController = TextEditingController();
  final TextEditingController _portController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _loadCurrentSettings();
  }

  Future<void> _loadCurrentSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final currentUrl = prefs.getString('api_base_url') ?? 'http://192.168.1.106:3003/api';
    
    // Extract IP and port from URL
    final uri = Uri.parse(currentUrl);
    setState(() {
      _ipController.text = uri.host;
      _portController.text = uri.port.toString();
    });
  }

  Future<void> _saveSettings() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _success = null;
    });

    try {
      final ip = _ipController.text.trim();
      final port = _portController.text.trim();

      if (ip.isEmpty || port.isEmpty) {
        throw Exception('IP address and port are required');
      }

      // Validate IP format (basic validation)
      final ipRegex = RegExp(r'^(\d{1,3}\.){3}\d{1,3}$');
      if (!ipRegex.hasMatch(ip)) {
        throw Exception('Invalid IP address format');
      }

      // Validate port
      final portNum = int.tryParse(port);
      if (portNum == null || portNum < 1 || portNum > 65535) {
        throw Exception('Port must be a number between 1 and 65535');
      }

      // Test connection
      final newUrl = 'http://$ip:$port/api';
      final testResponse = await ApiService.testConnection(newUrl);
      
      if (testResponse) {
        // Save to preferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('api_base_url', newUrl);
        
        // Update ApiService
        ApiService.updateBaseUrl(newUrl);
        
        setState(() {
          _success = 'Settings saved successfully!';
          _error = null;
        });
      } else {
        throw Exception('Cannot connect to server. Please check IP and port.');
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _success = null;
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _goBack() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Scaffold(
        backgroundColor: themeProvider.backgroundColor,
        appBar: AppBar(
          title: const Text('Settings'),
          backgroundColor: themeProvider.primaryColor,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _goBack,
          ),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Server Configuration Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: themeProvider.cardBackgroundColor,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: themeProvider.shadowColor,
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.settings,
                          color: themeProvider.primaryColor,
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Server Configuration',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: themeProvider.textPrimaryColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Configure the backend server connection settings. This allows you to connect to different servers or update the IP address when it changes.',
                      style: TextStyle(
                        fontSize: 14,
                        color: themeProvider.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    // IP Address Field
                    CustomTextField(
                      controller: _ipController,
                      label: 'Server IP Address',
                      hint: '192.168.1.106',
                      keyboardType: TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 16),
                    
                    // Port Field
                    CustomTextField(
                      controller: _portController,
                      label: 'Port',
                      hint: '3003',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 24),
                    
                    // Error/Success Messages
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: themeProvider.errorColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: themeProvider.errorColor.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: themeProvider.errorColor, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(
                                  color: themeProvider.errorColor,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    if (_success != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: themeProvider.successColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: themeProvider.successColor.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.check_circle_outline, color: themeProvider.successColor, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _success!,
                                style: TextStyle(
                                  color: themeProvider.successColor,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    if (_error != null || _success != null) const SizedBox(height: 16),
                    
                    // Save Button
                    CustomButton(
                      text: _isLoading ? 'Testing Connection...' : 'Save Settings',
                      onPressed: _isLoading ? null : _saveSettings,
                      isLoading: _isLoading,
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 20),
              
              // Current Configuration Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: themeProvider.cardBackgroundColor,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: themeProvider.shadowColor,
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: themeProvider.primaryColor,
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Current Configuration',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: themeProvider.textPrimaryColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildInfoRow('Current API URL', ApiService.baseUrl, themeProvider),
                    _buildInfoRow('Status', 'Connected', themeProvider),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, ThemeProvider themeProvider) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: themeProvider.textSecondaryColor,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: themeProvider.textPrimaryColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _ipController.dispose();
    _portController.dispose();
    super.dispose();
  }
}
