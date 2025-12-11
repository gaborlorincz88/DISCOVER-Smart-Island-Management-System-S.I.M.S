class QRData {

  QRData({
    required this.ticketId,
    required this.reservationId,
    required this.userId,
    required this.timestamp,
    required this.hash,
  });

  factory QRData.fromJson(Map<String, dynamic> json) => QRData(
      ticketId: json['ticketId'] ?? '',
      reservationId: json['reservationId'] ?? '',
      userId: json['userId'] ?? '',
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
      hash: json['hash'] ?? '',
    );
  final String ticketId;
  final String reservationId;
  final String userId;
  final DateTime timestamp;
  final String hash;

  Map<String, dynamic> toJson() => {
      'ticketId': ticketId,
      'reservationId': reservationId,
      'userId': userId,
      'timestamp': timestamp.toIso8601String(),
      'hash': hash,
    };

  @override
  String toString() => 'QRData(ticketId: $ticketId, reservationId: $reservationId, userId: $userId, timestamp: $timestamp, hash: $hash)';
}


