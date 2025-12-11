import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/validation.dart';
import '../models/statistics.dart';

class LocalStorageService {
  static Database? _database;
  static const String _tableName = 'validated_tickets';

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'ticket_validator.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) {
        return db.execute('''
          CREATE TABLE $_tableName(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            validation_type TEXT NOT NULL,
            validated_at TEXT NOT NULL,
            merchant_id TEXT,
            merchant_name TEXT,
            location TEXT,
            notes TEXT,
            ticket_data TEXT,
            created_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  // Save validated ticket to local storage
  static Future<void> saveValidatedTicket(ValidationRecord validation) async {
    final db = await database;
    
    // Extract quantity and price from validation record
    final quantity = validation.quantity ?? 1;
    final totalPrice = validation.totalPrice ?? 0.0;
    
    await db.insert(
      _tableName,
      {
        'ticket_id': validation.ticketId,
        'validation_type': validation.validationType.name,
        'validated_at': validation.scannedAt.toIso8601String(),
        'merchant_id': validation.merchantId,
        'merchant_name': 'Demo Merchant', // Default merchant name
        'location': validation.location,
        'notes': validation.notes,
        'ticket_data': json.encode({
          'ticket_id': validation.ticketId,
          'reservation_id': validation.reservationId,
          'quantity': quantity,
          'total_price': totalPrice,
          'ticket_name': validation.ticketName,
          'customer_email': validation.customerEmail,
          'reservation_date': validation.reservationDate,
          'reservation_time': validation.reservationTime,
        }),
        'created_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get all validated tickets from local storage
  static Future<List<ValidationRecord>> getValidatedTickets({
    int limit = 50,
    int offset = 0,
    String? merchantId,
  }) async {
    final db = await database;
    
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      where: merchantId != null ? 'merchant_id = ?' : null,
      whereArgs: merchantId != null ? [merchantId] : null,
      orderBy: 'validated_at DESC',
      limit: limit,
      offset: offset,
    );

    return List.generate(maps.length, (i) {
      final map = maps[i];
      return ValidationRecord(
        id: map['id'].toString(),
        ticketId: map['ticket_id'],
        validationType: ValidationType.fromString(map['validation_type']),
        scannedAt: DateTime.parse(map['validated_at']),
        merchantId: map['merchant_id'],
        reservationId: map['ticket_id'],
        location: map['location'],
        notes: map['notes'],
        status: ValidationRecordStatus.validated,
      );
    });
  }

  // Get validated tickets count
  static Future<int> getValidatedTicketsCount() async {
    final db = await database;
    final result = await db.rawQuery('SELECT COUNT(*) as count FROM $_tableName');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  // Clear all validated tickets (for testing or reset)
  static Future<void> clearAllValidatedTickets() async {
    final db = await database;
    await db.delete(_tableName);
  }

  // Delete specific validated ticket
  static Future<void> deleteValidatedTicket(int id) async {
    final db = await database;
    await db.delete(
      _tableName,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Search validated tickets by ticket ID
  static Future<List<ValidationRecord>> searchValidatedTickets(String query) async {
    final db = await database;
    
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      where: 'ticket_id LIKE ? OR merchant_name LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
      orderBy: 'validated_at DESC',
    );

    return List.generate(maps.length, (i) {
      final map = maps[i];
      return ValidationRecord(
        id: map['id'].toString(),
        ticketId: map['ticket_id'],
        validationType: ValidationType.fromString(map['validation_type']),
        scannedAt: DateTime.parse(map['validated_at']),
        merchantId: map['merchant_id'],
        reservationId: map['ticket_id'],
        location: map['location'],
        notes: map['notes'],
        status: ValidationRecordStatus.validated,
      );
    });
  }

  // Get statistics from validated tickets (optionally filtered by merchant)
  static Future<Statistics> getStatistics({String? merchantId}) async {
    final db = await database;
    
    final List<Map<String, dynamic>> maps = await db.query(
      _tableName,
      where: merchantId != null ? 'merchant_id = ?' : null,
      whereArgs: merchantId != null ? [merchantId] : null,
      orderBy: 'validated_at DESC',
    );

    return Statistics.fromValidations(maps);
  }
}
