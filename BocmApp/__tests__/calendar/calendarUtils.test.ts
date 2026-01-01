/**
 * Tests for calendarUtils
 * 
 * Tests all pure utility functions
 */

import {
  getStatusColors,
  transformBookingToEvent,
  filterEventsByStatus,
  getEventsForDate,
  formatTimeSlot,
  calculateTotalRevenue,
  getUpcomingEvents,
  getPastEvents,
  groupEventsByDate,
  hasEventsOnDate,
  getEventCountsByStatus,
  calculateCompletionRate,
  validateManualAppointment,
  formatCurrency,
  canCancelBooking,
  canMarkCompleted,
  canMarkMissed,
} from '@/lib/calendar/calendarUtils';
import type { CalendarEvent } from '@/lib/calendar/calendarDataService';

describe('calendarUtils', () => {
  describe('getStatusColors', () => {
    it('should return correct colors for confirmed status', () => {
      const colors = getStatusColors('confirmed');
      expect(colors.textColor).toBe('#FFFFFF');
      expect(colors).toHaveProperty('backgroundColor');
      expect(colors).toHaveProperty('borderColor');
    });

    it('should return correct colors for completed status', () => {
      const colors = getStatusColors('completed');
      expect(colors.textColor).toBe('#FFFFFF');
    });

    it('should return correct colors for cancelled status', () => {
      const colors = getStatusColors('cancelled');
      expect(colors.textColor).toBe('#FFFFFF');
    });

    it('should return default colors for unknown status', () => {
      const colors = getStatusColors('unknown');
      expect(colors.textColor).toBe('#FFFFFF');
    });
  });

  describe('transformBookingToEvent', () => {
    const mockBooking = {
      id: 'booking-123',
      date: '2024-12-15T10:00:00Z',
      status: 'confirmed',
      barber_id: 'barber-123',
      addon_total: 15,
      platform_fee: 5,
      guest_name: 'John Doe',
      is_guest: true
    };

    const mockService = {
      name: 'Haircut',
      duration: 30,
      price: 50
    };

    it('should transform booking for client view', () => {
      const mockBarber = { name: 'Barber Name' };
      
      const event = transformBookingToEvent(
        mockBooking,
        mockService,
        null,
        mockBarber,
        15,
        ['Beard Trim'],
        'client'
      );

      expect(event.id).toBe('booking-123');
      expect(event.title).toContain('Haircut');
      expect(event.title).toContain('Barber Name');
      expect(event.extendedProps.serviceName).toBe('Haircut');
      expect(event.extendedProps.addonNames).toEqual(['Beard Trim']);
    });

    it('should transform booking for barber appointments view', () => {
      const mockClient = { name: 'Client Name' };
      
      const event = transformBookingToEvent(
        mockBooking,
        mockService,
        mockClient,
        null,
        15,
        [],
        'barber',
        'appointments'
      );

      expect(event.title).toContain('Haircut');
      expect(event.title).toContain('Client Name');
      expect(event.extendedProps.clientName).toBe('Client Name');
    });

    it('should use guest name when client is null', () => {
      const event = transformBookingToEvent(
        mockBooking,
        mockService,
        null,
        null,
        0,
        [],
        'barber',
        'appointments'
      );

      expect(event.extendedProps.clientName).toBe('John Doe');
    });
  });

  describe('filterEventsByStatus', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Event 1',
        start: '2024-12-15T10:00:00Z',
        end: '2024-12-15T11:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
          serviceName: 'Service 1',
          clientName: 'Client 1',
          barberName: 'Barber 1',
          barberId: 'barber-1',
          price: 50,
          basePrice: 50,
          addonTotal: 0,
          addonNames: [],
          isGuest: false,
          guestEmail: '',
          guestPhone: ''
        }
      },
      {
        id: '2',
        title: 'Event 2',
        start: '2024-12-15T12:00:00Z',
        end: '2024-12-15T13:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'completed',
          serviceName: 'Service 2',
          clientName: 'Client 2',
          barberName: 'Barber 2',
          barberId: 'barber-2',
          price: 60,
          basePrice: 60,
          addonTotal: 0,
          addonNames: [],
          isGuest: false,
          guestEmail: '',
          guestPhone: ''
        }
      }
    ];

    it('should return all events when status is "all"', () => {
      const result = filterEventsByStatus(mockEvents, 'all');
      expect(result.length).toBe(2);
    });

    it('should filter events by status', () => {
      const result = filterEventsByStatus(mockEvents, 'confirmed');
      expect(result.length).toBe(1);
      expect(result[0].extendedProps.status).toBe('confirmed');
    });

    it('should return empty array when no events match', () => {
      const result = filterEventsByStatus(mockEvents, 'cancelled');
      expect(result.length).toBe(0);
    });
  });

  describe('getEventsForDate', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Event 1',
        start: '2024-12-15T10:00:00Z',
        end: '2024-12-15T11:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {} as any
      },
      {
        id: '2',
        title: 'Event 2',
        start: '2024-12-16T10:00:00Z',
        end: '2024-12-16T11:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {} as any
      }
    ];

    it('should get events for specific date', () => {
      const date = new Date('2024-12-15');
      const result = getEventsForDate(mockEvents, date);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no events on date', () => {
      const date = new Date('2024-12-17');
      const result = getEventsForDate(mockEvents, date);
      expect(result.length).toBe(0);
    });
  });

  describe('formatTimeSlot', () => {
    it('should format morning time correctly', () => {
      expect(formatTimeSlot('09:00')).toBe('9:00 AM');
      expect(formatTimeSlot('10:30')).toBe('10:30 AM');
    });

    it('should format afternoon time correctly', () => {
      expect(formatTimeSlot('14:00')).toBe('2:00 PM');
      expect(formatTimeSlot('17:30')).toBe('5:30 PM');
    });

    it('should format noon correctly', () => {
      expect(formatTimeSlot('12:00')).toBe('12:00 PM');
    });

    it('should format midnight correctly', () => {
      expect(formatTimeSlot('00:00')).toBe('12:00 AM');
    });
  });

  describe('calculateTotalRevenue', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Event 1',
        start: '2024-12-15T10:00:00Z',
        end: '2024-12-15T11:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
          price: 50,
        } as any
      },
      {
        id: '2',
        title: 'Event 2',
        start: '2024-12-15T12:00:00Z',
        end: '2024-12-15T13:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'completed',
          price: 60,
        } as any
      },
      {
        id: '3',
        title: 'Event 3',
        start: '2024-12-15T14:00:00Z',
        end: '2024-12-15T15:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'cancelled',
          price: 70,
        } as any
      }
    ];

    it('should calculate total revenue excluding cancelled', () => {
      const total = calculateTotalRevenue(mockEvents);
      expect(total).toBe(110); // 50 + 60, excluding cancelled
    });

    it('should return 0 for empty array', () => {
      const total = calculateTotalRevenue([]);
      expect(total).toBe(0);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should return only future events sorted by date', () => {
      const futureDate1 = new Date(Date.now() + 86400000); // Tomorrow
      const futureDate2 = new Date(Date.now() + 172800000); // Day after tomorrow
      
      const mockEvents: CalendarEvent[] = [
        {
          id: '2',
          title: 'Future 2',
          start: futureDate2.toISOString(),
          end: futureDate2.toISOString(),
          backgroundColor: '#000',
          borderColor: '#000',
          textColor: '#FFF',
          extendedProps: {} as any
        },
        {
          id: '1',
          title: 'Future 1',
          start: futureDate1.toISOString(),
          end: futureDate1.toISOString(),
          backgroundColor: '#000',
          borderColor: '#000',
          textColor: '#FFF',
          extendedProps: {} as any
        }
      ];

      const result = getUpcomingEvents(mockEvents);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('1'); // Earlier date first
      expect(result[1].id).toBe('2');
    });
  });

  describe('validateManualAppointment', () => {
    it('should validate correct data', () => {
      const data = {
        clientName: 'John Doe',
        serviceId: 'service-123',
        time: '14:00',
        price: '50'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty client name', () => {
      const data = {
        clientName: '   ',
        serviceId: 'service-123',
        time: '14:00',
        price: '50'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Client name');
    });

    it('should reject missing service', () => {
      const data = {
        clientName: 'John Doe',
        serviceId: '',
        time: '14:00',
        price: '50'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('service');
    });

    it('should reject missing time', () => {
      const data = {
        clientName: 'John Doe',
        serviceId: 'service-123',
        time: '',
        price: '50'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('time');
    });

    it('should reject invalid price', () => {
      const data = {
        clientName: 'John Doe',
        serviceId: 'service-123',
        time: '14:00',
        price: 'invalid'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('price');
    });

    it('should reject negative price', () => {
      const data = {
        clientName: 'John Doe',
        serviceId: 'service-123',
        time: '14:00',
        price: '-10'
      };

      const result = validateManualAppointment(data);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('price');
    });
  });

  describe('formatCurrency', () => {
    it('should format whole numbers', () => {
      expect(formatCurrency(50)).toBe('$50.00');
    });

    it('should format decimals', () => {
      expect(formatCurrency(45.99)).toBe('$45.99');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('canCancelBooking', () => {
    it('should allow cancelling future confirmed booking', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: futureDate.toISOString(),
        end: futureDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
        } as any
      };

      expect(canCancelBooking(booking)).toBe(true);
    });

    it('should not allow cancelling past booking', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: pastDate.toISOString(),
        end: pastDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
        } as any
      };

      expect(canCancelBooking(booking)).toBe(false);
    });

    it('should not allow cancelling already cancelled booking', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: futureDate.toISOString(),
        end: futureDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'cancelled',
        } as any
      };

      expect(canCancelBooking(booking)).toBe(false);
    });
  });

  describe('canMarkCompleted', () => {
    it('should allow marking confirmed as completed', () => {
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
        } as any
      };

      expect(canMarkCompleted(booking)).toBe(true);
    });

    it('should not allow marking completed twice', () => {
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'completed',
        } as any
      };

      expect(canMarkCompleted(booking)).toBe(false);
    });
  });

  describe('canMarkMissed', () => {
    it('should allow marking past confirmed booking as missed', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: pastDate.toISOString(),
        end: pastDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
        } as any
      };

      expect(canMarkMissed(booking)).toBe(true);
    });

    it('should not allow marking future booking as missed', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: futureDate.toISOString(),
        end: futureDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'confirmed',
        } as any
      };

      expect(canMarkMissed(booking)).toBe(false);
    });

    it('should not allow marking completed booking as missed', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const booking: CalendarEvent = {
        id: '1',
        title: 'Booking',
        start: pastDate.toISOString(),
        end: pastDate.toISOString(),
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: {
          status: 'completed',
        } as any
      };

      expect(canMarkMissed(booking)).toBe(false);
    });
  });

  describe('getEventCountsByStatus', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Event 1',
        start: '2024-12-15T10:00:00Z',
        end: '2024-12-15T11:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: { status: 'confirmed' } as any
      },
      {
        id: '2',
        title: 'Event 2',
        start: '2024-12-15T12:00:00Z',
        end: '2024-12-15T13:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: { status: 'confirmed' } as any
      },
      {
        id: '3',
        title: 'Event 3',
        start: '2024-12-15T14:00:00Z',
        end: '2024-12-15T15:00:00Z',
        backgroundColor: '#000',
        borderColor: '#000',
        textColor: '#FFF',
        extendedProps: { status: 'completed' } as any
      }
    ];

    it('should count events by status', () => {
      const counts = getEventCountsByStatus(mockEvents);
      expect(counts.confirmed).toBe(2);
      expect(counts.completed).toBe(1);
      expect(counts.cancelled).toBe(0);
      expect(counts.missed).toBe(0);
    });
  });
});

