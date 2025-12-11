import { getApiBaseUrl } from './config';

const API_BASE = getApiBaseUrl();

export interface Ticket {
  id: string;
  ticketNumber: string;
  tourName: string;
  tourId: string;
  date: string;
  participants: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialRequests: string;
  totalPaid: number;
  status: 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  image?: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  ticket_id: string;
  tour_name?: string;
  quantity: number;
  total_price: number;
  currency: string;
  status: string;
  reservation_date: string;
  reservation_time?: string;
  special_requests?: string;
  contact_email?: string;
  contact_phone?: string;
  ticket_name: string;
  ticket_category: string;
  ticket_price: number;
  ticket_image?: string;
  created_at: string;
  updated_at: string;
}

export const ticketService = {
  // Create a new reservation
  async createReservation(reservationData: {
    userId: string;
    ticketId: string;
    tourName?: string; // The actual tour name
    quantity: number;
    totalPrice: number;
    reservationDate: string;
    reservationTime?: string;
    specialRequests?: string;
    contactEmail?: string;
    contactPhone?: string;
    customerName?: string;
  }): Promise<{ message: string; reservationId: string }> {
    // Map tour ID to ticket ID (for now, use a simple mapping)
    const ticketIdMapping: { [key: string]: string } = {
      'comino-tour': 'ticket-2', // Comino Boat Trip
      'gozo-bus-tour': 'ticket-1', // Gozo Bus Tour
      'green-bus': 'ticket-1', // Green Bus (maps to Gozo Bus Tour)
      'sightseeing-bus': 'ticket-1', // Sightseeing Bus (maps to Gozo Bus Tour)
      'orange-bus': 'ticket-1', // Orange Bus (maps to Gozo Bus Tour)
      'hiking-tour': 'ticket-3', // Hiking Trail Guide
      'comino-walk': 'ticket-3', // Comino Walk (hiking trail)
      'dwejra-walk': 'ticket-3', // Dwejra Walk (hiking trail)
      'quad-tours': 'ticket-4', // Quad Bike Adventure
      'coastal-explorer': 'ticket-4', // Coastal Explorer Quad Tour
      'parasailing-1': 'ticket-5', // Parasailing Adventure
      'parasailing': 'ticket-5', // Parasailing Adventure (fallback)
      'gozo-adventure': 'ticket-1', // Jeep Tour (currently maps to ticket-1, but backend will detect it)
    };

    const mappedTicketId = ticketIdMapping[reservationData.ticketId] || 'ticket-1';

    console.log('=== TICKET SERVICE: Creating reservation ===');
    console.log('Original ticketId:', reservationData.ticketId);
    console.log('Mapped ticketId:', mappedTicketId);
    console.log('Full reservation data:', { ...reservationData, ticketId: mappedTicketId });

    const response = await fetch(`${API_BASE}/api/admin/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...reservationData,
        ticketId: mappedTicketId,
        originalTourId: reservationData.ticketId // Send original tour ID before mapping
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create reservation');
    }

    return response.json();
  },

  // Get user reservations
  async getUserReservations(userId: string): Promise<Reservation[]> {
    console.log('%c=== TICKET SERVICE: Getting user reservations ===', 'background: #0066cc; color: white; font-size: 14px; padding: 4px;');
    console.log('API URL:', `${API_BASE}/api/admin/user/${userId}/reservations`);
    
    const response = await fetch(`${API_BASE}/api/admin/user/${userId}/reservations`);

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      console.error('%cERROR getting reservations:', 'background: #cc0000; color: white; padding: 4px;', error);
      throw new Error(error.error || 'Failed to get reservations');
    }

    const data = await response.json();
    console.log('%c=== RESERVATIONS RESPONSE ===', 'background: #00cc00; color: white; padding: 4px;');
    console.log('Number of reservations:', data.reservations?.length || 0);
    if (data.reservations && data.reservations.length > 0) {
      data.reservations.forEach((r: any, idx: number) => {
        console.log(`Reservation ${idx + 1}: "${r.tour_name}" - ticket_image: ${r.ticket_image || 'NONE'}`);
      });
    }
    return data.reservations;
  },

  // Convert reservation to ticket format for frontend compatibility
  convertReservationToTicket(reservation: Reservation): Ticket {
    console.log('=== Converting reservation to ticket ===');
    console.log('Reservation ID:', reservation.id);
    console.log('Tour name:', reservation.tour_name);
    console.log('Ticket ID:', reservation.ticket_id);
    console.log('Ticket image from backend:', reservation.ticket_image);
    
    // Handle missing or undefined reservation_date
    const reservationDate = reservation.reservation_date || reservation.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
    
    // Handle image URL - add API base URL if it's a relative path
    // Filter out empty strings, null, undefined
    let imageUrl = undefined;
    console.log('%c=== Converting reservation.ticket_image ===', 'background: #0066cc; color: white; padding: 4px;');
    console.log('Raw ticket_image from backend:', reservation.ticket_image);
    console.log('ticket_image type:', typeof reservation.ticket_image);
    console.log('ticket_image length:', reservation.ticket_image?.length || 0);
    
    if (reservation.ticket_image && 
        typeof reservation.ticket_image === 'string' &&
        reservation.ticket_image.trim() !== '' && 
        reservation.ticket_image !== 'null' && 
        reservation.ticket_image !== 'undefined' &&
        reservation.ticket_image !== '""') {
      imageUrl = reservation.ticket_image.startsWith('/uploads/') 
        ? `${API_BASE}${reservation.ticket_image}` 
        : reservation.ticket_image.startsWith('http')
          ? reservation.ticket_image
          : `${API_BASE}${reservation.ticket_image.startsWith('/') ? '' : '/'}${reservation.ticket_image}`;
      console.log('%c✅ Valid image URL created:', 'background: #00cc00; color: white; padding: 4px;', imageUrl);
    } else {
      console.log('%c❌ Invalid or empty ticket_image:', 'background: #ff0000; color: white; padding: 4px;', reservation.ticket_image);
    }
    
    console.log('Final image URL for ticket:', imageUrl);
    
    // Create participant breakdown string
    const participantBreakdown = [];
    if (reservation.adults && reservation.adults > 0) {
      participantBreakdown.push(`${reservation.adults} Adult${reservation.adults !== 1 ? 's' : ''}`);
    }
    if (reservation.children && reservation.children > 0) {
      participantBreakdown.push(`${reservation.children} Child${reservation.children !== 1 ? 'ren' : ''}`);
    }
    if (reservation.seniors && reservation.seniors > 0) {
      participantBreakdown.push(`${reservation.seniors} Senior${reservation.seniors !== 1 ? 's' : ''}`);
    }
    
    const participantDetails = participantBreakdown.length > 0 
      ? participantBreakdown.join(', ')
      : `${reservation.quantity || 1} participant${(reservation.quantity || 1) !== 1 ? 's' : ''}`;

    return {
      id: reservation.id,
      ticketNumber: reservation.id, // Use the actual reservation ID (GOZO-YYYYMMDD-XXXXX format)
      tourName: reservation.tour_name || reservation.ticket_name || 'Unknown Tour',
      tourId: reservation.ticket_id,
      tourDescription: reservation.ticket_description || reservation.tour_description,
      date: reservationDate,
      participants: reservation.quantity || 1,
      participantDetails: participantDetails,
      adults: reservation.adults || 0,
      children: reservation.children || 0,
      seniors: reservation.seniors || 0,
      customerName: reservation.customer_name || reservation.contact_email?.split('@')[0] || 'Customer',
      customerEmail: reservation.contact_email || '',
      customerPhone: reservation.contact_phone || '',
      specialRequests: reservation.special_requests || '',
      totalPaid: reservation.total_price || 0,
      status: (reservation.validation_status === 'completed' ? 'completed' : 
               reservation.validation_status === 'pending' ? 'confirmed' : 
               reservation.status) as 'confirmed' | 'completed' | 'cancelled',
      createdAt: reservation.created_at || new Date().toISOString(),
      image: imageUrl,
    };
  },

  // Get user tickets (converted from reservations)
  async getUserTickets(userId: string): Promise<Ticket[]> {
    console.log('=== TICKET SERVICE: Getting user tickets ===');
    console.log('User ID:', userId);
    
    try {
      const reservations = await this.getUserReservations(userId);
      console.log('Reservations from backend:', reservations);
      console.log('Number of reservations:', reservations.length);
      
      if (reservations.length > 0) {
        console.log('First reservation details:', {
          id: reservations[0].id,
          tour_name: reservations[0].tour_name,
          ticket_id: reservations[0].ticket_id,
          ticket_image: reservations[0].ticket_image,
          ticket_category: reservations[0].ticket_category
        });
      }
      
      const tickets = reservations.map(reservation => this.convertReservationToTicket(reservation));
      console.log('Converted tickets:', tickets.length);
      
      // Log image status for each ticket
      tickets.forEach((ticket, index) => {
        console.log(`Ticket ${index + 1}: "${ticket.tourName}" - Image: ${ticket.image || 'NONE'}`);
      });
      
      return tickets;
    } catch (error) {
      console.error('Error getting user tickets:', error);
      console.log('Falling back to localStorage...');
      // Fallback to localStorage if backend fails
      return this.getTicketsFromLocalStorage();
    }
  },

  // Fallback to localStorage
  getTicketsFromLocalStorage(): Ticket[] {
    try {
      const savedTickets = localStorage.getItem('userTickets');
      return savedTickets ? JSON.parse(savedTickets) : [];
    } catch (error) {
      console.error('Error loading tickets from localStorage:', error);
      return [];
    }
  },

  // Generate QR code for a reservation
  async generateQRCode(reservationId: string): Promise<string> {
    console.log('=== TICKET SERVICE: Generating QR code ===');
    console.log('Reservation ID:', reservationId);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/reservations/${reservationId}/qr-simple`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate QR code');
      }
      
      const data = await response.json();
      console.log('QR code generated successfully');
      return data.qrCode;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  },

  // Save ticket to localStorage (for backward compatibility)
  saveTicketToLocalStorage(ticket: Ticket): void {
    try {
      const existingTickets = this.getTicketsFromLocalStorage();
      existingTickets.push(ticket);
      localStorage.setItem('userTickets', JSON.stringify(existingTickets));
    } catch (error) {
      console.error('Error saving ticket to localStorage:', error);
    }
  }
};
