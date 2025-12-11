import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/treasure_hunt_reward.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class TreasureHuntRewardScreen extends StatefulWidget {
  final String qrData;

  const TreasureHuntRewardScreen({
    required this.qrData,
    super.key,
  });

  @override
  State<TreasureHuntRewardScreen> createState() => _TreasureHuntRewardScreenState();
}

class _TreasureHuntRewardScreenState extends State<TreasureHuntRewardScreen> {
  final ApiService _apiService = ApiService();
  TreasureHuntReward? _reward;
  bool _isLoading = true;
  bool _isValidating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _validateReward();
  }

  Future<void> _validateReward() async {
    setState(() {
      _isValidating = true;
      _error = null;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      _apiService.setToken(authProvider.token!);
      
      final reward = await _apiService.validateTreasureHuntReward(widget.qrData);
      setState(() {
        _reward = reward;
        _isLoading = false;
        _isValidating = false;
      });
      
      // Notify that history should be refreshed
      // This will be handled by the history screen when it's opened
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
        _isValidating = false;
      });
    }
  }

  void _goBack() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Treasure Hunt Reward'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _goBack,
        ),
      ),
      body: _isLoading
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
                          'Error Validating Reward',
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
                          onPressed: _validateReward,
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
              : _reward == null
                  ? const Center(
                      child: Text('Reward not found'),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Reward Card
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: _reward!.alreadyRedeemed
                                    ? [Colors.orange.shade100, Colors.orange.shade50]
                                    : [Colors.green.shade100, Colors.green.shade50],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.1),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Header
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: _reward!.alreadyRedeemed
                                            ? Colors.orange.shade200
                                            : Colors.green.shade200,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(
                                        _reward!.alreadyRedeemed
                                            ? Icons.warning_amber_rounded
                                            : Icons.celebration,
                                        size: 32,
                                        color: _reward!.alreadyRedeemed
                                            ? Colors.orange.shade900
                                            : Colors.green.shade900,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _reward!.huntName,
                                            style: const TextStyle(
                                              fontSize: 22,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 6,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _reward!.alreadyRedeemed
                                                  ? Colors.orange.shade300
                                                  : Colors.green.shade300,
                                              borderRadius: BorderRadius.circular(20),
                                            ),
                                            child: Text(
                                              _reward!.alreadyRedeemed
                                                  ? '⚠️ Already Redeemed'
                                                  : '✅ Valid Reward',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: _reward!.alreadyRedeemed
                                                    ? Colors.orange.shade900
                                                    : Colors.green.shade900,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                
                                // Discount Badge
                                Center(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 24,
                                      vertical: 16,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(16),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.1),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      children: [
                                        Text(
                                          '${_reward!.discountPercentage}%',
                                          style: const TextStyle(
                                            fontSize: 48,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                        const Text(
                                          'DISCOUNT',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textSecondary,
                                            letterSpacing: 2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 24),
                                
                                // Reward Information
                                _buildInfoRow('🎫 Coupon Code', _reward!.couponCode, isCode: true),
                                _buildInfoRow('👤 Customer', _reward!.userName),
                                _buildInfoRow('📧 Email', _reward!.userEmail),
                                _buildInfoRow('🏆 Completed', _formatDate(_reward!.completedAt)),
                                if (_reward!.alreadyRedeemed) ...[
                                  _buildInfoRow('⏰ Redeemed', _formatDate(_reward!.redeemedAt)),
                                  _buildInfoRow('👨‍💼 Redeemed By', _reward!.redeemedBy),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          
                          // Message
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: _reward!.alreadyRedeemed
                                  ? Colors.orange.shade50
                                  : Colors.green.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _reward!.alreadyRedeemed
                                    ? Colors.orange.shade200
                                    : Colors.green.shade200,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _reward!.alreadyRedeemed
                                      ? Icons.info_outline
                                      : Icons.check_circle_outline,
                                  color: _reward!.alreadyRedeemed
                                      ? Colors.orange.shade700
                                      : Colors.green.shade700,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    _reward!.alreadyRedeemed
                                        ? 'This reward has already been redeemed. Please verify with the customer before applying the discount.'
                                        : 'Reward validated successfully! Apply ${_reward!.discountPercentage}% discount to the customer\'s purchase.',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: _reward!.alreadyRedeemed
                                          ? Colors.orange.shade900
                                          : Colors.green.shade900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
    );

  Widget _buildInfoRow(String label, String value, {bool isCode = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: isCode
                ? Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.primary),
                    ),
                    child: Text(
                      value,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                        letterSpacing: 1,
                        fontFamily: 'monospace',
                      ),
                    ),
                  )
                : Text(
                    value,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
          ),
        ],
      ),
    );

  String _formatDate(String dateString) {
    if (dateString.isEmpty) return 'N/A';
    try {
      final date = DateTime.parse(dateString);
      return '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateString;
    }
  }
}

