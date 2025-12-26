"use client"

import { useState, useEffect } from 'react'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Input } from '@/shared/components/ui/input'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { supabase } from '@/shared/lib/supabase'
import { toast } from 'sonner'
import { logger } from '@/shared/lib/logger'
import { Calendar, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface Availability {
  day_of_week: number
  start_time: string
  end_time: string
}

interface AvailabilityManagerProps {
  barberId: string
  onUpdate?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AvailabilityManager({ barberId, onUpdate }: AvailabilityManagerProps) {
  const [availability, setAvailability] = useState<Availability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchAvailability()
  }, [barberId])

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('barber_id', barberId)

      if (error) throw error

      if (data && data.length > 0) {
        setAvailability(data)
      } else {
        // Set default availability if none exists
        const defaultAvailability = DAYS.map((_, index) => ({
          day_of_week: index,
          start_time: '09:00',
          end_time: '17:00'
        }))
        setAvailability(defaultAvailability)
      }
    } catch (error) {
      logger.error('Error fetching availability', error)
      toast.error('Failed to load availability')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTimeChange = (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    setAvailability(prev => 
      prev.map(avail => 
        avail.day_of_week === dayOfWeek ? { ...avail, [field]: value } : avail
      )
    )
  }

  const toggleAvailability = (dayOfWeek: number) => {
    setAvailability(prev => {
      const day = prev.find(avail => avail.day_of_week === dayOfWeek)
      if (!day) return prev

      // If the day exists, remove it (making it unavailable)
      if (day.start_time && day.end_time) {
        return prev.filter(avail => avail.day_of_week !== dayOfWeek)
      }

      // If the day doesn't exist, add it with default times
      return [...prev, {
        day_of_week: dayOfWeek,
        start_time: '09:00',
        end_time: '17:00'
      }]
    })
  }

  const saveAvailability = async () => {
    try {
      setIsSaving(true)
      
      // Validate data
      const invalidTimes = availability.filter(avail => 
        new Date(`2000-01-01T${avail.start_time}`) >= new Date(`2000-01-01T${avail.end_time}`)
      )

      if (invalidTimes.length > 0) {
        toast.error('End time must be after start time')
        return
      }

      // Delete existing availability
      const { error: deleteError } = await supabase
        .from('availability')
        .delete()
        .eq('barber_id', barberId)

      if (deleteError) throw deleteError

      // Insert new availability
      const { error: insertError } = await supabase
        .from('availability')
        .insert(
          availability.map(avail => ({
            barber_id: barberId,
            day_of_week: avail.day_of_week,
            start_time: avail.start_time,
            end_time: avail.end_time
          }))
        )

      if (insertError) throw insertError

      // Refresh the data
      await fetchAvailability()
      toast.success('Availability updated successfully')
      
      // Call onUpdate to refresh settings data
      onUpdate?.()
    } catch (error) {
      logger.error('Error saving availability', error)
      toast.error('Failed to save availability')
    } finally {
      setIsSaving(false)
    }
  }

  const getAvailableDaysCount = () => {
    return availability.filter(avail => avail.start_time && avail.end_time).length
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-medium">Availability</h3>
        </div>
        <Card className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-medium">Availability</h3>
      </div>

      {/* Status Alert */}
      {getAvailableDaysCount() === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You haven't set any availability yet. Set your working hours to start accepting bookings.
          </AlertDescription>
        </Alert>
      )}

      {getAvailableDaysCount() > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            You have {getAvailableDaysCount()} day{getAvailableDaysCount() !== 1 ? 's' : ''} available for bookings.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-3 sm:p-6">
        <div className="space-y-6">
          {DAYS.map((dayName, index) => {
            const day = availability.find(avail => avail.day_of_week === index)
            const isAvailable = !!day

            return (
              <div key={dayName} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full">
                <div className="w-full sm:w-32 mb-1 sm:mb-0">
                  <Label className="font-medium text-base sm:text-sm">{dayName}</Label>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                  <Input
                    type="time"
                    value={day?.start_time || '09:00'}
                    onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                    disabled={!isAvailable}
                    className="w-full sm:w-32"
                  />
                  <span className="text-muted-foreground hidden sm:inline">to</span>
                  <Input
                    type="time"
                    value={day?.end_time || '17:00'}
                    onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                    disabled={!isAvailable}
                    className="w-full sm:w-32"
                  />
                </div>
                <Button
                  variant={isAvailable ? "default" : "outline"}
                  onClick={() => toggleAvailability(index)}
                  className="w-full sm:w-auto mt-2 sm:mt-0"
                >
                  {isAvailable ? 'Available' : 'Unavailable'}
                </Button>
              </div>
            )
          })}
          <Button 
            onClick={saveAvailability} 
            disabled={isSaving}
            className="w-full mt-6 mb-2 sm:mb-0"
            style={{ zIndex: 20 }}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Save Availability
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
} 