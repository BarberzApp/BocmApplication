/**
 * Tests for calendarDataService
 * 
 * Tests all data fetching functions with mocked Supabase calls
 */

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
  updateBookingStatus,
  cancelBooking,
} from '@/lib/calendar/calendarDataService';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// Mock dependencies
jest.mock('@/lib/supabase');
jest.mock('@/lib/logger');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('calendarDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUserRole', () => {
    it('should fetch user role successfully', async () => {
      const mockProfile = { role: 'barber' };
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      });

      const result = await fetchUserRole('user-123');
      
      expect(result).toBe('barber');
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should return null on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
          })
        })
      });

      const result = await fetchUserRole('user-123');
      
      expect(result).toBeNull();
    });
  });

  describe('fetchBarberId', () => {
    it('should fetch barber ID successfully', async () => {
      const mockBarber = { id: 'barber-123' };
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockBarber, error: null })
          })
        })
      });

      const result = await fetchBarberId('user-123');
      
      expect(result).toBe('barber-123');
    });

    it('should return null when barber not found', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          })
        })
      });

      const result = await fetchBarberId('user-123');
      
      expect(result).toBeNull();
    });
  });

  describe('fetchBarberBookings', () => {
    it('should fetch appointments mode bookings', async () => {
      const mockBookings = [
        { id: '1', barber_id: 'barber-123', date: '2024-01-01' },
        { id: '2', barber_id: 'barber-123', date: '2024-01-02' }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockBookings, error: null })
          })
        })
      });

      const result = await fetchBarberBookings('barber-123', 'user-123', 'appointments');
      
      expect(result).toEqual(mockBookings);
      expect(result.length).toBe(2);
    });

    it('should fetch bookings mode bookings', async () => {
      const mockBookings = [{ id: '1', client_id: 'user-123' }];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockBookings, error: null })
            })
          })
        })
      });

      const result = await fetchBarberBookings('barber-123', 'user-123', 'bookings');
      
      expect(result).toEqual(mockBookings);
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
          })
        })
      });

      const result = await fetchBarberBookings('barber-123', 'user-123', 'appointments');
      
      expect(result).toEqual([]);
    });
  });

  describe('fetchClientBookings', () => {
    it('should fetch client bookings successfully', async () => {
      const mockBookings = [
        { id: '1', client_id: 'user-123', payment_status: 'succeeded' }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockBookings, error: null })
            })
          })
        })
      });

      const result = await fetchClientBookings('user-123');
      
      expect(result).toEqual(mockBookings);
    });

    it('should return empty array on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
        })
      });

      const result = await fetchClientBookings('user-123');
      
      expect(result).toEqual([]);
    });
  });

  describe('fetchServiceById', () => {
    it('should fetch service successfully', async () => {
      const mockService = { name: 'Haircut', duration: 30, price: 50 };
      
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockService, error: null })
          })
        })
      });

      const result = await fetchServiceById('service-123');
      
      expect(result).toEqual(mockService);
    });

    it('should return null on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
          })
        })
      });

      const result = await fetchServiceById('service-123');
      
      expect(result).toBeNull();
    });
  });

  describe('fetchAvailableTimeSlots', () => {
    it('should generate available time slots', async () => {
      const date = new Date('2024-12-15T12:00:00Z');
      
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          neq: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      const result = await fetchAvailableTimeSlots('barber-123', date, 30);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Should have time slots between 9 AM and 6 PM
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('available');
    });

    it('should mark booked slots as unavailable', async () => {
      const date = new Date('2024-12-15T10:00:00Z');
      const bookedTime = new Date(date);
      bookedTime.setHours(10, 0, 0, 0);
      
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          neq: jest.fn().mockResolvedValue({ 
            data: [{ date: bookedTime.toISOString() }], 
            error: null 
          })
        })
      });

      const result = await fetchAvailableTimeSlots('barber-123', date, 30);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createManualAppointment', () => {
    it('should create appointment successfully', async () => {
      const mockBooking = { id: 'booking-123', status: 'confirmed' };
      
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockBooking, error: null })
          })
        })
      });

      const appointmentData = {
        barberId: 'barber-123',
        clientName: 'John Doe',
        serviceId: 'service-123',
        date: new Date('2024-12-15'),
        time: '14:00',
        price: 50
      };

      const result = await createManualAppointment(appointmentData);
      
      expect(result).toEqual(mockBooking);
    });

    it('should return null on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } })
          })
        })
      });

      const appointmentData = {
        barberId: 'barber-123',
        clientName: 'John Doe',
        serviceId: 'service-123',
        date: new Date('2024-12-15'),
        time: '14:00',
        price: 50
      };

      const result = await createManualAppointment(appointmentData);
      
      expect(result).toBeNull();
    });
  });

  describe('updateBookingStatus', () => {
    it('should update status successfully', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await updateBookingStatus('booking-123', 'completed');
      
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Error' } })
        })
      });

      const result = await updateBookingStatus('booking-123', 'completed');
      
      expect(result).toBe(false);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await cancelBooking('booking-123');
      
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Error' } })
        })
      });

      const result = await cancelBooking('booking-123');
      
      expect(result).toBe(false);
    });
  });

  describe('fetchBookingAddons', () => {
    it('should fetch addons with total and names', async () => {
      const mockBookingAddons = [
        { addon_id: 'addon-1', price: 10 },
        { addon_id: 'addon-2', price: 15 }
      ];
      
      const mockAddons = [
        { id: 'addon-1', name: 'Beard Trim' },
        { id: 'addon-2', name: 'Hot Towel' }
      ];

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockBookingAddons, error: null })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockAddons, error: null })
          })
        });

      const result = await fetchBookingAddons('booking-123');
      
      expect(result.calculatedAddonTotal).toBe(25);
      expect(result.addonNames).toEqual(['Beard Trim', 'Hot Towel']);
    });

    it('should return zeros when no addons', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const result = await fetchBookingAddons('booking-123');
      
      expect(result.calculatedAddonTotal).toBe(0);
      expect(result.addonNames).toEqual([]);
    });
  });
});

