"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useToast } from '@/shared/components/ui/use-toast'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'
import { 
  Phone, 
  MapPin, 
  Clock, 
  DollarSign,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react'

const ondemandSettingsSchema = z.object({
  is_enabled: z.boolean(),
  availability_radius_miles: z.number().min(1).max(50),
  min_notice_minutes: z.number().min(0).max(120),
  max_notice_hours: z.number().min(1).max(72),
  surge_pricing_enabled: z.boolean(),
  surge_multiplier: z.number().min(1.0).max(3.0),
})

type OnDemandSettingsFormData = z.infer<typeof ondemandSettingsSchema>

interface OnDemandSettingsProps {
  barberId: string
  onUpdate?: () => void
}

export function OnDemandSettings({ barberId, onUpdate }: OnDemandSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const form = useForm<OnDemandSettingsFormData>({
    resolver: zodResolver(ondemandSettingsSchema),
    defaultValues: {
      is_enabled: false,
      availability_radius_miles: 5,
      min_notice_minutes: 30,
      max_notice_hours: 24,
      surge_pricing_enabled: false,
      surge_multiplier: 1.5,
    },
  })

  useEffect(() => {
    if (barberId) {
      loadOnDemandSettings()
    }
  }, [barberId])

  const loadOnDemandSettings = async () => {
    try {
      setInitialLoading(true)

      const { data, error } = await supabase
        .from('ondemand_settings')
        .select('*')
        .eq('barber_id', barberId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        form.reset({
          is_enabled: data.is_enabled,
          availability_radius_miles: data.availability_radius_miles,
          min_notice_minutes: data.min_notice_minutes,
          max_notice_hours: data.max_notice_hours,
          surge_pricing_enabled: data.surge_pricing_enabled,
          surge_multiplier: data.surge_multiplier,
        })
      }
    } catch (error) {
      logger.error('Error loading on-demand settings', error)
      toast({
        title: 'Error',
        description: 'Failed to load on-demand settings',
        variant: 'destructive',
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const onSubmit = async (data: OnDemandSettingsFormData) => {
    try {
      setLoading(true)

      const { error } = await supabase
        .from('ondemand_settings')
        .upsert({
          barber_id: barberId,
          is_enabled: data.is_enabled,
          availability_radius_miles: data.availability_radius_miles,
          min_notice_minutes: data.min_notice_minutes,
          max_notice_hours: data.max_notice_hours,
          surge_pricing_enabled: data.surge_pricing_enabled,
          surge_multiplier: data.surge_multiplier,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: data.is_enabled 
          ? 'On-demand calling enabled! Clients can now request immediate service.' 
          : 'On-demand calling disabled.',
      })

      onUpdate?.()
    } catch (error) {
      logger.error('Error updating on-demand settings', error)
      toast({
        title: 'Error',
        description: 'Failed to update on-demand settings',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            On-Demand Calling
          </CardTitle>
          <CardDescription>
            Enable on-demand calling to allow clients to request immediate service, similar to Uber Eats. Clients can request you to come to their location or visit your location for urgent appointments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Enable/Disable On-Demand */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable On-Demand Calling</FormLabel>
                        <FormDescription>
                          When enabled, clients can request immediate service and you'll receive notifications for urgent requests.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('is_enabled') && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>On-demand calling is now active!</strong> Clients can request immediate service within your specified radius and time windows.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {form.watch('is_enabled') && (
                <>
                  <Separator />

                  {/* Service Area */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Service Area
                    </h3>
                    
                    <FormField
                      control={form.control}
                      name="availability_radius_miles"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Radius (miles)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum distance you're willing to travel for on-demand requests. Clients within this radius can request your service.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Time Windows */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Time Windows
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="min_notice_minutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Notice (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="120"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormDescription>
                              Minimum time you need to prepare for an on-demand request.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="max_notice_hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Notice (hours)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="72"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormDescription>
                              How far in advance clients can request on-demand service.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Surge Pricing */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Surge Pricing
                    </h3>
                    
                    <FormField
                      control={form.control}
                      name="surge_pricing_enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Surge Pricing</FormLabel>
                            <FormDescription>
                              Automatically increase prices during high-demand periods to incentivize availability.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch('surge_pricing_enabled') && (
                      <FormField
                        control={form.control}
                        name="surge_multiplier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Surge Price Multiplier</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1.0"
                                max="3.0"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 1.0)}
                              />
                            </FormControl>
                            <FormDescription>
                              Multiply your regular service prices by this factor during surge periods (e.g., 1.5x = 50% increase).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="min-w-[120px]">
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How On-Demand Calling Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p><strong>Client Requests:</strong> Clients can request immediate service through the app, specifying their location and preferred time.</p>
            <p><strong>Notifications:</strong> You'll receive push notifications for new on-demand requests within your service area.</p>
            <p><strong>Accept/Decline:</strong> You can accept or decline requests based on your availability and preferences.</p>
            <p><strong>Surge Pricing:</strong> During busy periods, prices automatically increase to encourage more barbers to be available.</p>
            <p><strong>Location Services:</strong> The app uses GPS to match clients with nearby barbers and calculate travel distances.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 