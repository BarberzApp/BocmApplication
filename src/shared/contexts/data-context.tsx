"use client"

import { User as LucideUser } from "lucide-react"
import { createContext, useContext, useState, type ReactNode, useEffect } from "react"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { supabase } from '@/shared/lib/supabase'
import type { CalendarEvent } from "@/shared/types/calendar"
import type { Barber, Booking, Service } from '@/shared/types'
import { logger } from '@/shared/lib/logger'

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
  loading: boolean
  error: string | null
  events: CalendarEvent[]
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>

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
  addBooking: (booking: Omit<Booking, 'id'>) => Promise<void>
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>
  addService: (service: Omit<Service, 'id'>) => Promise<void>
  updateService: (id: string, data: Partial<Service>) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [barbers, setBarbers] = useState<BarberFromDB[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])

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

        // Fetch barbers
        const { data: barbersData, error: barbersError } = await supabase
          .from('barbers')
          .select('*')
        if (barbersError) {
          logger.error('Error fetching barbers', barbersError)
          throw new Error('Failed to load barbers')
        }
        setBarbers(barbersData || [])

        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
        if (servicesError) {
          logger.error('Error fetching services', servicesError)
          throw new Error('Failed to load services')
        }
        setServices(servicesData || [])

        // Fetch bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .or(`barber_id.eq.${user.id},client_id.eq.${user.id}`)
        if (bookingsError) {
          logger.error('Error fetching bookings', bookingsError)
          throw new Error('Failed to load bookings')
        }
        setBookings(bookingsData || [])

      } catch (err) {
        logger.error('Error fetching data', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // Barber methods
  const getBarberById = (user_id: string) => barbers.find(barber => barber.user_id === user_id)

  const updateBarber = async (user_id: string, data: Partial<BarberFromDB>) => {
    try {
      // Only include barber-specific fields that exist in the BarberFromDB type
      const barberData: Partial<BarberFromDB> = {
        bio: data.bio,
        specialties: data.specialties,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('barbers')
        .update(barberData)
        .eq('user_id', user_id)
      if (error) throw error

      setBarbers(prev => prev.map(barber => 
        barber.user_id === user_id ? { ...barber, ...barberData } : barber
      ))
    } catch (err) {
      logger.error('Error updating barber', err)
      throw err
    }
  }

  // Booking methods
  const createBooking = async (booking: Omit<Booking, "id">): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single()
      if (error) throw error

      setBookings(prev => [...prev, data])
      return data.id
    } catch (err) {
      logger.error('Error creating booking', err)
      throw err
    }
  }

  const updateBookingStatus = async (id: string, status: Booking["status"]) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id)
      if (error) throw error

      setBookings(prev => prev.map(booking => 
        booking.id === id ? { ...booking, status } : booking
      ))
    } catch (err) {
      logger.error('Error updating booking status', err)
      throw err
    }
  }

  const updatePaymentStatus = async (id: string, status: Booking["payment_status"]) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: status })
        .eq('id', id)
      if (error) throw error

      setBookings(prev => prev.map(booking => 
        booking.id === id ? { ...booking, payment_status: status } : booking
      ))
    } catch (err) {
      logger.error('Error updating payment status', err)
      throw err
    }
  }

  const getBookingsByBarberId = (barberId: string) => {
    return bookings.filter(booking => booking.barber_id === barberId)
  }

  const getBookingsByClientId = (clientId: string) => {
    return bookings.filter(booking => booking.client_id === clientId)
  }

  const fetchBarbers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
      
      if (error) throw error
      setBarbers(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
      if (error) throw error

      setBookings(data.map(booking => ({
        id: booking.id,
        barber_id: booking.barber_id,
        client_id: booking.client_id,
        service_id: booking.service_id,
        date: booking.date,
        status: booking.status,
        payment_status: booking.payment_status,
        payment_intent_id: booking.payment_intent_id,
        price: booking.price,
        platform_fee: booking.platform_fee,
        barber_payout: booking.barber_payout,
        created_at: booking.created_at,
        updated_at: booking.updated_at,
        notes: booking.notes,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone
      })))
    } catch (err) {
      logger.error('Error fetching bookings', err)
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
      
      if (error) throw error
      setServices(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addBooking = async (booking: Omit<Booking, 'id'>) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .insert([booking])
      
      if (error) throw error
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updateBooking = async (id: string, data: Partial<Booking>) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
      await fetchBookings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addService = async (service: Omit<Service, 'id'>) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('services')
        .insert([service])
      
      if (error) throw error
      await fetchServices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updateService = async (id: string, data: Partial<Service>) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('services')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
      await fetchServices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const value = {
    barbers,
    services,
    bookings,
    loading,
    error,
    events,
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
    addBooking,
    updateBooking,
    addService,
    updateService
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