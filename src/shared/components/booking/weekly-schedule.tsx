"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Plus, Trash2, Save, Clock, Calendar, Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/shared/components/ui/use-toast'
import { supabase } from '@/shared/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'

interface Availability {
  id?: string
  barber_id: string
  day_of_week: number
  start_time: string
  end_time: string
  isAvailable?: boolean
}

interface WeeklyScheduleProps {
  barberId: string
  initialSchedule?: Availability[]
  onUpdate?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function WeeklySchedule({ barberId, initialSchedule, onUpdate }: WeeklyScheduleProps) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<Availability[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Initialize schedule when component mounts or initialSchedule changes
  useEffect(() => {
    if (initialSchedule && initialSchedule.length > 0) {
      // Map the initial schedule to include isAvailable property
      const mappedSchedule = DAYS.map((_, index) => {
        const existingDay = initialSchedule.find(day => day.day_of_week === index)
        return {
          barber_id: barberId,
          day_of_week: index,
          start_time: existingDay?.start_time || '',
          end_time: existingDay?.end_time || '',
          isAvailable: !!(existingDay?.start_time && existingDay?.end_time)
        }
      })
      setSchedule(mappedSchedule)
    } else {
      // Set default schedule if no initial data
      const defaultSchedule = DAYS.map((_, index) => ({
        barber_id: barberId,
        day_of_week: index,
        start_time: '',
        end_time: '',
        isAvailable: false
      }))
      setSchedule(defaultSchedule)
    }
  }, [initialSchedule, barberId])

  const handleToggleDay = (dayOfWeek: number) => {
    setSchedule(schedule.map(item => 
      item.day_of_week === dayOfWeek 
        ? { 
            ...item, 
            isAvailable: !item.isAvailable,
            start_time: item.isAvailable ? '' : '09:00',
            end_time: item.isAvailable ? '' : '17:00'
          } 
        : item
    ))
  }

  const handleTimeChange = (day: number, field: 'start_time' | 'end_time', value: string) => {
    if (!value) return; // Don't update if value is empty
    
    setSchedule(prev => 
      prev.map(slot => 
        slot.day_of_week === day 
          ? { ...slot, [field]: value }
          : slot
      )
    );
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Validate time slots
      const validSlots = schedule.filter(day => {
        if (!day.isAvailable) return false;
        if (!day.start_time || !day.end_time) {
          toast({
            title: "Error",
            description: `Please set both start and end times for ${DAYS[day.day_of_week]}`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });

      if (validSlots.length === 0) {
        toast({
          title: "Error",
          description: "Please set at least one day's availability",
          variant: "destructive",
        });
        return;
      }

      // Delete existing availability first
      await supabase.from('availability').delete().eq('barber_id', barberId)

      // Insert new availability
      const { error } = await supabase
        .from('availability')
        .insert(
          validSlots.map(slot => ({
            barber_id: barberId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time
          }))
        );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Weekly schedule updated successfully",
      });
      
      // Call onUpdate to refresh settings data
      onUpdate?.();
    } catch (error) {
      logger.error('Error saving availability', error);
      toast({
        title: "Error",
        description: "Failed to save schedule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const availableDays = schedule.filter(day => day.isAvailable).length;

  return (
    <div className="space-y-8 bg-background">
      {/* Unified Header */}
      <div className="text-center space-y-2 mb-4">
        <div className="flex items-center justify-center gap-3">
          <Calendar className="h-7 w-7 text-secondary" />
          <h2 className="text-2xl sm:text-3xl font-bebas text-white tracking-wide">Weekly Schedule</h2>
        </div>
        <p className="text-white/70 text-base mt-1">Set your regular working hours for each day</p>
      </div>

      {/* Schedule Grid - glassmorphism card style */}
      <div className="space-y-4">
        {schedule.map((slot) => (
          <div
            key={slot.day_of_week}
            className={`rounded-xl border border-white/10 bg-white/5 shadow-lg transition-all duration-300 overflow-hidden group px-0`}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-5">
              <div className="flex items-center space-x-5">
                {/* Toggle switch */}
                <label className="relative inline-flex items-center cursor-pointer group focus:outline-none">
                  <input
                    type="checkbox"
                    checked={slot.isAvailable}
                    onChange={() => handleToggleDay(slot.day_of_week)}
                    className="sr-only peer"
                    aria-label={`Toggle ${DAYS[slot.day_of_week]}`}
                  />
                  <span
                    className="w-12 h-6 flex items-center transition-all duration-300 rounded-full border-2 border-white/20 peer-checked:bg-secondary peer-checked:border-secondary bg-white/10 peer-focus:ring-2 peer-focus:ring-secondary peer-focus:ring-offset-2 peer-focus:ring-offset-background hover:scale-105"
                  >
                    <span className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ml-1 ${slot.isAvailable ? 'translate-x-6' : 'translate-x-0'}`} />
                  </span>
                </label>
                <div>
                  <span className={`font-bebas text-xl tracking-wide ${slot.isAvailable ? 'text-white' : 'text-white/60'}`}>{DAYS[slot.day_of_week]}</span>
                  {slot.isAvailable && (
                    <p className="text-xs text-secondary flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      Available for bookings
                    </p>
                  )}
                </div>
              </div>
              {slot.isAvailable && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-6 w-full md:w-auto">
                  <div className="space-y-2 w-full sm:w-auto">
                    <Label htmlFor={`start-${slot.day_of_week}`} className="text-white/80 text-xs font-medium flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Start Time
                    </Label>
                    <Input
                      id={`start-${slot.day_of_week}`}
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => handleTimeChange(slot.day_of_week, 'start_time', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary focus:ring-secondary rounded-lg h-10 text-base"
                    />
                  </div>
                  <div className="space-y-2 w-full sm:w-auto">
                    <Label htmlFor={`end-${slot.day_of_week}`} className="text-white/80 text-xs font-medium flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      End Time
                    </Label>
                    <Input
                      id={`end-${slot.day_of_week}`}
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => handleTimeChange(slot.day_of_week, 'end_time', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary focus:ring-secondary rounded-lg h-10 text-base"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button - settings style */}
      <div className="flex justify-center pt-6">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-secondary text-primary font-semibold shadow-lg px-10 py-3 rounded-xl transition-all duration-300 hover:bg-secondary/90 text-base"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-3" />
              Saving Schedule...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-3" />
              Save Weekly Schedule
            </>
          )}
        </Button>
      </div>
      {/* Tips Section - info card style */}
      <div className="mt-8">
        <div className="bg-white/5 border border-white/10 rounded-xl shadow-lg p-6 flex items-start gap-4">
          <div className="p-2 bg-secondary/10 rounded-lg">
            <Sparkles className="h-6 w-6 text-secondary" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bebas text-white tracking-wide">Schedule Tips</h4>
            <ul className="text-white/70 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                <span>Set realistic hours that you can consistently maintain</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                <span>Consider travel time between appointments when setting hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                <span>Leave buffer time for breaks and unexpected delays</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                <span>Update your schedule regularly to reflect your availability</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
