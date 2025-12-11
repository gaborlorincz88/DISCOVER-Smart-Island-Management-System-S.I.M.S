enum ValidationStatus {
  pending,
  confirmed,
  completed,
  cancelled,
  expired;

  static ValidationStatus fromString(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return ValidationStatus.pending;
      case 'confirmed':
        return ValidationStatus.confirmed;
      case 'completed':
        return ValidationStatus.completed;
      case 'cancelled':
        return ValidationStatus.cancelled;
      case 'expired':
        return ValidationStatus.expired;
      default:
        return ValidationStatus.pending;
    }
  }

  String get displayName {
    switch (this) {
      case ValidationStatus.pending:
        return 'Pending';
      case ValidationStatus.confirmed:
        return 'Confirmed';
      case ValidationStatus.completed:
        return 'Completed';
      case ValidationStatus.cancelled:
        return 'Cancelled';
      case ValidationStatus.expired:
        return 'Expired';
    }
  }

  String get emoji {
    switch (this) {
      case ValidationStatus.pending:
        return '⏳';
      case ValidationStatus.confirmed:
        return '📋';
      case ValidationStatus.completed:
        return '✅';
      case ValidationStatus.cancelled:
        return '❌';
      case ValidationStatus.expired:
        return '⏰';
    }
  }
}

class Ticket {

  Ticket({
    required this.id,
    required this.ticketId,
    required this.tourName,
    required this.customerName,
    required this.contactEmail,
    required this.contactPhone,
    required this.quantity,
    required this.totalPrice,
    required this.reservationDate,
    required this.validationStatus, this.reservationTime,
    this.validatedAt,
    this.validatedBy,
    this.validationLocation,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) => Ticket(
      id: json['id'] ?? '',
      ticketId: json['ticket_id'] ?? json['ticketId'] ?? '',
      tourName: json['tour_name'] ?? json['tourName'] ?? '',
      customerName: json['customer_name'] ?? json['customerName'] ?? '',
      contactEmail: json['contact_email'] ?? json['contactEmail'] ?? '',
      contactPhone: json['contact_phone'] ?? json['contactPhone'] ?? '',
      quantity: json['quantity'] ?? 0,
      totalPrice: (json['total_price'] ?? json['totalPrice'] ?? 0).toDouble(),
      reservationDate: json['reservation_date'] ?? json['reservationDate'] ?? '',
      reservationTime: json['reservation_time'] ?? json['reservationTime'],
      validationStatus: ValidationStatus.fromString(
        json['validation_status'] ?? json['validationStatus'] ?? 'pending',
      ),
      validatedAt: json['validated_at'] ?? json['validatedAt'],
      validatedBy: json['validated_by'] ?? json['validatedBy'],
      validationLocation: json['validation_location'] ?? json['validationLocation'],
    );
  final String id;
  final String ticketId;
  final String tourName;
  final String customerName;
  final String contactEmail;
  final String contactPhone;
  final int quantity;
  final double totalPrice;
  final String reservationDate;
  final String? reservationTime;
  final ValidationStatus validationStatus;
  final String? validatedAt;
  final String? validatedBy;
  final String? validationLocation;

  Map<String, dynamic> toJson() => {
      'id': id,
      'ticket_id': ticketId,
      'tour_name': tourName,
      'customer_name': customerName,
      'contact_email': contactEmail,
      'contact_phone': contactPhone,
      'quantity': quantity,
      'total_price': totalPrice,
      'reservation_date': reservationDate,
      'reservation_time': reservationTime,
      'validation_status': validationStatus.name,
      'validated_at': validatedAt,
      'validated_by': validatedBy,
      'validation_location': validationLocation,
    };

  @override
  String toString() => 'Ticket(id: $id, ticketId: $ticketId, tourName: $tourName, customerName: $customerName, validationStatus: $validationStatus)';
}


