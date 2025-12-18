"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { logger } from '@/shared/lib/logger'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  DollarSign, 
  X,
  MapPin,
  Phone,
  Mail,
  Scissors,
  Star,
  Loader2,
  ExternalLink,
  Download,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { addToGoogleCalendar, addMultipleToGoogleCalendar, downloadICalFile } from '@/shared/lib/google-calendar-utils'
import { ManualAppointmentForm } from './manual-appointment-form'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: {
    status: string
    serviceName: string
    clientName: string
    barberName: string
    price: number
    basePrice: number
    addonTotal: number
    addonNames: string[]
    isGuest: boolean
    guestEmail: string
    guestPhone: string
    isBarberView: boolean
  }
}

interface EnhancedCalendarProps {
  className?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
}

export function EnhancedCalendar({ className, onEventClick, onDateSelect }: EnhancedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [gotoDate, setGotoDate] = useState('')
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isMarkingMissed, setIsMarkingMissed] = useState(false)
  const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false)
  const [isBarber, setIsBarber] = useState(false)
  const { user } = useAuth()

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  useEffect(() => {
    logger.debug('EnhancedCalendar: User changed', { userId: user?.id })
    if (!user) {
      logger.debug('EnhancedCalendar: No user, skipping fetch')
      return
    }
    logger.debug('EnhancedCalendar: Fetching bookings for user', { userId: user.id })
    fetchBookings()
  }, [user])

  // Touch gesture handlers for mobile swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      nextMonth()
    }
    if (isRightSwipe) {
      prevMonth()
    }
  }

  const fetchBookings = async () => {
    try {
      logger.debug('EnhancedCalendar: Starting fetchBookings for user', { userId: user?.id })
      
      // Check if user is a barber or client
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      logger.debug('EnhancedCalendar: Barber data', { barberData, error: barberError })
      
      // Update isBarber state based on barberData
      setIsBarber(!!barberData)
      
      let bookingsQuery;
      
      if (barberData) {
        // User is a barber - fetch their bookings
        logger.debug('EnhancedCalendar: User is a barber, fetching barber bookings')
        bookingsQuery = supabase
          .from('bookings')
          .select(`
            *,
            booking_addons (
              id,
              price,
              service_addons (
                id,
                name,
                price
              )
            )
          `)
          .eq('barber_id', barberData.id)
          .eq('payment_status', 'succeeded') // Only show successful payments
          .order('date', { ascending: true })
      } else {
        // User is a client - fetch their bookings
        logger.debug('EnhancedCalendar: User is a client, fetching client bookings')
        bookingsQuery = supabase
          .from('bookings')
          .select(`
            *,
            barbers:barber_id(
              id,
              user_id,
              profiles:user_id(name, avatar_url)
            ),
            services:service_id(name, duration, price),
            booking_addons (
              id,
              price,
              service_addons (
                id,
                name,
                price
              )
            )
          `)
          .eq('client_id', user?.id)
          .eq('payment_status', 'succeeded') // Only show successful payments
          .order('date', { ascending: true })
      }

      const { data: bookings, error } = await bookingsQuery

      logger.debug('EnhancedCalendar: Bookings data', { bookings, error })
      
      if (error || !bookings) {
        logger.debug('EnhancedCalendar: No bookings found or error', { error })
        return
      }

      const events = await Promise.all(bookings.map(async (booking) => {
        logger.debug('EnhancedCalendar: Processing booking', { bookingId: booking.id })
        
        // For barber view, we need to fetch service and client separately
        // For client view, service and barber info are already included in the query
        let service = booking.services
        let client = null
        let barber = null
        
        if (barberData) {
          // Barber view - fetch service and client info
          if (!service) {
            const { data: serviceData } = await supabase
              .from('services')
              .select('name, duration, price')
              .eq('id', booking.service_id)
              .single()
            service = serviceData
          }
          
          if (booking.client_id) {
            const { data: clientData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', booking.client_id)
              .single()
            client = clientData
          }
        } else {
          // Client view - barber info is already included
          barber = booking.barbers
        }

        const startDate = new Date(booking.date)
        const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000)

        // Calculate values in dollars
        const basePrice = service?.price || 0
        const addonTotal = booking.addon_total || 0
        const platformFee = booking.platform_fee || 0
        const barberPayout = typeof booking.barber_payout === 'number'
          ? booking.barber_payout
          : basePrice + addonTotal + (platformFee * 0.40)
        
        logger.debug('EnhancedCalendar: Price calculation for booking', {
          bookingId: booking.id,
          servicePrice: service?.price,
          bookingPrice: booking.price,
          basePrice,
          addonTotal,
          platformFee,
          barberPayout,
          addonNames: booking.booking_addons?.map((addon: any) => addon.service_addons?.name)
        })

        // Get add-on names for display
        const addonNames = booking.booking_addons?.map((addon: any) => 
          addon.service_addons?.name || 'Unknown Add-on'
        ) || []

        // Create title based on user role
        let title
        if (barberData) {
          // Barber view: "Service - Client Name"
          title = `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`
        } else {
          // Client view: "Service with Barber Name"
          title = `${service?.name || 'Service'} with ${barber?.profiles?.name || 'Barber'}`
        }

        return {
          id: booking.id,
          title,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          backgroundColor: barberData ? '#ffc107' : '#3b82f6', // Yellow for barber, blue for client
          borderColor: barberData ? '#ff8c00' : '#1d4ed8',
          textColor: '#FFFFFF',
          extendedProps: {
            status: booking.status,
            serviceName: service?.name || '',
            clientName: client?.name || booking.guest_name || 'Guest',
            barberName: barber?.profiles?.name || 'Barber',
            price: barberPayout,
            basePrice: basePrice,
            addonTotal: addonTotal,
            addonNames: addonNames,
            isGuest: !client,
            guestEmail: booking.guest_email,
            guestPhone: booking.guest_phone,
            isBarberView: !!barberData
          }
        }
      }))

        logger.debug('EnhancedCalendar: Final events', { eventCount: events.length })
        logger.debug('EnhancedCalendar: Sample booking with addons', { booking: bookings[0] })
        setEvents(events)
    } catch (error) {
      logger.error('EnhancedCalendar: Error fetching bookings', error)
    }
  }

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    return eachDayOfInterval({ start, end })
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0
  }

  const hasPastEvents = (date: Date) => {
    const eventsForDate = getEventsForDate(date)
    const now = new Date()
    return eventsForDate.some(event => {
      const eventEnd = new Date(event.end)
      return eventEnd < now
    })
  }

  const hasUpcomingEvents = (date: Date) => {
    const eventsForDate = getEventsForDate(date)
    const now = new Date()
    return eventsForDate.some(event => {
      const eventStart = new Date(event.start)
      return eventStart > now
    })
  }

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    onDateSelect?.(date)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventDialog(true)
    onEventClick?.(event)
  }

  const handleMarkAsMissed = async () => {
    if (!selectedEvent) return
    
    setIsMarkingMissed(true)
    try {
      // Update the booking status in the database
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled', // Using 'cancelled' instead of 'missed' due to DB constraint
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEvent.id)

      if (error) {
        logger.error('Error marking booking as missed', error)
        throw error
      }

      // Update the local event state
      setSelectedEvent(prev => prev ? {
        ...prev,
        extendedProps: {
          ...prev.extendedProps,
          status: 'cancelled'
        }
      } : null)

      // Refresh the events to update the calendar
      await fetchBookings()

      logger.debug('Booking marked as missed successfully')
    } catch (error) {
      logger.error('Failed to mark booking as missed', error)
    } finally {
      setIsMarkingMissed(false)
    }
  }

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a')
  }

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy')
  }

  const calendarDays = getCalendarDays()

  return (
    <div className={cn("w-full", className)}>
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .calendar-container {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 24px;
            backdrop-filter: blur(3xl);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          
          .calendar-day {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 16px;
            position: relative;
            overflow: hidden;
            min-height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          
          .calendar-day:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 35px rgba(255, 193, 7, 0.25);
            background: rgba(255, 193, 7, 0.1);
            border-color: rgba(255, 193, 7, 0.3);
          }
          
          .calendar-day:active {
            transform: scale(0.96);
          }
          
          .calendar-day.has-upcoming-events {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.2) 0%, hsl(var(--secondary) / 0.2) 100%);
            border: 2px solid hsl(var(--secondary) / 0.4);
            box-shadow: 0 0 20px hsl(var(--secondary) / 0.3);
            animation: pulse-orange 2s infinite;
          }
          
          .calendar-day.has-upcoming-events:hover {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.3) 0%, hsl(var(--secondary) / 0.3) 100%);
            box-shadow: 0 0 25px hsl(var(--secondary) / 0.4);
          }
          
          .calendar-day.has-past-events {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%);
            border: 2px solid rgba(34, 197, 94, 0.4);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
            animation: pulse-green 2s infinite;
          }
          
          .calendar-day.has-past-events:hover {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.3) 100%);
            box-shadow: 0 0 25px rgba(34, 197, 94, 0.4);
          }
          
          @keyframes pulse-orange {
            0%, 100% { 
              opacity: 1; 
              box-shadow: 0 0 20px hsl(var(--secondary) / 0.3);
            }
            50% { 
              opacity: 0.8; 
              box-shadow: 0 0 30px hsl(var(--secondary) / 0.5);
            }
          }
          
          @keyframes pulse-green {
            0%, 100% { 
              opacity: 1; 
              box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
            }
            50% { 
              opacity: 0.8; 
              box-shadow: 0 0 30px rgba(34, 197, 94, 0.5);
            }
          }
          
          .calendar-day.selected {
            background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--secondary) / 0.8) 100%);
            color: white;
            transform: scale(1.08);
            box-shadow: 0 16px 40px hsl(var(--secondary) / 0.4);
            border: 2px solid rgba(255, 255, 255, 0.3);
            font-weight: bold;
          }
          
          .calendar-day.today {
            background: hsl(var(--secondary) / 0.15);
            border: 2px solid hsl(var(--secondary));
            color: hsl(var(--secondary));
            font-weight: bold;
            box-shadow: 0 8px 25px hsl(var(--secondary) / 0.3);
          }
          
          .calendar-day.today:hover {
            background: hsl(var(--secondary) / 0.25);
            box-shadow: 0 12px 35px hsl(var(--secondary) / 0.4);
          }
          
          .event-item {
            border-radius: 16px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            backdrop-filter: blur(10px);
          }
          
          .event-item.upcoming {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.08) 0%, hsl(var(--secondary) / 0.08) 100%);
            border: 1px solid hsl(var(--secondary) / 0.2);
          }
          
          .event-item.upcoming:hover {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.15) 0%, hsl(var(--secondary) / 0.15) 100%);
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 35px hsl(var(--secondary) / 0.25);
            border-color: hsl(var(--secondary) / 0.4);
          }
          
          .event-item.past {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(22, 163, 74, 0.08) 100%);
            border: 1px solid rgba(34, 197, 94, 0.2);
          }
          
          .event-item.past:hover {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%);
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 35px rgba(34, 197, 94, 0.25);
            border-color: rgba(34, 197, 94, 0.4);
          }
          
          .event-item.missed {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%);
            border: 1px solid rgba(239, 68, 68, 0.2);
          }
          
          .event-item.missed:hover {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%);
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 35px rgba(239, 68, 68, 0.25);
            border-color: rgba(239, 68, 68, 0.4);
          }
          
          .event-item:active {
            transform: scale(0.98);
          }
          
          .calendar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.5rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 20px;
            margin-bottom: 1.5rem;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          
          .calendar-nav-button {
            background: hsl(var(--secondary) / 0.15);
            border: 1px solid hsl(var(--secondary) / 0.3);
            color: hsl(var(--secondary));
            border-radius: 16px;
            padding: 0.875rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: 52px;
            min-height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            backdrop-filter: blur(10px);
          }
          
          .calendar-nav-button:hover {
            background: hsl(var(--secondary) / 0.25);
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 12px 35px hsl(var(--secondary) / 0.3);
            border-color: hsl(var(--secondary) / 0.5);
          }
          
          .calendar-nav-button:active {
            transform: scale(0.95);
          }
          
          .calendar-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: white;
            text-align: center;
            flex: 1;
            margin: 0 1.5rem;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            letter-spacing: -0.025em;
          }
          
          .weekdays-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            padding: 0 0.75rem;
          }
          
          .weekday {
            text-align: center;
            font-weight: 700;
            color: hsl(var(--secondary));
            font-size: 0.875rem;
            padding: 0.75rem 0;
            text-transform: uppercase;
            letter-spacing: 0.75px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          }
          
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.75rem;
            padding: 0 0.75rem;
          }
          
          .calendar-day.other-month {
            color: rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.01);
            border-color: rgba(255, 255, 255, 0.02);
          }
          
          .today-button {
            background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--secondary) / 0.8) 100%);
            color: white;
            border: none;
            border-radius: 16px;
            padding: 1rem 2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin-top: 1.5rem;
            width: 100%;
            min-height: 56px;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            box-shadow: 0 8px 25px hsl(var(--secondary) / 0.3);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            font-size: 1.1rem;
            letter-spacing: 0.025em;
          }
          
          .today-button:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 16px 40px hsl(var(--secondary) / 0.4);
          }
          
          .today-button:active {
            transform: scale(0.98);
          }
          
          .events-panel {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 20px;
            padding: 1.5rem;
            margin-top: 1.5rem;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          
          .event-list {
            max-height: 350px;
            overflow-y: auto;
            padding-right: 0.75rem;
          }
          
          .event-list::-webkit-scrollbar {
            width: 6px;
          }
          
          .event-list::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
          }
          
          .event-list::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.6) 0%, hsl(var(--secondary) / 0.6) 100%);
            border-radius: 3px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          .event-list::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, hsl(var(--secondary) / 0.8) 0%, hsl(var(--secondary) / 0.8) 100%);
          }
          
          /* Mobile optimizations */
          @media (max-width: 768px) {
            .calendar-day {
              min-height: 56px;
              font-size: 0.9rem;
              border-radius: 14px;
            }
            
            .calendar-title {
              font-size: 1.5rem;
            }
            
            .calendar-nav-button {
              min-width: 48px;
              min-height: 48px;
              padding: 0.75rem;
              border-radius: 14px;
            }
            
            .weekday {
              font-size: 0.8rem;
              padding: 0.5rem 0;
            }
            
            .calendar-grid {
              gap: 0.5rem;
            }
            
            .event-item {
              padding: 1rem;
              border-radius: 14px;
            }
            
            .calendar-header {
              padding: 1.25rem;
              border-radius: 18px;
            }
            
            .events-panel {
              padding: 1.25rem;
              border-radius: 18px;
            }
          }
          
          @media (max-width: 480px) {
            .calendar-day {
              min-height: 52px;
              font-size: 0.85rem;
              border-radius: 12px;
            }
            
            .calendar-title {
              font-size: 1.375rem;
            }
            
            .calendar-nav-button {
              min-width: 44px;
              min-height: 44px;
              padding: 0.625rem;
              border-radius: 12px;
            }
            
            .weekday {
              font-size: 0.75rem;
              padding: 0.375rem 0;
            }
            
            .calendar-grid {
              gap: 0.375rem;
            }
            
            .event-item {
              padding: 0.875rem;
              border-radius: 12px;
            }
          }
        `
      }} />

      <div 
        className="calendar-container p-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header with Navigation */}
        <div className="calendar-header">
          <button 
            className="calendar-nav-button"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <h2 className="calendar-title">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          
          <button 
            className="calendar-nav-button"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Weekdays Header + Calendar Grid aligned */}
        <div className="w-full">
          <div className="weekdays-header">
            {weekdays.map(day => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isTodayDate = isToday(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const dayEvents = getEventsForDate(day)
              return (
                <div
                  key={index}
                  className={cn(
                    "calendar-day",
                    !isCurrentMonth && "other-month",
                    isTodayDate && "today",
                    isSelected && "selected",
                    hasPastEvents(day) && "has-past-events",
                    hasUpcomingEvents(day) && "has-upcoming-events"
                  )}
                  onClick={() => handleDateClick(day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleDateClick(day)
                    }
                  }}
                  aria-label={`${format(day, 'EEEE, MMMM d, yyyy')}${dayEvents.length > 0 ? ` - ${dayEvents.length} events` : ''}`}
                >
                  {format(day, 'd')}
                </div>
              )
            })}
          </div>
        </div>

        {/* Today Button */}
        <button 
          className="today-button"
          onClick={goToToday}
          aria-label="Go to today"
        >
          Today
        </button>

        {/* Manual Appointment Button - Only for Barbers */}
        {isBarber && (
          <div className="mt-4 p-4 bg-gradient-to-r from-secondary/10 to-secondary/10 border border-secondary/20 rounded-xl backdrop-blur-sm">
            <div className="text-center mb-3">
              <h4 className="text-white font-semibold text-sm mb-1">Quick Add Appointment</h4>
              <p className="text-white/60 text-xs">For walk-ins, phone bookings, or admin purposes</p>
            </div>
            <Button
              onClick={() => setShowManualAppointmentForm(true)}
              className="w-full bg-secondary text-black hover:bg-secondary/90 font-semibold rounded-lg py-2.5 shadow-lg shadow-secondary/25 transition-all duration-200 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Appointment
            </Button>
          </div>
        )}

        {/* Events Panel */}
        {selectedDate && (
          <div className="events-panel">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-secondary" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            
            <div className="event-list">
              {getEventsForDate(selectedDate).length > 0 ? (
                getEventsForDate(selectedDate).map((event) => {
                  const eventEnd = new Date(event.end)
                  const now = new Date()
                  const isPast = eventEnd < now
                  const isUpcoming = new Date(event.start) > now
                  const isMissed = event.extendedProps.status === 'cancelled'
                  
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "event-item p-4 mb-3",
                        isMissed ? "missed" : isPast ? "past" : "upcoming"
                      )}
                      onClick={() => handleEventClick(event)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleEventClick(event)
                        }
                      }}
                      aria-label={`Event: ${event.title}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold text-sm mb-1">
                            {event.extendedProps.serviceName}
                          </h4>
                          <p className="text-white/80 text-xs mb-2">
                            {event.extendedProps.clientName}
                          </p>
                          <div className={cn(
                            "flex items-center text-xs",
                            isMissed ? "text-red-400" : isPast ? "text-green-400" : "text-secondary"
                          )}>
                            <Clock className={cn("w-3 h-3 mr-1", isMissed ? "text-red-400" : isPast ? "text-green-400" : "text-secondary")} />
                            <span className="font-medium">{formatTime(new Date(event.start))}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs font-semibold",
                              isMissed
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : isPast 
                                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                                  : "bg-secondary/20 text-secondary border-secondary/30"
                            )}
                          >
                            ${event.extendedProps.basePrice}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 mx-auto text-white/30 mb-3" />
                  <p className="text-white/60 text-sm">No events scheduled for this date</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="bg-black/95 backdrop-blur-3xl border border-white/20 max-w-lg mx-4 max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="pb-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  selectedEvent?.extendedProps.isBarberView 
                    ? "bg-blue-500/20" 
                    : "bg-secondary/20"
                )}>
                  {selectedEvent?.extendedProps.isBarberView ? (
                    <User className="w-6 h-6 text-blue-400" />
                  ) : (
                    <Scissors className="w-6 h-6 text-secondary" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-white text-2xl font-bold">
                    {selectedEvent?.extendedProps.isBarberView ? 'Client Booking' : 'My Appointment'}
                  </DialogTitle>
                  <DialogDescription className="text-white/70 text-sm">
                    {selectedEvent && formatDate(new Date(selectedEvent.start))}
                  </DialogDescription>
                </div>
              </div>
              <Badge 
                variant={selectedEvent?.extendedProps.status === 'confirmed' ? 'default' : 'secondary'}
                className={cn(
                  "text-xs font-semibold px-3 py-1",
                  selectedEvent?.extendedProps.status === 'cancelled' && "bg-red-500/20 text-red-400 border-red-500/30"
                )}
              >
                {selectedEvent?.extendedProps.status}
              </Badge>
            </div>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-6 overflow-y-auto flex-1 max-h-[65vh] pr-2">
              {/* Service Information */}
              <div className={cn(
                "rounded-2xl p-6 transition-all duration-300 border",
                selectedEvent.extendedProps.status === 'cancelled' 
                  ? "bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/20" 
                  : selectedEvent.extendedProps.isBarberView
                    ? "bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/20"
                    : "bg-secondary/10 border-secondary/30 shadow-lg shadow-secondary/20"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-bold text-xl mb-1">
                      {selectedEvent.extendedProps.serviceName}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {selectedEvent.extendedProps.isBarberView ? 'Client Request' : 'Your Service'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      ${selectedEvent.extendedProps.price}
                    </div>
                    <div className="text-white/60 text-xs">Total Amount</div>
                  </div>
                </div>
                
                {/* Role-specific Information */}
                <div className="space-y-4">
                  {selectedEvent.extendedProps.isBarberView ? (
                    // Barber View - Show Client Info
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Client</p>
                          <p className="text-white font-semibold text-lg">{selectedEvent.extendedProps.clientName}</p>
                          {selectedEvent.extendedProps.isGuest && (
                            <p className="text-blue-400 text-xs mt-1">Guest Booking</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Guest Contact Info */}
                      {selectedEvent.extendedProps.isGuest && (
                        <div className="space-y-3 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                          <h4 className="text-blue-400 font-semibold text-sm mb-3">Contact Information</h4>
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-blue-400" />
                            <span className="text-white/80 text-sm">{selectedEvent.extendedProps.guestEmail}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="w-4 h-4 text-blue-400" />
                            <span className="text-white/80 text-sm">{selectedEvent.extendedProps.guestPhone}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Client View - Show Barber Info
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="p-2 bg-secondary/20 rounded-lg">
                        <Scissors className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Barber</p>
                        <p className="text-white font-semibold text-lg">{selectedEvent.extendedProps.barberName}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Time Information */}
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Clock className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Appointment Time</p>
                      <p className="text-white font-semibold text-lg">
                        {formatTime(new Date(selectedEvent.start))} - {formatTime(new Date(selectedEvent.end))}
                      </p>
                      <p className="text-white/60 text-sm mt-1">
                        {formatDate(new Date(selectedEvent.start))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Price Breakdown */}
              {selectedEvent.extendedProps.addonTotal > 0 && (
                <div className="rounded-2xl p-6 bg-white/5 border border-white/10">
                  <h4 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-secondary" />
                    Price Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/80">Base Service</span>
                      <span className="text-white font-semibold">${selectedEvent.extendedProps.basePrice}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/80">Add-ons</span>
                      <span className="text-white font-semibold">${selectedEvent.extendedProps.addonTotal}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 pt-3">
                      <span className="text-white font-bold text-lg">Total</span>
                      <span className="text-secondary font-bold text-xl">${selectedEvent.extendedProps.price}</span>
                    </div>
                  </div>
                  
                  {/* Add-on Details */}
                  {selectedEvent.extendedProps.addonNames.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h5 className="text-white/60 text-sm mb-3">Selected Add-ons:</h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.extendedProps.addonNames.map((addonName, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-secondary/20 text-secondary border-secondary/30">
                            {addonName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Barber-specific Actions */}
                {selectedEvent.extendedProps.isBarberView && selectedEvent.extendedProps.status !== 'cancelled' && (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleMarkAsMissed}
                      disabled={isMarkingMissed}
                      variant="destructive"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {isMarkingMissed ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Marking as Missed...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          Mark as Missed
                        </>
                      )}
                    </Button>
                  </div>
                )}
                
                {/* Calendar Integration */}
                <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
                  <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-secondary" />
                    Add to Calendar
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (selectedEvent) {
                          try {
                            addToGoogleCalendar(
                              selectedEvent,
                              selectedEvent.extendedProps.isBarberView ? 'barber' : 'client',
                              {
                                name: (user as any)?.user_metadata?.full_name || (selectedEvent.extendedProps.isBarberView ? 'Barber' : 'Client'),
                                email: user?.email || '',
                                location: ''
                              }
                            )
                          } catch (error) {
                            logger.error('Error adding to Google Calendar', error)
                          }
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Google Calendar
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (selectedEvent) {
                          try {
                            downloadICalFile(
                              [selectedEvent],
                              selectedEvent.extendedProps.isBarberView ? 'barber' : 'client',
                              {
                                name: (user as any)?.user_metadata?.full_name || (selectedEvent.extendedProps.isBarberView ? 'Barber' : 'Client'),
                                email: user?.email || '',
                                location: ''
                              },
                              `appointment-${selectedEvent.id}.ics`
                            )
                          } catch (error) {
                            logger.error('Error downloading iCal file', error)
                          }
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download iCal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="pt-6 flex-shrink-0">
            <Button 
              onClick={() => setShowEventDialog(false)}
              className="w-full bg-secondary text-primary hover:bg-secondary/90 font-semibold py-3"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Appointment Form */}
      <ManualAppointmentForm
        isOpen={showManualAppointmentForm}
        onClose={() => setShowManualAppointmentForm(false)}
        selectedDate={selectedDate || undefined}
        onAppointmentCreated={(appointment) => {
          setShowManualAppointmentForm(false)
          // Refresh the calendar to show the new appointment
          fetchBookings()
        }}
      />
    </div>
  )
}