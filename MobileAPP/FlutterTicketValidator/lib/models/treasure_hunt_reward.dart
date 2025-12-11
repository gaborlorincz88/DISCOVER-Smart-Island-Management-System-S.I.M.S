class TreasureHuntReward {
  final String huntName;
  final String userName;
  final String userEmail;
  final String couponCode;
  final int discountPercentage;
  final String completedAt;
  final String redeemedAt;
  final String redeemedBy;
  final bool alreadyRedeemed;

  TreasureHuntReward({
    required this.huntName,
    required this.userName,
    required this.userEmail,
    required this.couponCode,
    required this.discountPercentage,
    required this.completedAt,
    required this.redeemedAt,
    required this.redeemedBy,
    required this.alreadyRedeemed,
  });

  factory TreasureHuntReward.fromJson(Map<String, dynamic> json) {
    final reward = json['reward'] ?? json;
    return TreasureHuntReward(
      huntName: reward['hunt_name'] ?? 'Unknown Hunt',
      userName: reward['user_name'] ?? 'Unknown User',
      userEmail: reward['user_email'] ?? '',
      couponCode: reward['coupon_code'] ?? '',
      discountPercentage: reward['discount_percentage'] ?? 0,
      completedAt: reward['completed_at'] ?? '',
      redeemedAt: reward['redeemed_at'] ?? '',
      redeemedBy: reward['redeemed_by'] ?? 'Merchant',
      alreadyRedeemed: reward['already_redeemed'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'hunt_name': huntName,
    'user_name': userName,
    'user_email': userEmail,
    'coupon_code': couponCode,
    'discount_percentage': discountPercentage,
    'completed_at': completedAt,
    'redeemed_at': redeemedAt,
    'redeemed_by': redeemedBy,
    'already_redeemed': alreadyRedeemed,
  };
}








