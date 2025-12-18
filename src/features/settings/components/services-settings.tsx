import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/components/ui/use-toast'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Loader2, Plus, Edit, Trash2, Scissors, AlertCircle, CheckCircle, Sparkles, Clock, DollarSign, Package } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { logger } from '@/shared/lib/logger'

interface Service {
  id?: string
  name: string
  duration: number // in minutes
  price: number
  description?: string
  barber_id: string
}

interface ServiceFormData {
  name: string
  price: number
  duration: number
  description: string
}

interface ServicesSettingsProps {
  onUpdate?: () => void
}

export function ServicesSettings({ onUpdate }: ServicesSettingsProps) {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()
  const { user } = useAuth()
  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<ServiceFormData>()

  // Load barber ID and services
  useEffect(() => {
    if (user) {
      loadBarberId()
    }
  }, [user])

  const loadBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      if (data) {
        setBarberId(data.id)
        loadServices(data.id)
      }
    } catch (error) {
      logger.error('Error loading barber ID', error)
      toast({
        title: 'Error',
        description: 'Failed to load barber information. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const loadServices = async (barberId: string) => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberId)
        .order('name')

      if (error) throw error
      if (data) setServices(data)
    } catch (error) {
      logger.error('Error loading services', error)
      toast({
        title: 'Error',
        description: 'Failed to load services. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (data: ServiceFormData): boolean => {
    const errors: {[key: string]: string} = {}
    
    if (!data.name?.trim()) errors.name = 'Service name is required'
    if (!data.duration || data.duration < 1) errors.duration = 'Duration must be at least 1 minute'
    if (!data.price || data.price < 0) errors.price = 'Price must be at least $0'
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Add or update service
  const onSubmit = async (data: ServiceFormData) => {
    if (!barberId) {
      toast({
        title: 'Error',
        description: 'Barber information not found. Please try again.',
        variant: 'destructive',
      })
      return
    }

    // Validate form
    if (!validateForm(data)) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      if (editingService) {
        // Update existing service
        const { error: updateError } = await supabase
          .from('services')
          .update({
            name: data.name,
            price: data.price,
            duration: data.duration,
            description: data.description,
          })
          .eq('id', editingService.id)

        if (updateError) {
          logger.error('Error updating service', updateError)
          toast({
            title: 'Error',
            description: 'Failed to update service. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Service updated successfully',
        })
      } else {
        // Add new service
        const { error: insertError } = await supabase
          .from('services')
          .insert({
            barber_id: barberId,
            name: data.name,
            price: data.price,
            duration: data.duration,
            description: data.description,
          })

        if (insertError) {
          logger.error('Error creating service', insertError)
          toast({
            title: 'Error',
            description: 'Failed to create service. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Service added successfully',
        })
      }
      
      await loadServices(barberId)
      reset()
      setEditingService(null)
      
      // Call onUpdate to refresh settings data
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving service', error)
      toast({
        title: 'Error',
        description: 'Failed to save service. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete service
  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Service deleted successfully',
      })
      
      await loadServices(barberId!)
      onUpdate?.()
    } catch (error) {
      logger.error('Error deleting service', error)
      toast({
        title: 'Error',
        description: 'Failed to delete service. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const editService = (service: Service) => {
    setEditingService(service)
    setValue('name', service.name)
    setValue('price', service.price)
    setValue('duration', service.duration)
    setValue('description', service.description || '')
  }

  const cancelEdit = () => {
    setEditingService(null)
    reset()
    setValidationErrors({})
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim()
    }
    return `${mins}m`
  }

  if (isLoading && services.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-secondary/20 rounded-full">
              <Scissors className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bebas text-white tracking-wide">
                Services
              </h3>
              <p className="text-white/80 mt-1">Manage your service offerings</p>
            </div>
          </div>
        </div>
        
        <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-secondary" />
                  <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
                </div>
                <p className="text-white/60 font-medium">Loading services...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl shadow-lg">
            <Scissors className="h-8 w-8 text-secondary" />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bebas text-white tracking-wide">
              Services Management
            </h2>
            <p className="text-white/70 text-lg mt-2">Create and manage your service offerings</p>
          </div>
        </div>
      </div>

      {/* Enhanced Add Service Form */}
      <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-secondary/10 to-transparent border-b border-white/10 p-6">
          <CardTitle className="text-white flex items-center gap-3 text-2xl">
            {editingService ? (
              <>
                <div className="p-2 bg-secondary/20 rounded-xl">
                  <Edit className="h-6 w-6 text-secondary" />
                </div>
                Edit Service
              </>
            ) : (
              <>
                <div className="p-2 bg-secondary/20 rounded-xl">
                  <Plus className="h-6 w-6 text-secondary" />
                </div>
                Add New Service
              </>
            )}
          </CardTitle>
          <CardDescription className="text-white/70 text-base">
            {editingService ? 'Update your service details and pricing' : 'Add a new service to your offerings and set competitive pricing'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-white font-semibold text-lg flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-secondary" />
                  Service Name *
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary rounded-xl h-12 text-lg"
                  placeholder="e.g., Haircut, Beard Trim"
                />
                {validationErrors.name && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.name}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="price" className="text-white font-semibold text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-secondary" />
                  Price ($) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('price', { valueAsNumber: true })}
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary rounded-xl h-12 text-lg"
                  placeholder="25.00"
                />
                {validationErrors.price && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.price}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="duration" className="text-white font-semibold text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-secondary" />
                  Duration (minutes) *
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  {...register('duration', { valueAsNumber: true })}
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary rounded-xl h-12 text-lg"
                  placeholder="30"
                />
                {validationErrors.duration && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.duration}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-white font-semibold text-lg flex items-center gap-2">
                  <Package className="h-4 w-4 text-secondary" />
                  Description
                </Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary rounded-xl text-lg min-h-[80px] resize-none"
                  placeholder="Brief description of the service"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-semibold shadow-lg rounded-xl px-8 py-3 text-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                {editingService ? 'Update Service' : 'Add Service'}
              </Button>
              
              {editingService && (
                <Button
                  type="button"
                  onClick={cancelEdit}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 rounded-xl px-8 py-3 text-lg"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Enhanced Services List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/20 rounded-xl">
              <Scissors className="h-5 w-5 text-secondary" />
            </div>
            <h3 className="text-2xl font-bebas text-white tracking-wide">Your Services</h3>
          </div>
          <Badge variant="secondary" className="text-sm px-4 py-2 bg-secondary/20 text-secondary border-secondary/30">
            {services.length} {services.length === 1 ? 'Service' : 'Services'}
          </Badge>
        </div>
        
        {services.length === 0 ? (
          <Card className="bg-gradient-to-br from-white/5 to-white/3 border border-white/10 shadow-xl backdrop-blur-xl rounded-3xl">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center gap-6">
                <div className="p-6 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-3xl">
                  <Sparkles className="h-12 w-12 text-secondary" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-2xl font-bebas text-white tracking-wide">No Services Yet</h4>
                  <p className="text-white/60 text-lg">Add your first service to start accepting bookings</p>
                </div>
                <Button
                  onClick={() => document.getElementById('name')?.focus()}
                  className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary/80 text-primary font-semibold shadow-lg rounded-xl px-8 py-3 text-lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Service
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {services.map((service) => (
              <Card key={service.id} className="bg-gradient-to-br from-white/5 to-white/3 border border-white/10 shadow-xl backdrop-blur-xl hover:shadow-2xl hover:border-secondary/20 transition-all duration-300 rounded-3xl group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h4 className="text-xl font-bebas text-white tracking-wide">{service.name}</h4>
                        <Badge variant="secondary" className="text-sm px-3 py-1 bg-secondary/20 text-secondary border-secondary/30">
                          ${service.price}
                        </Badge>
                        <div className="flex items-center gap-2 text-white/60 text-sm bg-white/5 px-3 py-1 rounded-full">
                          <Clock className="h-4 w-4" />
                          {formatDuration(service.duration)}
                        </div>
                      </div>
                      {service.description && (
                        <p className="text-white/70 text-base leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{service.description}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => editService(service)}
                        className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl p-3"
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteService(service.id!)}
                        disabled={isLoading}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl p-3"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Tips Section */}
      <Card className="bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent border border-secondary/20 shadow-xl backdrop-blur-xl rounded-3xl">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-2xl">
              <Sparkles className="h-6 w-6 text-secondary" />
            </div>
            <div className="space-y-4">
              <h4 className="text-xl font-bebas text-white tracking-wide">Pro Tips for Success</h4>
              <ul className="text-white/70 space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Set competitive prices based on your location and experience level</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Be accurate with duration estimates to avoid scheduling conflicts</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Add detailed descriptions to help clients understand your services</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-base">Consider offering package deals for multiple services</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 