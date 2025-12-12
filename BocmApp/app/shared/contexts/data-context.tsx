import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { Barber, Booking, Service, Availability, SpecialHours, TimeOff, BookingRestrictions, OnDemandSettings, Cut, CutComment, CutAnalytics, Payment, UserCalendarConnection, SyncedEvent, CalendarSyncLog, Notification, ServiceAddon, BookingAddon, OnDemandRequest, OnDemandSettings as OnDemandSettingsType } from '../types';

// Database-specific types that match the actual database schema
interface BarberFromDB {
  id: string
  user_id: string
  bio?: string
  specialties: string[]
  price_range?: string
  next_available?: string
  created_at: string
  updated_at: string
  stripe_account_id?: string
  stripe_account_status?: string
  business_name?: string
  status?: string
  onboarding_complete?: boolean
  stripe_account_ready?: boolean
  instagram?: string
  twitter?: string
  tiktok?: string
  facebook?: string
  portfolio?: string[]
  is_developer?: boolean
  latitude?: number
  longitude?: number
  city?: string
  state?: string
}

// Types
export type JobPost = {
  id: string
  businessId: string
  businessName: string
  businessImage: string
  title: string
  description: string
  requirements: string[]
  location: string
  salary: string
  postedDate: string
  status: "open" | "closed"
}

export type Application = {
  id: string
  jobId: string
  barberId: string
  barber: {
    id: string
    name: string
    image: string
    experience: string
    location: string
  }
  status: "pending" | "reviewing" | "accepted" | "rejected"
  appliedDate: string
  coverLetter: string
}

interface DataContextType {
  barbers: BarberFromDB[]
  services: Service[]
  bookings: Booking[]
  availability: Availability[]
  specialHours: SpecialHours[]
  timeOff: TimeOff[]
  bookingRestrictions: BookingRestrictions[]
  ondemandSettings: OnDemandSettingsType[]
  cuts: Cut[]
  cutComments: CutComment[]
  cutAnalytics: CutAnalytics[]
  payments: Payment[]
  calendarConnections: UserCalendarConnection[]
  syncedEvents: SyncedEvent[]
  calendarSyncLogs: CalendarSyncLog[]
  notifications: Notification[]
  serviceAddons: ServiceAddon[]
  bookingAddons: BookingAddon[]
  ondemandRequests: OnDemandRequest[]
  loading: boolean
  error: string | null
  setEvents: React.Dispatch<React.SetStateAction<any[]>>

  // Barber methods
  getBarberById: (user_id: string) => BarberFromDB | undefined
  updateBarber: (id: string, data: Partial<BarberFromDB>) => void

  // Booking methods
  createBooking: (booking: Omit<Booking, "id">) => Promise<string>
  updateBookingStatus: (id: string, status: Booking["status"]) => void
  updatePaymentStatus: (id: string, status: Booking["payment_status"]) => void
  getBookingsByBarberId: (barberId: string) => Booking[]
  getBookingsByClientId: (clientId: string) => Booking[]

