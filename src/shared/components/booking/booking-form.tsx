"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { logger } from '@/shared/lib/logger'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { Booking } from '@/shared/types/booking'
import { Service } from '@/shared/types/service'
import { ServiceAddon } from '@/shared/types/addon'
import { syncService } from '@/shared/lib/sync-service'
import { supabase } from '@/shared/lib/supabase'
import { Calendar } from '@/shared/components/ui/calendar'
import { CalendarIcon, Clock, User, CreditCard, Loader2, MapPin, Scissors, Star, ChevronLeft, ChevronRight, X, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { AddonSelector } from './addon-selector'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface BookingFormProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: Date
  barberId: string
  onBookingCreated: (booking: Booking) => void
}

export function BookingForm({ isOpen, onClose, selectedDate, barberId, onBookingCreated }: BookingFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([])
  const [formData, setFormData] = useState({
    serviceId: '',
    time: '',
    notes: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
  })
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [date, setDate] = useState<Date>(selectedDate)
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set())
  const [paymentType] = useState<'fee'>('fee')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4
  const [isDeveloperAccount, setIsDeveloperAccount] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchServices()
      fetchBarberStatus()
      setCurrentStep(1)
    }
  }, [isOpen, barberId])

  useEffect(() => {
    if (isOpen && selectedService) {
      fetchAvailability()
    }
  }, [isOpen, barberId, date, selectedService])

  const fetchServices = async () => {
    try {
      const [servicesResponse, addonsResponse] = await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('barber_id', barberId),
        supabase
          .from('service_addons')
          .select('*')
          .eq('barber_id', barberId)
          .eq('is_active', true)
      ])

      if (servicesResponse.error) throw servicesResponse.error
      if (addonsResponse.error) throw addonsResponse.error
      
      setServices(servicesResponse.data || [])
      setAddons(addonsResponse.data || [])
    } catch (error) {
      logger.error('Error fetching services and add-ons', error)
      toast({
        title: "Error",
        description: "Failed to load services. Please try again.",
        variant: "destructive",
      })
    }
  }

  const fetchBarberStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('is_developer')
        .eq('id', barberId)
        .single()

      if (error) throw error
      setIsDeveloperAccount(data?.is_developer || false)
    } catch (error) {
      logger.error('Error fetching barber status', error)
      setIsDeveloperAccount(false)
    }
  }

  const fetchAvailability = async () => {
    if (!selectedService) return

    try {
      const selectedDate = date.toISOString().split('T')[0]
      const timeSlotInterval = selectedService.duration // Use service duration as interval
      
      // Get existing bookings for the selected date (treat any non-cancelled as taken)
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('date')
        .eq('barber_id', barberId)
        .gte('date', `${selectedDate}T00:00:00`)
        .lt('date', `${selectedDate}T23:59:59`)
        .neq('status', 'cancelled')

      if (bookingsError) throw bookingsError

      // Log fetched bookings
      logger.debug('Fetched bookings', { bookings })

      // Set bookedTimes based on fetched bookings
      const newBookedTimes = new Set(bookings?.map(b => new Date(b.date).toTimeString().slice(0, 5)) || [])
      setBookedTimes(newBookedTimes)

      // First check for special hours
      const { data: specialHours, error: specialHoursError } = await supabase
        .from('special_hours')
        .select('*')
        .eq('barber_id', barberId)
        .eq('date', selectedDate)

      if (specialHoursError) {
        throw specialHoursError
      }

      // If there are special hours and the barber is closed, return no slots
      if (specialHours?.[0]?.is_closed) {
        setAvailableTimeSlots([])
        return
      }

      // Build slots from either special hours or regular availability
      const slots: string[] = []

      if (specialHours?.[0]) {
        const start = new Date(`2000-01-01T${specialHours[0].start_time}`)
        const end = new Date(`2000-01-01T${specialHours[0].end_time}`)
        for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotInterval)) {
          const timeStr = time.toTimeString().slice(0, 5)
          slots.push(timeStr)
        }
      } else {
        // If no special hours, use regular availability
        const dayOfWeek = date.getDay()
        const { data: availability, error: availabilityError } = await supabase
          .from('availability')
          .select('*')
          .eq('barber_id', barberId)
          .eq('day_of_week', dayOfWeek)

        if (availabilityError) throw availabilityError

        if (availability?.[0]) {
          const start = new Date(`2000-01-01T${availability[0].start_time}`)
          const end = new Date(`2000-01-01T${availability[0].end_time}`)
          for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + timeSlotInterval)) {
            const timeStr = time.toTimeString().slice(0, 5)
            slots.push(timeStr)
          }
        }
      }

      // Log generated slots
      logger.debug('Generated slots', { slots })

      setAvailableTimeSlots(slots)
    } catch (error) {
      logger.error('Error fetching availability', error)
      toast({
        title: "Error",
        description: "Failed to load available time slots. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const service = services.find(s => s.id === formData.serviceId)
    if (!service) {
      toast({
        title: "Error",
        description: "Please select a service.",
        variant: "destructive",
      })
      return
    }

    if (!formData.time) {
      toast({
        title: "Error",
        description: "Please select a time.",
        variant: "destructive",
      })
      return
    }

    // If user is not authenticated, validate guest information
    if (!user && (!formData.guestName || !formData.guestEmail || !formData.guestPhone)) {
      toast({
        title: "Error",
        description: "Please fill in all guest information.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const bookingDate = new Date(date)
      bookingDate.setHours(parseInt(formData.time.split(':')[0]), parseInt(formData.time.split(':')[1]), 0, 0)

      // Check if this is a developer account
      if (isDeveloperAccount) {
        // Use developer booking API for developer accounts
        const response = await fetch('/api/create-developer-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
        barberId,
        serviceId: formData.serviceId,
        date: bookingDate.toISOString(),
        notes: formData.notes,
            guestName: user ? undefined : formData.guestName,
            guestEmail: user ? undefined : formData.guestEmail,
            guestPhone: user ? undefined : formData.guestPhone,
        clientId: user?.id || null,
            paymentType: 'fee',
            addonIds: selectedAddonIds
          })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create developer booking')
        }

        toast({
          title: "Success!",
          description: "Your booking has been created successfully (developer mode - no payment required).",
        })

        onBookingCreated(data.booking)
      } else {
        // For regular accounts, create Stripe Checkout session
        if (!user) {
          toast({
            title: "Error",
            description: "Please sign in to book with this barber.",
            variant: "destructive",
          })
          return
        }

        logger.debug('Creating Stripe Checkout session for web booking...')
        
        // Create Stripe Checkout session
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberId,
            serviceId: formData.serviceId,
            date: bookingDate.toISOString(),
            notes: formData.notes,
            clientId: user.id,
            paymentType: 'fee',
            addonIds: selectedAddonIds
          })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session')
        }

        logger.debug('Checkout session created', { data })

        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (error) {
      logger.error('Error creating booking', error)
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleServiceChange = (serviceId: string) => {
    setFormData({ ...formData, serviceId })
    setSelectedService(services.find(s => s.id === serviceId) || null)
    setFormData({ ...formData, serviceId, time: '' }) // Reset time when service changes
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getDayName = (date: Date) => DAYS[date.getDay()]
  const getMonthName = (date: Date) => date.toLocaleDateString('en-US', { month: 'long' })

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!formData.serviceId
      case 2: return !!formData.time
      case 3: return user || (isDeveloperAccount && formData.guestName && formData.guestEmail && formData.guestPhone)
      case 4: return true
      default: return false
    }
  }

  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Choose Your Service"
      case 2: return "Pick Your Time"
      case 3: return "Your Information"
      case 4: return "Review & Book"
      default: return ""
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return "Select the service you'd like to book"
      case 2: return "Choose your preferred appointment time"
      case 3: return "Provide your contact information"
      case 4: return "Review your booking details and confirm"
      default: return ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full bg-black border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-0 overflow-hidden mb-[200px] md:mb-0 max-h-[95vh] md:max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle className="text-2xl font-bold text-white">{getStepTitle()}</DialogTitle>
              <DialogDescription className="text-white/60 mt-1">{getStepDescription()}</DialogDescription>
            </div>

          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-secondary to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  step < currentStep 
                    ? "bg-secondary text-black" 
                    : step === currentStep 
                    ? "bg-secondary/20 text-secondary border-2 border-secondary" 
                    : "bg-white/10 text-white/40"
                )}>
                  {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
                </div>
                <span className={cn(
                  "text-xs mt-1 transition-colors",
                  step <= currentStep ? "text-white" : "text-white/40"
                )}>
                  {step === 1 && "Service"}
                  {step === 2 && "Time"}
                  {step === 3 && "Info"}
                  {step === 4 && "Book"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[50vh] sm:max-h-[55vh] md:max-h-[75vh] lg:max-h-[80vh] overflow-y-auto pb-40 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-track-rounded-full scroll-smooth hover:scrollbar-thumb-white/30 transition-all duration-200">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <div className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scissors className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">What service do you need?</h3>
                <p className="text-white/60">Choose from our available services</p>
              </div>

              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className={cn(
                      "relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group",
                      formData.serviceId === service.id
                        ? "border-secondary bg-secondary/10 shadow-lg shadow-secondary/20"
                        : "border-white/10 bg-white/5 hover:border-secondary/30 hover:bg-white/10"
                    )}
                    onClick={() => handleServiceChange(service.id)}
                  >
                    {/* Selection indicator */}
                    {formData.serviceId === service.id && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-black" />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-2">{service.name}</h4>
                        {service.description && (
                          <p className="text-white/60 text-sm mb-3">{service.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-white/60">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration} min</span>
                          </div>
                          <Badge className="bg-secondary/20 text-secondary border-secondary/30">
                            Popular
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-3xl font-bold text-secondary">${service.price}</div>
                        <div className="text-white/40 text-sm">per service</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add-on Selector */}
              {addons.length > 0 && (
                <div className="pt-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-secondary" />
                    Enhance Your Service (Optional)
                  </h4>
                  <AddonSelector
                    barberId={barberId}
                    selectedAddonIds={selectedAddonIds}
                    onAddonChange={setSelectedAddonIds}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time Selection */}
          {currentStep === 2 && (
            <div className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">When works best for you?</h3>
                <p className="text-white/60">Pick your preferred date and time</p>
              </div>

          {/* Date Selection */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-secondary" />
                  Select Date
                </h4>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  disabled={(date) => date < new Date()}
                  className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center text-white mb-4",
                    caption_label: "text-lg font-bebas tracking-wide text-white",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-8 w-8 bg-white/10 border border-white/20 rounded-lg p-0 opacity-70 hover:opacity-100 hover:bg-white/20 text-white transition-all duration-200",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-2",
                    head_row: "flex mb-2",
                    head_cell: "text-white/70 rounded-md w-10 font-medium text-sm tracking-wide",
                    row: "flex w-full mt-1",
                    cell: "h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-10 w-10 p-0 font-medium aria-selected:opacity-100 text-white hover:bg-white/10 hover:border hover:border-secondary/50 rounded-xl transition-all duration-200 focus:bg-white/10 focus:border-secondary/50",
                    day_range_end: "day-range-end",
                    day_selected: "bg-gradient-to-br from-secondary to-orange-500 text-white font-bold shadow-lg shadow-secondary/25 scale-110 border-2 border-secondary/50 rounded-xl transition-all duration-200",
                    day_today: "bg-secondary/20 text-secondary font-bold border-2 border-secondary/50 rounded-xl",
                    day_outside: "day-outside text-white/20 opacity-30 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                    day_disabled: "text-white/20 opacity-20 aria-selected:bg-background aria-selected:text-muted-foreground cursor-not-allowed",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    day_hidden: "invisible",
                  }}
                />
                      </div>

          {/* Time Selection */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  Select Time
                </h4>
                
                {availableTimeSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {availableTimeSlots.map((time) => {
                      const [hours, minutes] = time.split(':').map((t) => parseInt(t))
                      const slotDateTime = new Date(date)
                      slotDateTime.setHours(hours, minutes, 0, 0)
                      const isPast = slotDateTime <= new Date()
                      const isBooked = bookedTimes.has(time)
                      const isDisabled = isPast || isBooked

                      return (
                        <Button
                          key={time}
                          type="button"
                          variant="ghost"
                          disabled={isDisabled}
                          className={cn(
                            "h-16 text-sm font-medium transition-all duration-300 relative overflow-hidden group",
                            isDisabled
                              ? "bg-white/5 border border-white/10 text-white/40 opacity-50 cursor-not-allowed"
                              : formData.time === time
                                ? "bg-gradient-to-br from-secondary to-orange-500 text-white border-2 border-secondary/50 shadow-lg scale-105 transform"
                                : "bg-white/5 border border-white/20 text-white hover:bg-gradient-to-br hover:from-secondary/20 hover:to-orange-500/20 hover:border-secondary/50 hover:scale-105 hover:shadow-md"
                          )}
                          onClick={() => {
                            if (!isDisabled) setFormData({ ...formData, time })
                          }}
                        >
                          <div className="font-semibold">{formatTime(time)}</div>
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                      <Clock className="h-16 w-16 mx-auto text-white/30 mb-4" />
                    <p className="text-white/70 font-semibold text-lg mb-2">No Available Slots</p>
                    <p className="text-white/50 text-sm">This date appears to be fully booked</p>
                  </div>
                )}
              </div>
            </div>
          )}

                     {/* Step 3: Guest Information */}
           {currentStep === 3 && (
             <div className="space-y-6 pb-8">
               <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <User className="h-8 w-8 text-secondary" />
                    </div>
                 <h3 className="text-xl font-bold text-white mb-2">Tell us about yourself</h3>
                 <p className="text-white/60">We'll use this to confirm your booking</p>
                  </div>
                  
               {!user ? (
                 isDeveloperAccount ? (
                  <div className="space-y-4">
                    <div>
                       <Label htmlFor="guestName" className="text-white font-medium mb-2 block">Full Name *</Label>
                      <Input
                        id="guestName"
                        value={formData.guestName}
                        onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                        placeholder="Enter your full name"
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                      />
                    </div>
                    <div>
                       <Label htmlFor="guestEmail" className="text-white font-medium mb-2 block">Email Address *</Label>
                      <Input
                        id="guestEmail"
                        type="email"
                        value={formData.guestEmail}
                        onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                        placeholder="Enter your email"
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                      />
                    </div>
                    <div>
                       <Label htmlFor="guestPhone" className="text-white font-medium mb-2 block">Phone Number *</Label>
                      <Input
                        id="guestPhone"
                        value={formData.guestPhone}
                        onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                        placeholder="Enter your phone number"
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                      />
                    </div>
                  </div>
                 ) : (
                   <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                     <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                       <X className="h-6 w-6 text-red-400" />
                     </div>
                     <h4 className="text-lg font-semibold text-white mb-2">Sign In Required</h4>
                     <p className="text-white/60">Please sign in to book with this barber</p>
                   </div>
                 )
               ) : (
                 <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 text-center">
                   <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle className="h-6 w-6 text-secondary" />
                   </div>
                   <h4 className="text-lg font-semibold text-white mb-2">Welcome back, {user.name}!</h4>
                   <p className="text-white/60">We'll use your account information for this booking</p>
                </div>
          )}

          {/* Notes */}
               <div>
                 <Label htmlFor="notes" className="text-white font-medium mb-2 block">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl min-h-[100px]"
                />
                          </div>
                        </div>
                      )}
                      
                     {/* Step 4: Review & Payment */}
           {currentStep === 4 && (
             <form onSubmit={handleSubmit} className="space-y-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-secondary" />
                          </div>
                <h3 className="text-xl font-bold text-white mb-2">Review Your Booking</h3>
                <p className="text-white/60">Confirm your details and complete payment</p>
                      </div>
                      
              {/* Booking Summary */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  Booking Summary
                </h4>

                      {selectedService && (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div>
                      <p className="text-white font-semibold">{selectedService.name}</p>
                      <p className="text-white/60 text-sm">{formatTime(formData.time)} • {date.toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                      <p className="text-xl font-bold text-secondary">${selectedService.price}</p>
                          </div>
                        </div>
                      )}
                      
                {/* Add-ons */}
                      {selectedAddonIds.length > 0 && (
                  <div className="space-y-2">
                    {selectedAddonIds.map((addonId) => {
                      const addon = addons.find(a => a.id === addonId)
                      return addon ? (
                        <div key={addonId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div>
                            <p className="text-white font-medium">{addon.name}</p>
                            <p className="text-white/60 text-sm">Add-on service</p>
                          </div>
                          <div className="text-right">
                            <p className="text-secondary font-semibold">+${addon.price}</p>
                          </div>
                        </div>
                      ) : null
                    })}
                        </div>
                      )}
                      
                      {/* Platform Fee */}
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-white font-medium">Platform Fee</p>
                     <p className="text-white/60 text-sm">
                       {isDeveloperAccount ? 'Developer account - no charge' : 'Secure payment processing'}
                     </p>
                        </div>
                        <div className="text-right">
                     <p className="text-lg font-bold text-secondary">
                       {isDeveloperAccount ? '$0.00' : '$3.38'}
                     </p>
                     <Badge className={cn(
                       "text-xs",
                       isDeveloperAccount 
                         ? "bg-green-500/20 text-green-400 border-green-500/30"
                         : "bg-green-500/20 text-green-400 border-green-500/30"
                     )}>
                       {isDeveloperAccount ? 'Developer' : 'Secure'}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Total */}
                 <div className="flex items-center justify-between p-4 bg-gradient-to-r from-secondary/10 to-orange-500/10 border border-secondary/20 rounded-xl">
                        <div>
                          <p className="text-white font-bold text-lg">Total</p>
                          <p className="text-white/60 text-sm">Amount to be charged</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-secondary">
                       {isDeveloperAccount ? '$0.00' : '$3.38'}
                          </p>
                        </div>
                      </div>

                                 <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                   <p className="text-blue-400 text-sm">
                     {isDeveloperAccount 
                       ? 'Developer account - no platform fees charged. Service cost and any add-ons will be paid directly to the barber at your appointment.'
                       : 'You will be redirected to Stripe to complete your payment securely. Your booking will be confirmed automatically after payment.'
                     }
                   </p>
                                 </div>
               </div>

               {/* Navigation Buttons for Step 4 */}
               <div className="flex gap-3 pt-6 pb-4 border-t border-white/10">
                 <Button 
                   type="button" 
                   variant="outline" 
                   onClick={prevStep}
                   className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl"
                 >
                   <ChevronLeft className="h-4 w-4 mr-2" />
                   Back
                 </Button>
                 
                 <Button 
                   type="submit" 
                   disabled={loading || !canProceed()}
                   className="flex-1 bg-secondary text-black font-semibold rounded-xl hover:bg-secondary/90"
                 >
                   {loading ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Redirecting to Payment...
                     </>
                   ) : (
                     <>
                       <CreditCard className="mr-2 h-4 w-4" />
                       {isDeveloperAccount ? 'Complete Booking' : 'Proceed to Payment'}
                     </>
                   )}
                 </Button>
               </div>
             </form>
           )}

          {/* Navigation Buttons for Steps 1-3 */}
          {currentStep < 4 && (
            <div className="flex gap-3 pt-6 pb-4 border-t border-white/10">
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={prevStep}
                  className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              
              <Button 
                type="button" 
                onClick={handleNextStep}
                disabled={!canProceed()}
                className="flex-1 bg-secondary text-black font-semibold rounded-xl hover:bg-secondary/90 relative z-10"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
