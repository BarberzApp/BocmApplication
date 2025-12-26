/**
 * Google Calendar Integration Utilities
 * Handles adding appointments to Google Calendar for both barbers and clients
 */

import { logger } from './logger'

export interface GoogleCalendarEvent {
  summary: string
  description: string
  location?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
}

/**
 * Generate Google Calendar event data from a booking
 */
export function generateGoogleCalendarEvent(
  event: {
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  },
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  }
): GoogleCalendarEvent {
  const startDate = new Date(event.start)
  const endDate = new Date(event.end)
  
  // Format the event description based on user role
  let description = ''
  let summary = ''
  
  if (userRole === 'barber') {
    // For barbers: focus on client and service details
    summary = `Appointment: ${event.extendedProps.serviceName} - ${event.extendedProps.clientName}`
    description = `Service: ${event.extendedProps.serviceName}
Client: ${event.extendedProps.clientName}
Price: $${event.extendedProps.price}
${event.extendedProps.isGuest ? `Guest Email: ${event.extendedProps.guestEmail || 'N/A'}
Guest Phone: ${event.extendedProps.guestPhone || 'N/A'}` : ''}

Booked through BOCM`
  } else {
    // For clients: focus on service and barber details
    summary = `Appointment: ${event.extendedProps.serviceName}`
    description = `Service: ${event.extendedProps.serviceName}
Price: $${event.extendedProps.price}

Booked through BOCM`
  }

  return {
    summary,
    description,
    location: userInfo.location,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    reminders: {
      useDefault: false,
      overrides: [
        {
          method: 'popup',
          minutes: 15 // 15 minutes before
        },
        {
          method: 'email',
          minutes: 60 // 1 hour before
        }
      ]
    }
  }
}

/**
 * Generate Google Calendar URL for adding an event
 */
export function generateGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${event.start.dateTime.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${event.end.dateTime.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    details: event.description,
    location: event.location || '',
    ctz: event.start.timeZone
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Add event to Google Calendar using the web interface
 */
export function addToGoogleCalendar(
  event: {
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  },
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  }
): void {
  try {
    const calendarEvent = generateGoogleCalendarEvent(event, userRole, userInfo)
    const calendarUrl = generateGoogleCalendarUrl(calendarEvent)
    
    // Open Google Calendar in a new tab
    window.open(calendarUrl, '_blank', 'noopener,noreferrer')
  } catch (error) {
    logger.error('Error generating Google Calendar URL', error)
    throw new Error('Failed to generate Google Calendar link')
  }
}

/**
 * Add multiple events to Google Calendar
 */
export function addMultipleToGoogleCalendar(
  events: Array<{
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  }>,
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  }
): void {
  try {
    // For multiple events, we'll add them one by one
    // Google Calendar doesn't support bulk add via URL, so we'll open multiple tabs
    events.forEach((event, index) => {
      setTimeout(() => {
        addToGoogleCalendar(event, userRole, userInfo)
      }, index * 500) // Stagger the opens by 500ms
    })
  } catch (error) {
    logger.error('Error adding multiple events to Google Calendar', error)
    throw new Error('Failed to add events to Google Calendar')
  }
}

/**
 * Generate iCal file content for downloading
 */
export function generateICalContent(
  events: Array<{
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  }>,
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  }
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BOCM//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  events.forEach((event, index) => {
    const startDate = new Date(event.start)
    const endDate = new Date(event.end)
    const calendarEvent = generateGoogleCalendarEvent(event, userRole, userInfo)
    
    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${event.title.replace(/\s+/g, '-')}-${index}-${Date.now()}@bocm.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${calendarEvent.summary}`,
      `DESCRIPTION:${calendarEvent.description.replace(/\n/g, '\\n')}`,
      calendarEvent.location ? `LOCATION:${calendarEvent.location}` : '',
      'END:VEVENT'
    )
  })

  icalContent.push('END:VCALENDAR')
  
  return icalContent.filter(line => line !== '').join('\r\n')
}

/**
 * Download events as iCal file
 */
export function downloadICalFile(
  events: Array<{
    title: string
    start: string
    end: string
    extendedProps: {
      serviceName: string
      clientName: string
      price: number
      isGuest: boolean
      guestEmail?: string
      guestPhone?: string
    }
  }>,
  userRole: 'barber' | 'client',
  userInfo: {
    name: string
    email: string
    location?: string
  },
  filename: string = 'bocm-appointments.ics'
): void {
  try {
    const icalContent = generateICalContent(events, userRole, userInfo)
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    logger.error('Error downloading iCal file', error)
    throw new Error('Failed to download calendar file')
  }
} 