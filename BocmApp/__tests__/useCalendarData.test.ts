/**
 * Tests for useCalendarData hook
 * 
 * Tests data fetching and operations
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useCalendarData } from '../app/shared/hooks/useCalendarData';
import { useCalendarState } from '../app/shared/hooks/useCalendarState';
import * as calendarDataService from '../app/shared/lib/calendar/calendarDataService';
import { logger } from '../app/shared/lib/logger';

// Mock dependencies
jest.mock('../app/shared/lib/calendar/calendarDataService');
jest.mock('../app/shared/lib/logger');

const mockCalendarDataService = calendarDataService as jest.Mocked<typeof calendarDataService>;

describe('useCalendarData', () => {
  let mockState: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock state
    mockState = {
      setEvents: jest.fn(),
      setLoading: jest.fn(),
      setRefreshing: jest.fn(),
      userRole: 'barber',
      setUserRole: jest.fn(),
      barberViewMode: 'appointments',
      setBarberId: jest.fn(),
      setServices: jest.fn(),
      setTimeSlots: jest.fn(),
      setLoadingTimeSlots: jest.fn(),
      manualFormData: {
        clientName: '',
        serviceId: '',
        price: '',
        time: '',
        date: new Date(),
      },
    };
  });

  describe('initialize', () => {
    it('should initialize with user role and fetch bookings', async () => {
      mockCalendarDataService.fetchUserRole.mockResolvedValue('barber');
      mockCalendarDataService.fetchBarberId.mockResolvedValue('barber-123');
      mockCalendarDataService.fetchBarberBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockCalendarDataService.fetchUserRole).toHaveBeenCalledWith('user-123');
      expect(mockState.setUserRole).toHaveBeenCalledWith('barber');
      expect(mockState.setLoading).toHaveBeenCalledWith(true);
      expect(mockState.setLoading).toHaveBeenCalledWith(false);
    });

    it('should not initialize without user ID', async () => {
      const { result } = renderHook(() => useCalendarData(mockState, undefined));

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockCalendarDataService.fetchUserRole).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockCalendarDataService.fetchUserRole.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockState.setLoading).toHaveBeenCalledWith(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadBookings', () => {
    it('should load barber appointments', async () => {
      mockState.userRole = 'barber';
      mockCalendarDataService.fetchBarberId.mockResolvedValue('barber-123');
      mockCalendarDataService.fetchBarberBookings.mockResolvedValue([
        {
          id: 'booking-1',
          barber_id: 'barber-123',
          service_id: 'service-1',
          date: '2024-12-15T10:00:00Z',
        },
      ]);
      mockCalendarDataService.fetchServiceById.mockResolvedValue({
        name: 'Haircut',
        duration: 30,
        price: 50,
      });
      mockCalendarDataService.fetchClientProfile.mockResolvedValue(null);
      mockCalendarDataService.fetchBookingAddons.mockResolvedValue({
        calculatedAddonTotal: 0,
        addonNames: [],
      });

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadBookings('barber');
      });

      expect(mockCalendarDataService.fetchBarberId).toHaveBeenCalledWith('user-123');
      expect(mockCalendarDataService.fetchBarberBookings).toHaveBeenCalledWith(
        'barber-123',
        'user-123',
        'appointments'
      );
      expect(mockState.setEvents).toHaveBeenCalled();
    });

    it('should load client bookings', async () => {
      mockState.userRole = 'client';
      mockCalendarDataService.fetchClientBookings.mockResolvedValue([
        {
          id: 'booking-1',
          client_id: 'user-123',
          service_id: 'service-1',
          barber_id: 'barber-1',
          date: '2024-12-15T10:00:00Z',
        },
      ]);
      mockCalendarDataService.fetchServiceById.mockResolvedValue({
        name: 'Haircut',
        duration: 30,
        price: 50,
      });
      mockCalendarDataService.fetchBarberProfile.mockResolvedValue({
        name: 'Barber Name',
      });
      mockCalendarDataService.fetchBookingAddons.mockResolvedValue({
        calculatedAddonTotal: 0,
        addonNames: [],
      });

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadBookings('client');
      });

      expect(mockCalendarDataService.fetchClientBookings).toHaveBeenCalledWith('user-123');
      expect(mockState.setEvents).toHaveBeenCalled();
    });

    it('should not load bookings without user ID', async () => {
      const { result } = renderHook(() => useCalendarData(mockState, undefined));

      await act(async () => {
        await result.current.loadBookings('barber');
      });

      expect(mockCalendarDataService.fetchBarberId).not.toHaveBeenCalled();
    });

    it('should handle errors when barber not found', async () => {
      mockState.userRole = 'barber';
      mockCalendarDataService.fetchBarberId.mockResolvedValue(null);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadBookings('barber');
      });

      expect(mockCalendarDataService.fetchBarberBookings).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should refresh bookings', async () => {
      mockState.userRole = 'client';
      mockCalendarDataService.fetchClientBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockState.setRefreshing).toHaveBeenCalledWith(true);
      expect(mockState.setRefreshing).toHaveBeenCalledWith(false);
    });

    it('should handle refresh errors', async () => {
      mockCalendarDataService.fetchClientBookings.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockState.setRefreshing).toHaveBeenCalledWith(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadServices', () => {
    it('should load barber services', async () => {
      const mockServices = [
        { id: '1', name: 'Haircut', price: 50, duration: 30 },
        { id: '2', name: 'Shave', price: 30, duration: 20 },
      ];
      mockCalendarDataService.fetchBarberServices.mockResolvedValue(mockServices);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadServices('barber-123');
      });

      expect(mockCalendarDataService.fetchBarberServices).toHaveBeenCalledWith('barber-123');
      expect(mockState.setServices).toHaveBeenCalledWith(mockServices);
    });

    it('should handle service loading errors', async () => {
      mockCalendarDataService.fetchBarberServices.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadServices('barber-123');
      });

      expect(mockState.setServices).toHaveBeenCalledWith([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadTimeSlots', () => {
    it('should load available time slots', async () => {
      const mockSlots = [
        { time: '09:00', available: true },
        { time: '10:00', available: false },
      ];
      mockCalendarDataService.fetchAvailableTimeSlots.mockResolvedValue(mockSlots);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));
      const testDate = new Date('2024-12-15');

      await act(async () => {
        await result.current.loadTimeSlots('barber-123', testDate, 30);
      });

      expect(mockCalendarDataService.fetchAvailableTimeSlots).toHaveBeenCalledWith(
        'barber-123',
        testDate,
        30
      );
      expect(mockState.setLoadingTimeSlots).toHaveBeenCalledWith(true);
      expect(mockState.setTimeSlots).toHaveBeenCalledWith(mockSlots);
      expect(mockState.setLoadingTimeSlots).toHaveBeenCalledWith(false);
    });

    it('should handle time slot loading errors', async () => {
      mockCalendarDataService.fetchAvailableTimeSlots.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      await act(async () => {
        await result.current.loadTimeSlots('barber-123', new Date(), 30);
      });

      expect(mockState.setTimeSlots).toHaveBeenCalledWith([]);
      expect(mockState.setLoadingTimeSlots).toHaveBeenCalledWith(false);
    });
  });

  describe('createAppointment', () => {
    it('should create manual appointment successfully', async () => {
      mockCalendarDataService.createManualAppointment.mockResolvedValue({
        id: 'booking-123',
        status: 'confirmed',
      });
      mockState.userRole = 'barber';
      mockCalendarDataService.fetchBarberId.mockResolvedValue('barber-123');
      mockCalendarDataService.fetchBarberBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      const appointmentData = {
        clientName: 'John Doe',
        serviceId: 'service-1',
        date: new Date('2024-12-15'),
        time: '14:00',
        price: 50,
      };

      let success;
      await act(async () => {
        success = await result.current.createAppointment('barber-123', appointmentData);
      });

      expect(mockCalendarDataService.createManualAppointment).toHaveBeenCalledWith({
        barberId: 'barber-123',
        ...appointmentData,
      });
      expect(success).toBe(true);
    });

    it('should return false when appointment creation fails', async () => {
      mockCalendarDataService.createManualAppointment.mockResolvedValue(null);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.createAppointment('barber-123', {
          clientName: 'John Doe',
          serviceId: 'service-1',
          date: new Date(),
          time: '14:00',
          price: 50,
        });
      });

      expect(success).toBe(false);
    });
  });

  describe('markCompleted', () => {
    it('should mark booking as completed', async () => {
      mockCalendarDataService.updateBookingStatus.mockResolvedValue(true);
      mockState.userRole = 'barber';
      mockCalendarDataService.fetchBarberId.mockResolvedValue('barber-123');
      mockCalendarDataService.fetchBarberBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.markCompleted('booking-123');
      });

      expect(mockCalendarDataService.updateBookingStatus).toHaveBeenCalledWith(
        'booking-123',
        'completed'
      );
      expect(success).toBe(true);
    });

    it('should return false when marking completed fails', async () => {
      mockCalendarDataService.updateBookingStatus.mockResolvedValue(false);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.markCompleted('booking-123');
      });

      expect(success).toBe(false);
    });
  });

  describe('markMissed', () => {
    it('should mark booking as missed', async () => {
      mockCalendarDataService.updateBookingStatus.mockResolvedValue(true);
      mockState.userRole = 'barber';
      mockCalendarDataService.fetchBarberId.mockResolvedValue('barber-123');
      mockCalendarDataService.fetchBarberBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.markMissed('booking-123');
      });

      expect(mockCalendarDataService.updateBookingStatus).toHaveBeenCalledWith(
        'booking-123',
        'missed'
      );
      expect(success).toBe(true);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      mockCalendarDataService.cancelBooking.mockResolvedValue(true);
      mockState.userRole = 'client';
      mockCalendarDataService.fetchClientBookings.mockResolvedValue([]);

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.cancelBooking('booking-123');
      });

      expect(mockCalendarDataService.cancelBooking).toHaveBeenCalledWith('booking-123');
      expect(success).toBe(true);
    });

    it('should handle cancellation errors', async () => {
      mockCalendarDataService.cancelBooking.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCalendarData(mockState, 'user-123'));

      let success;
      await act(async () => {
        success = await result.current.cancelBooking('booking-123');
      });

      expect(success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

