/**
 * Tests for useCalendarState hook
 * 
 * Tests state management functionality
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useCalendarState } from '../app/shared/hooks/useCalendarState';

describe('useCalendarState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCalendarState());

    expect(result.current.currentDate).toBeInstanceOf(Date);
    expect(result.current.selectedDate).toBeNull();
    expect(result.current.events).toEqual([]);
    expect(result.current.selectedEvent).toBeNull();
    expect(result.current.showEventDialog).toBe(false);
    expect(result.current.showManualAppointmentForm).toBe(false);
    expect(result.current.showReviewForm).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.filterStatus).toBe('all');
    expect(result.current.userRole).toBeNull();
    expect(result.current.barberViewMode).toBe('appointments');
  });

  describe('Calendar navigation', () => {
    it('should move to next month', () => {
      const { result } = renderHook(() => useCalendarState());
      const initialMonth = result.current.currentDate.getMonth();

      act(() => {
        result.current.nextMonth();
      });

      const newMonth = result.current.currentDate.getMonth();
      expect(newMonth).toBe((initialMonth + 1) % 12);
    });

    it('should move to previous month', () => {
      const { result } = renderHook(() => useCalendarState());
      const initialMonth = result.current.currentDate.getMonth();

      act(() => {
        result.current.prevMonth();
      });

      const expectedMonth = initialMonth === 0 ? 11 : initialMonth - 1;
      expect(result.current.currentDate.getMonth()).toBe(expectedMonth);
    });

    it('should go to today', () => {
      const { result } = renderHook(() => useCalendarState());
      const today = new Date();

      act(() => {
        result.current.prevMonth(); // Move away from today
        result.current.goToToday();
      });

      expect(result.current.currentDate.getDate()).toBe(today.getDate());
      expect(result.current.currentDate.getMonth()).toBe(today.getMonth());
    });

    it('should set selected date', () => {
      const { result } = renderHook(() => useCalendarState());
      const testDate = new Date('2024-12-15');

      act(() => {
        result.current.setSelectedDate(testDate);
      });

      expect(result.current.selectedDate).toEqual(testDate);
    });
  });

  describe('Event selection', () => {
    it('should select event and show dialog', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockEvent: any = {
        id: 'event-1',
        title: 'Test Event',
        start: '2024-12-15T10:00:00Z',
        end: '2024-12-15T11:00:00Z',
      };

      act(() => {
        result.current.selectEvent(mockEvent);
      });

      expect(result.current.selectedEvent).toEqual(mockEvent);
      expect(result.current.showEventDialog).toBe(true);
    });

    it('should clear selected event', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockEvent: any = { id: 'event-1', title: 'Test' };

      act(() => {
        result.current.selectEvent(mockEvent);
        result.current.clearSelectedEvent();
      });

      expect(result.current.selectedEvent).toBeNull();
      expect(result.current.showEventDialog).toBe(false);
    });
  });

  describe('Manual appointment form', () => {
    it('should open manual appointment form', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.openManualAppointmentForm();
      });

      expect(result.current.showManualAppointmentForm).toBe(true);
    });

    it('should open manual appointment form with specific date', () => {
      const { result } = renderHook(() => useCalendarState());
      const testDate = new Date('2024-12-20');

      act(() => {
        result.current.openManualAppointmentForm(testDate);
      });

      expect(result.current.showManualAppointmentForm).toBe(true);
      expect(result.current.manualFormData.date).toEqual(testDate);
    });

    it('should close manual appointment form and reset data', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.openManualAppointmentForm();
        result.current.updateManualFormData({ clientName: 'John Doe' });
        result.current.closeManualAppointmentForm();
      });

      expect(result.current.showManualAppointmentForm).toBe(false);
      expect(result.current.manualFormData.clientName).toBe('');
    });

    it('should update manual form data', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.updateManualFormData({
          clientName: 'Jane Smith',
          price: '75',
        });
      });

      expect(result.current.manualFormData.clientName).toBe('Jane Smith');
      expect(result.current.manualFormData.price).toBe('75');
    });

    it('should set services', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockServices = [
        { id: '1', name: 'Haircut', price: 50, duration: 30 },
        { id: '2', name: 'Shave', price: 30, duration: 20 },
      ];

      act(() => {
        result.current.setServices(mockServices);
      });

      expect(result.current.services).toEqual(mockServices);
    });

    it('should set time slots', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockSlots = [
        { time: '09:00', available: true },
        { time: '10:00', available: false },
      ];

      act(() => {
        result.current.setTimeSlots(mockSlots);
      });

      expect(result.current.timeSlots).toEqual(mockSlots);
    });
  });

  describe('Review form', () => {
    it('should open review form', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockReviewData = {
        barberId: 'barber-1',
        bookingId: 'booking-1',
      };

      act(() => {
        result.current.openReviewForm(mockReviewData);
      });

      expect(result.current.showReviewForm).toBe(true);
      expect(result.current.reviewFormData).toEqual(mockReviewData);
    });

    it('should close review form', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.openReviewForm({ barberId: '1', bookingId: '1' });
        result.current.closeReviewForm();
      });

      expect(result.current.showReviewForm).toBe(false);
      expect(result.current.reviewFormData).toBeNull();
    });
  });

  describe('Loading states', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should set refreshing state', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setRefreshing(true);
      });

      expect(result.current.refreshing).toBe(true);
    });

    it('should set marking completed state', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setIsMarkingCompleted(true);
      });

      expect(result.current.isMarkingCompleted).toBe(true);
    });

    it('should set marking missed state', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setIsMarkingMissed(true);
      });

      expect(result.current.isMarkingMissed).toBe(true);
    });
  });

  describe('User role and view mode', () => {
    it('should set user role', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setUserRole('barber');
      });

      expect(result.current.userRole).toBe('barber');
    });

    it('should toggle barber view mode', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.toggleBarberViewMode();
      });

      expect(result.current.barberViewMode).toBe('bookings');

      act(() => {
        result.current.toggleBarberViewMode();
      });

      expect(result.current.barberViewMode).toBe('appointments');
    });

    it('should set barber ID', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setBarberId('barber-123');
      });

      expect(result.current.barberId).toBe('barber-123');
    });
  });

  describe('Events', () => {
    it('should set events', () => {
      const { result } = renderHook(() => useCalendarState());
      const mockEvents: any = [
        { id: '1', title: 'Event 1' },
        { id: '2', title: 'Event 2' },
      ];

      act(() => {
        result.current.setEvents(mockEvents);
      });

      expect(result.current.events).toEqual(mockEvents);
    });

    it('should set filter status', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setFilterStatus('completed');
      });

      expect(result.current.filterStatus).toBe('completed');
    });
  });

  describe('Reset state', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useCalendarState());

      // Modify some state
      act(() => {
        result.current.setUserRole('barber');
        result.current.setFilterStatus('completed');
        result.current.setLoading(false);
        result.current.selectEvent({ id: '1' } as any);
        result.current.resetState();
      });

      // Check if state is reset
      expect(result.current.userRole).toBeNull();
      expect(result.current.filterStatus).toBe('all');
      expect(result.current.loading).toBe(true);
      expect(result.current.selectedEvent).toBeNull();
      expect(result.current.showEventDialog).toBe(false);
    });
  });

  describe('View mode', () => {
    it('should set view mode', () => {
      const { result } = renderHook(() => useCalendarState());

      act(() => {
        result.current.setViewMode('month');
      });

      expect(result.current.viewMode).toBe('month');
    });
  });
});

