"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, DollarSign, Grid, Calendar, Scissors, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { logger } from '@/shared/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { EnhancedCalendar } from '@/shared/components/calendar/enhanced-calendar';
import { CalendarSyncSettings } from '@/shared/components/calendar-sync-settings';

interface CalendarEvent {
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
    clientName?: string;
    barberName?: string;
    price: number;
    basePrice: number;
    addons: { name: string; price: number }[];
    isGuest: boolean;
    guestEmail: string;
    guestPhone: string;
    isBarberView: boolean;
  };
}

export default function BarberCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState('timeGridWeek');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [userRole, setUserRole] = useState<'barber' | 'client' | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
    logger.debug('Barber calendar page loaded/reloaded');
  }, []);

  useEffect(() => {
    if (!user) return;
    logger.debug('Fetching bookings for user', { userId: user.id });
    
    const fetchBookings = async () => {
      setLoading(true);
      try {
        // First, check if user is a barber
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (barberData && !barberError) {
          // User is a barber - fetch their appointments
          setUserRole('barber');
          logger.debug('User is a barber, fetching barber appointments');
          
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('barber_id', barberData.id)
            .eq('payment_status', 'succeeded') // Only show successful payments
            .order('date', { ascending: true });
          
          if (error || !bookings) {
            logger.error('Error fetching barber bookings', error);
            setEvents([]);
            return;
          }
          
          // For each booking, fetch the related service and client
          const events = await Promise.all(bookings.map(async (booking) => {
            // Fetch service
            const { data: service } = await supabase
              .from('services')
              .select('name, duration, price')
              .eq('id', booking.service_id)
              .single();
            
            // Fetch client
            let client = null;
            if (booking.client_id) {
              const { data: clientData } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', booking.client_id)
                .single();
              client = clientData;
            }
            
            // Fetch add-ons for this booking
            let addonTotal = 0;
            let addonList: { name: string; price: number }[] = [];
            const { data: bookingAddons, error: bookingAddonsError } = await supabase
              .from('booking_addons')
              .select('addon_id')
              .eq('booking_id', booking.id);
            if (!bookingAddonsError && bookingAddons && bookingAddons.length > 0) {
              const addonIds = bookingAddons.map((ba) => ba.addon_id);
              const { data: addons, error: addonsError } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', addonIds);
              if (!addonsError && addons) {
                addonTotal = addons.reduce((sum, addon) => sum + (addon.price || 0), 0);
                addonList = addons.map(a => ({ name: a.name, price: a.price }));
              }
            }
            
            const startDate = new Date(booking.date);
            const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000);
            
            return {
              id: booking.id,
              title: `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`,
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              backgroundColor: 'var(--secondary)',
              borderColor: 'var(--secondary)',
              textColor: '#FFFFFF',
              extendedProps: {
                status: booking.status,
                serviceName: service?.name || '',
                clientName: client?.name || booking.guest_name || 'Guest',
                price: (service?.price || booking.price || 0) + addonTotal,
                basePrice: service?.price || booking.price || 0,
                addons: addonList,
                isGuest: !client,
                guestEmail: booking.guest_email,
                guestPhone: booking.guest_phone,
                isBarberView: true
              }
            };
          }));
          
          setEvents(events);
        } else {
          // User is a client - fetch their appointments
          setUserRole('client');
          logger.debug('User is a client, fetching client appointments', { userId: user.id });
          
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
              *,
              barbers:barber_id(
                id,
                user_id,
                profiles:user_id(name, avatar_url)
              ),
              services:service_id(name, duration, price)
            `)
            .eq('client_id', user.id)
            .eq('payment_status', 'succeeded') // Only show successful payments
            .order('date', { ascending: true });
          
          logger.debug('Client bookings query result', { count: bookings?.length, error });
          
          if (error || !bookings) {
            logger.error('Error fetching client bookings', error);
            setEvents([]);
            return;
          }
          
          logger.debug(`Found ${bookings.length} bookings for client`);
          
          // For each booking, fetch add-ons
          const events = await Promise.all(bookings.map(async (booking, index) => {
            logger.debug(`Processing booking ${index + 1}`, { bookingId: booking.id });
            
            // Fetch add-ons for this booking
            let addonTotal = 0;
            let addonList: { name: string; price: number }[] = [];
            const { data: bookingAddons, error: bookingAddonsError } = await supabase
              .from('booking_addons')
              .select('addon_id')
              .eq('booking_id', booking.id);
            if (!bookingAddonsError && bookingAddons && bookingAddons.length > 0) {
              const addonIds = bookingAddons.map((ba) => ba.addon_id);
              const { data: addons, error: addonsError } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', addonIds);
              if (!addonsError && addons) {
                addonTotal = addons.reduce((sum, addon) => sum + (addon.price || 0), 0);
                addonList = addons.map(a => ({ name: a.name, price: a.price }));
              }
            }
            
            const startDate = new Date(booking.date);
            const endDate = new Date(startDate.getTime() + (booking.services?.duration || 60) * 60000);
            
            const event = {
              id: booking.id,
              title: `${booking.services?.name || 'Service'} with ${booking.barbers?.profiles?.name || 'Barber'}`,
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              backgroundColor: 'var(--secondary)',
              borderColor: 'var(--secondary)',
              textColor: '#FFFFFF',
              extendedProps: {
                status: booking.status,
                serviceName: booking.services?.name || '',
                barberName: booking.barbers?.profiles?.name || 'Barber',
                price: (booking.services?.price || booking.price || 0) + addonTotal,
                basePrice: booking.services?.price || booking.price || 0,
                addons: addonList,
                isGuest: false,
                guestEmail: booking.guest_email,
                guestPhone: booking.guest_phone,
                isBarberView: false
              }
            };
            
            return event;
          }));
          
          logger.debug(`Final events array: ${events.length} events`);
          setEvents(events);
        }
      } catch (error) {
        logger.error('Error fetching bookings', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
  }, [user]);

  const handleEventClick = (info: any) => {
    const event = info.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      textColor: event.textColor,
      extendedProps: event.extendedProps
    });
    setShowEventDialog(true);
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
  };

  // Use a fixed visible time range for the calendar
  const slotMinTime = "06:00:00";
  const slotMaxTime = "23:00:00";

  const customStyles = `
    .barber-calendar {
      background: transparent;
      color: white;
    }
    .barber-calendar .fc {
      background: transparent;
      border-radius: 0;
      overflow: hidden;
      border: none;
    }
    .barber-calendar .fc-header-toolbar {
      background: transparent;
      padding: 0;
      border-bottom: none;
    }
    .barber-calendar .fc-toolbar-title {
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .barber-calendar .fc-button {
      background: rgba(var(--secondary), 0.2) !important;
      border: 1px solid rgba(var(--secondary), 0.3) !important;
      color: var(--secondary) !important;
      border-radius: 12px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    .barber-calendar .fc-button:hover {
      background: rgba(var(--secondary), 0.3) !important;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(var(--secondary), 0.3);
    }
    .barber-calendar .fc-button-active {
      background: var(--secondary) !important;
      color: white !important;
      box-shadow: 0 8px 25px rgba(var(--secondary), 0.4);
    }
    .barber-calendar .fc-col-header {
      background: rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
    }
    .barber-calendar .fc-col-header-cell {
      color: white;
      font-weight: 600;
      padding: 1.5rem 0.5rem;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .barber-calendar .fc-col-header-cell .fc-col-header-cell-cushion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      text-decoration: none !important;
      color: white !important;
      font-weight: 600;
      font-size: 1.1rem;
      line-height: 1.1;
      height: 3.2rem;
      min-width: 2.5rem;
      padding: 0.2rem 0;
    }
    /* Only apply stacked header styles for week view, not month view */
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      text-decoration: none !important;
      color: white !important;
      font-weight: 600;
      font-size: 1.1rem;
      line-height: 1.1;
      height: 2.2rem;
      min-width: 2.5rem;
      padding: 0.2rem 0;
    }
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion .weekday-initial {
      font-size: 1.2rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--secondary);
      display: block;
    }
    .barber-calendar .fc-timeGridWeek-view .fc-col-header-cell .fc-col-header-cell-cushion .day-number {
      font-size: 1.4rem;
      font-weight: bold;
      color: white;
      line-height: 1.1;
      display: block;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-header .fc-col-header-cell:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body .fc-timegrid-axis {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body .fc-timegrid-axis-cushion {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid .fc-scrollgrid .fc-scrollgrid-section-body tr > td:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid-slot-label {
      color: rgba(255, 255, 255, 0.8) !important;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .barber-calendar .fc-timegrid-slot {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      height: 60px;
    }
    .barber-calendar .fc-timegrid-slot-lane {
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-daygrid-day {
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      background: rgba(255, 255, 255, 0.05);
    }
    .barber-calendar .fc-day-today {
      background: rgba(var(--secondary), 0.2) !important;
      border: 2px solid rgba(var(--secondary), 0.5) !important;
    }
    .barber-calendar .fc-timegrid-now-indicator-line {
      border-color: var(--secondary) !important;
      border-width: 3px !important;
      box-shadow: 0 0 10px rgba(var(--secondary), 0.5);
    }
    .barber-calendar .fc-timegrid-now-indicator-arrow {
      border-color: var(--secondary) !important;
      box-shadow: 0 0 10px rgba(var(--secondary), 0.5);
    }
    .barber-calendar .fc-event {
      border-radius: 12px !important;
      border: 2px solid rgba(var(--secondary), 0.5) !important;
      background: var(--secondary) !important;
      color: white !important;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(var(--secondary), 0.3);
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    .barber-calendar .fc-event *,
    .barber-calendar .fc-event-main {
      color: white !important;
    }
    .barber-calendar .fc-event:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 12px 35px rgba(var(--secondary), 0.4);
      border-color: rgba(var(--secondary), 0.8) !important;
      background: var(--secondary) !important;
    }
    .barber-calendar .fc-scrollgrid {
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
    .barber-calendar .fc-scrollgrid-section > * {
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    .barber-calendar .fc-timegrid-event .fc-event-title,
    .barber-calendar .fc-timegrid-event .fc-event-main {
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
      display: block !important;
    }
    .barber-calendar .fc-daygrid-day-number {
      color: white !important;
      font-weight: 600;
    }
    .barber-calendar .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
      color: var(--secondary) !important;
      font-weight: bold;
    }
    .barber-calendar .fc-daygrid-day.fc-day-other .fc-daygrid-day-number {
      color: rgba(255, 255, 255, 0.5) !important;
    }
    /* Enhanced more link */
    .barber-calendar .fc-more-link {
      background: var(--secondary);
      color: white !important;
      font-weight: bold;
      border-radius: 9999px;
      padding: 0.25em 1em;
      box-shadow: 0 2px 8px rgba(var(--secondary), 0.25);
      border: none;
      font-size: 1.1em;
      letter-spacing: 0.5px;
      transition: box-shadow 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.25em;
      margin-bottom: 0.25em;
      cursor: pointer;
      text-align: center;
      min-width: 2.2em;
    }
    .barber-calendar .fc-more-link::after {
      content: "" !important;
      display: none !important;
    }
    .barber-calendar .fc-more-link:hover {
      background: var(--secondary);
      box-shadow: 0 4px 16px rgba(var(--secondary), 0.35);
      color: white !important;
      text-decoration: none;
      outline: none;
    }
    .barber-calendar .fc-popover, .barber-calendar .fc-more-popover {
      background: rgba(255,255,255,0.05) !important;
      border: 1.5px solid var(--secondary) !important;
      border-radius: 1rem !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important;
      backdrop-filter: blur(12px) !important;
      color: white !important;
      padding: 0.5rem 0.75rem !important;
    }
    .barber-calendar .fc-popover .fc-popover-header, .barber-calendar .fc-more-popover .fc-popover-header {
      background: transparent !important;
      border-bottom: 1px solid var(--secondary) !important;
      color: var(--secondary) !important;
      font-weight: 600;
      font-size: 1rem;
      border-radius: 1rem 1rem 0 0 !important;
    }
    .barber-calendar .fc-popover .fc-popover-close, .barber-calendar .fc-more-popover .fc-popover-close {
      color: var(--secondary) !important;
      opacity: 0.8;
      font-size: 1.2rem;
      transition: opacity 0.2s;
    }
    .barber-calendar .fc-popover .fc-popover-close:hover, .barber-calendar .fc-more-popover .fc-popover-close:hover {
      opacity: 1;
    }
    .barber-calendar .fc-popover .fc-daygrid-event-harness .fc-event, .barber-calendar .fc-more-popover .fc-daygrid-event-harness .fc-event {
      background: var(--secondary) !important;
      color: white !important;
      border-radius: 0.75rem !important;
      border: none !important;
      box-shadow: 0 2px 8px rgba(38,43,46,0.15);
      font-weight: 600;
      margin-bottom: 0.5rem;
      padding: 0.5rem 1rem;
      transition: box-shadow 0.2s, background 0.2s;
    }
    .barber-calendar .fc-popover .fc-daygrid-event-harness .fc-event:hover, .barber-calendar .fc-more-popover .fc-daygrid-event-harness .fc-event:hover {
      box-shadow: 0 4px 16px rgba(var(--secondary), 0.25);
      background: var(--secondary) !important;
    }
    .barber-calendar .fc-popover .fc-daygrid-event-harness .fc-event .text-secondary, .barber-calendar .fc-more-popover .fc-daygrid-event-harness .fc-event .text-secondary {
      color: var(--secondary) !important;
    }
    /* Today button and view toggles */
    .barber-calendar .calendar-today-btn,
    .barber-calendar .calendar-view-toggle-active {
      background: var(--secondary) !important;
      color: white !important;
      border: none !important;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(var(--secondary), 0.25);
    }
    .barber-calendar .calendar-today-btn:hover,
    .barber-calendar .calendar-view-toggle-active:hover {
      background: var(--secondary) !important;
    }
    /* Icon backgrounds */
    .barber-calendar .calendar-header-icon {
      background: var(--secondary) !important;
      color: white !important;
      border-radius: 1rem;
      box-shadow: 0 2px 8px rgba(var(--secondary), 0.15);
    }
  `;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-secondary mx-auto"></div>
          <p className="text-white mt-4 text-lg">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="relative z-10 container mx-auto px-4 py-8 pb-32 flex flex-col items-center">
        {/* Header */}
        <div className="mb-6 sm:mb-8 w-full">
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-secondary/20 rounded-xl">
              <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bebas text-white tracking-wide">
                {userRole === 'barber' ? 'Appointment Calendar' : 'My Appointments'}
              </h1>
              <p className="text-white/70 text-sm sm:text-lg">
                {userRole === 'barber' 
                  ? 'View your bookings and schedule' 
                  : 'View your upcoming appointments'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Calendar Sync Section */}
        <div className="w-full max-w-4xl mx-auto mb-8">
          <CalendarSyncSettings />
        </div>

        {/* Centered EnhancedCalendar */}
        <div className="w-full flex justify-center">
          <div className="max-w-2xl w-full mx-auto p-0 overflow-visible" style={{ maxWidth: '700px' }}>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                <p className="text-white/60">Loading appointments...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md mx-auto">
                  <CalendarIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
                  <h3 className="text-white font-bebas font-bold text-xl mb-2">
                    {userRole === 'barber' ? 'No appointments yet' : 'No upcoming appointments'}
                  </h3>
                  <p className="text-white/60 text-sm mb-6">
                    {userRole === 'barber' 
                      ? 'When clients book appointments with you, they will appear here.'
                      : 'Book your first appointment to see it here.'
                    }
                  </p>
                  <Button
                    onClick={() => window.location.href = userRole === 'barber' ? '/profile' : '/browse'}
                    className="bg-secondary text-primary hover:bg-secondary/90"
                  >
                    {userRole === 'barber' ? 'View Profile' : 'Browse Barbers'}
                  </Button>
                </div>
              </div>
            ) : (
              <EnhancedCalendar />
            )}
          </div>
        </div>
      </div>

      {showEventDialog && selectedEvent && (
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent className="max-w-md w-full max-h-[80vh] bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-2xl font-bold text-white">
                {selectedEvent.extendedProps.isBarberView ? 'Booking Details' : 'Appointment Details'}
              </DialogTitle>
              <DialogDescription className="text-white/80">
                {selectedEvent.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 max-h-[60vh] pr-2">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Service</span>
                <span className="text-white font-semibold">{selectedEvent.extendedProps.serviceName}</span>
              </div>
              {selectedEvent.extendedProps.isBarberView ? (
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Client</span>
                  <span className="text-white font-semibold">{selectedEvent.extendedProps.clientName}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Barber</span>
                  <span className="text-white font-semibold">{selectedEvent.extendedProps.barberName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white/70">Status</span>
                <span className="text-white font-semibold capitalize">{selectedEvent.extendedProps.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Date</span>
                <span className="text-white font-semibold">{formatDate(new Date(selectedEvent.start))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Time</span>
                <span className="text-white font-semibold">{formatTime(new Date(selectedEvent.start))} - {formatTime(new Date(selectedEvent.end))}</span>
              </div>
              <div className="border-t border-white/10 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-white/70">Base Price</span>
                <span className="text-white font-semibold">${selectedEvent.extendedProps.basePrice?.toFixed(2)}</span>
              </div>
              {selectedEvent.extendedProps.addons && selectedEvent.extendedProps.addons.length > 0 && (
                <div>
                  <div className="text-white/70 mb-1">Add-ons</div>
                  <ul className="space-y-1">
                    {selectedEvent.extendedProps.addons.map((addon, idx) => (
                      <li key={idx} className="flex items-center justify-between">
                        <span className="text-white/80">{addon.name}</span>
                        <span className="text-secondary font-semibold">+${addon.price?.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-2">
                <span className="text-white font-bold text-lg">Total</span>
                <span className="text-secondary font-bold text-lg">${selectedEvent.extendedProps.price?.toFixed(2)}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
    </div>
  );
} 