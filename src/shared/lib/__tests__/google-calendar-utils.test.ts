/**
 * Tests for Google Calendar utility functions
 */

import {
  generateGoogleCalendarEvent,
  generateGoogleCalendarUrl,
  generateICalContent,
} from '../google-calendar-utils';

describe('Google Calendar Utils', () => {
  const mockEvent = {
    title: 'Test Appointment',
    start: '2024-01-15T10:00:00Z',
    end: '2024-01-15T11:00:00Z',
    extendedProps: {
      serviceName: 'Haircut',
      clientName: 'John Doe',
      price: 50,
      isGuest: false,
      guestEmail: undefined,
      guestPhone: undefined,
    },
  };

  const mockUserInfo = {
    name: 'Test Barber',
    email: 'barber@test.com',
    location: '123 Main St',
  };

  describe('generateGoogleCalendarEvent', () => {
    it('should generate event for barber view', () => {
      const event = generateGoogleCalendarEvent(mockEvent, 'barber', mockUserInfo);

      expect(event.summary).toContain('Appointment');
      expect(event.summary).toContain('Haircut');
      expect(event.summary).toContain('John Doe');
      expect(event.description).toContain('Service: Haircut');
      expect(event.description).toContain('Client: John Doe');
      expect(event.description).toContain('Price: $50');
      expect(event.location).toBe('123 Main St');
      expect(event.start.dateTime).toBeDefined();
      expect(event.end.dateTime).toBeDefined();
      expect(event.start.timeZone).toBeDefined();
      expect(event.end.timeZone).toBeDefined();
    });

    it('should generate event for client view', () => {
      const event = generateGoogleCalendarEvent(mockEvent, 'client', mockUserInfo);

      expect(event.summary).toContain('Appointment');
      expect(event.summary).toContain('Haircut');
      expect(event.description).toContain('Service: Haircut');
      expect(event.description).toContain('Price: $50');
      expect(event.description).not.toContain('Client:');
    });

    it('should include guest information when isGuest is true', () => {
      const guestEvent = {
        ...mockEvent,
        extendedProps: {
          ...mockEvent.extendedProps,
          isGuest: true,
          guestEmail: 'guest@test.com',
          guestPhone: '123-456-7890',
        },
      };

      const event = generateGoogleCalendarEvent(guestEvent, 'barber', mockUserInfo);

      expect(event.description).toContain('Guest Email: guest@test.com');
      expect(event.description).toContain('Guest Phone: 123-456-7890');
    });

    it('should set reminders correctly', () => {
      const event = generateGoogleCalendarEvent(mockEvent, 'barber', mockUserInfo);

      expect(event.reminders).toBeDefined();
      expect(event.reminders?.useDefault).toBe(false);
      expect(event.reminders?.overrides).toHaveLength(2);
      expect(event.reminders?.overrides?.[0].method).toBe('popup');
      expect(event.reminders?.overrides?.[0].minutes).toBe(15);
      expect(event.reminders?.overrides?.[1].method).toBe('email');
      expect(event.reminders?.overrides?.[1].minutes).toBe(60);
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('should generate valid Google Calendar URL', () => {
      const calendarEvent = generateGoogleCalendarEvent(mockEvent, 'barber', mockUserInfo);
      const url = generateGoogleCalendarUrl(calendarEvent);

      expect(url).toContain('https://calendar.google.com/calendar/render');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('text=');
      expect(url).toContain('dates=');
      expect(url).toContain('details=');
    });

    it('should include location in URL when provided', () => {
      const calendarEvent = generateGoogleCalendarEvent(mockEvent, 'barber', mockUserInfo);
      const url = generateGoogleCalendarUrl(calendarEvent);

      expect(url).toContain('location=');
    });

    it('should handle missing location gracefully', () => {
      const userInfoWithoutLocation = {
        ...mockUserInfo,
        location: undefined,
      };
      const calendarEvent = generateGoogleCalendarEvent(mockEvent, 'barber', userInfoWithoutLocation);
      const url = generateGoogleCalendarUrl(calendarEvent);

      expect(url).toBeDefined();
      expect(url).toContain('location=');
    });
  });

  describe('generateICalContent', () => {
    it('should generate valid iCal content', () => {
      const icalContent = generateICalContent([mockEvent], 'barber', mockUserInfo);

      expect(icalContent).toContain('BEGIN:VCALENDAR');
      expect(icalContent).toContain('VERSION:2.0');
      expect(icalContent).toContain('PRODID:-//BOCM//Calendar//EN');
      expect(icalContent).toContain('BEGIN:VEVENT');
      expect(icalContent).toContain('END:VEVENT');
      expect(icalContent).toContain('END:VCALENDAR');
    });

    it('should generate iCal for multiple events', () => {
      const events = [
        mockEvent,
        {
          ...mockEvent,
          title: 'Second Appointment',
          start: '2024-01-16T10:00:00Z',
          end: '2024-01-16T11:00:00Z',
        },
      ];

      const icalContent = generateICalContent(events, 'barber', mockUserInfo);

      const eventCount = (icalContent.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(2);
    });

    it('should include event summary and description', () => {
      const icalContent = generateICalContent([mockEvent], 'barber', mockUserInfo);

      expect(icalContent).toContain('SUMMARY:');
      expect(icalContent).toContain('DESCRIPTION:');
    });
  });
});

