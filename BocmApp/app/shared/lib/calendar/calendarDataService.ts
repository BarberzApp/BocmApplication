/**
 * Calendar Data Service
 * 
 * Handles all data fetching and mutations for the calendar feature.
 * Follows Single Responsibility Principle - only handles data layer.
 * 
 * @module calendarDataService
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import { format } from 'date-fns';

/**
 * Calendar event interface
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    status: string;
    serviceName: string;
    clientName: string;
    barberName: string;
    barberId: string;
    price: number;
    basePrice: number;
    addonTotal: number;
    addonNames: string[];
    isGuest: boolean;
    guestEmail: string;
    guestPhone: string;
  };
}

/**
 * Service interface
 */
export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

/**
 * Time slot interface
 */
export interface TimeSlot {
  time: string;
  available: boolean;
}

/**
 * Fetch user role from profiles table
 * 
 * @param userId - The user ID to fetch role for
 * @returns User role ('client' or 'barber') or null if error
 */
export async function fetchUserRole(userId: string): Promise<'client' | 'barber' | null> {
  try {
    logger.log('🔍 [CALENDAR] Fetching user role for user ID:', userId);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error) {
      logger.error('Error fetching user role:', error);
      return null;
    }
    
    logger.log('✅ [CALENDAR] User role detected:', profile.role);
    return profile.role as 'client' | 'barber';
  } catch (error) {
    logger.error('Error fetching user role:', error);
    return null;
  }
}

/**
 * Fetch barber ID for a given user ID
 * 
 * @param userId - The user ID
 * @returns Barber ID or null if not found
 */
export async function fetchBarberId(userId: string): Promise<string | null> {
  try {
    logger.log('🔍 [CALENDAR] Fetching barber data for user ID:', userId);
    
    const { data: barberData, error: barberError } = await supabase
      .from('barbers')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    logger.log('📊 [CALENDAR] Barber data result:', { barberData, barberError });
    
    if (barberError || !barberData) {
      logger.log('❌ [CALENDAR] No barber found for user');
      return null;
    }

    logger.log('✅ [CALENDAR] Barber ID found:', barberData.id);
    return barberData.id;
  } catch (error) {
    logger.error('Error fetching barber ID:', error);
    return null;
  }
}

/**
 * Fetch bookings for a barber (appointments or bookings mode)
 * 
 * @param barberId - The barber ID
 * @param userId - The user ID
 * @param mode - 'appointments' (clients coming to barber) or 'bookings' (barber going somewhere)
 * @returns Array of bookings
 */
export async function fetchBarberBookings(
  barberId: string,
  userId: string,
  mode: 'appointments' | 'bookings'
): Promise<any[]> {
  try {
    if (mode === 'appointments') {
      // Fetch appointments where barber is providing service (clients coming to barber)
      logger.log('📅 [CALENDAR] Fetching barber appointments (clients coming in)');
      
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('barber_id', barberId)
        .order('date', { ascending: true });

      if (appointmentsError) {
        logger.error('❌ [CALENDAR] Error fetching barber appointments:', appointmentsError);
        return [];
      }
      
      logger.log('✅ [CALENDAR] Found', appointmentsData?.length || 0, 'appointments for barber');
      return appointmentsData || [];
    } else {
      // Fetch bookings where barber is the client (barber going somewhere)
      logger.log('📅 [CALENDAR] Fetching barber bookings (barber going somewhere)');
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_id', userId)
        .in('payment_status', ['succeeded', 'paid']) // Show both succeeded and paid bookings
        .order('date', { ascending: true });

      if (bookingsError) {
        logger.error('❌ [CALENDAR] Error fetching barber bookings:', bookingsError);
        return [];
      }
      
      logger.log('✅ [CALENDAR] Found', bookingsData?.length || 0, 'bookings for barber as client');
      return bookingsData || [];
    }
  } catch (error) {
    logger.error('Error fetching barber bookings:', error);
    return [];
  }
}

/**
 * Fetch bookings for a client
 * 
 * @param userId - The client user ID
 * @returns Array of bookings
 */
export async function fetchClientBookings(userId: string): Promise<any[]> {
  try {
    logger.log('🔍 [CALENDAR] Fetching client bookings for user ID:', userId);
    
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('client_id', userId)
      .in('payment_status', ['succeeded', 'paid']) // Show both succeeded and paid bookings
      .order('date', { ascending: true });

    logger.log('📊 [CALENDAR] Client bookings query result:', { bookings, error });

    if (error || !bookings) {
      logger.error('❌ [CALENDAR] Error fetching client bookings:', error);
      return [];
    }

    logger.log('✅ [CALENDAR] Found', bookings.length, 'bookings for client');
    return bookings;
  } catch (error) {
    logger.error('Error fetching client bookings:', error);
    return [];
  }
}

/**
 * Fetch service details by ID
 * 
 * @param serviceId - The service ID
 * @returns Service details or null if not found
 */
export async function fetchServiceById(serviceId: string): Promise<any | null> {
  try {
    const { data: service, error } = await supabase
      .from('services')
      .select('name, duration, price')
      .eq('id', serviceId)
      .single();

    if (error) {
      logger.error('Error fetching service:', error);
      return null;
    }

    return service;
  } catch (error) {
    logger.error('Error fetching service:', error);
    return null;
  }
}

/**
 * Fetch client profile by ID
 * 
 * @param clientId - The client ID
 * @returns Client profile or null if not found
 */
