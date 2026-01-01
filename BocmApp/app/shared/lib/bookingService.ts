// lib/bookingService.ts
import { supabase } from './supabase';
import { logger } from './logger';

export type { Service } from '../types';
import type { Service } from '../types';

export interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  barber_id: string;
  client_id: string;
  service_id: string;
  date: string;
  price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_intent_id?: string;
  platform_fee?: number;
  barber_payout?: number;
  addon_total?: number;
  service_price?: number; // Historical service price at time of booking
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingData {
  barber_id: string;
  service_id: string;
  date: string;
  price: number;
  client_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  payment_intent_id: string;
  platform_fee: number;
  barber_payout: number;
  notes?: string;
}

class BookingService {
  // Fetch services for a specific barber (using barber ID directly)
  async getBarberServices(barberId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barberId)
      .order('price', { ascending: true });

    if (error) {
      logger.error('Error fetching services:', error);
      throw error;
    }

    return data || [];
  }

  // Get available time slots for a specific date (using barber ID directly)
  async getAvailableSlots(barberId: string, date: string, serviceDuration: number): Promise<TimeSlot[]> {

    // Get existing bookings for the date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('date')
      .eq('barber_id', barberId)
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .neq('status', 'cancelled');

    if (error) {
      logger.error('Error fetching bookings:', error);
      throw error;
    }

    // Generate time slots based on service duration
    const slots: TimeSlot[] = [];
    const bookedTimes = new Set((bookings || []).map(b => new Date(b.date).toISOString()));

    // Calculate slot interval based on service duration
    // Use the service duration as the interval, but minimum 10 minutes
    const slotInterval = Math.max(serviceDuration, 10);
    
    // Start from 9 AM and go until 6 PM
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);
        
        // Skip if this would go past 6 PM
        const endTime = new Date(slotTime);
        endTime.setMinutes(endTime.getMinutes() + serviceDuration);
        if (endTime.getHours() >= endHour) {
          continue;
        }
        
        const slotISO = slotTime.toISOString();
        const isBooked = bookedTimes.has(slotISO);
        
        // Check if there's enough time for the service
        let hasEnoughTime = true;
        if (!isBooked) {
          const serviceEndTime = new Date(slotTime);
          serviceEndTime.setMinutes(serviceEndTime.getMinutes() + serviceDuration);
          
          for (const bookedTime of bookedTimes) {
            const booked = new Date(bookedTime);
            if (booked >= slotTime && booked < serviceEndTime) {
              hasEnoughTime = false;
              break;
            }
          }
        }

        slots.push({
          date: date,
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          available: !isBooked && hasEnoughTime && slotTime > new Date()
        });
      }
    }

    return slots;
  }

  // Create a booking after payment
  async createBooking(bookingData: CreateBookingData): Promise<Booking> {
    try {
      // Use advisory lock to prevent race conditions (additional protection)
      const { data: lockAcquired, error: lockError } = await supabase
        .rpc('acquire_booking_slot_lock', {
          p_barber_id: bookingData.barber_id,
          p_date: bookingData.date
        });

      if (lockError) {
        logger.warn('Advisory lock error (non-fatal):', lockError);
        // Continue anyway - the database trigger will still prevent conflicts
      }

      // Insert booking (end_time will be calculated by database trigger)
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...bookingData,
        status: 'confirmed',
        payment_status: 'paid'
      })
      .select()
      .single();

    if (error) {
      // Check if error is due to conflict (database trigger)
        if (error.message?.includes('conflicts') || error.message?.includes('slot')) {
        throw new Error('This time slot is no longer available. Please select another time.')
      }
      throw error;
    }

    return data;
    } catch (err) {
      logger.error('Error creating booking:', err);
      
      // Capture error in Sentry
      const { captureException } = require('./sentry');
      captureException(err as Error, {
        context: 'bookingService.createBooking',
        barberId: bookingData.barber_id,
        serviceId: bookingData.service_id,
        clientId: bookingData.client_id,
        date: bookingData.date,
      });
      
      throw err;
    }
  }

  // Get user's bookings
  async getUserBookings(userId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barber:barbers!inner(
          id,
          business_name,
          user:profiles!barbers_user_id_fkey(
            name,
            avatar_url
          )
        ),
        service:services(
          name,
          duration
        )
      `)
      .eq('client_id', userId)
      .order('date', { ascending: false });

    if (error) {
      logger.error('Error fetching user bookings:', error);
      throw error;
    }

    return data || [];
  }

  // Cancel a booking
  async cancelBooking(bookingId: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  // Calculate fees (fee-only payment model)
  // Customer only pays platform fee, service price paid directly to barber at appointment
  calculateFees(servicePrice: number) {
    const servicePriceCents = Math.round(servicePrice * 100);
    const platformFee = 203; // $2.03 (60% of $3.38 fee)
    const barberFeeShare = 135; // $1.35 (40% of $3.38 fee)
    
    return {
      total: 338, // Just the $3.38 platform fee
      platformFee: platformFee,
      barberPayout: barberFeeShare,
      servicePrice: servicePriceCents
    };
  }
}

export const bookingService = new BookingService();