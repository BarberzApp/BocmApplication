import { Alert } from 'react-native';
import { logger } from './logger';

const API_URL = process.env.EXPO_PUBLIC_API_URL || "";

export interface PaymentIntentData {
  barberId: string;
  serviceId: string;
  date: string;
  servicePrice: number;
  paymentType: 'full' | 'fee';
  clientId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  notes?: string;
}

export interface CheckoutSessionData extends PaymentIntentData {
  successUrl: string;
  cancelUrl: string;
}

class StripePaymentService {
  // Create a payment intent using the existing endpoint
  async createPaymentIntent(data: PaymentIntentData) {
    try {
      const url = `${API_URL}/api/payments/create-booking-intent`;
      const requestBody = {
        barberId: data.barberId,
        serviceId: data.serviceId,
        date: data.date,
        notes: data.notes || '',
        guestName: data.guestName || '',
        guestEmail: data.guestEmail || '',
        guestPhone: data.guestPhone || '',
        clientId: data.clientId || ''
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = 'Failed to create payment intent';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${responseText || 'No details'}`;
        }
        throw new Error(errorMessage);
      }

      const result = JSON.parse(responseText);
      if (!result.clientSecret) {
        throw new Error('No client secret returned from server');
      }
      
      return result.clientSecret;
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Format price for display
  formatPrice(cents: number): string {
    return `${(cents / 100).toFixed(2)}`;
  }

  // Validate guest information
  validateGuestInfo(info: { name?: string; email?: string; phone?: string }): string[] {
    const errors: string[] = [];

    if (!info.name || info.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    if (!info.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) {
      errors.push('Invalid email address');
    }

    if (!info.phone || !/^[\d\s\-\+\(\)]+$/.test(info.phone) || info.phone.replace(/\D/g, '').length < 10) {
      errors.push('Invalid phone number');
    }

    return errors;
  }
}

export const stripePaymentService = new StripePaymentService();