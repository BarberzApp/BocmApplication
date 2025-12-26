"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { logger } from '@/shared/lib/logger'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog'
import { useToast } from '@/shared/components/ui/use-toast'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Calendar, Clock, User, DollarSign, Loader2, Plus, X, Scissors, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ManualAppointmentFormProps {
  isOpen: boolean
  onClose: () => void
  selectedDate?: Date
  onAppointmentCreated: (appointment: any) => void
}

interface Service {
  id: string
  name: string
  price: number
  duration: number
}

export function ManualAppointmentForm({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onAppointmentCreated 
}: ManualAppointmentFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [barberId, setBarberId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [existingAppointments, setExistingAppointments] = useState<any[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
    time: '',
    duration: 60,
    price: 0,
    notes: '',
    status: 'confirmed' as 'pending' | 'confirmed' | 'completed' | 'cancelled'
  })

  // Fetch barber ID and services when component opens
  useEffect(() => {
    if (isOpen && user) {
      fetchBarberData()
      setErrors({})
    }
  }, [isOpen, user])

  // Update date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        date: selectedDate.toISOString().split('T')[0]
      }))
    }
  }, [selectedDate])

  const fetchBarberData = async () => {
    try {
      // Get barber ID
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (barberError) throw barberError
      setBarberId(barberData.id)

      // Get services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('barber_id', barberData.id)
        .order('name')

      if (servicesError) throw servicesError
      setServices(servicesData || [])
    } catch (error) {
      logger.error('Error fetching barber data', error)
      toast({
        title: 'Error',
        description: 'Failed to load services.',
        variant: 'destructive',
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required'
    }

    if (!formData.serviceId) {
      newErrors.serviceId = 'Please select a service'
    }

    if (!formData.date) {
      newErrors.date = 'Please select a date'
    }

    if (!formData.time) {
      newErrors.time = 'Please select a time'
    }

    if (formData.duration < 15) {
      newErrors.duration = 'Duration must be at least 15 minutes'
    }

    // Check for time conflicts
    if (existingAppointments.length > 0) {
      newErrors.time = 'Selected time conflicts with existing appointments'
    }

    // Validate email format if provided
    if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      newErrors.clientEmail = 'Please enter a valid email address'
    }

    // Validate phone format if provided
    if (formData.clientPhone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.clientPhone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.clientPhone = 'Please enter a valid phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    setFormData(prev => ({
      ...prev,
      serviceId,
      price: service?.price || 0,
      duration: service?.duration || 60
    }))
    // Clear service error
    if (errors.serviceId) {
      setErrors(prev => ({ ...prev, serviceId: '' }))
    }
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    // Check availability when date, time, or duration changes
    if (['date', 'time', 'duration'].includes(field) && formData.date && formData.time) {
      checkAvailability()
    }
  }

  const checkAvailability = async () => {
    if (!barberId || !formData.date || !formData.time || !formData.duration) return
    
    setCheckingAvailability(true)
    try {
      const appointmentDate = new Date(`${formData.date}T${formData.time}`)
      const endTime = new Date(appointmentDate.getTime() + formData.duration * 60000)
      
      const { data: conflicts, error } = await supabase
        .from('bookings')
        .select('id, date, end_time, guest_name, service:service_id(name)')
        .eq('barber_id', barberId)
        .neq('status', 'cancelled')
        .or(`and(date.lt.${endTime.toISOString()},end_time.gt.${appointmentDate.toISOString()})`)
      
      if (error) throw error
      setExistingAppointments(conflicts || [])
    } catch (error) {
      logger.error('Error checking availability', error)
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form.',
        variant: 'destructive',
      })
      return
    }

    if (!barberId) {
      toast({
        title: 'Error',
        description: 'Barber profile not found.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const appointmentDate = new Date(`${formData.date}T${formData.time}`)
      const endTime = new Date(appointmentDate.getTime() + formData.duration * 60000)

      // Check if the appointment time is in the past
      if (appointmentDate < new Date()) {
        toast({
          title: 'Error',
          description: 'Cannot create appointments in the past.',
          variant: 'destructive',
        })
        return
      }

      const appointmentData = {
        barber_id: barberId,
        service_id: formData.serviceId,
        date: appointmentDate.toISOString(),
        end_time: endTime.toISOString(),
        status: formData.status,
        payment_status: 'succeeded', // Manual appointments are considered paid
        price: formData.price,
        notes: formData.notes,
        guest_name: formData.clientName,
        guest_email: formData.clientEmail || null,
        guest_phone: formData.clientPhone || null,
        client_id: null, // Manual appointments don't have a registered client
        payment_intent_id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        platform_fee: 0, // No platform fee for manual appointments
        barber_payout: formData.price
      }

      // Use the API endpoint to create booking (this will handle SMS notifications)
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create appointment')
      }

      toast({
        title: 'Success!',
        description: 'Manual appointment created successfully.',
      })

      onAppointmentCreated(data.booking)
      handleClose()
    } catch (error) {
      logger.error('Error creating manual appointment', error)
      toast({
        title: 'Error',
        description: 'Failed to create appointment. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      serviceId: '',
      date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
      time: '',
      duration: 60,
      price: 0,
      notes: '',
      status: 'confirmed'
    })
    setErrors({})
    onClose()
  }

  const selectedService = services.find(s => s.id === formData.serviceId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full bg-black/95 border border-white/20 backdrop-blur-xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-saffron/20 rounded-xl">
              <Plus className="h-6 w-6 text-saffron" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Add Manual Appointment
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Create an appointment directly in your calendar (e.g., walk-ins, phone bookings)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Information Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-saffron" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientName" className="text-white font-medium">
                  Client Name *
                </Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => handleInputChange('clientName', e.target.value)}
                  placeholder="Enter client name"
                  className={cn(
                    "bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron mt-1",
                    errors.clientName && "border-red-500 focus:border-red-500"
                  )}
                />
                {errors.clientName && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.clientName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientEmail" className="text-white font-medium">
                    Email
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                    placeholder="client@email.com"
                    className={cn(
                      "bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron mt-1",
                      errors.clientEmail && "border-red-500 focus:border-red-500"
                    )}
                  />
                  {errors.clientEmail && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.clientEmail}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="clientPhone" className="text-white font-medium">
                    Phone
                  </Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className={cn(
                      "bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron mt-1",
                      errors.clientPhone && "border-red-500 focus:border-red-500"
                    )}
                  />
                  {errors.clientPhone && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.clientPhone}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Selection Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Scissors className="h-5 w-5 text-saffron" />
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service" className="text-white font-medium">
                  Service *
                </Label>
                <Select value={formData.serviceId} onValueChange={handleServiceChange}>
                  <SelectTrigger className={cn(
                    "bg-white/10 border-white/20 text-white focus:border-saffron mt-1",
                    errors.serviceId && "border-red-500 focus:border-red-500"
                  )}>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-white/20">
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id} className="text-white">
                        {service.name} - ${service.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.serviceId && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.serviceId}
                  </p>
                )}
              </div>

              {selectedService && (
                <div className="bg-saffron/10 border border-saffron/20 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">Service Price:</span>
                    <span className="text-saffron font-semibold">${selectedService.price}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-white/80">Duration:</span>
                    <span className="text-white">{selectedService.duration} minutes</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date and Time Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-saffron" />
                Appointment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="text-white font-medium">
                    Date *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={cn(
                      "bg-white/10 border-white/20 text-white focus:border-saffron mt-1",
                      errors.date && "border-red-500 focus:border-red-500"
                    )}
                  />
                  {errors.date && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.date}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="time" className="text-white font-medium">
                    Time *
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    className={cn(
                      "bg-white/10 border-white/20 text-white focus:border-saffron mt-1",
                      errors.time && "border-red-500 focus:border-red-500"
                    )}
                  />
                  {errors.time && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.time}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="duration" className="text-white font-medium">
                  Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 60)}
                  className={cn(
                    "bg-white/10 border-white/20 text-white focus:border-saffron mt-1",
                    errors.duration && "border-red-500 focus:border-red-500"
                  )}
                  min="15"
                  step="15"
                />
                {errors.duration && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.duration}
                  </p>
                )}
              </div>

              {/* Price Section */}
              <div>
                <Label className="text-white font-medium">
                  Price
                </Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 bg-saffron/10 border border-saffron/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Service Price:</span>
                      <span className="text-saffron font-semibold">${formData.price}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleInputChange('price', 0)}
                    className={cn(
                      "bg-white/5 border-white/20 text-white hover:bg-white/10",
                      formData.price === 0 && "bg-green-500/20 border-green-500/40 text-green-300"
                    )}
                  >
                    Free
                  </Button>
                </div>
                {errors.price && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.price}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status" className="text-white font-medium">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value: any) => handleInputChange('status', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white focus:border-saffron mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-white/20">
                    <SelectItem value="confirmed" className="text-white">Confirmed</SelectItem>
                    <SelectItem value="pending" className="text-white">Pending</SelectItem>
                    <SelectItem value="completed" className="text-white">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Availability Check */}
              {formData.date && formData.time && (
                <div className="mt-4">
                  {/* Appointment Preview */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-200">Start Time:</span>
                      <span className="text-blue-300 font-medium">
                        {new Date(`${formData.date}T${formData.time}`).toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-blue-200">End Time:</span>
                      <span className="text-blue-300 font-medium">
                        {new Date(new Date(`${formData.date}T${formData.time}`).getTime() + formData.duration * 60000).toLocaleString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-blue-200">Duration:</span>
                      <span className="text-blue-300 font-medium">{formData.duration} minutes</span>
                    </div>
                  </div>

                  {checkingAvailability ? (
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking availability...
                    </div>
                  ) : existingAppointments.length > 0 ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                        <AlertCircle className="h-4 w-4" />
                        Time Slot Conflict
                      </div>
                      <p className="text-red-300 text-sm mb-3">
                        The selected time conflicts with existing appointments:
                      </p>
                      <div className="space-y-2">
                        {existingAppointments.map((appointment) => (
                          <div key={appointment.id} className="bg-red-500/10 rounded-lg p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-red-200 font-medium">
                                {appointment.guest_name}
                              </span>
                              <span className="text-red-300">
                                {new Date(appointment.date).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                            <div className="text-red-300 text-xs mt-1">
                              {appointment.service?.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-green-400 font-medium">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        Time slot available
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes about this appointment..."
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-saffron text-black hover:bg-saffron/90 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 