export async function fetchClientProfile(clientId: string): Promise<any | null> {
  try {
    const { data: clientData, error } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', clientId)
      .single();

    if (error) {
      logger.error('Error fetching client profile:', error);
      return null;
    }

    return clientData;
  } catch (error) {
    logger.error('Error fetching client profile:', error);
    return null;
  }
}

/**
 * Fetch barber profile by barber ID
 * 
 * @param barberId - The barber ID
 * @returns Barber profile or null if not found
 */
export async function fetchBarberProfile(barberId: string): Promise<any | null> {
  try {
    const { data: barberData, error: barberError } = await supabase
      .from('barbers')
      .select('user_id')
      .eq('id', barberId)
      .single();
    
    if (barberError || !barberData) {
      logger.error('Error fetching barber:', barberError);
      return null;
    }
    
    const { data: barberProfile, error: profileError } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', barberData.user_id)
      .single();

    if (profileError) {
      logger.error('Error fetching barber profile:', profileError);
      return null;
    }

    return barberProfile;
  } catch (error) {
    logger.error('Error fetching barber profile:', error);
    return null;
  }
}

/**
 * Fetch add-ons for a booking
 * 
 * @param bookingId - The booking ID
 * @returns Object with addon total and names
 */
export async function fetchBookingAddons(bookingId: string): Promise<{
  calculatedAddonTotal: number;
  addonNames: string[];
}> {
  try {
    const { data: bookingAddons } = await supabase
      .from('booking_addons')
      .select('addon_id, price')
      .eq('booking_id', bookingId);

    if (!bookingAddons || bookingAddons.length === 0) {
      return { calculatedAddonTotal: 0, addonNames: [] };
    }

    // Use the stored addon prices from booking_addons table
    const calculatedAddonTotal = bookingAddons.reduce((sum, ba) => sum + (ba.price || 0), 0);
    
    // Get addon names from service_addons table
    const addonIds = bookingAddons.map((ba) => ba.addon_id);
    const { data: addons } = await supabase
      .from('service_addons')
      .select('id, name')
      .in('id', addonIds);

    const addonNames = addons ? addons.map(a => a.name) : [];

    return { calculatedAddonTotal, addonNames };
  } catch (error) {
    logger.error('Error fetching booking addons:', error);
    return { calculatedAddonTotal: 0, addonNames: [] };
  }
}

/**
 * Fetch services for a barber
 * 
 * @param barberId - The barber ID
 * @returns Array of services
 */
export async function fetchBarberServices(barberId: string): Promise<Service[]> {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('barber_id', barberId)
      .eq('is_active', true);

    if (error) {
      logger.error('Error fetching services:', error);
      return [];
    }

    return services || [];
  } catch (error) {
    logger.error('Error fetching services:', error);
    return [];
  }
}

/**
 * Fetch available time slots for a given date and service
 * 
 * @param barberId - The barber ID
 * @param date - The date to check
 * @param serviceDuration - The service duration in minutes
 * @returns Array of time slots with availability
 */
export async function fetchAvailableTimeSlots(
  barberId: string,
  date: Date,
  serviceDuration: number
): Promise<TimeSlot[]> {
  try {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('date')
      .eq('barber_id', barberId)
      .gte('date', `${dateStr}T00:00:00`)
      .lte('date', `${dateStr}T23:59:59`)
      .neq('status', 'cancelled');

    if (error) {
      logger.error('Error fetching bookings for time slots:', error);
      return [];
    }

    // Generate time slots
    const slots: TimeSlot[] = [];
    const bookedTimes = new Set((bookings || []).map(b => new Date(b.date).toISOString()));

    // Calculate slot interval based on service duration (minimum 10 minutes)
    const slotInterval = Math.max(serviceDuration, 10);
    
    // Business hours: 9 AM to 6 PM
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);
        
        // Skip if service would go past 6 PM
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
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          available: !isBooked && hasEnoughTime && slotTime > new Date()
        });
      }
    }

    return slots;
  } catch (error) {
    logger.error('Error fetching time slots:', error);
    return [];
  }
}

/**
 * Create a manual appointment
 * 
 * @param appointmentData - The appointment data
 * @returns Created booking or null if error
 */
export async function createManualAppointment(appointmentData: {
  barberId: string;
  clientName: string;
  serviceId: string;
  date: Date;
  time: string;
  price: number;
}): Promise<any | null> {
  try {
    const [hours, minutes] = appointmentData.time.split(':');
    const appointmentDate = new Date(appointmentData.date);
    appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([
        {
          barber_id: appointmentData.barberId,
          guest_name: appointmentData.clientName,
          service_id: appointmentData.serviceId,
          date: appointmentDate.toISOString(),
          status: 'confirmed',
          payment_status: 'manual',
          price: appointmentData.price,
          is_guest: true,
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error('Error creating manual appointment:', error);
      return null;
    }

    return booking;
  } catch (error) {
    logger.error('Error creating manual appointment:', error);
    return null;
  }
}

/**
 * Update booking status
 * 
 * @param bookingId - The booking ID
 * @param status - The new status
 * @returns True if successful, false otherwise
 */
export async function updateBookingStatus(bookingId: string, status: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error updating booking status:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error updating booking status:', error);
    return false;
  }
}

/**
 * Cancel a booking
 * 
 * @param bookingId - The booking ID
 * @returns True if successful, false otherwise
 */
export async function cancelBooking(bookingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error cancelling booking:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    return false;
  }
}

