import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, Camera } from 'expo-camera';

// Types
interface Merchant {
  id: string;
  name: string;
  email: string;
  businessName: string;
}

interface Ticket {
  id: string;
  ticket_id: string;
  tour_name: string;
  customer_name: string;
  contact_email: string;
  contact_phone: string;
  quantity: number;
  total_price: number;
  reservation_date: string;
  status: string;
  validation_status: string;
}

interface ValidationRecord {
  id: string;
  ticket_id: string;
  reservation_id: string;
  merchant_id: string;
  validation_type: string;
  status: string;
  scanned_at: string;
  location: string;
  notes: string;
}

// API Service
const API_BASE = 'http://192.168.1.102:3003/api';

class MerchantService {
  private token: string | null = null;

  async login(email: string, password: string): Promise<{ token: string; merchant: Merchant }> {
    const response = await fetch(`${API_BASE}/merchant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    this.token = data.token;
    await AsyncStorage.setItem('merchant_token', data.token);
    await AsyncStorage.setItem('merchant_data', JSON.stringify(data.merchant));
    return data;
  }

  async validateTicket(reservationId: string, validationType: string = 'scan'): Promise<ValidationRecord> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/merchant/validate-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ ticket_id: reservationId, validation_type: validationType }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to validate ticket: ${errorText}`);
    }

    return response.json();
  }

  async getTicketDetails(ticketId: string): Promise<Ticket> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/merchant/tickets/${ticketId}/qr-data`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get ticket details');
    }

    return response.json();
  }

  async getValidationHistory(): Promise<ValidationRecord[]> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/merchant/tickets/validated`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get validation history');
    }

    const data = await response.json();
    return data.validations || [];
  }

  async logout(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem('merchant_token');
    await AsyncStorage.removeItem('merchant_data');
  }
}

