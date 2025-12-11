import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { merchantService } from '../services/merchantService';
import { QRData } from '../types';

export default function ValidationScreen() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { merchant } = useAuth();

  const { qrData }: { qrData: QRData } = route.params as any;

  useEffect(() => {
    performValidation();
  }, []);

  const performValidation = async () => {
    try {
      setIsValidating(true);
      const qrDataString = JSON.stringify(qrData);
      const response = await merchantService.validateTicket(
        qrDataString,
        merchant?.location || 'Unknown Location'
      );
      
      setValidationResult(response);
    } catch (error: any) {
      console.error('Error validating ticket:', error);
      setValidationResult({
        error: error.message || 'Failed to validate ticket',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('Scanner' as never);
  };

  const handleScanAnother = () => {
    navigation.navigate('Scanner' as never);
  };

  if (isValidating) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Validating ticket...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {validationResult?.error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>Validation Failed</Text>
            <Text style={styles.errorMessage}>{validationResult.error}</Text>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Ticket Validated Successfully!</Text>
            
            {validationResult?.validation && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Ticket Details:</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ticket Name:</Text>
                  <Text style={styles.detailValue}>{validationResult.validation.ticketName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer Email:</Text>
                  <Text style={styles.detailValue}>{validationResult.validation.customerEmail}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity:</Text>
                  <Text style={styles.detailValue}>{validationResult.validation.quantity} person(s)</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Price:</Text>
                  <Text style={styles.detailValue}>€{validationResult.validation.totalPrice}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Validated At:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(validationResult.validation.validatedAt).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location:</Text>
                  <Text style={styles.detailValue}>{validationResult.validation.location}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleScanAnother}
        >
          <Text style={styles.buttonText}>Scan Another Ticket</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleDone}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#6b7280',
  },
  successContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButtonText: {
    color: '#374151',
  },
});
