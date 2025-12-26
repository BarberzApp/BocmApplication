/**
 * Calendar Utilities
 * 
 * Pure utility functions for calendar operations.
 * Follows Single Responsibility Principle - only handles calculations and transformations.
 * All functions are pure (no side effects) for easy testing.
 * 
 * @module calendarUtils
 */

import { theme } from '../theme';
import type { CalendarEvent } from './calendarDataService';

/**
 * Get color scheme for booking status
 * 
 * @param status - Booking status
 * @returns Object with backgroundColor, borderColor, and textColor
 */
export function getStatusColors(status: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        backgroundColor: theme.colors.success || '#10b981',
        borderColor: theme.colors.success || '#10b981',
        textColor: '#FFFFFF'
      };
    case 'completed':
      return {
        backgroundColor: theme.colors.primary || '#3b82f6',
        borderColor: theme.colors.primary || '#3b82f6',
        textColor: '#FFFFFF'
      };
    case 'cancelled':
      return {
        backgroundColor: theme.colors.warning || '#ef4444',
        borderColor: theme.colors.warning || '#ef4444',
        textColor: '#FFFFFF'
      };
    case 'missed':
      return {
        backgroundColor: '#6b7280',
        borderColor: '#6b7280',
        textColor: '#FFFFFF'
      };
    default:
      return {
        backgroundColor: theme.colors.secondary || '#f59e0b',
        borderColor: theme.colors.secondary || '#f59e0b',
        textColor: '#FFFFFF'
      };
  }
}

/**
 * Transform booking data to calendar event
 * 
 * @param booking - Raw booking data
 * @param service - Service details
 * @param client - Client profile (optional)
 * @param barber - Barber profile (optional)
 * @param addonTotal - Total addon cost
 * @param addonNames - Array of addon names
 * @param userRole - Current user's role
 * @param barberViewMode - Barber's view mode (appointments or bookings)
 * @returns Calendar event object
 */
export function transformBookingToEvent(
  booking: any,
  service: any,
  client: any | null,
  barber: any | null,
  addonTotal: number,
  addonNames: string[],
  userRole: 'client' | 'barber',
  barberViewMode?: 'appointments' | 'bookings'
): CalendarEvent {
  const startDate = new Date(booking.date);
  const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000);

  // Create title based on role and view mode
  let title = '';
  if (userRole === 'client') {
    title = `${service?.name || 'Service'} with ${barber?.name || 'Barber'}`;
  } else if (userRole === 'barber') {
    if (barberViewMode === 'appointments') {
      title = `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`;
    } else {
      title = `${service?.name || 'Service'} with ${barber?.name || 'Barber'}`;
    }
  }

  // Calculate prices
  const basePrice = service?.price || 0;
  const storedAddonTotal = booking.addon_total || 0;
  const platformFee = booking.platform_fee || 0;
  const barberPayout = typeof booking.barber_payout === 'number' 
    ? booking.barber_payout 
    : (basePrice + storedAddonTotal + (platformFee * 0.40));

  // Get status colors
  const colors = getStatusColors(booking.status);

  return {
    id: booking.id,
    title,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    textColor: colors.textColor,
    extendedProps: {
      status: booking.status,
      serviceName: service?.name || 'Unknown Service',
      clientName: client?.name || booking.guest_name || 'Guest',
      barberName: barber?.name || 'Unknown Barber',
      barberId: booking.barber_id,
      price: barberPayout,
      basePrice,
      addonTotal: storedAddonTotal,
      addonNames,
      isGuest: booking.is_guest || false,
      guestEmail: booking.guest_email || '',
      guestPhone: booking.guest_phone || ''
    }
  };
}

/**
 * Filter events by status
 * 
 * @param events - Array of calendar events
 * @param status - Status to filter by ('all' for no filtering)
 * @returns Filtered array of events
 */
export function filterEventsByStatus(events: CalendarEvent[], status: string): CalendarEvent[] {
  if (status === 'all') {
    return events;
  }
  return events.filter(event => event.extendedProps.status === status);
}

/**
 * Get events for a specific date
 * 
 * @param events - Array of calendar events
 * @param date - Date to filter by
 * @returns Events on the specified date
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dateStr = date.toISOString().split('T')[0];
  return events.filter(event => {
    const eventDateStr = new Date(event.start).toISOString().split('T')[0];
    return eventDateStr === dateStr;
  });
}

/**
 * Format time slot for display (24-hour to 12-hour)
 * 
 * @param time - Time in HH:mm format
 * @returns Formatted time (e.g., "2:30 PM")
 */
