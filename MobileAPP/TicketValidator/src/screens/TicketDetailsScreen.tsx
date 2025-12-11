import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { merchantService } from '../services/merchantService';
import { Ticket, QRData } from '../types';

export default function TicketDetailsScreen() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { merchant } = useAuth();

  const { qrData }: { qrData: QRData } = route.params as any;

  useEffect(() => {
    loadTicketDetails();
  }, []);

  const loadTicketDetails = async () => {
    try {
      setIsLoading(true);
      const ticketData = await merchantService.getTicketStatus(qrData.ticketId);
      setTicket(ticketData);
    } catch (error) {
      console.error('Error loading ticket details:', error);
      Alert.alert('Error', 'Failed to load ticket details. Please try again.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!ticket) return;

    if (ticket.validationStatus === 'validated' || ticket.validationStatus === 'used') {
      Alert.alert(
        'Ticket Already Validated',
        `This ticket was already validated on ${ticket.validatedAt} by ${ticket.validatedBy}.`
      );
      return;
    }

    if (ticket.validationStatus === 'expired') {
      Alert.alert('Ticket Expired', 'This ticket has expired and cannot be validated.');
      return;
    }

    if (ticket.validationStatus === 'cancelled') {
      Alert.alert('Ticket Cancelled', 'This ticket has been cancelled and cannot be validated.');
      return;
    }

    Alert.alert(
      'Confirm Validation',
      `Are you sure you want to validate this ticket for ${ticket.customerEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Validate', onPress: performValidation },
      ]
    );
  };

  const performValidation = async () => {
    try {
      setIsValidating(true);
      const qrDataString = JSON.stringify(qrData);
      const response = await merchantService.validateTicket(
        qrDataString,
        merchant?.location || 'Unknown Location'
      );

      Alert.alert(
        'Success!',
        `Ticket validated successfully for ${response.validation.ticketName}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Scanner' as never),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error validating ticket:', error);
      Alert.alert('Validation Failed', error.message || 'Failed to validate ticket. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validated':
      case 'used':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'expired':
        return '#ef4444';
      case 'cancelled':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'validated':
        return 'Validated';
      case 'used':
        return 'Used';
      case 'pending':
        return 'Pending';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading ticket details...</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load ticket details</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ticket Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.validationStatus) }]}>
          <Text style={styles.statusText}>{getStatusText(ticket.validationStatus)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ticket Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Ticket Name:</Text>
            <Text style={styles.value}>{ticket.ticketName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Customer Email:</Text>
            <Text style={styles.value}>{ticket.customerEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Quantity:</Text>
            <Text style={styles.value}>{ticket.quantity} person(s)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Price:</Text>
            <Text style={styles.value}>€{ticket.totalPrice}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Reservation Date:</Text>
            <Text style={styles.value}>{ticket.reservationDate}</Text>
          </View>
        </View>

        {ticket.validatedAt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Validation Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Validated At:</Text>
              <Text style={styles.value}>{ticket.validatedAt}</Text>
            </View>
            {ticket.validatedBy && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Validated By:</Text>
                <Text style={styles.value}>{ticket.validatedBy}</Text>
              </View>
            )}
            {ticket.validationLocation && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Location:</Text>
                <Text style={styles.value}>{ticket.validationLocation}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back to Scanner</Text>
        </TouchableOpacity>

        {ticket.validationStatus === 'pending' && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isValidating && styles.buttonDisabled]}
            onPress={handleValidate}
            disabled={isValidating}
          >
            {isValidating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Validate Ticket</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
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
