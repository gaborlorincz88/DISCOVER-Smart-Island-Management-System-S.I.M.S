enum ValidationType {
  scan,
  manual,
  refund;

  static ValidationType fromString(String type) {
    switch (type.toLowerCase()) {
      case 'scan':
        return ValidationType.scan;
      case 'manual':
        return ValidationType.manual;
      case 'refund':
        return ValidationType.refund;
      default:
        return ValidationType.scan;
    }
  }

  String get displayName {
    switch (this) {
      case ValidationType.scan:
        return 'QR Scan';
      case ValidationType.manual:
        return 'Manual Entry';
      case ValidationType.refund:
        return 'Refund';
    }
  }
}

enum ValidationRecordStatus {
  validated,
  refunded,
  cancelled;

  static ValidationRecordStatus fromString(String status) {
    switch (status.toLowerCase()) {
      case 'validated':
        return ValidationRecordStatus.validated;
      case 'refunded':
        return ValidationRecordStatus.refunded;
      case 'cancelled':
        return ValidationRecordStatus.cancelled;
      default:
        return ValidationRecordStatus.validated;
    }
  }

  String get displayName {
    switch (this) {
      case ValidationRecordStatus.validated:
        return 'Validated';
      case ValidationRecordStatus.refunded:
        return 'Refunded';
      case ValidationRecordStatus.cancelled:
        return 'Cancelled';
    }
  }
}

class ValidationRecord {

  ValidationRecord({
    required this.id,
    required this.ticketId,
    required this.reservationId,
    required this.merchantId,
    required this.validationType,
    required this.status,
    required this.scannedAt,
    this.location,
    this.notes,
    this.ticketName,
    this.customerEmail,
    this.quantity,
    this.totalPrice,
    this.reservationDate,
    this.reservationTime,
  });

  factory ValidationRecord.fromJson(Map<String, dynamic> json) => ValidationRecord(
      id: json['id'] ?? '',
      ticketId: json['ticket_id'] ?? json['ticketId'] ?? '',
      reservationId: json['reservation_id'] ?? json['reservationId'] ?? '',
      merchantId: json['merchant_id'] ?? json['merchantId'] ?? '',
      validationType: ValidationType.fromString(
        json['validation_type'] ?? json['validationType'] ?? 'scan',
      ),
      status: ValidationRecordStatus.fromString(
        json['status'] ?? 'validated',
      ),
      scannedAt: DateTime.parse(
        json['scanned_at'] ?? json['scannedAt'] ?? json['validatedAt'] ?? DateTime.now().toIso8601String(),
      ),
      location: json['location'],
      notes: json['notes'],
      ticketName: json['ticket_name'] ?? json['ticketName'],
      customerEmail: json['customer_email'] ?? json['customerEmail'],
      quantity: json['quantity'],
      totalPrice: json['total_price'] != null 
          ? (json['total_price'] as num).toDouble()
          : json['totalPrice'] != null 
              ? (json['totalPrice'] as num).toDouble()
              : null,
      reservationDate: json['reservation_date'] ?? json['reservationDate'],
      reservationTime: json['reservation_time'] ?? json['reservationTime'],
    );
  final String id;
  final String ticketId;
  final String reservationId;
  final String merchantId;
  final ValidationType validationType;
  final ValidationRecordStatus status;
  final DateTime scannedAt;
  final String? location;
  final String? notes;
  final String? ticketName;
  final String? customerEmail;
  final int? quantity;
  final double? totalPrice;
  final String? reservationDate;
  final String? reservationTime;

  Map<String, dynamic> toJson() => {
      'id': id,
      'ticket_id': ticketId,
      'reservation_id': reservationId,
      'merchant_id': merchantId,
      'validation_type': validationType.name,
      'status': status.name,
      'scanned_at': scannedAt.toIso8601String(),
      'location': location,
      'notes': notes,
      'ticket_name': ticketName,
      'customer_email': customerEmail,
      'quantity': quantity,
      'total_price': totalPrice,
      'reservation_date': reservationDate,
      'reservation_time': reservationTime,
    };

  @override
  String toString() => 'ValidationRecord(id: $id, ticketId: $ticketId, status: $status, scannedAt: $scannedAt)';
}