export function formatTimeSlot(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Calculate total revenue from events
 * 
 * @param events - Array of calendar events
 * @returns Total revenue
 */
export function calculateTotalRevenue(events: CalendarEvent[]): number {
  return events.reduce((total, event) => {
    if (event.extendedProps.status !== 'cancelled') {
      return total + event.extendedProps.price;
    }
    return total;
  }, 0);
}

/**
 * Get upcoming events (future events only)
 * 
 * @param events - Array of calendar events
 * @returns Array of upcoming events
 */
export function getUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events
    .filter(event => new Date(event.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Get past events
 * 
 * @param events - Array of calendar events
 * @returns Array of past events
 */
export function getPastEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events
    .filter(event => new Date(event.start) <= now)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

/**
 * Group events by date
 * 
 * @param events - Array of calendar events
 * @returns Map of date string to events array
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  
  events.forEach(event => {
    const dateStr = new Date(event.start).toISOString().split('T')[0];
    const existing = grouped.get(dateStr) || [];
    existing.push(event);
    grouped.set(dateStr, existing);
  });
  
  return grouped;
}

/**
 * Check if a date has any events
 * 
 * @param events - Array of calendar events
 * @param date - Date to check
 * @returns True if date has events
 */
export function hasEventsOnDate(events: CalendarEvent[], date: Date): boolean {
  return getEventsForDate(events, date).length > 0;
}

/**
 * Get count of events by status
 * 
 * @param events - Array of calendar events
 * @returns Object with count for each status
 */
export function getEventCountsByStatus(events: CalendarEvent[]): Record<string, number> {
  const counts: Record<string, number> = {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    missed: 0
  };
  
  events.forEach(event => {
    const status = event.extendedProps.status;
    if (status in counts) {
      counts[status]++;
    }
  });
  
  return counts;
}

/**
 * Calculate completion rate
 * 
 * @param events - Array of calendar events
 * @returns Completion rate as percentage (0-100)
 */
export function calculateCompletionRate(events: CalendarEvent[]): number {
  const pastEvents = getPastEvents(events);
  if (pastEvents.length === 0) return 0;
  
  const completedCount = pastEvents.filter(
    e => e.extendedProps.status === 'completed'
  ).length;
  
  return Math.round((completedCount / pastEvents.length) * 100);
}

/**
 * Validate manual appointment data
 * 
 * @param data - Appointment form data
 * @returns Object with isValid and error message
 */
export function validateManualAppointment(data: {
  clientName: string;
  serviceId: string;
  time: string;
  price: string;
}): { isValid: boolean; error?: string } {
  if (!data.clientName.trim()) {
    return { isValid: false, error: 'Client name is required' };
  }
  
  if (!data.serviceId) {
    return { isValid: false, error: 'Please select a service' };
  }
  
  if (!data.time) {
    return { isValid: false, error: 'Please select a time slot' };
  }
  
  const price = parseFloat(data.price);
  if (isNaN(price) || price <= 0) {
    return { isValid: false, error: 'Please enter a valid price' };
  }
  
  return { isValid: true };
}

/**
 * Format currency for display
 * 
 * @param amount - Amount in dollars
 * @returns Formatted currency string (e.g., "$45.00")
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Check if booking can be cancelled
 * 
 * @param booking - Calendar event
 * @returns True if booking can be cancelled
 */
export function canCancelBooking(booking: CalendarEvent): boolean {
  const startTime = new Date(booking.start);
  const now = new Date();
  const status = booking.extendedProps.status;
  
  // Can cancel if:
  // 1. Not already cancelled or completed
  // 2. Booking is in the future
  return (
    status !== 'cancelled' &&
    status !== 'completed' &&
    startTime > now
  );
}

/**
 * Check if booking can be marked as completed
 * 
 * @param booking - Calendar event
 * @returns True if booking can be marked completed
 */
export function canMarkCompleted(booking: CalendarEvent): boolean {
  const status = booking.extendedProps.status;
  
  // Can mark completed if not already completed or cancelled
  return status !== 'completed' && status !== 'cancelled';
}

/**
 * Check if booking can be marked as missed
 * 
 * @param booking - Calendar event
 * @returns True if booking can be marked missed
 */
export function canMarkMissed(booking: CalendarEvent): boolean {
  const startTime = new Date(booking.start);
  const now = new Date();
  const status = booking.extendedProps.status;
  
  // Can mark missed if:
  // 1. Not already completed, cancelled, or missed
  // 2. Booking is in the past
  return (
    status !== 'completed' &&
    status !== 'cancelled' &&
    status !== 'missed' &&
    startTime < now
  );
}

