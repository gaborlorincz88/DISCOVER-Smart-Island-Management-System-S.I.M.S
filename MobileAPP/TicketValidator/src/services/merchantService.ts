import { Merchant, Validation, Ticket, QRData } from '../types';

const API_BASE_URL = 'http://localhost:3003/api/merchant';

class MerchantService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async register(merchantData: {
    name: string;
    email: string;
    password: string;
    businessName?: string;
    location?: string;
  }) {
    const response = await this.makeRequest('/register', {
      method: 'POST',
      body: JSON.stringify(merchantData),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return {
      success: true,
      token: response.token,
      merchant: response.merchant,
    };
  }

  async login(email: string, password: string) {
    const response = await this.makeRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return {
      success: true,
      token: response.token,
      merchant: response.merchant,
    };
  }

  async validateTicket(qrData: string, location?: string, notes?: string) {
    const response = await this.makeRequest('/validate-ticket', {
      method: 'POST',
      body: JSON.stringify({ qrData, location, notes }),
    });

    return response;
  }

  async getValidatedTickets(limit: number = 50, offset: number = 0): Promise<Validation[]> {
    const response = await this.makeRequest(`/tickets/validated?limit=${limit}&offset=${offset}`);
    return response.validations;
  }

  async getTicketStatus(ticketId: string): Promise<Ticket> {
    const response = await this.makeRequest(`/tickets/${ticketId}/status`);
    return response.ticket;
  }

  async getQRData(ticketId: string): Promise<{ qrData: string; ticket: Ticket }> {
    const response = await this.makeRequest(`/tickets/${ticketId}/qr-data`);
    return response;
  }
}

export const merchantService = new MerchantService();
