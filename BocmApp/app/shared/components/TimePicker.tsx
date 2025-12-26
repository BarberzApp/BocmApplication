import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { format, addMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import tw from 'twrnc';
import { logger } from '../lib/logger';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react-native';

interface TimePickerProps {
  selectedDate: Date;
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  serviceDuration?: number;
  barberId?: string;
  disabled?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isPast: boolean;
  isBooked: boolean;
}

export default function TimePicker({
  selectedDate,
  selectedTime,
  onTimeSelect,
  serviceDuration = 60,
  barberId,
  disabled = false,
}: TimePickerProps) {

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState('');

  // Generate time slots from 6 AM to 10 PM in 30-minute intervals
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);
    const isToday = isSameDay(now, selectedDateOnly);

    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isPast = isToday && isBefore(slotTime, now);
        
        slots.push({
          time: timeString,
          available: true,
          isPast,
          isBooked: false,
        });
      }
    }
    
    return slots;
  };

  // Check for booking conflicts
  const checkBookingConflicts = async (slots: TimeSlot[]): Promise<TimeSlot[]> => {
    if (!barberId) return slots;

    try {
      const startOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59';

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('date, end_time')
        .eq('barber_id', barberId)
        .gte('date', startOfDay)
        .lte('date', endOfDay)
        .neq('status', 'cancelled');

      if (error) {
        logger.error('Error fetching bookings:', error);
        return slots;
      }

      const bookedTimes = new Set();
      (bookings || []).forEach(booking => {
        const start = new Date(booking.date);
        const end = booking.end_time ? new Date(booking.end_time) : addMinutes(start, 60);
        
        // Mark all times within this booking as booked
        let current = new Date(start);
        while (current < end) {
          const timeString = `${current.getHours().toString().padStart(2, '0')}:${current.getMinutes().toString().padStart(2, '0')}`;
          bookedTimes.add(timeString);
          current = addMinutes(current, 30);
        }
      });

      return slots.map(slot => ({
        ...slot,
        isBooked: bookedTimes.has(slot.time),
        available: !slot.isPast && !bookedTimes.has(slot.time),
      }));
    } catch (error) {
      logger.error('Error checking booking conflicts:', error);
      return slots;
    }
  };

  useEffect(() => {
    const loadTimeSlots = async () => {
      setLoading(true);
      try {
        const slots = generateTimeSlots();
        const slotsWithConflicts = await checkBookingConflicts(slots);
        setTimeSlots(slotsWithConflicts);
      } catch (error) {
        logger.error('Error loading time slots:', error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedDate) {
      loadTimeSlots();
    }
  }, [selectedDate, barberId, serviceDuration]);

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeSelect = (time: string) => {
    if (disabled) return;
    onTimeSelect(time);
  };

  const handleCustomTimeSubmit = () => {
    if (customTime.trim()) {
      // Validate custom time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (timeRegex.test(customTime)) {
        onTimeSelect(customTime);
        setShowCustomTime(false);
        setCustomTime('');
      } else {
        // Try to parse common time formats
        const parsedTime = parseCustomTime(customTime);
        if (parsedTime) {
          onTimeSelect(parsedTime);
          setShowCustomTime(false);
          setCustomTime('');
        }
      }
    }
  };

  const parseCustomTime = (timeString: string): string | null => {
    // Try to parse various time formats
    const patterns = [
      /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/,
      /^(\d{1,2})\s*(AM|PM|am|pm)$/,
      /^(\d{1,2})$/,
    ];

    for (const pattern of patterns) {
      const match = timeString.match(pattern);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const period = match[3]?.toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
    }

    return null;
  };

  const availableSlots = timeSlots.filter(slot => slot.available);
  const pastSlots = timeSlots.filter(slot => slot.isPast);
  const bookedSlots = timeSlots.filter(slot => slot.isBooked);

  return (
    <View style={tw`space-y-4`}>
      {/* Time Slots Grid */}
      {loading ? (
        <View style={tw`items-center py-8`}>
          <ActivityIndicator size="small" color={theme.colors.secondary} />
          <Text style={[tw`mt-2`, { color: theme.colors.mutedForeground }]}>
            Loading available times...
          </Text>
        </View>
      ) : (
        <>
          {/* Available Times */}
          {availableSlots.length > 0 && (
            <View>
              <Text style={[tw`text-sm font-medium mb-3`, { color: theme.colors.foreground }]}>
                Available Times
              </Text>
              <View style={tw`flex-row flex-wrap -mx-1`}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.time}
                    onPress={() => handleTimeSelect(slot.time)}
                    style={tw`w-1/3 px-1 mb-2`}
                    disabled={disabled}
                  >
                    <View style={[
                      tw`rounded-lg py-3 items-center`,
                      selectedTime === slot.time
                        ? { backgroundColor: theme.colors.secondary }
                        : { backgroundColor: 'rgba(255,255,255,0.05)' }
                    ]}>
                      <Text style={[
                        tw`text-sm font-medium`,
                        selectedTime === slot.time
                          ? { color: theme.colors.background }
                          : { color: theme.colors.foreground }
                      ]}>
                        {formatTime(slot.time)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Booked Times */}
          {bookedSlots.length > 0 && (
            <View>
              <Text style={[tw`text-sm font-medium mb-3`, { color: theme.colors.mutedForeground }]}>
                Booked Times
              </Text>
              <View style={tw`flex-row flex-wrap -mx-1`}>
                {bookedSlots.slice(0, 6).map((slot) => (
                  <View key={slot.time} style={tw`w-1/3 px-1 mb-2`}>
                    <View style={[
                      tw`rounded-lg py-3 items-center`,
                      { backgroundColor: 'rgba(255,0,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,0,0,0.3)' }
                    ]}>
                      <Text style={[tw`text-sm font-medium`, { color: 'rgba(255,255,255,0.5)' }]}>
                        {formatTime(slot.time)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Quick Time Selection */}
          <View>
            <Text style={[tw`text-sm font-medium mb-3`, { color: theme.colors.mutedForeground }]}>
              Quick Selection
            </Text>
            <View style={tw`flex-row flex-wrap -mx-1`}>
              {['09:00', '12:00', '15:00', '18:00'].map((quickTime) => {
                const isAvailable = timeSlots.find(slot => slot.time === quickTime)?.available;
                return (
                  <TouchableOpacity
                    key={quickTime}
                    onPress={() => isAvailable && handleTimeSelect(quickTime)}
                    style={tw`w-1/2 px-1 mb-2`}
                    disabled={disabled || !isAvailable}
                  >
                    <View style={[
                      tw`rounded-lg py-2 items-center`,
                      selectedTime === quickTime
                        ? { backgroundColor: theme.colors.secondary }
                        : isAvailable
                        ? { backgroundColor: 'rgba(255,255,255,0.05)' }
                        : { backgroundColor: 'rgba(255,255,255,0.02)', opacity: 0.5 }
                    ]}>
                      <Text style={[
                        tw`text-sm font-medium`,
                        selectedTime === quickTime
                          ? { color: theme.colors.background }
                          : isAvailable
                          ? { color: theme.colors.foreground }
                          : { color: theme.colors.mutedForeground }
                      ]}>
                        {formatTime(quickTime)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Custom Time Option */}
          <TouchableOpacity
            onPress={() => setShowCustomTime(true)}
            style={[
              tw`p-3 rounded-xl border items-center`,
              { 
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
              }
            ]}
            disabled={disabled}
          >
            <View style={tw`flex-row items-center`}>
              <Clock size={16} color={theme.colors.secondary} style={tw`mr-2`} />
              <Text style={[tw`font-medium`, { color: theme.colors.secondary }]}>
                Enter Custom Time
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Custom Time Modal */}
      <Modal
        visible={showCustomTime}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomTime(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-center items-center p-6`}>
          <View style={[
            tw`w-full max-w-sm rounded-2xl p-6`,
            { backgroundColor: theme.colors.background }
          ]}>
            <Text style={[tw`text-lg font-bold mb-4`, { color: theme.colors.foreground }]}>
              Enter Custom Time
            </Text>
            
            <Text style={[tw`text-sm mb-4`, { color: theme.colors.mutedForeground }]}>
              Enter time in 24-hour format (e.g., 14:30) or 12-hour format (e.g., 2:30 PM)
            </Text>

            <TextInput
              style={[
                tw`p-3 rounded-xl border mb-4`,
                {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: theme.colors.foreground
                }
              ]}
              placeholder="e.g., 14:30 or 2:30 PM"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={customTime}
              onChangeText={setCustomTime}
              autoFocus
            />

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setShowCustomTime(false)}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center`,
                  { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}
              >
                <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleCustomTimeSubmit}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center`,
                  { backgroundColor: theme.colors.secondary }
                ]}
              >
                <Text style={[tw`font-semibold`, { color: theme.colors.background }]}>
                  Set Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
