"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useToast } from '@/shared/components/ui/use-toast'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { 
  Clock, 
  Calendar, 
  Plus,
  Trash2,
  Settings,
  Info,
  AlertCircle
} from 'lucide-react'
import { SchedulingSlot } from '@/shared/types/booking-restrictions'
import { logger } from '@/shared/lib/logger'

const schedulingSlotSchema = z.object({
  day_of_week: z.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  slot_duration_minutes: z.number().min(15).max(120),
  buffer_minutes_before: z.number().min(0).max(60),
  buffer_minutes_after: z.number().min(0).max(60),
  max_bookings_per_slot: z.number().min(1).max(10),
  is_active: z.boolean(),
})

type SchedulingSlotFormData = z.infer<typeof schedulingSlotSchema>

interface AdvancedSchedulingSlotsProps {
  barberId: string
  onUpdate?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AdvancedSchedulingSlots({ barberId, onUpdate }: AdvancedSchedulingSlotsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [schedulingSlots, setSchedulingSlots] = useState<SchedulingSlot[]>([])
  const [editingSlot, setEditingSlot] = useState<SchedulingSlot | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const form = useForm<SchedulingSlotFormData>({
    resolver: zodResolver(schedulingSlotSchema),
    defaultValues: {
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      slot_duration_minutes: 30,
      buffer_minutes_before: 0,
      buffer_minutes_after: 0,
      max_bookings_per_slot: 1,
      is_active: true,
    },
  })

  useEffect(() => {
    if (barberId) {
      loadSchedulingSlots()
    }
  }, [barberId])

  const loadSchedulingSlots = async () => {
    try {
      setInitialLoading(true)

      const { data, error } = await supabase
        .from('scheduling_slots')
        .select('*')
        .eq('barber_id', barberId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error

      setSchedulingSlots(data || [])
    } catch (error) {
      logger.error('Error loading scheduling slots', error)
      toast({
        title: 'Error',
        description: 'Failed to load scheduling slots',
        variant: 'destructive',
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const onSubmit = async (data: SchedulingSlotFormData) => {
    try {
      setLoading(true)

      const slotData = {
        barber_id: barberId,
        ...data,
        updated_at: new Date().toISOString(),
      }

      if (editingSlot) {
        // Update existing slot
        const { error } = await supabase
          .from('scheduling_slots')
          .update(slotData)
          .eq('id', editingSlot.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Scheduling slot updated successfully!',
        })
      } else {
        // Create new slot
        const { error } = await supabase
          .from('scheduling_slots')
          .insert(slotData)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Scheduling slot created successfully!',
        })
      }

      // Reset form and reload data
      form.reset()
      setEditingSlot(null)
      setShowAddForm(false)
      await loadSchedulingSlots()
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving scheduling slot', error)
      toast({
        title: 'Error',
        description: 'Failed to save scheduling slot',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (slot: SchedulingSlot) => {
    setEditingSlot(slot)
    setShowAddForm(true)
    form.reset({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slot_duration_minutes: slot.slot_duration_minutes,
      buffer_minutes_before: slot.buffer_minutes_before,
      buffer_minutes_after: slot.buffer_minutes_after,
      max_bookings_per_slot: slot.max_bookings_per_slot,
      is_active: slot.is_active,
    })
  }

  const handleDelete = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('scheduling_slots')
        .delete()
        .eq('id', slotId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Scheduling slot deleted successfully!',
      })

      await loadSchedulingSlots()
      onUpdate?.()
    } catch (error) {
      logger.error('Error deleting scheduling slot', error)
      toast({
        title: 'Error',
        description: 'Failed to delete scheduling slot',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    form.reset()
    setEditingSlot(null)
    setShowAddForm(false)
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
            Advanced Scheduling Slots
          </CardTitle>
          <CardDescription>
            Create custom scheduling slots with specific durations, buffers, and booking limits. This gives you fine-grained control over your availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          
          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <h3 className="text-lg font-semibold mb-4">
                {editingSlot ? 'Edit Scheduling Slot' : 'Add New Scheduling Slot'}
              </h3>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="day_of_week"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Day of Week</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select day" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DAYS.map((day, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="slot_duration_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slot Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="15"
                              max="120"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="buffer_minutes_before"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buffer Before (minutes)</FormLabel>
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
                            Extra time before each slot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="buffer_minutes_after"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buffer After (minutes)</FormLabel>
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
                            Extra time after each slot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_bookings_per_slot"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Bookings per Slot</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Enable or disable this scheduling slot
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

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : (editingSlot ? 'Update Slot' : 'Add Slot')}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Add New Slot Button */}
          {!showAddForm && (
            <Button 
              onClick={() => setShowAddForm(true)} 
              className="mb-6"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Scheduling Slot
            </Button>
          )}

          {/* Existing Slots */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Current Scheduling Slots</h3>
            
            {schedulingSlots.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No scheduling slots configured. Add your first slot to get started with advanced scheduling.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {schedulingSlots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{DAYS[slot.day_of_week]}</span>
                        <span className="text-sm text-muted-foreground">
                          {slot.start_time} - {slot.end_time}
                        </span>
                        {!slot.is_active && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {slot.slot_duration_minutes}min slots • 
                        {slot.buffer_minutes_before > 0 && ` ${slot.buffer_minutes_before}min buffer before •`}
                        {slot.buffer_minutes_after > 0 && ` ${slot.buffer_minutes_after}min buffer after •`}
                        {' '}Max {slot.max_bookings_per_slot} booking{slot.max_bookings_per_slot > 1 ? 's' : ''} per slot
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(slot)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(slot.id)}
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

      {/* Information Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Advanced Scheduling Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p><strong>Slot Duration:</strong> Define how long each booking slot should be (e.g., 30 minutes for haircuts, 60 minutes for complex services).</p>
            <p><strong>Buffer Time:</strong> Add extra time before or after slots for setup, cleanup, or unexpected delays.</p>
            <p><strong>Booking Limits:</strong> Control how many clients can book the same time slot (useful for group sessions or multiple chairs).</p>
            <p><strong>Active/Inactive:</strong> Temporarily disable slots without deleting them (e.g., for vacations or special events).</p>
            <p><strong>Multiple Slots:</strong> Create different slot configurations for different days or time periods.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 