export interface Merchant {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  location?: string;
}

export interface Ticket {
  id: string;
  ticketId: string;
  ticketName: string;
  customerEmail: string;
  quantity: number;
  totalPrice: number;
  reservationDate: string;
  validationStatus: 'pending' | 'validated' | 'used' | 'expired' | 'cancelled';
  validatedAt?: string;
  validatedBy?: string;
  validationLocation?: string;
}

export interface QRData {
  ticketId: string;
  reservationId: string;
  userId: string;
  timestamp: string;
  hash: string;
}

export interface Validation {
  id: string;
  ticketId: string;
  reservationId: string;
  merchantId: string;
  validationType: 'scan' | 'manual' | 'refund';
  status: 'validated' | 'refunded' | 'cancelled';
  scannedAt: string;
  location?: string;
  notes?: string;
  ticketName: string;
  customerEmail: string;
  quantity: number;
  totalPrice: number;
  reservationDate: string;
  reservationTime?: string;
}

export interface AuthContextType {
  merchant: Merchant | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}