const merchantService = new MerchantService();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [currentScreen, setCurrentScreen] = useState('Login');
  const [scannedTicket, setScannedTicket] = useState<Ticket | null>(null);
  const [validationHistory, setValidationHistory] = useState<ValidationRecord[]>([]);
  
  // QR Scanner state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Manual ticket input state
  const [ticketIdInput, setTicketIdInput] = useState('');

  useEffect(() => {
    checkAuthStatus();
    requestCameraPermission();
  }, []);

  // Request camera permission for QR scanning
  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('merchant_token');
      const merchantData = await AsyncStorage.getItem('merchant_data');
      
      if (token && merchantData) {
        merchantService['token'] = token;
        setMerchant(JSON.parse(merchantData));
        setIsLoggedIn(true);
        setCurrentScreen('Scanner');
        // Clear validation history when switching merchants
        setValidationHistory([]);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const data = await merchantService.login(email, password);
      setMerchant(data.merchant);
      setIsLoggedIn(true);
      setCurrentScreen('Scanner');
      // Clear validation history when logging in
      setValidationHistory([]);
      Alert.alert('Success', 'Login successful!');
    } catch (error) {
      Alert.alert('Error', `Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await merchantService.logout();
    setMerchant(null);
    setIsLoggedIn(false);
    setCurrentScreen('Login');
    setEmail('');
    setPassword('');
    // Clear validation history when logging out
    setValidationHistory([]);
  };

  const handleManualTicketLookup = async () => {
    if (!ticketIdInput.trim()) {
      Alert.alert('Error', 'Please enter a ticket ID');
      return;
    }

    try {
      const ticketDetails = await merchantService.getTicketDetails(ticketIdInput.trim());
      setScannedTicket(ticketDetails);
      setCurrentScreen('TicketDetails');
      setTicketIdInput('');
    } catch (error) {
      Alert.alert('Error', 'Invalid ticket or ticket not found');
    }
  };

  // Handle QR code scanning
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    console.log('QR Code scanned:', { type, data });
    
    try {
      // Clean the scanned data (remove any whitespace)
      const cleanData = data.trim();
      
      // Look up the ticket using the scanned data
      const ticketDetails = await merchantService.getTicketDetails(cleanData);
      setScannedTicket(ticketDetails);
      setShowScanner(false);
      setCurrentScreen('TicketDetails');
    } catch (error) {
      Alert.alert(
        'Invalid QR Code', 
        'The scanned code is not a valid ticket ID',
        [
          { text: 'Try Again', onPress: () => setScanned(false) },
          { text: 'Manual Input', onPress: () => {
            setShowScanner(false);
            setScanned(false);
          }}
        ]
      );
    }
  };

  // Start QR scanning
  const startQRScanning = () => {
    if (hasPermission === null) {
      Alert.alert('Permission Required', 'Camera permission is being requested...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert(
        'Camera Permission Denied', 
        'Please enable camera permission in your device settings to scan QR codes.',
        [
          { text: 'Settings', onPress: () => requestCameraPermission() },
          { text: 'Manual Input', onPress: () => {} }
        ]
      );
      return;
    }
    
    setScanned(false);
    setShowScanner(true);
  };

  const handleValidateTicket = async () => {
    if (!scannedTicket) return;

    try {
      await merchantService.validateTicket(scannedTicket.id, 'scan');
      Alert.alert('Success', 'Ticket validated successfully!');
      setScannedTicket(null);
      setCurrentScreen('Scanner');
    } catch (error) {
      Alert.alert('Error', 'Failed to validate ticket');
    }
  };

  const loadValidationHistory = async () => {
    try {
      const history = await merchantService.getValidationHistory();
      setValidationHistory(history);
    } catch (error) {
      Alert.alert('Error', 'Failed to load validation history');
    }
  };

  const renderLoginScreen = () => (
    <View style={styles.loginContainer}>
      {/* Header with Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🌊</Text>
        </View>
        <Text style={styles.brandTitle}>Discover Gozo</Text>
        <Text style={styles.brandSubtitle}>Merchant Portal</Text>
        <Text style={styles.brandDescription}>Ticket Validation System</Text>
      </View>

      {/* Login Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Welcome Back</Text>
        <Text style={styles.formSubtitle}>Sign in to validate tickets</Text>
        
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>
          
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Sign In</Text>
            <Text style={styles.loginButtonIcon}>→</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>Demo Credentials</Text>
          <Text style={styles.helpText}>Email: merchant@discovergozo.com</Text>
          <Text style={styles.helpText}>Password: merchant123</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Discover Gozo</Text>
        <Text style={styles.footerSubtext}>Powered by Technology</Text>
      </View>
    </View>
  );

  const renderScannerScreen = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>🌊</Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.merchantName}>{merchant?.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scannerContainer} showsVerticalScrollIndicator={false}>
        {/* Ticket Lookup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎫 Ticket Validation</Text>
          <Text style={styles.sectionSubtitle}>Scan QR code or enter reservation ID manually</Text>
          
          {/* QR Scanner Button */}
          <TouchableOpacity
            style={styles.qrButton}
            onPress={startQRScanning}
          >
            <Text style={styles.qrButtonIcon}>📷</Text>
            <Text style={styles.qrButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.ticketInput}
              placeholder="Enter reservation ID manually (e.g., GOZO-20250910-C29M1)"
              value={ticketIdInput}
              onChangeText={setTicketIdInput}
              autoCapitalize="characters"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={styles.lookupButton}
              onPress={handleManualTicketLookup}
            >
              <Text style={styles.lookupButtonText}>🔍 Lookup Ticket</Text>
            </TouchableOpacity>
          </View>
          
          {/* Sample Tickets */}
          <View style={styles.sampleTickets}>
            <Text style={styles.sampleTitle}>Quick Test IDs:</Text>
            <TouchableOpacity 
              style={styles.sampleButton}
              onPress={() => setTicketIdInput('GOZO-20250910-C29M1')}
            >
              <Text style={styles.sampleButtonText}>GOZO-20250910-C29M1</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>
              Supports GOZO-YYYYMMDD-XXXXX format
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                loadValidationHistory();
                setCurrentScreen('History');
              }}
            >
              <Text style={styles.actionButtonIcon}>📊</Text>
              <Text style={styles.actionButtonText}>History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setCurrentScreen('Profile')}
            >
              <Text style={styles.actionButtonIcon}>👤</Text>
              <Text style={styles.actionButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderTicketDetailsScreen = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('Scanner')}
        >
          <Text style={styles.backButtonIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        {scannedTicket && (
          <>
            {/* Ticket Card */}
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketTitle}>{scannedTicket.tour_name}</Text>
                <View style={styles.ticketStatus}>
                  <Text style={styles.ticketStatusText}>
                    {scannedTicket.validation_status === 'completed' ? '✅ Completed' : 
                     scannedTicket.validation_status === 'pending' ? '⏳ Pending' : 
                     '📋 Confirmed'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.ticketInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>👤 Customer</Text>
                  <Text style={styles.infoValue}>{scannedTicket.customer_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📧 Email</Text>
                  <Text style={styles.infoValue}>{scannedTicket.contact_email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📱 Phone</Text>
                  <Text style={styles.infoValue}>{scannedTicket.contact_phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>👥 Quantity</Text>
                  <Text style={styles.infoValue}>{scannedTicket.quantity} person(s)</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>💰 Price</Text>
                  <Text style={styles.infoValue}>€{scannedTicket.total_price}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📅 Date</Text>
                  <Text style={styles.infoValue}>{scannedTicket.reservation_date}</Text>
                </View>
              </View>
            </View>

            {/* Validation Button */}
            {scannedTicket.validation_status !== 'completed' && (
              <TouchableOpacity
                style={styles.validateButton}
                onPress={handleValidateTicket}
              >
                <Text style={styles.validateButtonText}>✅ Validate Ticket</Text>
              </TouchableOpacity>
            )}
            
            {scannedTicket.validation_status === 'completed' && (
              <View style={styles.completedCard}>
                <Text style={styles.completedIcon}>🎉</Text>
                <Text style={styles.completedText}>Ticket Already Validated</Text>
                <Text style={styles.completedSubtext}>This ticket has been successfully validated</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );

  const renderHistoryScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Validation History</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('Scanner')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.historyContainer}>
        {validationHistory.length === 0 ? (
          <Text style={styles.noHistoryText}>No validation history found</Text>
        ) : (
          validationHistory.map((record) => (
            <View key={record.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>Ticket ID: {record.ticket_id}</Text>
              <Text style={styles.historyInfo}>Type: {record.validation_type}</Text>
              <Text style={styles.historyInfo}>Status: {record.status}</Text>
              <Text style={styles.historyInfo}>Scanned: {new Date(record.scanned_at).toLocaleString()}</Text>
              {record.location && (
                <Text style={styles.historyInfo}>Location: {record.location}</Text>
              )}
              {record.notes && (
                <Text style={styles.historyInfo}>Notes: {record.notes}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderProfileScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Profile</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('Scanner')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.profileContainer}>
        {merchant && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>Merchant Information</Text>
            <Text style={styles.profileInfo}>Name: {merchant.name}</Text>
            <Text style={styles.profileInfo}>Email: {merchant.email}</Text>
            <Text style={styles.profileInfo}>Business: {merchant.businessName}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.logoutButtonLarge}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // QR Scanner Screen
  const renderQRScannerScreen = () => {
    if (hasPermission === null) {
      return (
        <View style={styles.scannerContainer}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Requesting camera permission...</Text>
          </View>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.scannerContainer}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionIcon}>📷</Text>
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              Please enable camera permission in your device settings to scan QR codes.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestCameraPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.permissionButtonSecondary}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.permissionButtonSecondaryText}>Manual Input</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.scannerContainer}>
        <View style={styles.scannerHeader}>
          <TouchableOpacity
            style={styles.scannerBackButton}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.scannerBackButtonIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>Scan QR Code</Text>
          <View style={styles.scannerSpacer} />
        </View>
        
        <View style={styles.scannerView}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417'],
            }}
            style={styles.barcodeScanner}
          />
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerInstruction}>
              Position the QR code within the frame
            </Text>
          </View>
        </View>
        
        <View style={styles.scannerFooter}>
          <TouchableOpacity
            style={styles.scannerActionButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.scannerActionButtonText}>Reset Scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scannerActionButtonSecondary}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.scannerActionButtonSecondaryText}>Manual Input</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {showScanner && renderQRScannerScreen()}
      {!showScanner && currentScreen === 'Login' && renderLoginScreen()}
      {!showScanner && currentScreen === 'Scanner' && renderScannerScreen()}
      {!showScanner && currentScreen === 'TicketDetails' && renderTicketDetailsScreen()}
      {!showScanner && currentScreen === 'History' && renderHistoryScreen()}
      {!showScanner && currentScreen === 'Profile' && renderProfileScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Login Screen Styles
  loginContainer: {
    flex: 1,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 40,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  brandDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    fontSize: 16,
    color: '#1f2937',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  loginButtonIcon: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerLogoText: {
    fontSize: 20,
  },
  welcomeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  merchantName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scannerContainer: {
    flex: 1,
    padding: 20,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 30,
  },
  ticketInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'white',
    fontSize: 16,
  },
  lookupButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  lookupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  menuButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // New Modern Styles
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  sampleTickets: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  sampleButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  sampleButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  detailsContainer: {
    flex: 1,
    padding: 20,
  },
  ticketCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  ticketInfo: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  validateButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  validateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  // Enhanced Ticket Details Styles
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  ticketStatus: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  completedCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  completedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  completedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8,
  },
  completedSubtext: {
    fontSize: 14,
    color: '#16a34a',
    textAlign: 'center',
  },
  // QR Scanner Styles
  qrButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  qrButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  qrButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  // Scanner Screen Styles
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#3b82f6',
  },
  scannerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBackButtonIcon: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scannerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  scannerSpacer: {
    width: 40,
  },
  scannerView: {
    flex: 1,
    position: 'relative',
  },
  barcodeScanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerInstruction: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scannerFooter: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'space-between',
  },
  scannerActionButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  scannerActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerActionButtonSecondary: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  scannerActionButtonSecondaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Permission Styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButtonSecondary: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonSecondaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  historyContainer: {
    flex: 1,
    padding: 20,
  },
  noHistoryText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 50,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  historyInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  profileContainer: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  profileInfo: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  logoutButtonLarge: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sampleTickets: {
    marginTop: 20,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
  },
  sampleButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  sampleButtonText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});