  // New methods
  fetchBarbers: () => Promise<void>
  fetchBookings: () => Promise<void>
  fetchServices: () => Promise<void>
  fetchAvailability: () => Promise<void>
  fetchSpecialHours: () => Promise<void>
  fetchTimeOff: () => Promise<void>
  fetchBookingRestrictions: () => Promise<void>
  fetchOnDemandSettings: () => Promise<void>
  fetchCuts: () => Promise<void>
  fetchCutComments: () => Promise<void>
  fetchCutAnalytics: () => Promise<void>
  fetchPayments: () => Promise<void>
  fetchCalendarConnections: () => Promise<void>
  fetchSyncedEvents: () => Promise<void>
  fetchCalendarSyncLogs: () => Promise<void>
  fetchNotifications: () => Promise<void>
  fetchServiceAddons: () => Promise<void>
  fetchBookingAddons: () => Promise<void>
  fetchOnDemandRequests: () => Promise<void>
  addBooking: (booking: Omit<Booking, 'id'>) => Promise<void>
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>
  addService: (service: Omit<Service, 'id'>) => Promise<void>
  updateService: (id: string, data: Partial<Service>) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [barbers, setBarbers] = useState<BarberFromDB[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [bookingRestrictions, setBookingRestrictions] = useState<BookingRestrictions[]>([])
  const [ondemandSettings, setOnDemandSettings] = useState<OnDemandSettingsType[]>([])
  const [cuts, setCuts] = useState<Cut[]>([])
  const [cutComments, setCutComments] = useState<CutComment[]>([])
  const [cutAnalytics, setCutAnalytics] = useState<CutAnalytics[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [calendarConnections, setCalendarConnections] = useState<UserCalendarConnection[]>([])
  const [syncedEvents, setSyncedEvents] = useState<SyncedEvent[]>([])
  const [calendarSyncLogs, setCalendarSyncLogs] = useState<CalendarSyncLog[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([])
  const [bookingAddons, setBookingAddons] = useState<BookingAddon[]>([])
  const [ondemandRequests, setOnDemandRequests] = useState<OnDemandRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<any[]>([])

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch barbers, services, and bookings in parallel
        await Promise.all([
          fetchBarbers(),
          fetchServices(),
          fetchBookings(),
        ])

        setLoading(false)
      } catch (err) {
        logger.error('Error fetching data:', err)
        setError('Failed to load data')
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const getBarberById = (user_id: string) => barbers.find(barber => barber.user_id === user_id)

  const updateBarber = async (user_id: string, data: Partial<BarberFromDB>) => {
    try {
      const { error } = await supabase
        .from('barbers')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)

      if (error) {
        logger.error('Error updating barber:', error)
        return
      }

      // Update local state
      setBarbers(prev => prev.map(barber => 
        barber.user_id === user_id 
          ? { ...barber, ...data, updated_at: new Date().toISOString() }
          : barber
      ))
    } catch (err) {
        logger.error('Error updating barber:', err)
    }
  }

  const createBooking = async (booking: Omit<Booking, "id">): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([booking])
        .select()
        .single()

      if (error) {
        logger.error('Error creating booking:', error)
        throw error
      }

      // Add to local state
      setBookings(prev => [...prev, data])
      return data.id
    } catch (err) {
      logger.error('Error creating booking:', err)
      
      // Capture error in Sentry
      const { captureException } = require('../lib/sentry');
      captureException(err as Error, {
        context: 'data-context.createBooking',
      });
      
      throw err
    }
  }

