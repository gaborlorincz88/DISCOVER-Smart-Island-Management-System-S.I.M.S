class Merchant {

  Merchant({
    required this.id,
    required this.name,
    required this.email,
    this.businessName,
    this.location,
  });

  factory Merchant.fromJson(Map<String, dynamic> json) => Merchant(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      businessName: json['businessName'],
      location: json['location'],
    );
  final String id;
  final String name;
  final String email;
  final String? businessName;
  final String? location;

  Map<String, dynamic> toJson() => {
      'id': id,
      'name': name,
      'email': email,
      'businessName': businessName,
      'location': location,
    };

  @override
  String toString() => 'Merchant(id: $id, name: $name, email: $email, businessName: $businessName, location: $location)';
}


