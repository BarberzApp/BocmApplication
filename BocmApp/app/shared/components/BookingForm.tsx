import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import Icon from 'react-native-vector-icons/Feather';
import { RootStackParamList } from '../types';
import { bookingService, Service, TimeSlot } from '../lib/bookingService';
import * as WebBrowser from 'expo-web-browser';
import { initStripe, confirmPayment, presentPaymentSheet, CardField } from '@stripe/stripe-react-native';

// Add-on types
interface ServiceAddon {
  id: string;
  barber_id: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
import { useAuth } from '../hooks/useAuth';
import { theme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { notificationService, formatAppointmentTime } from '../lib/notifications';
import { logger } from '../lib/logger';

type BookingFormNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingCalendar'>;

interface BookingFormProps {
  isVisible: boolean;
  onClose: () => void;
  barberId: string;
  barberName: string;
  preSelectedService?: Service;
  onBookingCreated: (booking: any) => void;
}

interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  dateString: string;
}

export default function BookingForm({ 
  isVisible, 
  onClose, 
  barberId, 
  barberName, 
  preSelectedService,
  onBookingCreated 
}: BookingFormProps) {
  const navigation = useNavigation<BookingFormNavigationProp>();
  const { user, userProfile } = useAuth();

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Form data
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  
  const [paymentType, setPaymentType] = useState<'fee'>('fee');
  const [isDeveloperAccount, setIsDeveloperAccount] = useState(false);

  const totalSteps = 5; // Added step 5 for card input

  useEffect(() => {
    if (isVisible) {
      fetchServices();
      fetchBarberStatus();
      setCurrentStep(1);
      
      // Pre-populate user info if logged in
      if (user) {
        setGuestInfo(prev => ({
          ...prev,
          name: userProfile?.name || '',
          email: user.email || ''
        }));
      }
    }
  }, [isVisible, barberId, user]);

  // Auto-select service if provided as prop
  useEffect(() => {
    if (preSelectedService && services.length > 0) {
      const matchingService = services.find(service => service.id === preSelectedService.id);
      if (matchingService) {
        setSelectedService(matchingService);
        logger.log('Auto-selected service:', matchingService.name);
        // Auto-advance to next step if service is pre-selected
        if (currentStep === 1) {
          setTimeout(() => {
            setCurrentStep(2);
          }, 500);
        }
      }
    }
  }, [preSelectedService, services, currentStep]);

  useEffect(() => {
    if (isVisible && selectedService && selectedDate) {
      fetchTimeSlots();
    }
  }, [isVisible, selectedService, selectedDate]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const servicesData = await Promise.race([
        bookingService.getBarberServices(barberId),
        timeoutPromise
      ]) as Service[];
      
      if (!servicesData || servicesData.length === 0) {
        logger.warn('No services found for this barber');
        Alert.alert('No Services', 'This barber has no services available for booking.');
        onClose();
        return;
      }
      
      setServices(servicesData);
      
      // Fetch add-ons separately (non-critical) with timeout
      try {
        const addonsData = await Promise.race([
          fetchAddons(),
          timeoutPromise
        ]) as ServiceAddon[];
        setAddons(addonsData);
      } catch (addonError) {
        logger.warn('Add-ons fetch failed, continuing without add-ons:', addonError);
        setAddons([]);
      }
    } catch (error) {
      logger.error('Error fetching services:', error);
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async (): Promise<ServiceAddon[]> => {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching add-ons:', error);
      return [];
    }
  };

  const fetchBarberStatus = async () => {
    try {
      logger.log('🔍 Checking if barber is developer account:', barberId);
      const { data, error } = await supabase
        .from('barbers')
        .select('is_developer')
        .eq('id', barberId)
        .single();

      if (error) {
        logger.error('❌ Error fetching barber status:', error);
        setIsDeveloperAccount(false);
        return;
      }

      const isDev = data?.is_developer || false;
      logger.log(`✅ Barber developer status: ${isDev ? 'DEVELOPER' : 'REGULAR'}`);
      setIsDeveloperAccount(isDev);
    } catch (error) {
      logger.error('❌ Error fetching barber status:', error);
      setIsDeveloperAccount(false);
    }
  };

  const fetchTimeSlots = async () => {
    if (!selectedDate || !selectedService) {
      // Cannot fetch time slots - missing date or service
      return;
    }

    try {
      setLoadingSlots(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const slots = await bookingService.getAvailableSlots(
        barberId,
        dateStr,
        selectedService.duration
      );
      setTimeSlots(slots);
    } catch (error) {
      logger.error('Error fetching time slots:', error);
      Alert.alert('Error', 'Failed to load available times. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedTime('');
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!selectedService;
      case 2:
        return !!selectedDate && !!selectedTime;
      case 3:
        if (user) return true;
        if (isDeveloperAccount) {
          return !!(guestInfo.name && guestInfo.email && guestInfo.phone);
        }
        return false;
      case 4:
        return true;
      case 5:
        return !isDeveloperAccount; // Only validate for regular bookings

      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep() && currentStep < totalSteps) {
      // For developer accounts, skip step 5 (payment) and go directly to booking
      if (currentStep === 4 && isDeveloperAccount) {
        handleCreateBooking();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please complete all required fields.');
      return;
    }

    if (!user && !isDeveloperAccount) {
      Alert.alert('Error', 'Please sign in to book with this barber.');
      return;
    }

    if (!user && isDeveloperAccount && (!guestInfo.name || !guestInfo.email || !guestInfo.phone)) {
      Alert.alert('Error', 'Please fill in all guest information.');
      return;
    }

    setBookingLoading(true);

    try {
      const bookingDate = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      bookingDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Double-check barber status before using developer booking
      // This ensures we don't accidentally use developer booking for non-developer barbers
      const { data: barberCheck, error: barberCheckError } = await supabase
        .from('barbers')
        .select('is_developer')
        .eq('id', barberId)
        .single();
      
      const isActuallyDeveloper = barberCheck?.is_developer === true;
      
      if (isDeveloperAccount && isActuallyDeveloper) {
        logger.log('🔧 Developer account confirmed - using create-developer-booking endpoint');
        logger.log('📦 Request data:', {
          barberId,
          serviceId: selectedService.id,
          date: bookingDate.toISOString(),
          clientId: user?.id,
          guestName: user ? undefined : guestInfo.name,
        });
        
        // Use the developer booking Edge Function (same as rest of app)
        const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-developer-booking`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            barberId,
            serviceId: selectedService.id,
            date: bookingDate.toISOString(),
            notes: guestInfo.notes,
            guestName: user ? undefined : guestInfo.name,
            guestEmail: user ? undefined : guestInfo.email,
            guestPhone: user ? undefined : guestInfo.phone,
            clientId: user?.id || null,
            paymentType: 'fee',
            addonIds: selectedAddonIds
          })
        });

        logger.log('📡 Response status:', response.status, response.statusText);
        
        const data = await response.json();
        logger.log('📥 Response data:', data);
        
        if (!response.ok) {
          logger.error('❌ Developer booking failed:', {
            status: response.status,
            error: data.error,
            details: data
          });
          throw new Error(data.error || 'Failed to create developer booking');
        }

        logger.log('✅ Developer booking created successfully');
        Alert.alert(
          'Success!',
          'Your booking has been created successfully (developer mode - no payment required).',
          [{ text: 'OK', onPress: () => onBookingCreated(data.booking) }]
        );
      } else {
        // Barber is NOT a developer - must use Stripe payment flow
        logger.log('💳 Regular barber account - using Stripe payment flow');
        logger.log('⚠️ Developer booking was requested but barber is not a developer account');
        
        if (!user) {
          Alert.alert('Error', 'Please sign in to book with this barber.');
          return;
        }
        
        // Initialize Stripe
        await initStripe({
          publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        });

        // Create payment intent using Edge Function
        logger.log('📞 Calling create-payment-intent endpoint...');
        logger.log('📦 Request data:', {
          barberId,
          serviceId: selectedService.id,
          date: bookingDate.toISOString(),
          clientId: user.id,
          paymentType: 'fee',
          addonIds: selectedAddonIds
        });
        
        const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            barberId,
            serviceId: selectedService.id,
            date: bookingDate.toISOString(),
            notes: guestInfo.notes,
            clientId: user.id,
            paymentType: 'fee',
            addonIds: selectedAddonIds
          })
        });

        logger.log('📡 Response status:', response.status, response.statusText);
        
        const data = await response.json();
        logger.log('📥 Response data:', data);
        
        if (!response.ok) {
          logger.error('❌ Payment intent failed:', {
            status: response.status,
            error: data.error,
            details: data
          });
          throw new Error(data.error || 'Failed to create payment intent');
        }

        logger.log('Payment intent created');

        // Confirm payment in-app (secure)
        const { error: paymentError } = await confirmPayment(data.clientSecret, {
          paymentMethodType: 'Card',
        });

        if (paymentError) {
          logger.error('Payment error:', paymentError);
          Alert.alert('Payment Failed', paymentError.message || 'Payment could not be completed.');
          return;
        }

        // Payment successful - booking will be created by webhook
        logger.log('Payment successful - booking will be created via webhook');
        
        Alert.alert(
          'Payment Successful!',
          'Your payment has been processed. Your booking will be confirmed shortly.',
          [{ 
            text: 'OK', 
            onPress: () => {
              // Navigate to success page or close form
              // The booking will be created by the webhook, so we pass null
              onBookingCreated(null);
            }
          }]
        );
      }

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error creating booking:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        barberId,
        serviceId: selectedService?.id,
        selectedDate,
        selectedTime,
      });
      
      // Capture error in Sentry
      const { captureException } = require('../../shared/lib/sentry');
      captureException(error as Error, {
        context: 'BookingForm.handleBooking',
        selectedService: selectedService?.name,
        selectedBarber: barberId,
        selectedDate: selectedDate?.toISOString(),
        selectedTime,
        errorMessage,
      });
      
      // Show user-friendly error with more detail
      Alert.alert(
        'Booking Failed', 
        errorMessage || 'Failed to create booking. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      days.push({
        date,
        dayName: format(date, 'EEE'),
        dayNumber: parseInt(format(date, 'd')),
        monthName: format(date, 'MMM'),
        isToday: isToday(date),
        dateString: format(date, 'yyyy-MM-dd'),
      });
    }
    return days;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Choose Your Service';
      case 2: return 'Pick Your Time';
      case 3: return 'Your Information';
      case 4: return 'Review & Book';
      case 5: return 'Payment';
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Select the service you\'d like to book';
      case 2: return 'Choose your preferred appointment time';
      case 3: return 'Provide your contact information';
      case 4: return 'Review your booking details and confirm';
      case 5: return 'Enter your payment information';
      default: return '';
    }
  };

  const getSelectedAddons = () => {
    return addons.filter(addon => selectedAddonIds.includes(addon.id));
  };

  const getSelectedAddonsTotal = () => {
    return getSelectedAddons().reduce((total, addon) => total + addon.price, 0);
  };

  const getTotalPrice = () => {
    return isDeveloperAccount ? 0.00 : 3.38; // Return $0.00 for developer accounts
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={tw`px-5 pt-4 pb-6 border-b border-white/10`}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <TouchableOpacity testID="close-button" onPress={onClose}>
              <Icon name="x" size={24} color={theme.colors.secondary} />
            </TouchableOpacity>
            <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
              {getStepTitle()}
            </Text>
            <View style={tw`w-6`} />
          </View>

          {/* Progress Bar */}
          <View style={tw`w-full bg-white/10 rounded-full h-2 mb-4`}>
            <View 
              style={[
                tw`h-2 rounded-full`,
                { 
                  backgroundColor: theme.colors.secondary,
                  width: `${(currentStep / totalSteps) * 100}%` 
                }
              ]}
            />
          </View>

          {/* Step Indicators */}
          <View style={tw`flex-row justify-between`}>
            {[1, 2, 3, 4, 5].map((step) => (
              <View key={step} style={tw`items-center`}>
                <View style={[
                  tw`w-8 h-8 rounded-full items-center justify-center`,
                  currentStep >= step 
                    ? { backgroundColor: theme.colors.secondary }
                    : { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}>
                  <Text style={[
                    tw`text-sm font-medium`,
                    currentStep >= step 
                      ? { color: theme.colors.background }
                      : { color: theme.colors.mutedForeground }
                  ]}>
                    {step}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
          <View style={tw`p-5`}>
            {/* Step 1: Service Selection */}
            {currentStep === 1 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${theme.colors.secondary}20` }]}>
                    <Icon name="scissors" size={24} color={theme.colors.secondary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: theme.colors.foreground }]}>
                    What service do you need?
                  </Text>
                  <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                    Choose from our available services
                  </Text>
                </View>

                {loading ? (
                  <View style={tw`items-center py-8`}>
                    <ActivityIndicator size="large" color={theme.colors.secondary} />
                    <Text style={[tw`mt-4`, { color: theme.colors.mutedForeground }]}>Loading services...</Text>
                  </View>
                ) : (
                  <View style={tw`gap-6`}>
                    {services.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        onPress={() => handleServiceSelect(service)}
                      >
                        <View style={[
                          tw`p-4 rounded-2xl border-2`,
                          selectedService?.id === service.id
                            ? { 
                                borderColor: theme.colors.secondary, 
                                backgroundColor: `${theme.colors.secondary}10` 
                              }
                            : { 
                                borderColor: 'rgba(255,255,255,0.1)', 
                                backgroundColor: 'rgba(255,255,255,0.05)' 
                              }
                        ]}>
                          {selectedService?.id === service.id && (
                            <View style={[tw`absolute top-4 right-4 w-6 h-6 rounded-full items-center justify-center`, { backgroundColor: theme.colors.secondary }]}>
                              <Icon name="check" size={16} color={theme.colors.background} />
                            </View>
                          )}
                          
                          <View style={tw`flex-row justify-between items-start`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`text-lg font-semibold mb-1`, { color: theme.colors.foreground }]}>
                                {service.name}
                              </Text>
                              {service.description && (
                                <Text style={[tw`text-sm mb-2`, { color: theme.colors.mutedForeground }]}>
                                  {service.description}
                                </Text>
                              )}
                              <View style={tw`flex-row items-center`}>
                                <Icon name="clock" size={16} color={theme.colors.mutedForeground} />
                                <Text style={[tw`ml-1 text-sm`, { color: theme.colors.mutedForeground }]}>
                                  {service.duration} min
                                </Text>
                              </View>
                            </View>
                            <Text style={[tw`text-lg font-bold`, { color: theme.colors.secondary }]}>
                              ${service.price.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Add-ons Section */}
                {addons.length > 0 && (
                  <View style={tw`mt-6`}>
                    <View style={tw`items-center mb-4`}>
                      <Icon name="package" size={20} color={theme.colors.secondary} />
                      <Text style={[tw`text-lg font-semibold mt-2`, { color: theme.colors.foreground }]}>
                        Enhance Your Service (Optional)
                      </Text>
                    </View>
                    
                    <View style={tw`space-y-3`}>
                      {addons.map((addon) => (
                        <TouchableOpacity
                          key={addon.id}
                          onPress={() => {
                            const isSelected = selectedAddonIds.includes(addon.id);
                            if (isSelected) {
                              setSelectedAddonIds(selectedAddonIds.filter(id => id !== addon.id));
                            } else {
                              setSelectedAddonIds([...selectedAddonIds, addon.id]);
                            }
                          }}
                        >
                          <View style={[
                            tw`p-4 rounded-xl border-2`,
                            selectedAddonIds.includes(addon.id)
                              ? { 
                                  borderColor: theme.colors.secondary, 
                                  backgroundColor: `${theme.colors.secondary}10` 
                                }
                              : { 
                                  borderColor: 'rgba(255,255,255,0.1)', 
                                  backgroundColor: 'rgba(255,255,255,0.05)' 
                                }
                          ]}>
                            <View style={tw`flex-row items-center justify-between`}>
                              <View style={tw`flex-1`}>
                                <Text style={[tw`text-lg font-semibold mb-1`, { color: theme.colors.foreground }]}>
                                  {addon.name}
                                </Text>
                                {addon.description && (
                                  <Text style={[tw`text-sm mb-2`, { color: theme.colors.mutedForeground }]}>
                                    {addon.description}
                                  </Text>
                                )}
                              </View>
                              <View style={tw`items-end`}>
                                <Text style={[tw`text-lg font-bold`, { color: theme.colors.secondary }]}>
                                  +${addon.price.toFixed(2)}
                                </Text>
                                <View style={[
                                  tw`w-6 h-6 rounded-full items-center justify-center mt-2`,
                                  selectedAddonIds.includes(addon.id)
                                    ? { backgroundColor: theme.colors.secondary }
                                    : { backgroundColor: 'rgba(255,255,255,0.1)' }
                                ]}>
                                  {selectedAddonIds.includes(addon.id) && (
                                    <Icon name="check" size={16} color={theme.colors.background} />
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Add-ons Summary */}
                    {selectedAddonIds.length > 0 && (
                      <View style={[tw`mt-4 p-4 rounded-xl`, { backgroundColor: `${theme.colors.secondary}10`, borderWidth: 1, borderColor: `${theme.colors.secondary}20` }]}>
                        <View style={tw`flex-row items-center justify-between mb-2`}>
                          <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
                            Selected Add-ons ({selectedAddonIds.length})
                          </Text>
                          <Text style={[tw`font-semibold text-lg`, { color: theme.colors.secondary }]}>
                            +${getSelectedAddonsTotal().toFixed(2)}
                          </Text>
                        </View>
                        <View style={tw`space-y-1`}>
                          {getSelectedAddons().map((addon) => (
                            <View key={addon.id} style={tw`flex-row justify-between`}>
                              <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                                {addon.name}
                              </Text>
                              <Text style={[tw`text-sm`, { color: theme.colors.secondary }]}>
                                +${addon.price.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 2: Date and Time Selection */}
            {currentStep === 2 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${theme.colors.secondary}20` }]}>
                    <Icon name="calendar" size={24} color={theme.colors.secondary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: theme.colors.foreground }]}>
                    Pick Your Time
                  </Text>
                  <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                    Choose your preferred appointment time
                  </Text>
                </View>

                {/* Date Selection */}
                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: theme.colors.foreground }]}>
                    Select Date
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={tw`pb-4`}
                  >
                    {generateCalendarDays().map((day, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleDateSelect(day.date)}
                        style={tw`mr-3`}
                      >
                        <View style={[
                          tw`rounded-xl p-4 items-center min-w-[80px]`,
                          selectedDate && isSameDay(selectedDate, day.date)
                            ? { backgroundColor: theme.colors.secondary }
                            : { backgroundColor: 'rgba(255,255,255,0.05)' },
                          day.isToday && { borderWidth: 1, borderColor: theme.colors.secondary }
                        ]}>
                          <Text style={[
                            tw`text-xs font-medium`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: theme.colors.background }
                              : { color: theme.colors.mutedForeground }
                          ]}>
                            {day.dayName}
                          </Text>
                          <Text style={[
                            tw`text-xl font-bold my-1`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: theme.colors.background }
                              : { color: theme.colors.foreground }
                          ]}>
                            {day.dayNumber}
                          </Text>
                          <Text style={[
                            tw`text-xs`,
                            selectedDate && isSameDay(selectedDate, day.date)
                              ? { color: theme.colors.background }
                              : { color: theme.colors.mutedForeground }
                          ]}>
                            {day.monthName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Time Selection */}
                {selectedDate && (
                  <View>
                    <Text style={[tw`text-lg font-semibold mb-4`, { color: theme.colors.foreground }]}>
                      Select Time
                    </Text>
                    {loadingSlots ? (
                      <View style={tw`items-center py-8`}>
                        <ActivityIndicator size="small" color={theme.colors.secondary} />
                        <Text style={[tw`mt-2`, { color: theme.colors.mutedForeground }]}>Loading times...</Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row flex-wrap -mx-1`}>
                        {timeSlots
                          .filter(slot => slot.available)
                          .map((slot) => (
                            <TouchableOpacity
                              key={slot.time}
                              onPress={() => handleTimeSelect(slot.time)}
                              style={tw`w-1/3 px-1 mb-2`}
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
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 3: Guest Information */}
            {currentStep === 3 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${theme.colors.secondary}20` }]}>
                    <Icon name="user" size={24} color={theme.colors.secondary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: theme.colors.foreground }]}>
                    Tell us about yourself
                  </Text>
                  <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                    We'll use this to confirm your booking
                  </Text>
                </View>

                {!user ? (
                  isDeveloperAccount ? (
                    <View style={tw`space-y-4`}>
                      <View>
                        <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                          Full Name *
                        </Text>
                        <TextInput
                          style={[
                            tw`px-4 py-3 rounded-xl`,
                            { backgroundColor: 'rgba(255,255,255,0.1)', color: theme.colors.foreground }
                          ]}
                          placeholder="Enter your full name"
                          placeholderTextColor={theme.colors.mutedForeground}
                          value={guestInfo.name}
                          onChangeText={(text) => setGuestInfo({ ...guestInfo, name: text })}
                        />
                      </View>
                      <View>
                        <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                          Email Address *
                        </Text>
                        <TextInput
                          style={[
                            tw`px-4 py-3 rounded-xl`,
                            { backgroundColor: 'rgba(255,255,255,0.1)', color: theme.colors.foreground }
                          ]}
                          placeholder="Enter your email"
                          placeholderTextColor={theme.colors.mutedForeground}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={guestInfo.email}
                          onChangeText={(text) => setGuestInfo({ ...guestInfo, email: text })}
                        />
                      </View>
                      <View>
                        <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                          Phone Number *
                        </Text>
                        <TextInput
                          style={[
                            tw`px-4 py-3 rounded-xl`,
                            { backgroundColor: 'rgba(255,255,255,0.1)', color: theme.colors.foreground }
                          ]}
                          placeholder="Enter your phone number"
                          placeholderTextColor={theme.colors.mutedForeground}
                          keyboardType="phone-pad"
                          value={guestInfo.phone}
                          onChangeText={(text) => setGuestInfo({ ...guestInfo, phone: text })}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={[tw`p-6 rounded-2xl`, { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }]}>
                      <View style={tw`items-center`}>
                        <View style={[tw`w-12 h-12 rounded-full items-center justify-center mb-4`, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                          <Icon name="x" size={24} color="#ef4444" />
                        </View>
                        <Text style={[tw`text-lg font-semibold mb-2`, { color: theme.colors.foreground }]}>
                          Sign In Required
                        </Text>
                        <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                          Please sign in to book with this barber
                        </Text>
                      </View>
                    </View>
                  )
                ) : (
                  <View style={[tw`p-6 rounded-2xl`, { backgroundColor: `${theme.colors.secondary}10`, borderWidth: 1, borderColor: `${theme.colors.secondary}20` }]}>
                    <View style={tw`items-center`}>
                      <View style={[tw`w-12 h-12 rounded-full items-center justify-center mb-4`, { backgroundColor: `${theme.colors.secondary}20` }]}>
                        <Icon name="check" size={24} color={theme.colors.secondary} />
                      </View>
                      <Text style={[tw`text-lg font-semibold mb-2`, { color: theme.colors.foreground }]}>
                        Welcome back, {userProfile?.name}!
                      </Text>
                      <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                        We'll use your account information for this booking
                      </Text>
                    </View>
                  </View>
                )}

                {/* Notes */}
                <View>
                  <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                    Additional Notes (Optional)
                  </Text>
                  <TextInput
                    style={[
                      tw`px-4 py-3 rounded-xl min-h-[100px]`,
                      { backgroundColor: 'rgba(255,255,255,0.1)', color: theme.colors.foreground }
                    ]}
                    placeholder="Any special requests or notes..."
                    placeholderTextColor={theme.colors.mutedForeground}
                    value={guestInfo.notes}
                    onChangeText={(text) => setGuestInfo({ ...guestInfo, notes: text })}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}

            {/* Step 4: Review & Payment */}
            {currentStep === 4 && (
              <View style={tw`space-y-6`}>
                <View style={tw`items-center mb-6`}>
                  <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-4`, { backgroundColor: `${theme.colors.secondary}20` }]}>
                    <Icon name="credit-card" size={24} color={theme.colors.secondary} />
                  </View>
                  <Text style={[tw`text-xl font-bold mb-2`, { color: theme.colors.foreground }]}>
                    Review Your Booking
                  </Text>
                  <Text style={[tw`text-center`, { color: theme.colors.mutedForeground }]}>
                    Confirm your details and complete payment
                  </Text>
                </View>

                {/* Booking Summary */}
                <View style={[tw`p-4 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Text style={[tw`font-semibold mb-4`, { color: theme.colors.secondary }]}>
                    Booking Summary
                  </Text>
                  <View style={tw`space-y-2`}>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: theme.colors.mutedForeground }}>Service:</Text>
                      <Text style={{ color: theme.colors.foreground }}>{selectedService?.name}</Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: theme.colors.mutedForeground }}>Date:</Text>
                      <Text style={{ color: theme.colors.foreground }}>
                        {selectedDate && format(selectedDate, 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: theme.colors.mutedForeground }}>Time:</Text>
                      <Text style={{ color: theme.colors.foreground }}>
                        {formatTime(selectedTime)}
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: theme.colors.mutedForeground }}>Duration:</Text>
                      <Text style={{ color: theme.colors.foreground }}>
                        {selectedService?.duration} min
                      </Text>
                    </View>
                    <View style={tw`flex-row justify-between`}>
                      <Text style={{ color: theme.colors.mutedForeground }}>Price:</Text>
                      <Text style={{ color: theme.colors.foreground }}>
                        ${selectedService?.price.toFixed(2)}
                      </Text>
                    </View>
                    
                    {/* Add-ons */}
                    {selectedAddonIds.length > 0 && (
                      <>
                        <View style={tw`border-t border-white/10 pt-2 mt-2`}>
                          <Text style={[tw`font-medium mb-2`, { color: theme.colors.foreground }]}>
                            Add-ons:
                          </Text>
                          {getSelectedAddons().map((addon) => (
                            <View key={addon.id} style={tw`flex-row justify-between`}>
                              <Text style={{ color: theme.colors.mutedForeground }}>
                                {addon.name}
                              </Text>
                              <Text style={{ color: theme.colors.foreground }}>
                                +${addon.price.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <View style={tw`flex-row justify-between pt-2 border-t border-white/10`}>
                          <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                            Total Service Cost:
                          </Text>
                          <Text style={[tw`font-semibold`, { color: theme.colors.secondary }]}>
                            ${((selectedService?.price || 0) + getSelectedAddonsTotal()).toFixed(2)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Payment Information */}
                <View>
                  <Text style={[tw`text-lg font-semibold mb-4`, { color: theme.colors.foreground }]}>
                    Payment
                  </Text>
                  <View style={[tw`p-4 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={{ color: theme.colors.foreground }}>
                        Booking Fee
                      </Text>
                      <Text style={[tw`font-semibold`, { color: theme.colors.secondary }]}>
                        {isDeveloperAccount ? '$0.00' : '$3.38'}
                      </Text>
                    </View>
                    <Text style={[tw`text-sm mt-2`, { color: theme.colors.mutedForeground }]}>
                      {isDeveloperAccount 
                        ? 'Developer account - no platform fees charged. Service cost and any add-ons will be paid directly to the barber at your appointment.'
                        : 'Pay the remaining amount directly to your barber'
                      }
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Step 5: Card Input (only for regular bookings) */}
            {currentStep === 5 && !isDeveloperAccount && (
              <View style={tw`space-y-6`}>
                {/* Header Section */}
                <View style={tw`items-center mb-8`}>
                  <View style={[
                    tw`w-20 h-20 rounded-full items-center justify-center mb-4`,
                    { 
                      backgroundColor: `${theme.colors.secondary}20`,
                      borderWidth: 2,
                      borderColor: `${theme.colors.secondary}40`
                    }
                  ]}>
                    <Icon name="credit-card" size={28} color={theme.colors.secondary} />
                  </View>
                  <Text style={[tw`text-2xl font-bold mb-3`, { color: theme.colors.foreground }]}>
                    Secure Payment
                  </Text>
                  <Text style={[tw`text-center text-base leading-6`, { color: theme.colors.mutedForeground }]}>
                    Your payment information is encrypted and secure
                  </Text>
                </View>

                {/* Security Badge */}
                <View style={[
                  tw`flex-row items-center justify-center p-3 rounded-full mb-6`,
                  { backgroundColor: `${theme.colors.secondary}15` }
                ]}>
                  <Icon name="shield" size={16} color={theme.colors.secondary} />
                  <Text style={[tw`ml-2 text-sm font-medium`, { color: theme.colors.secondary }]}>
                    Powered by Stripe • PCI Compliant
                  </Text>
                </View>

                {/* Card Input Section */}
                <View style={[
                  tw`p-6 rounded-2xl mb-8`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }
                ]}>
                  <View style={tw`flex-row items-center mb-4`}>
                    <Icon name="credit-card" size={20} color={theme.colors.secondary} />
                    <Text style={[tw`ml-2 text-lg font-semibold`, { color: theme.colors.foreground }]}>
                      Card Information
                    </Text>
                  </View>
                  
                  <CardField
                    postalCodeEnabled={false}
                    placeholders={{
                      number: "4242 4242 4242 4242",
                    }}
                    cardStyle={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      textColor: theme.colors.foreground,
                      fontSize: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.2)',
                    }}
                    style={{
                      width: '100%',
                      height: 56,
                      marginVertical: 20,
                    }}
                  />
                  
                  <View style={tw`flex-row items-center mt-2`}>
                    <Icon name="info" size={14} color={theme.colors.mutedForeground} />
                    <Text style={[tw`ml-2 text-xs`, { color: theme.colors.mutedForeground }]}>
                      All transactions are processed securely by Stripe.
                    </Text>
                  </View>
                </View>

                {/* Payment Summary */}
                <View style={[
                  tw`p-6 rounded-2xl`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }
                ]}>
                  <View style={tw`flex-row items-center mb-3`}>
                    <Icon name="receipt" size={20} color={theme.colors.secondary} />
                    <Text style={[tw`ml-2 text-lg font-semibold`, { color: theme.colors.foreground }]}>
                      Payment Summary
                    </Text>
                  </View>
                  
                  <View style={tw`space-y-3`}>
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={[tw`text-base`, { color: theme.colors.mutedForeground }]}>
                        Service
                      </Text>
                      <Text style={[tw`text-base font-medium`, { color: theme.colors.foreground }]}>
                        {selectedService?.name}
                      </Text>
                    </View>
                    
                    <View style={tw`flex-row justify-between items-center`}>
                      <Text style={[tw`text-base`, { color: theme.colors.mutedForeground }]}>
                        Booking Fee
                      </Text>
                      <Text style={[tw`text-base font-medium`, { color: theme.colors.foreground }]}>
                        $3.38
                      </Text>
                    </View>
                    
                    {/* Add-ons if any */}
                    {selectedAddonIds.length > 0 && (
                      <View style={tw`space-y-2`}>
                        {getSelectedAddons().map((addon) => (
                          <View key={addon.id} style={tw`flex-row justify-between items-center`}>
                            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                              + {addon.name}
                            </Text>
                            <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                              +${addon.price.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    <View style={[
                      tw`border-t border-white/10 pt-3 mt-3`,
                      { borderTopWidth: 1 }
                    ]}>
                      <View style={tw`flex-row justify-between items-center`}>
                        <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                          Total
                        </Text>
                        <Text style={[tw`text-xl font-bold`, { color: theme.colors.secondary }]}>
                          ${(3.38 + getSelectedAddonsTotal()).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Trust Indicators */}
                <View style={tw`items-center mt-4`}>
                  <View style={tw`flex-row items-center space-x-4`}>
                    <View style={tw`items-center mr-4`}>
                      <Icon name="lock" size={16} color={theme.colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                        Encrypted
                      </Text>
                    </View>
                    <View style={tw`items-center`}>
                      <Icon name="shield" size={16} color={theme.colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                        Secure
                      </Text>
                    </View>
                    <View style={tw`items-center ml-4`}>
                      <Icon name="check-circle" size={16} color={theme.colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                        Verified
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}


          </View>
        </ScrollView>

        {/* Footer with Navigation */}
        <View style={tw`p-5 border-t border-white/10`}>
          <View style={tw`flex-row gap-3`}>
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={handlePrevStep}
                style={tw`flex-1`}
              >
                <View style={[
                  tw`py-4 rounded-full items-center`,
                  { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}>
                  <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
                    Back
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            
            {currentStep < totalSteps ? (
              <TouchableOpacity
                onPress={handleNextStep}
                disabled={!validateStep()}
                style={tw`flex-1`}
              >
                <View style={[
                  tw`py-4 rounded-full items-center`,
                  { backgroundColor: theme.colors.secondary },
                  !validateStep() && { opacity: 0.5 }
                ]}>
                  <Text style={[tw`font-medium`, { color: theme.colors.background }]}>
                    Continue
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleCreateBooking}
                disabled={bookingLoading}
                style={tw`flex-1`}
              >
                <View style={[
                  tw`py-4 rounded-full items-center`,
                  { backgroundColor: theme.colors.secondary }
                ]}>
                  {bookingLoading ? (
                    <ActivityIndicator color={theme.colors.background} size="small" />
                  ) : (
                    <Text style={[tw`font-medium`, { color: theme.colors.background }]}>
                      Complete Booking
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
