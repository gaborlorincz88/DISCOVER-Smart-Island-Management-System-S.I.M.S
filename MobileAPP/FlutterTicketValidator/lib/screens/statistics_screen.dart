import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/statistics.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/local_storage_service.dart';
import '../utils/app_colors.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  Statistics? _statistics;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStatistics();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadStatistics();
  }

  Future<void> _loadStatistics() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      // Try to get statistics from server first
      try {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        if (authProvider.token != null) {
          final apiService = ApiService();
          apiService.setToken(authProvider.token!);
          final serverData = await apiService.getMerchantStatistics();
          final statistics = Statistics.fromServerData(serverData);
          setState(() {
            _statistics = statistics;
            _isLoading = false;
          });
          return;
        }
      } catch (e) {
        print('Failed to get server statistics, falling back to local: $e');
      }

      // Fallback to local statistics if server fails
      String? currentMerchantId;
      try {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        if (authProvider.merchant != null) {
          currentMerchantId = authProvider.merchant!.id;
        }
      } catch (e) {
        currentMerchantId = null;
      }

      final statistics = await LocalStorageService.getStatistics(merchantId: currentMerchantId);
      setState(() {
        _statistics = statistics;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Scaffold(
        backgroundColor: themeProvider.backgroundColor,
        appBar: AppBar(
          title: const Text('Statistics'),
          backgroundColor: themeProvider.primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 64, color: AppColors.error),
                          const SizedBox(height: 16),
                          Text(
                            'Error loading statistics',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: themeProvider.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: themeProvider.textSecondaryColor),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(onPressed: _loadStatistics, child: const Text('Retry')),
                        ],
                      ),
                    ),
                  )
                : _statistics == null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.analytics, size: 64, color: themeProvider.textSecondaryColor),
                            const SizedBox(height: 16),
                            Text(
                              'No statistics available',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: themeProvider.textPrimaryColor,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Statistics will appear here once you start validating tickets.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: themeProvider.textSecondaryColor),
                            ),
                          ],
                        ),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildPeriodCard('Today', Icons.today, AppColors.primary,
                                _statistics!.todayTickets, _statistics!.todayPersons, _statistics!.todayRevenue),
                            const SizedBox(height: 16),
                            _buildPeriodCard('This Week', Icons.date_range, AppColors.secondary,
                                _statistics!.weekTickets, _statistics!.weekPersons, _statistics!.weekRevenue),
                            const SizedBox(height: 16),
                            _buildPeriodCard('This Month', Icons.calendar_month, AppColors.warning,
                                _statistics!.monthTickets, _statistics!.monthPersons, _statistics!.monthRevenue),
                            const SizedBox(height: 16),
                            _buildPeriodCard('All Time', Icons.all_inclusive, AppColors.success,
                                _statistics!.totalTickets, _statistics!.totalPersons, _statistics!.totalRevenue),
                            const SizedBox(height: 24),
                            _buildSummaryCard(),
                          ],
                        ),
                      ),
      ),
    );
  }

  Widget _buildPeriodCard(String period, IconData icon, Color color, int tickets, int persons, double revenue) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Container(
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
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(width: 16),
                Text(
                  period,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: themeProvider.textPrimaryColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: _buildStatItem('Tickets', tickets.toString(), Icons.confirmation_number, AppColors.primary)),
                Expanded(child: _buildStatItem('Persons', persons.toString(), Icons.people, AppColors.secondary)),
                Expanded(child: _buildStatItem('Revenue', '€${revenue.toStringAsFixed(2)}', Icons.euro, AppColors.success)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 4),
        Consumer<ThemeProvider>(
          builder: (context, themeProvider, child) => Text(
            label,
            style: TextStyle(fontSize: 12, color: themeProvider.textSecondaryColor),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard() {
    final now = DateTime.now();
    final today = DateFormat('EEEE, MMMM d, yyyy').format(now);
    
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [themeProvider.primaryColor, themeProvider.secondaryColor],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: themeProvider.primaryColor.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Summary',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            const Text(
              'Today',
              style: TextStyle(fontSize: 14, color: Colors.white70),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: _buildSummaryItem('Total Tickets', _statistics!.totalTickets.toString(), Colors.white)),
                Expanded(child: _buildSummaryItem('Total Persons', _statistics!.totalPersons.toString(), Colors.white)),
                Expanded(child: _buildSummaryItem('Total Revenue', '€${_statistics!.totalRevenue.toStringAsFixed(2)}', Colors.white)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: color.withOpacity(0.8)),
        ),
      ],
    );
  }
}