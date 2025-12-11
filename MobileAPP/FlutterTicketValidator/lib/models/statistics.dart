import 'dart:convert';

class Statistics {
  final int totalTickets;
  final int totalPersons;
  final double totalRevenue;
  final int todayTickets;
  final int todayPersons;
  final double todayRevenue;
  final int weekTickets;
  final int weekPersons;
  final double weekRevenue;
  final int monthTickets;
  final int monthPersons;
  final double monthRevenue;

  const Statistics({
    required this.totalTickets,
    required this.totalPersons,
    required this.totalRevenue,
    required this.todayTickets,
    required this.todayPersons,
    required this.todayRevenue,
    required this.weekTickets,
    required this.weekPersons,
    required this.weekRevenue,
    required this.monthTickets,
    required this.monthPersons,
    required this.monthRevenue,
  });

  factory Statistics.fromServerData(Map<String, dynamic> data) {
    return Statistics(
      totalTickets: data['totalTickets'] ?? 0,
      totalPersons: data['totalPersons'] ?? 0,
      totalRevenue: (data['totalRevenue'] ?? 0.0).toDouble(),
      todayTickets: data['todayTickets'] ?? 0,
      todayPersons: data['todayPersons'] ?? 0,
      todayRevenue: (data['todayRevenue'] ?? 0.0).toDouble(),
      weekTickets: data['weekTickets'] ?? 0,
      weekPersons: data['weekPersons'] ?? 0,
      weekRevenue: (data['weekRevenue'] ?? 0.0).toDouble(),
      monthTickets: data['monthTickets'] ?? 0,
      monthPersons: data['monthPersons'] ?? 0,
      monthRevenue: (data['monthRevenue'] ?? 0.0).toDouble(),
    );
  }

  factory Statistics.fromValidations(List<dynamic> validations) {
    // Note: DateTime.now() and DateTime.parse() use device local timezone
    // This ensures dates are compared correctly in the user's timezone (Malta/Gozo)
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final weekStart = today.subtract(Duration(days: today.weekday - 1));
    final monthStart = DateTime(now.year, now.month, 1);

    int totalTickets = 0;
    int totalPersons = 0;
    double totalRevenue = 0.0;

    int todayTickets = 0;
    int todayPersons = 0;
    double todayRevenue = 0.0;

    int weekTickets = 0;
    int weekPersons = 0;
    double weekRevenue = 0.0;

    int monthTickets = 0;
    int monthPersons = 0;
    double monthRevenue = 0.0;

    for (final validation in validations) {
      final validatedAt = DateTime.parse(validation['scanned_at']);
      
      // Use basic data available in local storage
      final quantity = 1; // Each validation represents 1 ticket
      final price = 0.0; // Price data not available in local storage
      final revenue = quantity * price;

      // All time
      totalTickets++;
      totalPersons += quantity;
      totalRevenue += revenue;

      // Today
      if (validatedAt.isAfter(today)) {
        todayTickets++;
        todayPersons += quantity;
        todayRevenue += revenue;
      }

      // This week
      if (validatedAt.isAfter(weekStart)) {
        weekTickets++;
        weekPersons += quantity;
        weekRevenue += revenue;
      }

      // This month
      if (validatedAt.isAfter(monthStart)) {
        monthTickets++;
        monthPersons += quantity;
        monthRevenue += revenue;
      }
    }

    return Statistics(
      totalTickets: totalTickets,
      totalPersons: totalPersons,
      totalRevenue: totalRevenue,
      todayTickets: todayTickets,
      todayPersons: todayPersons,
      todayRevenue: todayRevenue,
      weekTickets: weekTickets,
      weekPersons: weekPersons,
      weekRevenue: weekRevenue,
      monthTickets: monthTickets,
      monthPersons: monthPersons,
      monthRevenue: monthRevenue,
    );
  }

  static int _extractQuantity(Map<String, dynamic> ticketData) {
    // Try different possible field names for quantity
    if (ticketData['quantity'] != null) {
      return int.tryParse(ticketData['quantity'].toString()) ?? 1;
    }
    if (ticketData['participants'] != null) {
      return int.tryParse(ticketData['participants'].toString()) ?? 1;
    }
    if (ticketData['adults'] != null || ticketData['children'] != null || ticketData['seniors'] != null) {
      final adults = int.tryParse(ticketData['adults']?.toString() ?? '0') ?? 0;
      final children = int.tryParse(ticketData['children']?.toString() ?? '0') ?? 0;
      final seniors = int.tryParse(ticketData['seniors']?.toString() ?? '0') ?? 0;
      return adults + children + seniors;
    }
    return 1; // Default to 1 person if no quantity found
  }

  static double _extractPrice(Map<String, dynamic> ticketData) {
    // Try different possible field names for price
    if (ticketData['total_price'] != null) {
      return double.tryParse(ticketData['total_price'].toString()) ?? 0.0;
    }
    if (ticketData['price'] != null) {
      return double.tryParse(ticketData['price'].toString()) ?? 0.0;
    }
    if (ticketData['total'] != null) {
      return double.tryParse(ticketData['total'].toString()) ?? 0.0;
    }
    return 0.0; // Default to 0 if no price found
  }
}
