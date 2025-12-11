import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/ticket.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class TicketDetailsScreen extends StatefulWidget {

  const TicketDetailsScreen({
    required this.ticketId, super.key,
  });
  final String ticketId;

  @override
  State<TicketDetailsScreen> createState() => _TicketDetailsScreenState();
}

class _TicketDetailsScreenState extends State<TicketDetailsScreen> {
  final ApiService _apiService = ApiService();
  Ticket? _ticket;
  bool _isLoading = true;
  bool _isValidating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTicketDetails();
  }

  Future<void> _loadTicketDetails() async {
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      _apiService.setToken(authProvider.token!);
      
      final ticket = await _apiService.getTicketDetails(widget.ticketId);
      setState(() {
        _ticket = ticket;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _validateTicket() async {
    if (_ticket == null) return;

    setState(() {
      _isValidating = true;
    });

    try {
      await _apiService.validateTicket(_ticket!.id);
      
      // Refresh ticket details
      await _loadTicketDetails();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ticket validated successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Failed to validate ticket: $e';
        
        // Handle specific error types
        if (e is ApiException) {
          if (e.statusCode == 403) {
            errorMessage = 'Access Denied: You are not authorized to validate tickets for this tour. Please contact your administrator.';
          } else if (e.statusCode == 401) {
            errorMessage = 'Authentication expired. Please login again.';
          } else {
            errorMessage = e.message;
          }
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5), // Longer duration for important messages
          ),
        );
      }
    } finally {
      setState(() {
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
        title: const Text('Ticket Details'),
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
                          'Error Loading Ticket',
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
                          onPressed: _loadTicketDetails,
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
              : _ticket == null
                  ? const Center(
                      child: Text('Ticket not found'),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Ticket Card
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.1),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Ticket Header
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _ticket!.tourName,
                                        style: const TextStyle(
                                          fontSize: 24,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _ticket!.validationStatus == ValidationStatus.completed
                                            ? AppColors.successLight
                                            : AppColors.infoLight,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        '${_ticket!.validationStatus.emoji} ${_ticket!.validationStatus.displayName}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _ticket!.validationStatus == ValidationStatus.completed
                                              ? AppColors.success
                                              : AppColors.info,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),

                                // Ticket Information
                                _buildInfoRow('👤 Customer', _ticket!.customerName),
                                _buildInfoRow('📧 Email', _ticket!.contactEmail),
                                _buildInfoRow('📱 Phone', _ticket!.contactPhone),
                                _buildInfoRow('👥 Quantity', '${_ticket!.quantity} person(s)'),
                                _buildInfoRow('💰 Price', '€${_ticket!.totalPrice.toStringAsFixed(2)}'),
                                _buildInfoRow('📅 Date', _ticket!.reservationDate),
                                if (_ticket!.reservationTime != null)
                                  _buildInfoRow('🕐 Time', _ticket!.reservationTime!),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Validation Button or Completed Status
                          if (_ticket!.validationStatus != ValidationStatus.completed)
                            CustomButton(
                              text: '✅ Validate Ticket',
                              onPressed: _isValidating ? null : _validateTicket,
                              isLoading: _isValidating,
                              backgroundColor: AppColors.secondary,
                            )
                          else
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: AppColors.successLight,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.success),
                              ),
                              child: const Column(
                                children: [
                                  Text(
                                    '🎉',
                                    style: TextStyle(fontSize: 48),
                                  ),
                                  SizedBox(height: 12),
                                  Text(
                                    'Ticket Already Validated',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.success,
                                    ),
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'This ticket has been successfully validated',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppColors.success,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
    );

  Widget _buildInfoRow(String label, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
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
            child: Text(
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
}


