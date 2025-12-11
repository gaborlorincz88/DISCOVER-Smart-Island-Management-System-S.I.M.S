import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/validation.dart';
import '../models/treasure_hunt_redemption.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';
import 'statistics_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> with SingleTickerProviderStateMixin {
  final ApiService _apiService = ApiService();
  List<ValidationRecord> _validations = [];
  List<TreasureHuntRedemption> _redemptions = [];
  List<dynamic> _allHistory = []; // Combined list
  List<dynamic> _filteredHistory = [];
  bool _isLoading = true;
  String? _error;
  final TextEditingController _searchController = TextEditingController();
  bool _isOfflineMode = false;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadValidationHistory();
    _searchController.addListener(_filterValidations);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload history when screen becomes visible (but only if not already loading)
    if (!_isLoading) {
      _loadValidationHistory();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _filterValidations() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredHistory = _allHistory.where((item) {
        if (item is ValidationRecord) {
          return item.ticketId.toLowerCase().contains(query) ||
                 (item.merchantId.toLowerCase().contains(query)) ||
                 (item.location?.toLowerCase().contains(query) ?? false) ||
                 (item.ticketName?.toLowerCase().contains(query) ?? false);
        } else if (item is TreasureHuntRedemption) {
          return item.huntName.toLowerCase().contains(query) ||
                 item.couponCode.toLowerCase().contains(query) ||
                 item.userEmail.toLowerCase().contains(query) ||
                 (item.userName?.toLowerCase().contains(query) ?? false);
        }
        return false;
      }).toList();
    });
  }

  Future<void> _loadValidationHistory() async {
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      _apiService.setToken(authProvider.token!);
      
      // Load both ticket validations and treasure hunt redemptions
      final validations = await _apiService.getValidationHistory();
      final redemptions = await _apiService.getTreasureHuntRedemptions();
      
      // Combine and sort by date (most recent first)
      final combined = <dynamic>[
        ...validations,
        ...redemptions,
      ];
      
      combined.sort((a, b) {
        final dateA = a is ValidationRecord ? a.scannedAt : (a as TreasureHuntRedemption).redeemedAt;
        final dateB = b is ValidationRecord ? b.scannedAt : (b as TreasureHuntRedemption).redeemedAt;
        return dateB.compareTo(dateA);
      });
      
      setState(() {
        _validations = validations;
        _redemptions = redemptions;
        _allHistory = combined;
        _filteredHistory = combined;
        _isLoading = false;
        _isOfflineMode = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
        _isOfflineMode = true;
      });
    }
  }

  void _goBack() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) => Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Scaffold(
        backgroundColor: themeProvider.backgroundColor,
      appBar: AppBar(
        title: const Text('History & Statistics'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _goBack,
        ),
        actions: [
          if (_isOfflineMode)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.cloud_off, size: 16, color: Colors.orange),
                  SizedBox(width: 4),
                  Text(
                    'Offline',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.orange,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(
              icon: Icon(Icons.history),
              text: 'History',
            ),
            Tab(
              icon: Icon(Icons.analytics),
              text: 'Statistics',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // History Tab
          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(),
                )
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.error_outline,
                              size: 64,
                              color: AppColors.error,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Error Loading History',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _error!,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            CustomButton(
                              text: 'Try Again',
                              onPressed: _loadValidationHistory,
                              backgroundColor: AppColors.primary,
                            ),
                            const SizedBox(height: 12),
                            CustomButton(
                              text: 'Go Back',
                              onPressed: _goBack,
                              backgroundColor: AppColors.textSecondary,
                            ),
                          ],
                        ),
                      ),
                    )
                  : _filteredHistory.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.history,
                                  size: 64,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'No Validation History',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'No validation history found',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 20),
                                CustomButton(
                                  text: 'Go Back',
                                  onPressed: _goBack,
                                  backgroundColor: AppColors.primary,
                                ),
                              ],
                            ),
                          ),
                        )
                      : Column(
                          children: [
                            // Search Bar
                            Container(
                              padding: const EdgeInsets.all(16),
                              child: TextField(
                                controller: _searchController,
                                decoration: InputDecoration(
                                  hintText: 'Search by ticket ID, merchant, or location...',
                                  prefixIcon: const Icon(Icons.search),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide.none,
                                  ),
                                  filled: true,
                                  fillColor: themeProvider.inputBackgroundColor,
                                ),
                              ),
                            ),
                            // Results count
                            if (_searchController.text.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: Row(
                                  children: [
                                    Text(
                                      '${_filteredHistory.length} result(s) found',
                                      style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const Spacer(),
                                    TextButton(
                                      onPressed: () {
                                        _searchController.clear();
                                      },
                                      child: const Text('Clear'),
                                    ),
                                  ],
                                ),
                              ),
                            // List
                            Expanded(
                              child: RefreshIndicator(
                                onRefresh: _loadValidationHistory,
                                child: ListView.builder(
                                  padding: const EdgeInsets.symmetric(horizontal: 20),
                                  itemCount: _filteredHistory.length,
                                  itemBuilder: (context, index) {
                                    final item = _filteredHistory[index];
                                    if (item is ValidationRecord) {
                                      return _buildValidationCard(item);
                                    } else if (item is TreasureHuntRedemption) {
                                      return _buildRedemptionCard(item);
                                    }
                                    return const SizedBox.shrink();
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
          // Statistics Tab
          const StatisticsScreen(),
        ],
      ),
    ),
  );

  Widget _buildValidationCard(ValidationRecord validation) => Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: themeProvider.cardBackgroundColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: themeProvider.shadowColor,
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Ticket ID: ${validation.ticketId}',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: themeProvider.textPrimaryColor,
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: validation.status == ValidationRecordStatus.validated
                          ? themeProvider.successLightColor
                          : themeProvider.warningLightColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      validation.status.displayName,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: validation.status == ValidationRecordStatus.validated
                            ? themeProvider.successColor
                            : themeProvider.warningColor,
                      ),
                    ),
                  ),
                  if (validation.location == 'Offline Mode')
                    Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: themeProvider.warningColor.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'OFFLINE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: themeProvider.warningColor,
                        ),
                      ),
                    )
                  else if (validation.location == 'Online Server')
                    Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: themeProvider.successColor.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'ONLINE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: themeProvider.successColor,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Details
          _buildDetailRow('Type', validation.validationType.displayName),
          _buildDetailRow('Scanned', DateFormat('MMM dd, yyyy - HH:mm').format(validation.scannedAt)),
          
          if (validation.ticketName != null)
            _buildDetailRow('Tour', validation.ticketName!),
          
          if (validation.customerEmail != null)
            _buildDetailRow('Customer', validation.customerEmail!),
          
          if (validation.quantity != null)
            _buildDetailRow('Quantity', '${validation.quantity} person(s)'),
          
          if (validation.totalPrice != null)
            _buildDetailRow('Price', '€${validation.totalPrice!.toStringAsFixed(2)}'),
          
          if (validation.reservationDate != null)
            _buildDetailRow('Date', validation.reservationDate!),
          
          if (validation.location != null)
            _buildDetailRow('Location', validation.location!),
          
          if (validation.notes != null)
            _buildDetailRow('Notes', validation.notes!),
        ],
      ),
    ),
  );

  Widget _buildDetailRow(String label, String value) => Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 80,
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
      ),
    );

  Widget _buildRedemptionCard(TreasureHuntRedemption redemption) => Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.amber.shade50,
              Colors.orange.shade50,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Colors.amber.shade200,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: themeProvider.shadowColor,
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade200,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.celebration,
                        size: 20,
                        color: Colors.amber,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        redemption.huntName,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: themeProvider.textPrimaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.amber.shade200,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Treasure Hunt',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.amber.shade900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Details
          _buildDetailRow('Type', 'Reward Redemption'),
          _buildDetailRow('Redeemed', DateFormat('MMM dd, yyyy - HH:mm').format(redemption.redeemedAt)),
          _buildDetailRow('Coupon Code', redemption.couponCode),
          _buildDetailRow('Discount', '${redemption.discountPercentage}%'),
          _buildDetailRow('Customer', redemption.userName ?? redemption.userEmail),
          _buildDetailRow('Email', redemption.userEmail),
        ],
      ),
    ),
  );
}


