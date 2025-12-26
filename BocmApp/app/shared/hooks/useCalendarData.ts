/**
 * useCalendarData Hook
 * 
 * Handles data fetching and processing for calendar events.
 * Uses calendarDataService for API calls and calendarUtils for transformations.
 * Follows Single Responsibility Principle - only handles data operations.
 * 
 * @module useCalendarData
 */

import { useCallback } from 'react';
import {
  fetchUserRole,
  fetchBarberId,
  fetchBarberBookings,
  fetchClientBookings,
  fetchServiceById,
  fetchClientProfile,
  fetchBarberProfile,
  fetchBookingAddons,
  fetchBarberServices,
  fetchAvailableTimeSlots,
  createManualAppointment,
  updateBookingStatus as updateBookingStatusService,
  cancelBooking as cancelBookingService,
  type CalendarEvent,
} from '../lib/calendar/calendarDataService';
import { transformBookingToEvent } from '../lib/calendar/calendarUtils';
import { logger } from '../lib/logger';
import type { CalendarState } from './useCalendarState';

/**
 * Hook for calendar data operations
 * 
 * @param state - Calendar state from useCalendarState hook
 * @param userId - Current user ID
 */
export function useCalendarData(state: CalendarState, userId: string | undefined) {
  const {
    setEvents,
    setLoading,
    setRefreshing,
    userRole,
    setUserRole,
    barberViewMode,
    setBarberId,
    setServices,
    setTimeSlots,
    setLoadingTimeSlots,
    manualFormData,
  } = state;

  /**
   * Initialize user role and fetch initial data
   */
  const initialize = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const role = await fetchUserRole(userId);
      if (role) {
        setUserRole(role);
        await loadBookings(role);
      }
    } catch (error) {
      logger.error('Error initializing calendar:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, setLoading, setUserRole]);

  /**
   * Load bookings based on user role
   */
  const loadBookings = useCallback(async (role?: 'client' | 'barber') => {
    if (!userId) return;

    try {
      const roleToUse = role || userRole;
      if (!roleToUse) return;

      logger.log('Loading bookings for user:', userId, 'with role:', roleToUse);

      let bookings: any[] = [];

      if (roleToUse === 'barber') {
        // Fetch barber ID first
        const barberId = await fetchBarberId(userId);
        if (!barberId) {
          logger.log('No barber found for user');
          return;
        }

        setBarberId(barberId);

        // Fetch bookings based on view mode
        bookings = await fetchBarberBookings(barberId, userId, barberViewMode);
      } else {
        // Fetch client bookings
        bookings = await fetchClientBookings(userId);
      }

      // Process bookings into calendar events
      await processBookings(bookings, roleToUse);
    } catch (error) {
      logger.error('Error loading bookings:', error);
    }
  }, [userId, userRole, barberViewMode, setBarberId]);

  /**
   * Process raw bookings into calendar events
   */
  const processBookings = useCallback(async (bookings: any[], role: 'client' | 'barber') => {
    try {
      const events = await Promise.all(
        bookings.map(async (booking) => {
          // Fetch service details
          const service = await fetchServiceById(booking.service_id);

          // Fetch client details if client_id exists
          let client = null;
          if (booking.client_id) {
            client = await fetchClientProfile(booking.client_id);
          }

          // Fetch barber details for client view or barber bookings view
          let barber = null;
          if (role === 'client' || (role === 'barber' && barberViewMode === 'bookings')) {
            barber = await fetchBarberProfile(booking.barber_id);
          }

          // Fetch add-ons for this booking
          const { calculatedAddonTotal, addonNames } = await fetchBookingAddons(booking.id);

          // Transform booking to calendar event
          return transformBookingToEvent(
            booking,
            service,
            client,
            barber,
            calculatedAddonTotal,
            addonNames,
            role,
            barberViewMode
          );
        })
      );

      setEvents(events);
      logger.log('✅ Processed', events.length, 'calendar events');
    } catch (error) {
      logger.error('Error processing bookings:', error);
    }
  }, [barberViewMode, setEvents]);

  /**
   * Refresh calendar data
   */
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadBookings();
    } catch (error) {
      logger.error('Error refreshing calendar:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBookings, setRefreshing]);

  /**
   * Load services for barber (for manual appointment form)
   */
  const loadServices = useCallback(async (barberId: string) => {
    try {
      const services = await fetchBarberServices(barberId);
      setServices(services);
    } catch (error) {
      logger.error('Error loading services:', error);
      setServices([]);
    }
  }, [setServices]);

  /**
   * Load available time slots
   */
  const loadTimeSlots = useCallback(async (
    barberId: string,
    date: Date,
    serviceDuration: number
  ) => {
    try {
      setLoadingTimeSlots(true);
      const slots = await fetchAvailableTimeSlots(barberId, date, serviceDuration);
      setTimeSlots(slots);
    } catch (error) {
      logger.error('Error loading time slots:', error);
      setTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  }, [setTimeSlots, setLoadingTimeSlots]);

  /**
   * Create manual appointment
   */
  const createAppointment = useCallback(async (
    barberId: string,
    appointmentData: {
      clientName: string;
      serviceId: string;
      date: Date;
      time: string;
      price: number;
    }
  ) => {
    try {
      const booking = await createManualAppointment({
        barberId,
        ...appointmentData,
      });

      if (booking) {
        logger.log('✅ Manual appointment created successfully');
        // Refresh bookings to show new appointment
        await loadBookings();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error creating manual appointment:', error);
      return false;
    }
  }, [loadBookings]);

  /**
   * Mark booking as completed
   */
  const markCompleted = useCallback(async (bookingId: string) => {
    try {
      const success = await updateBookingStatusService(bookingId, 'completed');
      if (success) {
        logger.log('✅ Booking marked as completed');
        await loadBookings();
      }
      return success;
    } catch (error) {
      logger.error('Error marking booking as completed:', error);
      return false;
    }
  }, [loadBookings]);

  /**
   * Mark booking as missed
   */
  const markMissed = useCallback(async (bookingId: string) => {
    try {
      const success = await updateBookingStatusService(bookingId, 'missed');
      if (success) {
        logger.log('✅ Booking marked as missed');
        await loadBookings();
      }
      return success;
    } catch (error) {
      logger.error('Error marking booking as missed:', error);
      return false;
    }
  }, [loadBookings]);

  /**
   * Cancel booking
   */
  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      const success = await cancelBookingService(bookingId);
      if (success) {
        logger.log('✅ Booking cancelled successfully');
        await loadBookings();
      }
      return success;
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      return false;
    }
  }, [loadBookings]);

  return {
    // Initialization
    initialize,
    
    // Data loading
    loadBookings,
    refresh,
    loadServices,
    loadTimeSlots,
    
    // Mutations
    createAppointment,
    markCompleted,
    markMissed,
    cancelBooking,
  };
}

/**
 * Type definition for the hook's return value
 */
export type CalendarDataOperations = ReturnType<typeof useCalendarData>;

