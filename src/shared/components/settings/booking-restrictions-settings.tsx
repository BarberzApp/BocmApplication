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
  Clock, 
  Calendar, 
  Users, 
  AlertCircle,
  Info,
  Settings
} from 'lucide-react'

const bookingRestrictionsSchema = z.object({
  min_interval_minutes: z.number().min(0).max(60),
  max_bookings_per_day: z.number().min(1).max(50),
  advance_booking_days: z.number().min(0).max(365),
  same_day_booking_enabled: z.boolean(),
})

type BookingRestrictionsFormData = z.infer<typeof bookingRestrictionsSchema>

interface BookingRestrictionsSettingsProps {
  barberId: string
  onUpdate?: () => void
}

export function BookingRestrictionsSettings({ barberId, onUpdate }: BookingRestrictionsSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const form = useForm<BookingRestrictionsFormData>({
    resolver: zodResolver(bookingRestrictionsSchema),
    defaultValues: {
      min_interval_minutes: 5,
      max_bookings_per_day: 10,
      advance_booking_days: 30,
      same_day_booking_enabled: true,
    },
  })

  useEffect(() => {
    if (barberId) {
      loadBookingRestrictions()
    }
  }, [barberId])

  const loadBookingRestrictions = async () => {
    try {
      setInitialLoading(true)

      const { data, error } = await supabase
        .from('booking_restrictions')
        .select('*')
        .eq('barber_id', barberId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        form.reset({
          min_interval_minutes: data.min_interval_minutes,
          max_bookings_per_day: data.max_bookings_per_day,
          advance_booking_days: data.advance_booking_days,
          same_day_booking_enabled: data.same_day_booking_enabled,
        })
      }
    } catch (error) {
      logger.error('Error loading booking restrictions', error)
      toast({
        title: 'Error',
        description: 'Failed to load booking restrictions',
        variant: 'destructive',
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const onSubmit = async (data: BookingRestrictionsFormData) => {
    try {
      setLoading(true)

      const { error } = await supabase
        .from('booking_restrictions')
        .upsert({
          barber_id: barberId,
          min_interval_minutes: data.min_interval_minutes,
          max_bookings_per_day: data.max_bookings_per_day,
          advance_booking_days: data.advance_booking_days,
          same_day_booking_enabled: data.same_day_booking_enabled,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Booking restrictions updated successfully!',
      })

      onUpdate?.()
    } catch (error) {
      logger.error('Error updating booking restrictions', error)
      toast({
        title: 'Error',
        description: 'Failed to update booking restrictions',
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
            <Settings className="h-5 w-5" />
            Booking Restrictions
          </CardTitle>
          <CardDescription>
            Configure how clients can book appointments with you. These settings help manage your schedule and prevent booking conflicts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Minimum Interval Between Bookings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Between Bookings
                </h3>
                
                <FormField
                  control={form.control}
                  name="min_interval_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Interval (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum time required between consecutive bookings. This ensures you have enough time to complete each service and prepare for the next client.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recommended:</strong> 5-15 minutes between bookings. This allows for cleanup, preparation, and buffer time for services that run longer than expected.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              {/* Daily Booking Limits */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Daily Limits
                </h3>
                
                <FormField
                  control={form.control}
                  name="max_bookings_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Bookings Per Day</FormLabel>
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
                        Maximum number of bookings you can accept per day. This helps prevent overbooking and ensures quality service.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Advance Booking Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Advance Booking Settings
                </h3>
                
                <FormField
                  control={form.control}
                  name="advance_booking_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Advance Booking Limit (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        How far in advance clients can book appointments. Set to 0 for no limit, or specify the number of days.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="same_day_booking_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow Same-Day Bookings</FormLabel>
                        <FormDescription>
                          When enabled, clients can book appointments for the same day if slots are available.
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

                {!form.watch('same_day_booking_enabled') && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Same-day bookings are disabled. Clients will only be able to book appointments for future dates.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="min-w-[120px]">
                  {loading ? 'Saving...' : 'Save Restrictions'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How These Settings Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p><strong>Time Between Bookings:</strong> When a client books a 30-minute haircut at 2:00 PM, the next available slot will be at 2:35 PM (assuming 5-minute intervals).</p>
            <p><strong>Daily Limits:</strong> Once you reach your daily booking limit, no more appointments can be scheduled for that day.</p>
            <p><strong>Advance Booking:</strong> Clients can only book appointments within your specified advance booking window.</p>
            <p><strong>Same-Day Bookings:</strong> When disabled, clients must book at least one day in advance.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 