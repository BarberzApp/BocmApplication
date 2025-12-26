"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Button } from "@/shared/components/ui/button"
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar"
import { Badge } from "@/shared/components/ui/badge"
import { Calendar, Clock, MapPin, Scissors, X } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"
import { supabase } from "@/shared/lib/supabase"
import type { Booking } from "@/shared/types/booking"
import { useToast } from '@/shared/components/ui/use-toast'
import { logger } from '@/shared/lib/logger'

export default function BookingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const { push: safePush } = useSafeNavigation();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      safePush("/login")
      return
    }

    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            barber:barber_id (
              id,
              user_id,
              name,
              image,
              location
            )
          `)
          .eq('client_id', user.id)
          .order('booking_date', { ascending: true })

        if (error) throw error

        // Get usernames for all barbers
        const userIds = (data || []).map(booking => booking.barber?.user_id).filter(Boolean)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        if (profileError) {
          logger.error('Error fetching usernames', profileError)
        }

        // Create a map of user_id to username
        const usernameMap = new Map(profileData?.map(profile => [profile.id, profile.username]) || [])

        // Transform the data to include proper Date objects and barber info
        const transformedBookings = (data || []).map(booking => ({
          ...booking,
          date: new Date(booking.booking_date),
          services: booking.services || [],
          barber: {
            id: booking.barber.id,
            name: booking.barber.name,
            username: usernameMap.get(booking.barber.user_id),
            image: booking.barber.image,
            location: booking.barber.location
          }
        }))

        setBookings(transformedBookings)
      } catch (error) {
        logger.error('Error fetching bookings', error)
        toast({
          title: 'Error',
          description: 'Failed to load bookings',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [user, toast])

  const upcomingBookings = bookings.filter((booking) => booking.status === "pending" || booking.status === "confirmed")
  const pastBookings = bookings.filter((booking) => booking.status === "completed")

  const handleCancelBooking = useCallback(async () => {
    if (!cancelBookingId) return

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', cancelBookingId)

      if (error) throw error

      setBookings(bookings.map(booking => 
        booking.id === cancelBookingId 
          ? { ...booking, status: 'cancelled' }
          : booking
      ))
      setCancelBookingId(null)
    } catch (error) {
      logger.error('Error cancelling booking', error)
    }
  }, [cancelBookingId, bookings])

  const handleCancelClick = useCallback((bookingId: string) => {
    setCancelBookingId(bookingId)
  }, [])

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-barber-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading bookings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <Button asChild>
          <Link href="/browse">Book New Appointment</Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Bookings</h3>
              <p className="text-muted-foreground mb-6">You don't have any upcoming appointments scheduled.</p>
              <Button asChild>
                <Link href="/browse">Book an Appointment</Link>
              </Button>
            </div>
          ) : (
            upcomingBookings.map((booking) => (
              <div key={booking.id} className="relative rounded-2xl overflow-hidden shadow-2xl min-h-[320px] flex flex-col justify-end bg-black">
                {/* Full-bleed barber/service image */}
                {booking.barber.image ? (
                  <img
                    src={booking.barber.image}
                    alt={booking.barber.name}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-darkpurple/80 z-0" />
                )}
                {/* Glassy overlay */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10" />
                {/* Floating details card - refined for Bitesight style */}
                <div className="relative z-20 px-4 pb-24 pt-8 flex flex-col justify-end h-full">
                  <div className="max-w-xl mx-auto bg-white/10 border border-white/30 rounded-2xl shadow-2xl backdrop-blur-xl p-5 flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bebas text-white font-bold tracking-wide mb-1">{booking.barber.name}</h3>
                        <div className="text-white/80 text-base mb-2">No description available.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" className="bg-white/10 border-white/20 text-white/80 p-2 rounded-full shadow-md">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                        </Button>
                        <Button variant="ghost" className="bg-white/10 border-white/20 text-white/80 p-2 rounded-full shadow-md">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M16 8a6 6 0 0 1-8 8" /></svg>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-saffron" />
                      <span className="text-white/80 text-base font-semibold">
                        {new Date(booking.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <Clock className="h-4 w-4 text-saffron ml-2" />
                      <span className="text-white/70 text-sm">
                        {new Date(booking.date).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-saffron mt-0.5" />
                      <div className="flex-1 text-saffron font-semibold text-sm leading-tight whitespace-pre-line">
                        {booking.barber.location || 'Barber Shop'}
                      </div>
                      <div className="text-white/60 text-xs ml-2 text-right min-w-[60px]">0.6 miles away</div>
                    </div>
                    {/* Tags and ratings row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {(Array.isArray((booking as any).services) ? (booking as any).services : booking?.service ? [booking.service] : []).map((service: any) => (
                        <Badge key={service} variant="glassy-saffron" className="text-xs">{service}</Badge>
                      ))}
                      <Badge variant="glassy-saffron" className="text-xs">{booking.status === 'confirmed' ? 'CONFIRMED' : 'UPCOMING'}</Badge>
                      <Badge variant="glassy-saffron" className="text-xs">POPULAR</Badge>
                      <span className="flex items-center gap-1 text-white/80 text-xs"><span className="font-bold">4.3</span>★ (660+)</span>
                      <span className="flex items-center gap-1 text-white/80 text-xs"><span className="font-bold">3.9</span>★ (330+)</span>
                    </div>
                  </div>
                </div>
                {/* Sticky bottom action bar for this booking */}
                <div className="absolute left-0 right-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 flex justify-center">
                  <div className="w-full max-w-xl flex items-center gap-4">
                    <Button className="flex-1 bg-saffron text-primary font-bold text-lg py-4 rounded-xl shadow-xl hover:bg-saffron/90 transition-all">
                      {booking.status === 'confirmed' ? 'Cancel' : 'Rebook'}
                    </Button>
                    <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold text-lg shadow-xl">
                      ${booking.price?.toFixed(2) || '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-6">
          {pastBookings.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Past Bookings</h3>
              <p className="text-muted-foreground">You haven't had any appointments yet.</p>
            </div>
          ) : (
            pastBookings.map((booking) => (
              <Card key={booking.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback>{booking.barber.name.charAt(0)}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{booking.barber.name}</h3>

                      <div className="flex flex-col sm:flex-row sm:gap-6 mt-2">
                        <div className="flex items-center text-sm">
                          <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>
                            {new Date(booking.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center text-sm mt-1 sm:mt-0">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>{new Date(booking.date).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</span>
                        </div>

                        <div className="flex items-center text-sm mt-1 sm:mt-0">
                          <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>{booking.barber.location}</span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm font-medium">Services:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary">
                            {booking.service.name}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-4 md:mt-0">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-bold">${booking.price}</p>
                      </div>

                      <Button variant="outline" size="sm">
                        Book Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!cancelBookingId} onOpenChange={() => setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking}>Cancel Booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
