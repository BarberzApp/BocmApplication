import React, { useEffect, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Vibration,
  TextInput,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  DollarSign,
  X,
  Plus,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  Clock as ClockIcon
} from 'lucide-react-native';
import tw from 'twrnc';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { supabase } from '../shared/lib/supabase';
import { useAuth } from '../shared/hooks/useAuth';
import { theme } from '../shared/lib/theme';
import { logger } from '../shared/lib/logger';
import { ReviewForm } from '../shared/components/ReviewForm';
import { bookingService } from '../shared/lib/bookingService';
import { formatTimeSlot } from '../shared/lib/calendar/calendarUtils';
import { getBookingPricingData, getClientBookingDetails, getBarberBookingDetails } from '../shared/lib/bookingDetailsHelper';

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
    clientName: string;
    barberName: string;
    barberId: string;
    price: number;
    basePrice: number;
    addonTotal: number;
    platformFee: number;
    barberPayout: number;
    totalCharged: number;
    addonNames: string[];
    isGuest: boolean;
    guestEmail: string;
    guestPhone: string;
  };
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false);
  const [isMarkingMissed, setIsMarkingMissed] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'month'>('month');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [userRole, setUserRole] = useState<'client' | 'barber' | null>(null);
  const [barberViewMode, setBarberViewMode] = useState<'appointments' | 'bookings'>('appointments');
  
  // Manual appointment form state
  const [manualFormData, setManualFormData] = useState({
    clientName: '',
    serviceId: '',
    price: '',
    time: '',
    date: selectedDate || new Date()
  });
  const [services, setServices] = useState<Array<{id: string, name: string, price: number, duration: number}>>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState<Array<{time: string, available: boolean}>>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const manualFormScrollRef = useRef<ScrollView>(null);
  
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewFormData, setReviewFormData] = useState<{
    barberId: string;
    bookingId: string;
    isEditing?: boolean;
    reviewId?: string;
    initialRating?: number;
    initialComment?: string;
  } | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    if (!user) return;
    
    // Fetch user role first, then bookings
    const initializeData = async () => {
      const role = await fetchUserRole();
      if (role) {
        await fetchBookings(role);
      }
    };
    
    initializeData();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  }, [user]);

  // Fetch services when manual appointment modal opens
  useEffect(() => {
    if (showManualAppointmentForm) {
      fetchServices();
    }
  }, [showManualAppointmentForm]);

  // Fetch time slots when date or service changes
  useEffect(() => {
    if (showManualAppointmentForm && manualFormData.date && manualFormData.serviceId && barberId) {
      fetchTimeSlots();
    }
  }, [showManualAppointmentForm, manualFormData.date, manualFormData.serviceId, barberId]);

  // Auto-scroll to time section when time slots are loaded
  useEffect(() => {
    if (!loadingTimeSlots && timeSlots.length > 0 && manualFormScrollRef.current) {
      // Small delay to ensure layout is complete, then scroll to end to show time slots
      setTimeout(() => {
        manualFormScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [loadingTimeSlots, timeSlots.length]);

  // formatTimeSlot now imported from calendarUtils

  const fetchTimeSlots = async () => {
    if (!manualFormData.date || !manualFormData.serviceId || !barberId) {
      return;
    }

    try {
      setLoadingTimeSlots(true);
      const selectedService = services.find(s => s.id === manualFormData.serviceId);
      if (!selectedService) return;

      const dateStr = format(manualFormData.date, 'yyyy-MM-dd');
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('date')
        .eq('barber_id', barberId)
        .gte('date', `${dateStr}T00:00:00`)
        .lte('date', `${dateStr}T23:59:59`)
        .neq('status', 'cancelled');

      if (error) throw error;

      // Generate time slots based on service duration
      const slots: Array<{time: string, available: boolean}> = [];
      const bookedTimes = new Set((bookings || []).map(b => new Date(b.date).toISOString()));

      // Calculate slot interval based on service duration
      // Use the service duration as the interval, but minimum 10 minutes
      const slotInterval = Math.max(selectedService.duration, 10);
      
      // Start from 9 AM and go until 6 PM
      const startHour = 9;
      const endHour = 18;
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotInterval) {
          const slotTime = new Date(manualFormData.date);
          slotTime.setHours(hour, minute, 0, 0);
          
          // Skip if this would go past 6 PM
          const endTime = new Date(slotTime);
          endTime.setMinutes(endTime.getMinutes() + selectedService.duration);
          if (endTime.getHours() >= endHour) {
            continue;
          }
          
          const slotISO = slotTime.toISOString();
          const isBooked = bookedTimes.has(slotISO);
          
          // Check if there's enough time for the service
          let hasEnoughTime = true;
          if (!isBooked) {
            const serviceEndTime = new Date(slotTime);
            serviceEndTime.setMinutes(serviceEndTime.getMinutes() + selectedService.duration);
            
            for (const bookedTime of bookedTimes) {
              const booked = new Date(bookedTime);
              if (booked >= slotTime && booked < serviceEndTime) {
                hasEnoughTime = false;
                break;
              }
            }
          }

          slots.push({
            time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
            available: !isBooked && hasEnoughTime && slotTime > new Date()
          });
        }
      }

      setTimeSlots(slots);
    } catch (error) {
      logger.error('Error fetching time slots:', error);
      setTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  // Refresh calendar data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && userRole) {
        logger.log('🔄 [CALENDAR] Page focused - refreshing data...');
        fetchBookings(userRole);
      }
    }, [user, userRole])
  );

  const fetchUserRole = async () => {
    try {
      logger.log('🔍 [CALENDAR] Fetching user role for user ID:', user?.id);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      if (error) {
        logger.error('Error fetching user role:', error);
        return null;
      }
      
      logger.log('✅ [CALENDAR] User role detected:', profile.role);
      setUserRole(profile.role as 'client' | 'barber');
      return profile.role as 'client' | 'barber';
    } catch (error) {
      logger.error('Error fetching user role:', error);
      return null;
    }
  };

  const fetchBookings = async (role?: 'client' | 'barber') => {
    try {
      setLoading(true);
      const userRoleToUse = role || userRole;
      logger.log('Fetching bookings for user:', user?.id, 'with role:', userRoleToUse);
      
      if (userRoleToUse === 'barber') {
        logger.log('🔍 [CALENDAR] Fetching barber data for user ID:', user?.id);
        // Fetch the barber's ID from the barbers table
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user?.id)
          .single();
        
        logger.log('📊 [CALENDAR] Barber data result:', { barberData, barberError });
        
        if (barberError || !barberData) {
          logger.log('❌ [CALENDAR] No barber found for user');
          return;
        }

        logger.log('✅ [CALENDAR] Barber ID found:', barberData.id);
        
        let bookings: any[] = [];
        
        if (barberViewMode === 'appointments') {
          // Fetch appointments where barber is providing service (clients coming to barber)
          logger.log('📅 [CALENDAR] Fetching barber appointments (clients coming in)');
          const { data: appointmentsData, error: appointmentsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('barber_id', barberData.id)
            .order('date', { ascending: true });

          if (appointmentsError) {
            logger.error('❌ [CALENDAR] Error fetching barber appointments:', appointmentsError);
            return;
          }
          
          bookings = appointmentsData || [];
          logger.log('✅ [CALENDAR] Found', bookings.length, 'appointments for barber');
        } else {
          // Fetch bookings where barber is the client (barber going somewhere)
          logger.log('📅 [CALENDAR] Fetching barber bookings (barber going somewhere)');
          const { data: bookingsData, error: bookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('client_id', user?.id)
            .eq('payment_status', 'succeeded') // Only show successful payments
            .order('date', { ascending: true });

          if (bookingsError) {
            logger.error('❌ [CALENDAR] Error fetching barber bookings:', bookingsError);
            return;
          }
          
          bookings = bookingsData || [];
          logger.log('✅ [CALENDAR] Found', bookings.length, 'bookings for barber as client');
        }

        // Process barber bookings
        await processBookings(bookings, userRoleToUse);
      } else if (userRoleToUse === 'client') {
        // Fetch bookings where client is the user (same logic as barber bookings mode)
        logger.log('📅 [CALENDAR] Fetching client bookings (client going somewhere)');
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('client_id', user?.id)
          .eq('payment_status', 'succeeded') // Only show successful payments
          .order('date', { ascending: true });

        if (bookingsError) {
          logger.error('❌ [CALENDAR] Error fetching client bookings:', bookingsError);
          return;
        }

        const bookings = bookingsData || [];
        logger.log('✅ [CALENDAR] Found', bookings.length, 'bookings for client');
        // Process client bookings (same as barber bookings mode)
        await processBookings(bookings, userRoleToUse);
      }
    } catch (error) {
      logger.error('Error in fetchBookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const processBookings = async (bookings: any[], role?: 'client' | 'barber') => {
    try {
      const userRoleToUse = role || userRole;
      // Process each booking to create calendar events
      const events = await Promise.all(bookings.map(async (booking) => {
        // Fetch service details (for name and duration only)
        // Use booking.service_price for historical price accuracy
        const { data: service } = await supabase
          .from('services')
          .select('name, duration')
          .eq('id', booking.service_id)
          .single();

        // Fetch client details
        let client = null;
        if (booking.client_id) {
          const { data: clientData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', booking.client_id)
            .single();
          client = clientData;
        }

        // Fetch barber details for client view or barber bookings view
        let barber = null;
        if (userRoleToUse === 'client' || (userRoleToUse === 'barber' && barberViewMode === 'bookings')) {
          const { data: barberData } = await supabase
            .from('barbers')
            .select('user_id')
            .eq('id', booking.barber_id)
            .single();
          
          if (barberData) {
            const { data: barberProfile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', barberData.user_id)
              .single();
            barber = barberProfile;
          }
        }

        // Fetch add-ons for this booking
        let calculatedAddonTotal = 0;
        let addonNames: string[] = [];
        const { data: bookingAddons } = await supabase
          .from('booking_addons')
          .select('addon_id, price')
          .eq('booking_id', booking.id);

        if (bookingAddons && bookingAddons.length > 0) {
          // Use the stored addon prices from booking_addons table
          calculatedAddonTotal = bookingAddons.reduce((sum, ba) => sum + (ba.price || 0), 0);
          
          // Get addon names from service_addons table
          const addonIds = bookingAddons.map((ba) => ba.addon_id);
          const { data: addons } = await supabase
            .from('service_addons')
            .select('id, name')
            .in('id', addonIds);

          if (addons) {
            addonNames = addons.map(a => a.name);
          }
        }

        const startDate = new Date(booking.date);
        const endDate = new Date(startDate.getTime() + (service?.duration || 60) * 60000);

        // Create different titles based on user role and view mode
        let title = '';
        if (userRoleToUse === 'client') {
          title = `${service?.name || 'Service'} with ${barber?.name || 'Barber'}`;
        } else if (userRoleToUse === 'barber') {
          if (barberViewMode === 'appointments') {
            title = `${service?.name || 'Service'} - ${client?.name || booking.guest_name || 'Guest'}`;
          } else {
            title = `${service?.name || 'Service'} with ${barber?.name || 'Barber'}`;
          }
        }

        // Compute monetary fields using role-specific helpers
        // For clients or barbers viewing "My Bookings" (where they're the client), use client view
        // For barbers viewing "My Appointments" (where they're providing service), use barber view
        const isClientView = userRoleToUse === 'client' || (userRoleToUse === 'barber' && barberViewMode === 'bookings');
        
        // Use stored service_price from booking (historical price) if available,
        // otherwise fall back to fetching current service price
        let historicalServicePrice = booking.service_price || 0;
        if (!historicalServicePrice) {
          // Fallback: fetch current service price if historical price not stored
          const { data: currentService } = await supabase
            .from('services')
            .select('price')
            .eq('id', booking.service_id)
            .single();
          historicalServicePrice = currentService?.price || 0;
        }
        
        const breakdown = isClientView
          ? getClientBookingDetails({
              price: booking.price,
              platform_fee: booking.platform_fee,
              addon_total: calculatedAddonTotal || booking.addon_total,
            }, historicalServicePrice)
          : getBarberBookingDetails({
              price: booking.price,
              platform_fee: booking.platform_fee,
              barber_payout: booking.barber_payout,
              addon_total: calculatedAddonTotal || booking.addon_total,
            }, historicalServicePrice);

        return {
          id: booking.id,
          title,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.secondary,
          textColor: '#FFFFFF',
          extendedProps: {
            status: booking.status,
            serviceName: service?.name || '',
            clientName: client?.name || booking.guest_name || 'Guest',
            barberName: barber?.name || 'Barber',
            barberId: booking.barber_id, // Add barber_id for review functionality
            price: breakdown.total, // Total charged to client or barber payout
            basePrice: breakdown.servicePrice,
            addonTotal: breakdown.addons,
            platformFee: breakdown.platformFee,
            barberPayout: breakdown.barberPayout || 0,
            totalCharged: breakdown.total,
            addonNames,
            isGuest: !client,
            guestEmail: booking.guest_email,
            guestPhone: booking.guest_phone
          }
        };
      }));

      setEvents(events);
    } catch (error) {
      logger.error('Error processing bookings:', error);
      Alert.alert('Error', 'Failed to load calendar events');
    }
  };

  const handleBarberViewToggle = async (mode: 'appointments' | 'bookings') => {
    setBarberViewMode(mode);
    Vibration.vibrate(30); // Light haptic feedback
    await fetchBookings(userRole || undefined);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Vibration.vibrate(50); // Light haptic feedback
    await fetchBookings(userRole || undefined);
    setRefreshing(false);
  };

  const getCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDate = (date: Date) => {
    let filteredEvents = events;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filteredEvents = events.filter(event => event.extendedProps.status === filterStatus);
    }
    
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  };

  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  const hasPastEvents = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    return dateEvents.some(event => {
      const eventDate = new Date(event.start);
      return eventDate < new Date() && event.extendedProps.status !== 'completed';
    });
  };

  const hasUpcomingEvents = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    return dateEvents.some(event => {
      const eventDate = new Date(event.start);
      return eventDate >= new Date();
    });
  };

  const prevMonth = () => {
    Vibration.vibrate(30); // Light haptic feedback
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    Vibration.vibrate(30); // Light haptic feedback
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const goToToday = () => {
    Vibration.vibrate(50); // Medium haptic feedback
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    Vibration.vibrate(20); // Light haptic feedback
    setSelectedDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    Vibration.vibrate(30); // Light haptic feedback
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleMarkAsMissed = async () => {
    if (!selectedEvent) return;

    setIsMarkingMissed(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'missed' })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      Vibration.vibrate(100); // Success haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as missed`);
      setShowEventDialog(false);
      fetchBookings(); // Refresh events
    } catch (error) {
      logger.error('Error marking as missed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Error', `Failed to mark ${itemType} as missed`);
    } finally {
      setIsMarkingMissed(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!selectedEvent) return;

    setIsMarkingCompleted(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      Vibration.vibrate(100); // Success haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Success', `${itemTypeCapitalized} marked as completed`);
      setShowEventDialog(false);
      fetchBookings(); // Refresh events
    } catch (error) {
      logger.error('Error marking as completed:', error);
      Vibration.vibrate([100, 100]); // Error haptic feedback
      const itemType = userRole === 'barber' && barberViewMode === 'appointments' ? 'appointment' : 'booking';
      const itemTypeCapitalized = userRole === 'barber' && barberViewMode === 'appointments' ? 'Appointment' : 'Booking';
      Alert.alert('Error', `Failed to mark ${itemType} as completed`);
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  const handleLeaveReview = async () => {
    if (!selectedEvent) return;
    
    // Barbers can only leave reviews in "My Bookings" tab (when they're the client)
    // They cannot leave reviews in "My Appointments" tab (when they're the service provider)
    if (userRole === 'barber' && barberViewMode === 'appointments') {
      Alert.alert('Info', 'You can only leave reviews for bookings where you are the client (My Bookings tab)');
      return;
    }

    setReviewFormData({
      barberId: selectedEvent.extendedProps.barberId,
      bookingId: selectedEvent.id,
      isEditing: false
    });
    setShowReviewForm(true);
    setShowEventDialog(false);
  };

  const handleCancelBooking = async () => {
    if (!selectedEvent) return;

    // Determine if this is an appointment or booking based on view mode
    const isAppointment = userRole === 'barber' && barberViewMode === 'appointments';
    const itemType = isAppointment ? 'appointment' : 'booking';
    const itemTypeCapitalized = isAppointment ? 'Appointment' : 'Booking';

    // Show confirmation dialog
    Alert.alert(
      `Cancel ${itemTypeCapitalized}`,
      `Are you sure you want to cancel this ${itemType}? This action cannot be undone.`,
      [
        {
          text: `Keep ${itemTypeCapitalized}`,
          style: 'cancel'
        },
        {
          text: `Cancel ${itemTypeCapitalized}`,
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingService.cancelBooking(selectedEvent.id);
              Vibration.vibrate(100); // Success haptic feedback
              Alert.alert('Success', `${itemTypeCapitalized} cancelled successfully`);
              setShowEventDialog(false);
              fetchBookings(); // Refresh events
            } catch (error) {
              logger.error(`Error cancelling ${itemType}:`, error);
              Vibration.vibrate([100, 100]); // Error haptic feedback
              Alert.alert('Error', `Failed to cancel ${itemType}. Please try again.`);
            }
          }
        }
      ]
    );
  };

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

  const getGlowOpacity = () => {
    return glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    });
  };

  // Fetch services for manual appointment form
  const fetchServices = async () => {
    try {
      // First check if user exists
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Check if barber profile exists
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id, onboarding_complete')
        .eq('user_id', user?.id)
        .single();

      if (barberError) {
        logger.error('Barber not found:', barberError);
        Alert.alert(
          'Profile Setup Required', 
          'You need to complete your barber profile setup first. Please go to Settings to set up your profile.',
          [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
        );
        return;
      }

      // Check if onboarding is complete
      if (!barberData.onboarding_complete) {
        Alert.alert(
          'Profile Setup Incomplete', 
          'Please complete your profile setup before creating appointments.',
          [{ text: 'OK', onPress: () => setShowManualAppointmentForm(false) }]
        );
        return;
      }

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('barber_id', barberData.id)
        .order('name');

      if (servicesError) {
        logger.error('Error fetching services:', servicesError);
        setServices([]);
        return;
      }

      setServices(servicesData || []);
      setBarberId(barberData.id);
      
      if (!servicesData || servicesData.length === 0) {
        Alert.alert(
          'No Services Found', 
          'You need to add services to your profile before creating manual appointments. Please go to Settings to add your services.',
          [
            { text: 'OK', onPress: () => setShowManualAppointmentForm(false) }
          ]
        );
      }
    } catch (error) {
      logger.error('Error fetching services:', error);
      setServices([]);
    }
  };

  // Handle manual appointment form submission
  const handleManualAppointmentSubmit = async () => {
    if (!manualFormData.clientName || !manualFormData.serviceId || !manualFormData.time) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get barber ID
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (barberError) throw barberError;

      // Get selected service
      const selectedService = services.find(s => s.id === manualFormData.serviceId);
      if (!selectedService) throw new Error('Service not found');

      // Parse time and create appointment date
      const [time, period] = manualFormData.time.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let hour = hours;
      if (period === 'PM' && hours !== 12) hour += 12;
      if (period === 'AM' && hours === 12) hour = 0;

      const appointmentDate = new Date(manualFormData.date);
      appointmentDate.setHours(hour, minutes, 0, 0);

      // Compute end_time using service duration
      const endTime = new Date(appointmentDate.getTime() + (selectedService.duration || 60) * 60000);

      // Simple conflict check: overlapping non-cancelled bookings
      const { data: conflicts, error: conflictError } = await supabase
        .from('bookings')
        .select('id')
        .eq('barber_id', barberData.id)
        .neq('status', 'cancelled')
        .or(`and(date.lt.${endTime.toISOString()},end_time.gt.${appointmentDate.toISOString()})`);

      if (conflictError) throw conflictError;
      if (conflicts && conflicts.length > 0) {
        Alert.alert('Time Conflict', 'This time overlaps an existing booking.');
        return;
      }

      // Create booking using API to keep behavior consistent (adds notifications)
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barber_id: barberData.id,
          service_id: manualFormData.serviceId,
          date: appointmentDate.toISOString(),
          end_time: endTime.toISOString(),
          status: 'confirmed',
          payment_status: 'succeeded',
          price: selectedService.price,
          guest_name: manualFormData.clientName,
          guest_email: '',
          guest_phone: '',
          notes: 'Manual appointment created by barber'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create appointment');
      }

      Alert.alert('Success', 'Manual appointment created successfully');
      setShowManualAppointmentForm(false);
      setManualFormData({
        clientName: '',
        serviceId: '',
        price: '',
        time: '',
        date: selectedDate || new Date()
      });
      fetchBookings(); // Refresh calendar
    } catch (error) {
      logger.error('Error creating manual appointment:', error);
      Alert.alert('Error', 'Failed to create appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update form data when service is selected
  const handleServiceSelect = (serviceId: string) => {
    const selectedService = services.find(s => s.id === serviceId);
    setManualFormData(prev => ({
      ...prev,
      serviceId,
      price: selectedService ? selectedService.price.toString() : ''
    }));
  };

  const handleDateSelect = (date: Date) => {
    setManualFormData(prev => ({
      ...prev,
      date: date,
      time: '' // Clear time when date changes
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
          <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
            Loading Calendar...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      <Animated.View 
        style={[
          tw`flex-1`,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.secondary}
              colors={[theme.colors.secondary]}
              progressBackgroundColor="rgba(0, 0, 0, 0.3)"
            />
          }
        >
        {/* Title */}
        <View style={tw`px-4 pt-4 pb-2`}>
          <Text style={[tw`text-2xl font-bold mb-4`, { color: theme.colors.foreground }]}>
            Calendar
          </Text>
          
          {/* Barber View Toggle */}
          {userRole === 'barber' && (
            <View style={[tw`flex-row mb-4 p-1 rounded-xl`, { 
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }]}>
              <TouchableOpacity
                onPress={() => handleBarberViewToggle('appointments')}
                style={[
                  tw`flex-1 py-3 px-4 rounded-lg items-center`,
                  barberViewMode === 'appointments' 
                    ? { 
                        backgroundColor: theme.colors.secondary,
                        shadowColor: theme.colors.secondary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }
                    : { backgroundColor: 'transparent' }
                ]}
              >
                <Text style={[
                  tw`font-semibold text-sm`,
                  barberViewMode === 'appointments' 
                    ? { color: 'white' }
                    : { color: theme.colors.mutedForeground }
                ]}>
                  My Appointments
                </Text>
                <Text style={[
                  tw`text-xs mt-1`,
                  barberViewMode === 'appointments' 
                    ? { color: 'rgba(255,255,255,0.8)' }
                    : { color: theme.colors.mutedForeground }
                ]}>
                  Clients Coming In
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => handleBarberViewToggle('bookings')}
                style={[
                  tw`flex-1 py-3 px-4 rounded-lg items-center`,
                  barberViewMode === 'bookings' 
                    ? { 
                        backgroundColor: theme.colors.secondary,
                        shadowColor: theme.colors.secondary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }
                    : { backgroundColor: 'transparent' }
                ]}
              >
                <Text style={[
                  tw`font-semibold text-sm`,
                  barberViewMode === 'bookings' 
                    ? { color: 'white' }
                    : { color: theme.colors.mutedForeground }
                ]}>
                  My Bookings
                </Text>
                <Text style={[
                  tw`text-xs mt-1`,
                  barberViewMode === 'bookings' 
                    ? { color: 'rgba(255,255,255,0.8)' }
                    : { color: theme.colors.mutedForeground }
                ]}>
                  Going Somewhere
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

          {/* Single Main Calendar Container - Enhanced with glow */}
          <Animated.View 
            style={[
              tw`mx-5 mb-6 p-6 rounded-3xl`,
              { 
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                              shadowColor: theme.colors.secondary,
              shadowOffset: { width: 0, height: 15 },
              shadowOpacity: 0.2,
              shadowRadius: 30,
                elevation: 15
              }
            ]}
            >
            {/* Header with Navigation - Enhanced */}
            <View style={[tw`flex-row items-center justify-between mb-6 p-4 rounded-2xl`, {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 32,
              elevation: 8
            }]}>
            <TouchableOpacity
                testID="prev-month-button"
                onPress={prevMonth}
                style={[tw`p-3 rounded-2xl items-center justify-center`, {
                  backgroundColor: `${theme.colors.secondary}15`,
                  borderWidth: 1,
                  borderColor: `${theme.colors.secondary}30`,
                  minWidth: 52,
                  minHeight: 52
                }]}
              >
              <ChevronLeft size={24} color={theme.colors.secondary} />
            </TouchableOpacity>
              <Text style={[tw`text-xl font-bold text-center flex-1 mx-6`, { 
                color: theme.colors.foreground,
                textShadowColor: 'rgba(0, 0, 0, 0.3)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4
              }]}>
                {`${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
            </Text>
              <TouchableOpacity 
                testID="next-month-button"
                onPress={nextMonth}
                style={[tw`p-3 rounded-2xl items-center justify-center`, {
                  backgroundColor: `${theme.colors.secondary}15`,
                  borderWidth: 1,
                  borderColor: `${theme.colors.secondary}30`,
                  minWidth: 52,
                  minHeight: 52
                }]}
              >
              <ChevronRight size={24} color={theme.colors.secondary} />
            </TouchableOpacity>
          </View>

            {/* Weekdays Header */}
            <View style={[tw`flex-row mb-4 px-4`]}>
            {weekdays.map((day, index) => (
                <View key={index} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={[tw`text-xs font-bold uppercase tracking-wider text-center`, { 
                    color: theme.colors.secondary,
                    fontSize: 12,
                    textShadowColor: 'rgba(0, 0, 0, 0.3)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2
                  }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
            <View style={[tw`flex-row flex-wrap px-4`]}>
            {getCalendarDays().map((date, index) => {
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isTodayDate = isToday(date);
              const dateEvents = getEventsForDate(date);
              const hasPast = hasPastEvents(date);
              const hasUpcoming = hasUpcomingEvents(date);

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleDateClick(date)}
                    style={{
                      width: `${100 / 7}%`,
                      height: 45,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginVertical: 4,
                      borderRadius: 14,
                      backgroundColor: isCurrentMonth 
                        ? 'rgba(255,255,255,0.02)' 
                        : 'rgba(255,255,255,0.005)',
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected 
                        ? theme.colors.secondary 
                        : 'rgba(255,255,255,0.03)',
                      transform: [{ scale: isSelected ? 1.02 : 1 }],
                      shadowColor: isSelected ? theme.colors.secondary : 'transparent',
                      shadowOffset: { width: 0, height: isSelected ? 1 : 0 },
                      shadowOpacity: isSelected ? 0.08 : 0,
                      shadowRadius: isSelected ? 6 : 0,
                      elevation: isSelected ? 1 : 0,
                    }}
                >
                  <Text style={[
                      tw`font-semibold`,
                      {
                        fontSize: screenWidth < 400 ? 14 : 16,
                        lineHeight: screenWidth < 400 ? 18 : 20,
                        textAlign: 'center',
                        color: isSelected || isTodayDate 
                          ? theme.colors.secondary 
                          : isCurrentMonth 
                            ? theme.colors.foreground 
                            : 'rgba(255,255,255,0.15)',
                      }
                  ]}>
                    {date.getDate()}
                  </Text>
                  
                    {/* Event indicators */}
                  {dateEvents.length > 0 && (
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                      {hasPast && (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                      )}
                      {hasUpcoming && (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary }} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

            {/* Today Button - Enhanced with glow */}
            <Animated.View
              style={{
                shadowColor: theme.colors.secondary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 15,
                elevation: 5,
              }}
            >
              <TouchableOpacity
                onPress={goToToday}
                style={[tw`mt-6 py-4 rounded-2xl items-center`, {
                  backgroundColor: theme.colors.secondary,
                  shadowColor: theme.colors.secondary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 25,
                  elevation: 8
                }]}
              >
                <Text style={[tw`font-bold text-lg`, { 
                  color: theme.colors.primaryForeground,
                  textShadowColor: 'rgba(0, 0, 0, 0.2)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2
                }]}>
                  Today
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Manual Appointment Button - Only for Barbers in Appointments Mode */}
            {/* TODO: Re-enable manual appointment feature later */}
            {/* {userRole === 'barber' && barberViewMode === 'appointments' && (
              <View style={[tw`mt-4 p-4 rounded-2xl`, {
                backgroundColor: `${theme.colors.secondary}10`,
                borderWidth: 1,
                borderColor: `${theme.colors.secondary}20`
              }]}>
                <View style={tw`items-center mb-3`}>
                  <Text style={[tw`font-semibold text-sm mb-1`, { color: theme.colors.foreground }]}>
                    Quick Add Appointment
                  </Text>
                  <Text style={[tw`text-xs`, { color: 'rgba(255,255,255,0.6)' }]}>
                    For walk-ins, phone bookings, or admin purposes
                  </Text>
        </View>
                <TouchableOpacity
                  onPress={() => setShowManualAppointmentForm(true)}
                  style={[tw`py-3 rounded-xl items-center flex-row justify-center`, {
                    backgroundColor: theme.colors.secondary,
                    shadowColor: theme.colors.secondary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4
                  }]}
                >
                  <Plus size={16} color={theme.colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                    Add Manual Appointment
                  </Text>
                </TouchableOpacity>
              </View>
            )} */}

            {/* Events Panel - Enhanced */}
        {selectedDate && (
              <View style={[tw`mt-6 p-6 rounded-2xl`, {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 32,
                elevation: 8
              }]}>
              <View style={tw`flex-row items-center mb-4`}>
                <CalendarIcon size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`font-bold text-lg`, { color: theme.colors.foreground }]}>
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>
              </View>
            
              <ScrollView style={tw`max-h-80`} showsVerticalScrollIndicator={false}>
            {getEventsForDate(selectedDate).length === 0 ? (
                  <View style={tw`items-center py-8`}>
                    <CalendarIcon size={48} color="rgba(255,255,255,0.3)" style={tw`mb-3`} />
                    <Text style={[tw`text-sm`, { color: 'rgba(255,255,255,0.6)' }]}>
                      No events scheduled for this date
                </Text>
              </View>
            ) : (
              <View style={tw`space-y-3`}>
                    {getEventsForDate(selectedDate).map((event) => {
                      const eventEnd = new Date(event.end);
                      const now = new Date();
                      const isPast = eventEnd < now;
                      const isUpcoming = new Date(event.start) > now;
                      const isMissed = event.extendedProps.status === 'cancelled';
                      
                      return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => handleEventClick(event)}
                          style={[tw`p-4 rounded-2xl`, {
                            backgroundColor: isMissed 
                              ? 'rgba(239, 68, 68, 0.08)' 
                              : isPast 
                                ? 'rgba(34, 197, 94, 0.08)' 
                                : `${theme.colors.secondary}08`,
                            borderWidth: 1,
                            borderColor: isMissed 
                              ? 'rgba(239, 68, 68, 0.2)' 
                              : isPast 
                                ? 'rgba(34, 197, 94, 0.2)' 
                              : `${theme.colors.secondary}20`
                          }]}
                  >
                          <View style={tw`flex-row items-center justify-between`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`font-semibold text-sm mb-1`, { color: theme.colors.foreground }]}>
                        {event.extendedProps.serviceName}
                      </Text>
                              <Text style={[tw`text-xs mb-2`, { color: 'rgba(255,255,255,0.8)' }]}>
                        {event.extendedProps.clientName}
                      </Text>
                              <View style={tw`flex-row items-center`}>
                                <Clock size={12} color={isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary} style={tw`mr-1`} />
                                <Text style={[tw`text-xs font-medium`, { 
                                  color: isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary 
                                }]}>
                                  {formatTime(new Date(event.start))}
                      </Text>
                    </View>
                            </View>
                            <View style={[tw`px-2 py-1 rounded-full`, {
                              backgroundColor: isMissed 
                                ? 'rgba(239, 68, 68, 0.2)' 
                                : isPast 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : `${theme.colors.secondary}20`,
                              borderWidth: 1,
                              borderColor: isMissed 
                                ? 'rgba(239, 68, 68, 0.3)' 
                                : isPast 
                                  ? 'rgba(34, 197, 94, 0.3)' 
                                  : `${theme.colors.secondary}30`
                            }]}>
                              <Text style={[tw`text-xs font-semibold`, { 
                                color: isMissed ? '#ef4444' : isPast ? '#22c55e' : theme.colors.secondary 
                              }]}>
                                ${(() => {
                                  if (userRole === 'client') {
                                    // Always recalculate to ensure accuracy
                                    // Total = service price + addons + platform fee
                                    let basePrice = event.extendedProps.basePrice || 0;
                                    const addons = event.extendedProps.addonTotal || 0;
                                    let platformFee = event.extendedProps.platformFee || 0;
                                    
                                    // If basePrice is 0 but we have a platformFee, try to get service price from price field
                                    // For non-developer bookings: price = platform_fee + barber_payout (platform fee total)
                                    // If basePrice is missing, we can't calculate accurately, but we'll use what we have
                                    // The total should be: service_price + addons + (platform_fee + barber_payout)
                                    // If basePrice is 0, the stored totalCharged might be wrong, so we need to fix it
                                    const storedTotal = event.extendedProps.totalCharged || 0;
                                    
                                    // If stored total seems wrong (equals just platform fee when we should have service price),
                                    // and we have a platform fee, try to infer service price
                                    // But actually, if basePrice is 0, we can't fix it here - it should be fixed when creating the event
                                    // So just use the recalculated total if basePrice exists, otherwise use stored total
                                    if (basePrice > 0) {
                                      const recalculatedTotal = basePrice + addons + platformFee;
                                      return recalculatedTotal.toFixed(2);
                                    } else {
                                      // Fallback: use stored total, but log a warning
                                      logger.warn('Calendar event missing basePrice, using stored totalCharged', {
                                        eventId: event.id,
                                        storedTotal,
                                        platformFee,
                                        addons
                                      });
                                      return storedTotal.toFixed(2);
                                    }
                                  } else {
                                    return event.extendedProps.barberPayout.toFixed(2);
                                  }
                                })()}
                      </Text>
                            </View>
                    </View>
                  </TouchableOpacity>
                      );
                    })}
              </View>
            )}
              </ScrollView>
          </View>
        )}
          </Animated.View>
      </ScrollView>
      </Animated.View>

      {/* Event Details Modal */}
      <Modal
        visible={showEventDialog}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEventDialog(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={[tw`rounded-t-3xl p-6`, { 
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)'
          }]}>
            <View style={tw`flex-row items-center justify-between mb-6`}>
              <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                {userRole === 'barber' && barberViewMode === 'appointments' 
                  ? 'Appointment Details' 
                  : 'Booking Details'
                }
              </Text>
              <TouchableOpacity onPress={() => setShowEventDialog(false)}>
                <X size={24} color={theme.colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {selectedEvent && (
              <View style={tw`space-y-4`}>
                {/* Header Section */}
                <View style={tw`items-center mb-4`}>
                  <Text style={[tw`text-xl font-bold mb-1`, { color: theme.colors.foreground }]}>
                    {userRole === 'barber' && barberViewMode === 'appointments' 
                      ? 'Appointment Details' 
                      : 'Booking Details'
                    }
                  </Text>
                  <Text style={[tw`text-lg font-semibold mb-1`, { color: theme.colors.foreground }]}>
                    {userRole === 'client' 
                      ? selectedEvent.extendedProps.barberName 
                      : userRole === 'barber' && barberViewMode === 'appointments'
                      ? selectedEvent.extendedProps.clientName
                      : selectedEvent.extendedProps.barberName
                    }
                  </Text>
                  <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                    {userRole === 'barber' && barberViewMode === 'appointments' 
                      ? `Appointment #${selectedEvent.id.slice(0, 8).toUpperCase()}`
                      : `Booking #${selectedEvent.id.slice(0, 8).toUpperCase()}`
                    }
                  </Text>
                </View>

                {/* Service Section */}
                <View style={tw`mb-4`}>
                  <Text style={[tw`text-sm font-semibold mb-2`, { color: theme.colors.foreground }]}>
                    Service
                  </Text>
                  <Text style={[tw`text-base`, { color: theme.colors.foreground }]}>
                    {selectedEvent.extendedProps.serviceName}
                  </Text>
                </View>

                {/* Date & Time Section */}
                <View style={tw`mb-4`}>
                                      <View style={tw`flex-row items-center justify-between mb-2`}>
                      <View style={tw`flex-row items-center`}>
                        <Calendar size={16} color={theme.colors.mutedForeground} style={tw`mr-2`} />
                        <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Date</Text>
                      </View>
                    <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                      {formatDate(new Date(selectedEvent.start))}
                    </Text>
                  </View>
                  
                                      <View style={tw`flex-row items-center justify-between`}>
                      <View style={tw`flex-row items-center`}>
                        <Clock size={16} color={theme.colors.mutedForeground} style={tw`mr-2`} />
                        <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Time</Text>
                      </View>
                    <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                      {formatTime(new Date(selectedEvent.start))}
                    </Text>
                  </View>
                </View>

                {/* Status Section */}
                <View style={tw`mb-4`}>
                  <Text style={[tw`text-sm font-semibold mb-2`, { color: theme.colors.foreground }]}>
                    Status
                  </Text>
                  <View style={[
                    tw`self-end px-3 py-1 rounded-full`,
                    selectedEvent.extendedProps.status === 'completed' 
                      ? { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                      : selectedEvent.extendedProps.status === 'cancelled'
                      ? { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                      : selectedEvent.extendedProps.status === 'missed'
                      ? { backgroundColor: '#f59e0b', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                      : { backgroundColor: theme.colors.secondary, shadowColor: theme.colors.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
                  ]}>
                    <Text style={[tw`text-xs font-semibold capitalize`, { color: 'white' }]}>
                      {selectedEvent.extendedProps.status}
                    </Text>
                  </View>
                </View>

                {/* Pricing Section */}
                {(() => {
                  // Get pricing breakdown based on user role
                  const breakdown = userRole === 'client' 
                    ? {
                        servicePrice: selectedEvent.extendedProps.basePrice,
                        addons: selectedEvent.extendedProps.addonTotal,
                        platformFee: selectedEvent.extendedProps.platformFee,
                        total: selectedEvent.extendedProps.totalCharged,
                      }
                    : {
                        servicePrice: selectedEvent.extendedProps.basePrice,
                        addons: selectedEvent.extendedProps.addonTotal,
                        platformFee: selectedEvent.extendedProps.platformFee,
                        total: selectedEvent.extendedProps.totalCharged,
                        barberPayout: selectedEvent.extendedProps.barberPayout,
                      };

                  return (
                    <>
                      <View style={tw`mb-4`}>
                        <Text style={[tw`text-sm font-semibold mb-3`, { color: theme.colors.foreground }]}>
                          Pricing Breakdown
                        </Text>
                        
                        <View style={tw`space-y-2`}>
                          <View style={tw`flex-row items-center justify-between`}>
                            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Service Price</Text>
                            <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                              ${breakdown.servicePrice.toFixed(2)}
                            </Text>
                          </View>

                          {selectedEvent.extendedProps.addonNames.length > 0 && (
                            <View style={tw`flex-row items-center justify-between`}>
                              <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Add-ons</Text>
                              <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                                +${breakdown.addons.toFixed(2)}
                              </Text>
                            </View>
                          )}

                          {/* Show platform fee */}
                          {breakdown.platformFee > 0 && (
                            <View style={tw`flex-row items-center justify-between`}>
                              <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Platform Fee</Text>
                              <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                                +${breakdown.platformFee.toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Total Section */}
                      <View style={tw`mb-4`}>
                        {/* Show "Total Charged" for clients OR barbers viewing "My Bookings" (when they're the client) */}
                        {userRole === 'client' || (userRole === 'barber' && barberViewMode === 'bookings') ? (
                          <>
                            <View style={tw`flex-row items-center justify-between`}>
                              <Text style={[tw`font-bold text-lg`, { color: theme.colors.foreground }]}>
                                Total Charged
                              </Text>
                              <Text style={[tw`font-bold text-lg`, { color: theme.colors.secondary }]}>
                                ${breakdown.total.toFixed(2)}
                              </Text>
                            </View>
                            <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                              Total amount charged to you
                            </Text>
                          </>
                        ) : (
                          /* Show "Your Payout" only for barbers viewing "My Appointments" (when they're providing service) */
                          <>
                            <View style={tw`flex-row items-center justify-between`}>
                              <Text style={[tw`font-bold text-lg`, { color: theme.colors.foreground }]}>
                                Your Payout
                              </Text>
                              <Text style={[tw`font-bold text-lg`, { color: theme.colors.secondary }]}>
                                ${breakdown.barberPayout?.toFixed(2) || '0.00'}
                              </Text>
                            </View>
                            <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                              Amount you'll receive for this appointment
                            </Text>
                          </>
                        )}
                      </View>
                    </>
                  );
                })()}

                {/* Guest Information (if applicable) */}
                {selectedEvent.extendedProps.isGuest && (
                  <View style={tw`mb-4`}>
                    <Text style={[tw`text-sm font-semibold mb-2`, { color: theme.colors.foreground }]}>
                      Guest Information
                    </Text>
                    <View style={tw`space-y-1`}>
                      <Text style={[tw`text-sm`, { color: theme.colors.foreground }]}>
                        Email: {selectedEvent.extendedProps.guestEmail}
                      </Text>
                      <Text style={[tw`text-sm`, { color: theme.colors.foreground }]}>
                        Phone: {selectedEvent.extendedProps.guestPhone}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                {selectedEvent.extendedProps.status === 'pending' && (
                  <View style={tw`flex-row gap-3 mt-6`}>
                    <TouchableOpacity
                      onPress={handleMarkAsCompleted}
                      disabled={isMarkingCompleted}
                      style={[tw`flex-1 py-3 rounded-xl items-center`, { 
                        backgroundColor: '#10b981',
                        shadowColor: '#10b981',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }]}
                    >
                      {isMarkingCompleted ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={tw`font-semibold text-white`}>Mark as Completed</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleMarkAsMissed}
                      disabled={isMarkingMissed}
                      style={[tw`flex-1 py-3 rounded-xl items-center`, { 
                        backgroundColor: theme.colors.secondary,
                        shadowColor: theme.colors.secondary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }]}
                    >
                      {isMarkingMissed ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={tw`font-semibold text-white`}>Mark as Missed</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Cancel Button - for future appointments/bookings that aren't cancelled */}
                {selectedEvent.extendedProps.status !== 'cancelled' && 
                 selectedEvent.extendedProps.status !== 'completed' && 
                 selectedEvent.extendedProps.status !== 'missed' && 
                 new Date(selectedEvent.start) > new Date() && (
                  <View style={tw`mt-6`}>
                    <TouchableOpacity
                      onPress={handleCancelBooking}
                      style={[tw`py-3 rounded-xl items-center`, { 
                        backgroundColor: '#ef4444',
                        shadowColor: '#ef4444',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }]}
                    >
                      <Text style={tw`font-semibold text-white`}>
                        {userRole === 'barber' && barberViewMode === 'appointments'
                          ? 'Cancel Appointment'
                          : 'Cancel Booking'
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Leave Review Button for Completed Bookings/Appointments */}
                {selectedEvent.extendedProps.status === 'completed' && userRole === 'client' && (
                  <View style={tw`mt-6`}>
                    <TouchableOpacity
                      onPress={handleLeaveReview}
                      style={[tw`py-3 rounded-xl items-center`, { 
                        backgroundColor: '#3b82f6',
                        shadowColor: '#3b82f6',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4
                      }]}
                    >
                      <Text style={tw`font-semibold text-white`}>Leave Review</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual Appointment Form Modal */}
      {/* TODO: Re-enable manual appointment feature later */}
      {false && (
      <Modal
        visible={showManualAppointmentForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowManualAppointmentForm(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={[tw`rounded-t-3xl`, { 
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            maxHeight: screenHeight * 0.9, // Limit modal height to 90% of screen
          }]}>
            {/* Fixed Header */}
            <View style={tw`flex-row items-center justify-between p-6 pb-4 border-b border-white/10`}>
              <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                Add Manual Appointment
              </Text>
              <TouchableOpacity onPress={() => setShowManualAppointmentForm(false)}>
                <X size={24} color={theme.colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              ref={manualFormScrollRef}
              style={tw`flex-1`}
              contentContainerStyle={tw`p-6 pt-4 pb-8`}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={tw`space-y-4`}>
              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Client Name *
            </Text>
                <TextInput
                  style={[tw`p-3 rounded-xl border`, {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: theme.colors.foreground
                  }]}
                  placeholder="Enter client name"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={manualFormData.clientName}
                  onChangeText={(text) => setManualFormData(prev => ({ ...prev, clientName: text }))}
                />
              </View>

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Service *
                </Text>
                {services.length > 0 ? (
                  <ScrollView style={{ maxHeight: 120 }}>
                    {services.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        onPress={() => handleServiceSelect(service.id)}
                        style={[
                          tw`p-3 rounded-xl border mb-2`,
                          {
                            backgroundColor: manualFormData.serviceId === service.id 
                              ? `${theme.colors.secondary}15` 
                              : 'rgba(255,255,255,0.05)',
                            borderColor: manualFormData.serviceId === service.id 
                              ? theme.colors.secondary 
                              : 'rgba(255,255,255,0.1)',
                            borderWidth: manualFormData.serviceId === service.id ? 2 : 1,
                            shadowColor: manualFormData.serviceId === service.id ? theme.colors.secondary : 'transparent',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: manualFormData.serviceId === service.id ? 0.2 : 0,
                            shadowRadius: 4,
                            elevation: manualFormData.serviceId === service.id ? 2 : 0
                          }
                        ]}
                      >
                        <View style={tw`flex-row justify-between items-center`}>
                          <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
                            {service.name}
                          </Text>
                          <Text style={[tw`font-semibold`, { color: theme.colors.secondary }]}>
                            ${service.price}
                          </Text>
                        </View>
                        <Text style={[tw`text-xs`, { color: 'rgba(255,255,255,0.6)' }]}>
                          {service.duration} minutes
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[tw`p-4 rounded-xl border items-center`, {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }]}>
                    <Text style={[tw`text-center`, { color: 'rgba(255,255,255,0.6)' }]}>
                      No services available. Please add services in your profile settings.
                    </Text>
                  </View>
                )}
              </View>

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Price
                </Text>
                <TextInput
                  style={[tw`p-3 rounded-xl border`, {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: theme.colors.foreground
                  }]}
                  placeholder="Auto-filled from service"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={manualFormData.price}
                  editable={false}
                />
              </View>

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Date *
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    logger.log('Date picker button pressed, showing simple alert');
                    Alert.alert(
                      'Select Date',
                      'Choose a date for the appointment',
                      [
                        {
                          text: 'Today',
                          onPress: () => {
                            logger.log('Selected Today');
                            handleDateSelect(new Date());
                          }
                        },
                        {
                          text: 'Tomorrow',
                          onPress: () => {
                            logger.log('Selected Tomorrow');
                            handleDateSelect(new Date(Date.now() + 24 * 60 * 60 * 1000));
                          }
                        },
                        {
                          text: 'Next Week',
                          onPress: () => {
                            logger.log('Selected Next Week');
                            handleDateSelect(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
                          }
                        },
                        {
                          text: 'Cancel',
                          style: 'cancel',
                          onPress: () => logger.log('Cancelled date selection')
                        }
                      ]
                    );
                  }}
                  style={[tw`p-3 rounded-xl border`, {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }]}
                >
                  <Text style={[tw`text-center`, { color: theme.colors.foreground }]}>
                    {manualFormData.date ? format(manualFormData.date, 'MMM dd, yyyy') : 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Time *
                </Text>
                {manualFormData.date && (
                  <View>
                    {loadingTimeSlots ? (
                      <View style={tw`items-center py-8`}>
                        <ActivityIndicator size="small" color={theme.colors.secondary} />
                        <Text style={[tw`mt-2`, { color: theme.colors.mutedForeground }]}>Loading times...</Text>
                      </View>
                    ) : timeSlots.filter(slot => slot.available).length === 0 ? (
                      <View style={[tw`p-4 rounded-xl border items-center`, {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: 'rgba(255,255,255,0.1)',
                      }]}>
                        <Text style={[tw`text-center`, { color: 'rgba(255,255,255,0.6)' }]}>
                          No available time slots for this date
                        </Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row flex-wrap -mx-1`}>
                        {timeSlots
                          .filter(slot => slot.available)
                          .map((slot) => (
                            <TouchableOpacity
                              key={slot.time}
                              onPress={() => setManualFormData(prev => ({ ...prev, time: slot.time }))}
                              style={tw`w-1/3 px-1 mb-2`}
                              disabled={isSubmitting}
                            >
                              <View style={[
                                tw`rounded-lg py-3 items-center`,
                                manualFormData.time === slot.time
                                  ? { backgroundColor: theme.colors.secondary }
                                  : { backgroundColor: 'rgba(255,255,255,0.05)' }
                              ]}>
                                <Text style={[
                                  tw`text-sm font-medium`,
                                  manualFormData.time === slot.time
                                    ? { color: theme.colors.background }
                                    : { color: theme.colors.foreground }
                                ]}>
                                  {formatTimeSlot(slot.time)}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
              </View>
            </ScrollView>

            {/* Fixed Footer with Buttons */}
            <View style={[tw`flex-row gap-3 p-6 pt-4 border-t border-white/10`, {
              backgroundColor: theme.colors.background,
            }]}>
            <TouchableOpacity
              onPress={() => setShowManualAppointmentForm(false)}
                style={[tw`flex-1 py-3 rounded-xl items-center`, {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)'
                }]}
              >
                <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleManualAppointmentSubmit}
                disabled={isSubmitting}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center`, 
                  { 
                    backgroundColor: isSubmitting ? 'rgba(255,255,255,0.3)' : theme.colors.secondary,
                    shadowColor: theme.colors.secondary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4
                  }
                ]}
            >
                {isSubmitting ? (
                  <ActivityIndicator color={theme.colors.primaryForeground} size="small" />
                ) : (
              <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                    Add Appointment
              </Text>
                )}
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}



      {/* Review Form Modal */}
      {reviewFormData && (
        <ReviewForm
          barberId={reviewFormData.barberId}
          bookingId={reviewFormData.bookingId}
          onClose={() => {
            setReviewFormData(null);
            setShowReviewForm(false);
          }}
          onSuccess={() => {
            setReviewFormData(null);
            setShowReviewForm(false);
            // Refresh events if needed
            fetchBookings();
          }}
          isEditing={reviewFormData.isEditing}
          reviewId={reviewFormData.reviewId}
          initialRating={reviewFormData.initialRating}
          initialComment={reviewFormData.initialComment}
        />
      )}
    </SafeAreaView>
  );
} 