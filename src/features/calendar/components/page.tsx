"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { supabase } from "@/shared/lib/supabase"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui/select"
import { addToGoogleCalendar, downloadICalFile } from "@/shared/lib/google-calendar-utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Badge } from "@/shared/components/ui/badge"
import { Calendar, Clock, User, MapPin, DollarSign, Loader2, ExternalLink, Download, Plus } from "lucide-react"
import dynamic from 'next/dynamic'
import { ManualAppointmentForm } from '@/shared/components/calendar/manual-appointment-form'
import { logger } from '@/shared/lib/logger'

const CalendarComponent = dynamic(
  () => import("@/shared/components/ui/calendar").then((mod) => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
)

const CalendarSection = dynamic(
  () => Promise.resolve(({ selectedDate, onSelect }: { selectedDate: Date | undefined, onSelect: (date: Date | undefined) => void }) => (
    <div className="w-[300px]">
      <CalendarComponent
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        className="rounded-md border"
      />
    </div>
  )),
  {
    ssr: false,
    loading: () => (
      <div className="w-[300px] h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
)

interface Booking {
  id: string
  date: string
  time: string
  status: string
  service_name: string
  price: number
  // For clients: contains barber info, for barbers: contains client info
  otherParty: {
    id: string
    name: string
    username: string
    image?: string
    location?: string
  }
}

interface Barber {
  id: string
  name: string
  email: string
  phone?: string
  location?: string
  bio?: string
  businessName?: string
  specialties: string[]
  services: any[]
  priceRange?: string
  nextAvailable?: string
  rating?: number
  image?: string
  portfolio?: string[]
  trending?: boolean
  openToHire?: boolean
  isPublic?: boolean
  instagram?: string
  twitter?: string
  tiktok?: string
  facebook?: string
  joinDate?: string
  createdAt?: string
  updatedAt?: string
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedBarber, setSelectedBarber] = useState<string | undefined>()
  const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false)

  // Fetch data based on user role
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!user) {
          setLoading(false)
          return
        }

        logger.debug('Current user', { userId: user.id, role: user?.role })
        
        if (user.role === 'client') {
          logger.debug('User is client, fetching client bookings')
          // For clients: fetch their bookings
          await fetchClientBookings()
        } else if (user.role === 'barber') {
          logger.debug('User is barber, fetching barber data')
          // For barbers: fetch all barbers (for admin purposes) and their own bookings
          await fetchBarberData()
        } else {
          logger.debug('Unknown user role', { role: user?.role })
        }
      } catch (error) {
        logger.error('Error fetching data', error)
        setError('Failed to load data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const fetchClientBookings = async () => {
    try {
      logger.debug('Fetching client bookings', { userId: user?.id, role: user?.role })
      
      // Fetch client's bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          date,
          time,
          status,
          price,
          service_id,
          barber_id,
          barber:barbers!barber_id (
            id,
            user_id,
            business_name
          )
        `)
        .eq('client_id', user?.id)
        .order('date', { ascending: true })

      logger.debug('Raw bookings data', { count: bookingsData?.length, hasError: !!bookingsError })

      if (bookingsError) {
        logger.error('Error fetching bookings', bookingsError)
        throw bookingsError
      }

      if (!bookingsData || bookingsData.length === 0) {
        logger.debug('No bookings found for client', { userId: user?.id })
        setBookings([])
        return
      }

      logger.debug('Found bookings', { count: bookingsData.length })
      
      // Debug: Check if user ID matches any client_id in the database
      logger.debug('Checking if user ID matches any bookings')
      const { data: allBookingsDebug, error: debugError } = await supabase
        .from('bookings')
        .select('client_id, barber_id, date, status')
        .limit(10)
      
      if (debugError) {
        logger.debug('Debug query error', { error: debugError?.message })
      } else {
        logger.debug('All bookings in DB (for debugging)', { count: allBookingsDebug?.length })
        const userBookings = allBookingsDebug?.filter(b => b.client_id === user?.id)
        logger.debug('Bookings for current user', { count: userBookings?.length })
      }

      // Fetch service names for bookings
      const serviceIds = bookingsData.map(booking => booking.service_id).filter(Boolean)
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name')
        .in('id', serviceIds)

      const serviceMap = new Map(servicesData?.map(service => [service.id, service.name]) || [])

             // Fetch barber profile data
       const barberUserIds = bookingsData.map(booking => (booking.barber as any)?.user_id).filter(Boolean)
       const { data: profilesData } = await supabase
         .from('profiles')
         .select('id, name, username, avatar_url, location')
         .in('id', barberUserIds)

       const profileMap = new Map(profilesData?.map(profile => [profile.id, profile]) || [])

       // Transform bookings data
       const transformedBookings: Booking[] = bookingsData.map(booking => {
         const barberData = booking.barber as any
         const profile = profileMap.get(barberData?.user_id)
         return {
           id: booking.id,
           date: booking.date,
           time: booking.time,
           status: booking.status,
           service_name: serviceMap.get(booking.service_id) || 'Unknown Service',
           price: booking.price,
           otherParty: {
             id: barberData?.id || '',
             name: profile?.name || barberData?.business_name || 'Unknown Barber',
             username: profile?.username || '',
             image: profile?.avatar_url,
             location: profile?.location
           }
         }
       })

      setBookings(transformedBookings)
    } catch (error) {
      logger.error('Error in fetchClientBookings', error)
      throw error
    }
  }

  const fetchBarberData = async () => {
    try {
      // For barbers, fetch their own bookings (where they are the barber)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          date,
          time,
          status,
          price,
          service_id,
          client_id,
          client:profiles!client_id (
            id,
            name,
            username,
            avatar_url,
            location
          )
        `)
        .eq('barber_id', user?.id)
        .order('date', { ascending: true })

      if (bookingsError) {
        logger.error('Error fetching barber bookings', bookingsError)
        throw bookingsError
      }

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        return
      }

      // Fetch service names for bookings
      const serviceIds = bookingsData.map(booking => booking.service_id).filter(Boolean)
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name')
        .in('id', serviceIds)

      const serviceMap = new Map(servicesData?.map(service => [service.id, service.name]) || [])

      // Transform bookings data for barber view
      const transformedBookings: Booking[] = bookingsData.map(booking => {
        const clientData = booking.client as any
        return {
          id: booking.id,
          date: booking.date,
          time: booking.time,
          status: booking.status,
          service_name: serviceMap.get(booking.service_id) || 'Unknown Service',
          price: booking.price,
          otherParty: {
            id: clientData?.id || '',
            name: clientData?.name || 'Unknown Client',
            username: clientData?.username || '',
            image: clientData?.avatar_url,
            location: clientData?.location
          }
        }
      })

      setBookings(transformedBookings)
    } catch (error) {
      logger.error('Error in fetchBarberData', error)
      throw error
    }
  }

  const getBookingsForDate = (date: Date) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return bookings.filter(booking => booking.date === dateStr)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'cancelled': return 'bg-red-500'
      case 'completed': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-saffron" />
          <p className="mt-4 text-white/60">Loading calendar...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <p className="text-red-400">Error loading calendar: {error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-saffron hover:bg-saffron/90 text-primary"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendar</h1>
          <p className="text-white/60 mt-1">
            {user?.role === 'client' ? 'View your appointments' : 'Manage your bookings'}
          </p>
        </div>
        <div className="flex gap-4">
          {user?.role === 'barber' && (
          <Select
            value={selectedBarber}
            onValueChange={setSelectedBarber}
          >
              <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Select barber" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Barbers</SelectItem>
              {barbers.map((barber) => (
                <SelectItem key={barber.id} value={barber.id}>
                  {barber.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <CalendarSection selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        
        {/* Manual Appointment Button for Barbers */}
        {user?.role === 'barber' && (
          <div className="flex justify-center mt-6">
            <Card className="bg-gradient-to-r from-saffron/10 to-secondary/10 border border-saffron/20 p-4">
              <div className="text-center mb-3">
                <h4 className="text-white font-semibold text-sm mb-1">Quick Add Appointment</h4>
                <p className="text-white/60 text-xs">For walk-ins, phone bookings, or admin purposes</p>
              </div>
              <Button
                onClick={() => setShowManualAppointmentForm(true)}
                className="bg-saffron text-black hover:bg-saffron/90 font-semibold px-6 py-3 shadow-lg shadow-saffron/25 transition-all duration-200 hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Manual Appointment
              </Button>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border border-white/20 bg-white/5"
              />
            </CardContent>
          </Card>
        </div>

        {/* Events/Bookings Panel */}
        <div className="lg:col-span-1">
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">
                {selectedDate ? formatDate(selectedDate.toISOString()) : 'Select a Date'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="space-y-4">
                  {getBookingsForDate(selectedDate).length > 0 ? (
                    getBookingsForDate(selectedDate).map((booking) => (
                      <div key={booking.id} className="p-4 bg-white/10 rounded-lg border border-white/20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white">{booking.service_name}</h3>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm text-white/80">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{user?.role === 'client' ? 'Barber: ' : 'Client: '}{booking.otherParty.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(booking.time)}</span>
                          </div>
                          {booking.otherParty.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{booking.otherParty.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span>${booking.price}</span>
                          </div>
                        </div>
                        
                        {/* Google Calendar Sync Buttons */}
                        <div className="mt-4 pt-3 border-t border-white/20">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                try {
                                  const startDate = new Date(`${booking.date}T${booking.time}`)
                                  const endDate = new Date(startDate.getTime() + 60 * 60000) // 1 hour duration
                                  
                                  addToGoogleCalendar(
                                    {
                                      title: `${booking.service_name} - ${booking.otherParty.name}`,
                                      start: startDate.toISOString(),
                                      end: endDate.toISOString(),
                                      extendedProps: {
                                        serviceName: booking.service_name,
                                        clientName: user?.role === 'client' ? (user as any)?.user_metadata?.full_name || 'Client' : 'Client',
                                        price: booking.price,
                                        isGuest: false,
                                        guestEmail: '',
                                        guestPhone: ''
                                      }
                                    },
                                    user?.role === 'client' ? 'client' : 'barber',
                                    {
                                      name: (user as any)?.user_metadata?.full_name || (user?.role === 'client' ? 'Client' : 'Barber'),
                                      email: user?.email || '',
                                      location: booking.otherParty.location || ''
                                    }
                                  )
                                } catch (error) {
                                  logger.error('Error adding to Google Calendar', error)
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
                                try {
                                  const startDate = new Date(`${booking.date}T${booking.time}`)
                                  const endDate = new Date(startDate.getTime() + 60 * 60000) // 1 hour duration
                                  
                                  downloadICalFile(
                                    [{
                                      title: `${booking.service_name} - ${booking.otherParty.name}`,
                                      start: startDate.toISOString(),
                                      end: endDate.toISOString(),
                                      extendedProps: {
                                        serviceName: booking.service_name,
                                        clientName: user?.role === 'client' ? (user as any)?.user_metadata?.full_name || 'Client' : 'Client',
                                        price: booking.price,
                                        isGuest: false,
                                        guestEmail: '',
                                        guestPhone: ''
                                      }
                                    }],
                                    user?.role === 'client' ? 'client' : 'barber',
                                    {
                                      name: (user as any)?.user_metadata?.full_name || (user?.role === 'client' ? 'Client' : 'Barber'),
                                      email: user?.email || '',
                                      location: booking.otherParty.location || ''
                                    },
                                    `appointment-${booking.id}.ics`
                                  )
                                } catch (error) {
                                  logger.error('Error downloading iCal file', error)
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
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto text-white/40 mb-4" />
                      <p className="text-white/60">No bookings for this date</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-white/40 mb-4" />
                  <p className="text-white/60">Select a date to view bookings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barber Cards (for barber users only) */}
      {user?.role === 'barber' && barbers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-6">All Barbers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {barbers
          .filter((barber) => !selectedBarber || barber.id === selectedBarber)
          .map((barber) => (
                <Card key={barber.id} className="bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-saffron/20 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-saffron" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{barber.name}</h3>
                        <p className="text-sm text-white/60">{barber.location || 'No location'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
          ))}
      </div>
        </div>
      )}

      {/* Manual Appointment Form */}
      <ManualAppointmentForm
        isOpen={showManualAppointmentForm}
        onClose={() => setShowManualAppointmentForm(false)}
        selectedDate={selectedDate || undefined}
        onAppointmentCreated={(appointment) => {
          setShowManualAppointmentForm(false)
          // Refresh the data to show the new appointment
          if (user?.role === 'client') {
            fetchClientBookings()
          } else if (user?.role === 'barber') {
            fetchBarberData()
          }
        }}
      />
    </div>
  )
}