  const updateBookingStatus = async (id: string, status: Booking["status"]) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        logger.error('Error updating booking status:', error)
        return
      }

      // Update local state
      setBookings(prev => prev.map(booking => 
        booking.id === id 
          ? { ...booking, status, updated_at: new Date().toISOString() }
          : booking
      ))
    } catch (err) {
        logger.error('Error updating booking status:', err)
    }
  }

  const updatePaymentStatus = async (id: string, status: Booking["payment_status"]) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        logger.error('Error updating payment status:', error)
        return
      }

      // Update local state
      setBookings(prev => prev.map(booking => 
        booking.id === id 
          ? { ...booking, payment_status: status, updated_at: new Date().toISOString() }
          : booking
      ))
    } catch (err) {
        logger.error('Error updating payment status:', err)
    }
  }

  const getBookingsByBarberId = (barberId: string) => {
    return bookings.filter(booking => booking.barber_id === barberId)
  }

  const getBookingsByClientId = (clientId: string) => {
    return bookings.filter(booking => booking.client_id === clientId)
  }

  const fetchBarbers = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching barbers:', error)
        return
      }

      setBarbers(data || [])
    } catch (err) {
        logger.error('Error fetching barbers:', err)
    }
  }

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching bookings:', error)
        return
      }

      setBookings(data || [])
    } catch (err) {
        logger.error('Error fetching bookings:', err)
    }
  }

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching services:', error)
        return
      }

      setServices(data || [])
    } catch (err) {
        logger.error('Error fetching services:', err)
    }
  }

  const addBooking = async (booking: Omit<Booking, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([booking])
        .select()
        .single()

      if (error) {
        logger.error('Error adding booking:', error)
        return
      }

      setBookings(prev => [...prev, data])
    } catch (err) {
        logger.error('Error adding booking:', err)
    }
  }

  const updateBooking = async (id: string, data: Partial<Booking>) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        logger.error('Error updating booking:', error)
        return
      }

      setBookings(prev => prev.map(booking => 
        booking.id === id 
          ? { ...booking, ...data, updated_at: new Date().toISOString() }
          : booking
      ))
    } catch (err) {
        logger.error('Error updating booking:', err)
    }
  }

  const addService = async (service: Omit<Service, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([service])
        .select()
        .single()

      if (error) {
        logger.error('Error adding service:', error)
        return
      }

      setServices(prev => [...prev, data])
    } catch (err) {
        logger.error('Error adding service:', err)
    }
  }

  const updateService = async (id: string, data: Partial<Service>) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        logger.error('Error updating service:', error)
        return
      }

      setServices(prev => prev.map(service => 
        service.id === id 
          ? { ...service, ...data, updated_at: new Date().toISOString() }
          : service
      ))
    } catch (err) {
        logger.error('Error updating service:', err)
    }
  }

  // Additional fetch methods
  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching availability:', error)
        return
      }

      setAvailability(data || [])
    } catch (err) {
        logger.error('Error fetching availability:', err)
    }
  }

  const fetchSpecialHours = async () => {
    try {
      const { data, error } = await supabase
        .from('special_hours')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching special hours:', error)
        return
      }

      setSpecialHours(data || [])
    } catch (err) {
        logger.error('Error fetching special hours:', err)
    }
  }

  const fetchTimeOff = async () => {
    try {
      const { data, error } = await supabase
        .from('time_off')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching time off:', error)
        return
      }

      setTimeOff(data || [])
    } catch (err) {
        logger.error('Error fetching time off:', err)
    }
  }

  const fetchBookingRestrictions = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_restrictions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching booking restrictions:', error)
        return
      }

      setBookingRestrictions(data || [])
    } catch (err) {
        logger.error('Error fetching booking restrictions:', err)
    }
  }

  const fetchOnDemandSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ondemand_settings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching ondemand settings:', error)
        return
      }

      setOnDemandSettings(data || [])
    } catch (err) {
        logger.error('Error fetching ondemand settings:', err)
    }
  }

  const fetchCuts = async () => {
    try {
      const { data, error } = await supabase
        .from('cuts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching cuts:', error)
        return
      }

      setCuts(data || [])
    } catch (err) {
        logger.error('Error fetching cuts:', err)
    }
  }

  const fetchCutComments = async () => {
    try {
      const { data, error } = await supabase
        .from('cut_comments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching cut comments:', error)
        return
      }

      setCutComments(data || [])
    } catch (err) {
        logger.error('Error fetching cut comments:', err)
    }
  }

  const fetchCutAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('cut_analytics')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching cut analytics:', error)
        return
      }

      setCutAnalytics(data || [])
    } catch (err) {
        logger.error('Error fetching cut analytics:', err)
    }
  }

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching payments:', error)
        return
      }

      setPayments(data || [])
    } catch (err) {
        logger.error('Error fetching payments:', err)
    }
  }

  const fetchCalendarConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('user_calendar_connections')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching calendar connections:', error)
        return
      }

      setCalendarConnections(data || [])
    } catch (err) {
        logger.error('Error fetching calendar connections:', err)
    }
  }

  const fetchSyncedEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('synced_events')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching synced events:', error)
        return
      }

      setSyncedEvents(data || [])
    } catch (err) {
        logger.error('Error fetching synced events:', err)
    }
  }

  const fetchCalendarSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching calendar sync logs:', error)
        return
      }

      setCalendarSyncLogs(data || [])
    } catch (err) {
        logger.error('Error fetching calendar sync logs:', err)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching notifications:', error)
        return
      }

      setNotifications(data || [])
    } catch (err) {
        logger.error('Error fetching notifications:', err)
    }
  }

  const fetchServiceAddons = async () => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching service addons:', error)
        return
      }

      setServiceAddons(data || [])
    } catch (err) {
        logger.error('Error fetching service addons:', err)
    }
  }

  const fetchBookingAddons = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_addons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching booking addons:', error)
        return
      }

      setBookingAddons(data || [])
    } catch (err) {
        logger.error('Error fetching booking addons:', err)
    }
  }

  const fetchOnDemandRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('ondemand_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching ondemand requests:', error)
        return
      }

      setOnDemandRequests(data || [])
    } catch (err) {
        logger.error('Error fetching ondemand requests:', err)
    }
  }

  const value: DataContextType = {
    barbers,
    services,
    bookings,
    availability,
    specialHours,
    timeOff,
    bookingRestrictions,
    ondemandSettings,
    cuts,
    cutComments,
    cutAnalytics,
    payments,
    calendarConnections,
    syncedEvents,
    calendarSyncLogs,
    notifications,
    serviceAddons,
    bookingAddons,
    ondemandRequests,
    loading,
    error,
    setEvents,
    getBarberById,
    updateBarber,
    createBooking,
    updateBookingStatus,
    updatePaymentStatus,
    getBookingsByBarberId,
    getBookingsByClientId,
    fetchBarbers,
    fetchBookings,
    fetchServices,
    fetchAvailability,
    fetchSpecialHours,
    fetchTimeOff,
    fetchBookingRestrictions,
    fetchOnDemandSettings,
    fetchCuts,
    fetchCutComments,
    fetchCutAnalytics,
    fetchPayments,
    fetchCalendarConnections,
    fetchSyncedEvents,
    fetchCalendarSyncLogs,
    fetchNotifications,
    fetchServiceAddons,
    fetchBookingAddons,
    fetchOnDemandRequests,
    addBooking,
    updateBooking,
    addService,
    updateService,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
} 