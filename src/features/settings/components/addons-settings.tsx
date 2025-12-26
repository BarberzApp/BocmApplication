import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/components/ui/use-toast'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Loader2, Plus, Edit, Trash2, Package, AlertCircle, CheckCircle, DollarSign } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { ServiceAddon, CreateServiceAddonInput, UpdateServiceAddonInput } from '@/shared/types/addon'
import { logger } from '@/shared/lib/logger'

interface AddonsSettingsProps {
  onUpdate?: () => void
}

interface AddonFormData {
  name: string
  description: string
  price: number
  is_active: boolean
}

export function AddonsSettings({ onUpdate }: AddonsSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<AddonFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      is_active: true
    }
  })

  const isActive = watch('is_active')

  useEffect(() => {
    if (user) {
      loadBarberId()
    }
  }, [user])

  useEffect(() => {
    if (barberId) {
      loadAddons(barberId)
    }
  }, [barberId])

  const loadBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      setBarberId(data.id)
    } catch (error) {
      logger.error('Error loading barber ID', error)
      toast({
        title: 'Error',
        description: 'Failed to load barber information.',
        variant: 'destructive',
      })
    }
  }

  const loadAddons = async (barberId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .order('name')

      if (error) throw error
      setAddons(data || [])
    } catch (error) {
      logger.error('Error loading add-ons', error)
      toast({
        title: 'Error',
        description: 'Failed to load add-ons. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const onSubmit = async (data: AddonFormData) => {
    if (!barberId) {
      toast({
        title: 'Error',
        description: 'Barber information not found.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      if (editingAddon) {
        // Update existing add-on
        const { error: updateError } = await supabase
          .from('service_addons')
          .update({
            name: data.name,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAddon.id)

        if (updateError) {
          logger.error('Error updating add-on', updateError)
          toast({
            title: 'Error',
            description: 'Failed to update add-on. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Add-on updated successfully',
        })
      } else {
        // Add new add-on
        const { error: insertError } = await supabase
          .from('service_addons')
          .insert({
            barber_id: barberId,
            name: data.name,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
          })

        if (insertError) {
          logger.error('Error creating add-on', insertError)
          toast({
            title: 'Error',
            description: 'Failed to create add-on. Please try again.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: 'Success',
          description: 'Add-on added successfully',
        })
      }
      
      await loadAddons(barberId)
      reset()
      setEditingAddon(null)
      
      // Call onUpdate to refresh settings data
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving add-on', error)
      toast({
        title: 'Error',
        description: 'Failed to save add-on. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (addon: ServiceAddon) => {
    setEditingAddon(addon)
    setValue('name', addon.name)
    setValue('description', addon.description || '')
    setValue('price', addon.price)
    setValue('is_active', addon.is_active)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return

    try {
      const { error } = await supabase
        .from('service_addons')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Add-on deleted successfully',
      })
      
      await loadAddons(barberId!)
    } catch (error) {
      logger.error('Error deleting add-on', error)
      toast({
        title: 'Error',
        description: 'Failed to delete add-on. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setEditingAddon(null)
    reset()
  }

  return (
    <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
      <CardHeader className="bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-saffron/20 rounded-full">
            <Package className="h-5 w-5 text-saffron" />
          </div>
          <div>
            <CardTitle className="text-xl font-bebas text-white tracking-wide">
              Service Add-ons
            </CardTitle>
            <CardDescription className="text-white/70">
              Manage additional services and items you offer (e.g., towels, premium products)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add/Edit Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Add-on Name</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="e.g., Fresh Towel, Premium Shampoo"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
              />
              {errors.name && (
                <p className="text-red-400 text-sm">{errors.name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price" className="text-white">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...register('price', { 
                  required: 'Price is required',
                  min: { value: 0, message: 'Price must be positive' }
                })}
                placeholder="5.00"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
              />
              {errors.price && (
                <p className="text-red-400 text-sm">{errors.price.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">Description (Optional)</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Brief description of what this add-on includes..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
              rows={3}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
            <Label htmlFor="is_active" className="text-white">Active (available for booking)</Label>
          </div>
          
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-saffron hover:bg-saffron/90 text-black font-semibold"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAddon ? 'Update Add-on' : 'Add Add-on'}
            </Button>
            
            {editingAddon && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        {/* Add-ons List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="h-4 w-4 text-saffron" />
            Your Add-ons ({addons.length})
          </h3>
          
          {addons.length === 0 ? (
            <Alert className="bg-white/5 border-white/10 rounded-2xl">
              <Package className="h-4 w-4 text-white/60" />
              <AlertDescription className="text-white/70">
                No add-ons created yet. Add your first add-on above to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{addon.name}</h4>
                      <Badge 
                        variant={addon.is_active ? "default" : "secondary"}
                        className={addon.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}
                      >
                        {addon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {addon.description && (
                      <p className="text-white/60 text-sm mb-2">{addon.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-saffron font-semibold">
                      <DollarSign className="h-4 w-4" />
                      <span>${addon.price.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(addon)}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(addon.id)}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 