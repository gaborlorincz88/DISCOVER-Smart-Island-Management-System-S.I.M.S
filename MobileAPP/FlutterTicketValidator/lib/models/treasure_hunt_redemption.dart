class TreasureHuntRedemption {
  final String id;
  final int treasureHuntId;
  final int userId;
  final String couponCode;
  final String merchantId;
  final DateTime redeemedAt;
  final String huntName;
  final int discountPercentage;
  final String userEmail;
  final String? userName;

  TreasureHuntRedemption({
    required this.id,
    required this.treasureHuntId,
    required this.userId,
    required this.couponCode,
    required this.merchantId,
    required this.redeemedAt,
    required this.huntName,
    required this.discountPercentage,
    required this.userEmail,
    this.userName,
  });

  factory TreasureHuntRedemption.fromJson(Map<String, dynamic> json) => TreasureHuntRedemption(
    id: json['id'] ?? '',
    treasureHuntId: json['treasure_hunt_id'] ?? json['treasureHuntId'] ?? 0,
    userId: json['user_id'] ?? json['userId'] ?? 0,
    couponCode: json['coupon_code'] ?? json['couponCode'] ?? '',
    merchantId: json['merchant_id'] ?? json['merchantId'] ?? '',
    redeemedAt: DateTime.parse(
      json['redeemed_at'] ?? json['redeemedAt'] ?? DateTime.now().toIso8601String(),
    ),
    huntName: json['hunt_name'] ?? json['huntName'] ?? 'Unknown Hunt',
    discountPercentage: json['prize_discount_percentage'] ?? json['discountPercentage'] ?? 0,
    userEmail: json['user_email'] ?? json['userEmail'] ?? '',
    userName: json['user_name'] ?? json['userName'],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'treasure_hunt_id': treasureHuntId,
    'user_id': userId,
    'coupon_code': couponCode,
    'merchant_id': merchantId,
    'redeemed_at': redeemedAt.toIso8601String(),
    'hunt_name': huntName,
    'prize_discount_percentage': discountPercentage,
    'user_email': userEmail,
    'user_name': userName,
  };
}








