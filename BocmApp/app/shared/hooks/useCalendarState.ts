/**
 * useCalendarState Hook
 * 
 * Manages all state for the calendar feature.
 * Follows Single Responsibility Principle - only handles state management.
 * 
 * @module useCalendarState
 */

import { useState, useCallback } from 'react';
import { addMonths, subMonths } from 'date-fns';
import type { CalendarEvent, Service, TimeSlot } from '../lib/calendar';

/**
 * Manual appointment form data
 */
export interface ManualFormData {
  clientName: string;
  serviceId: string;
  price: string;
  time: string;
  date: Date;
}

/**
 * Review form data
 */
export interface ReviewFormData {
  barberId: string;
  bookingId: string;
  isEditing?: boolean;
  reviewId?: string;
  initialRating?: number;
  initialComment?: string;
}

/**
 * Calendar state hook
 * 
 * Centralizes all state management for the calendar feature
 */
export function useCalendarState() {
  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month'>('month');

  // Events and display state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Modal/Dialog state
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showManualAppointmentForm, setShowManualAppointmentForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMarkingMissed, setIsMarkingMissed] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  // User role and view mode
  const [userRole, setUserRole] = useState<'client' | 'barber' | null>(null);
  const [barberViewMode, setBarberViewMode] = useState<'appointments' | 'bookings'>('appointments');

  // Manual appointment form state
  const [manualFormData, setManualFormData] = useState<ManualFormData>({
    clientName: '',
    serviceId: '',
    price: '',
    time: '',
    date: new Date()
  });
  const [services, setServices] = useState<Service[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Review form state
  const [reviewFormData, setReviewFormData] = useState<ReviewFormData | null>(null);

  // Calendar navigation helpers
  const nextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Event selection helpers
  const selectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  }, []);

  const clearSelectedEvent = useCallback(() => {
    setSelectedEvent(null);
    setShowEventDialog(false);
  }, []);

  // Manual appointment form helpers
  const openManualAppointmentForm = useCallback((date?: Date) => {
    setManualFormData(prev => ({
      ...prev,
      date: date || prev.date || new Date()
    }));
    setShowManualAppointmentForm(true);
  }, []);

  const closeManualAppointmentForm = useCallback(() => {
    setShowManualAppointmentForm(false);
    // Reset form data
    setManualFormData({
      clientName: '',
      serviceId: '',
      price: '',
      time: '',
      date: selectedDate || new Date()
    });
    setTimeSlots([]);
  }, [selectedDate]);

  const updateManualFormData = useCallback((updates: Partial<ManualFormData>) => {
    setManualFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Review form helpers
  const openReviewForm = useCallback((data: ReviewFormData) => {
    setReviewFormData(data);
    setShowReviewForm(true);
  }, []);

  const closeReviewForm = useCallback(() => {
    setShowReviewForm(false);
    setReviewFormData(null);
  }, []);

  // Barber view mode toggle
  const toggleBarberViewMode = useCallback(() => {
    setBarberViewMode(prev => prev === 'appointments' ? 'bookings' : 'appointments');
  }, []);

  // Reset all state (useful for cleanup)
  const resetState = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(null);
    setEvents([]);
    setSelectedEvent(null);
    setShowEventDialog(false);
    setShowManualAppointmentForm(false);
    setShowReviewForm(false);
    setFilterStatus('all');
    setLoading(true);
    setRefreshing(false);
    setIsMarkingMissed(false);
    setIsMarkingCompleted(false);
    setIsSubmitting(false);
    setLoadingTimeSlots(false);
  }, []);

  return {
    // Calendar navigation
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    nextMonth,
    prevMonth,
    goToToday,

    // Events
    events,
    setEvents,
    filterStatus,
    setFilterStatus,
    selectedEvent,
    selectEvent,
    clearSelectedEvent,

    // Dialogs/Modals
    showEventDialog,
    setShowEventDialog,
    showManualAppointmentForm,
    setShowManualAppointmentForm,
    showReviewForm,
    setShowReviewForm,

    // Loading states
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    isMarkingMissed,
    setIsMarkingMissed,
    isMarkingCompleted,
    setIsMarkingCompleted,
    isSubmitting,
    setIsSubmitting,
    loadingTimeSlots,
    setLoadingTimeSlots,

    // User role
    userRole,
    setUserRole,
    barberViewMode,
    setBarberViewMode,
    toggleBarberViewMode,

    // Manual appointment form
    manualFormData,
    setManualFormData,
    updateManualFormData,
    services,
    setServices,
    barberId,
    setBarberId,
    timeSlots,
    setTimeSlots,
    openManualAppointmentForm,
    closeManualAppointmentForm,

    // Review form
    reviewFormData,
    setReviewFormData,
    openReviewForm,
    closeReviewForm,

    // Utilities
    resetState,
  };
}

/**
 * Type definition for the hook's return value
 */
export type CalendarState = ReturnType<typeof useCalendarState>;

