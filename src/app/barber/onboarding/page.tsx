'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useToast } from '@/shared/components/ui/use-toast'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Progress } from '@/shared/components/ui/progress'
import { CheckCircle, AlertCircle, Loader2, CreditCard, Building, Scissors, X, Instagram, Twitter, Music, Facebook } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import Link from 'next/link'
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { SocialMediaLinks } from '@/shared/components/social-media-links'
import React from 'react'
import { getAddressSuggestionsNominatim } from '@/shared/lib/geocode'

const steps = [
  {
    id: 'business',
    title: 'Business Information',
    description: 'Tell us about your business',
    icon: Building,
    required: ['businessName', 'phone', 'address', 'city', 'state', 'zipCode', 'bio']
  },
  {
    id: 'services',
    title: 'Services & Pricing',
    description: 'Set up your services and pricing',
    icon: Scissors,
    required: ['services']
  },
  {
    id: 'stripe',
    title: 'Payment Setup',
    description: 'Connect your Stripe account to receive payments',
    icon: CreditCard,
    required: ['stripeConnected']
  },
]

interface FormData {
  businessName: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  bio: string
  specialties: string[]
  services: Array<{ name: string; price: number; duration: number }>
  stripeConnected: boolean
  socialMedia: {
    instagram: string
    twitter: string
    tiktok: string
    facebook: string
  }
}

interface ValidationErrors {
  [key: string]: string
}

// Add async address validation function
async function validateAddress(address: string, city: string, state: string, zip: string): Promise<boolean> {
  const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    return Array.isArray(data) && data.length > 0
  } catch (e) {
    return false
  }
}

// Utility function to extract handle from URL or return as-is if already a handle
function extractHandle(input: string): string {
  if (!input) return '';
  input = input.trim();
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL
  }
  if (input.startsWith('@')) return input;
  return '@' + input;
}

export default function BarberOnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { push: safePush, replace: safeReplace } = useSafeNavigation()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isRouterReady, setIsRouterReady] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [stripeStatus, setStripeStatus] = useState<string | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [showCompleteBanner, setShowCompleteBanner] = useState(true)

  // Add state for location input and suggestions
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocationAutofilled, setIsLocationAutofilled] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    setIsRouterReady(true)
  }, [])

  // Prefill form with existing data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        logger.debug('Fetching profile data for user', { userId: user.id });
        
        // Fetch barber profile data
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('*, profiles!user_id(location, phone)')
          .eq('user_id', user.id)
          .single()

        logger.debug('Barber data fetched', { hasData: !!barberData, error: barberError });
        logger.debug('Profile data from join', { hasProfile: !!barberData?.profiles });

        if (barberData) {
          logger.debug('Setting barber data in form');
          setFormData(prev => ({
            ...prev,
            businessName: barberData.business_name || '',
            bio: barberData.bio || '',
            specialties: barberData.specialties || [],
            socialMedia: {
              instagram: barberData.instagram || '',
              twitter: barberData.twitter || '',
              tiktok: barberData.tiktok || '',
              facebook: barberData.facebook || '',
            }
          }))
        }

        // Get profile data from the joined query
        let profile = barberData?.profiles;
        
        // Fallback: if profile data not available through join, fetch separately
        if (!profile) {
          logger.debug('Profile data not available through join, fetching separately');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('phone, location')
            .eq('id', user.id)
            .single();
          
          if (profileError && profileError.code !== 'PGRST116') {
            logger.error('Error fetching profile data', profileError);
          } else {
            profile = profileData;
          }
        }

        // Parse location with improved regex patterns
        let address = '', city = '', state = '', zipCode = '';
        logger.debug('Available location data', {
          profileLocation: profile?.location,
          barberCity: barberData?.city,
          barberState: barberData?.state
        });
        
        if (profile?.location) {
          logger.debug('Parsing location', { location: profile.location });
          
          // Try different location formats
          const location = profile.location.trim();
          
          // Format: "Address, City, State ZIP" or "Address, City, State"
          const fullMatch = location.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2,})\s*(\d{5})?$/);
          if (fullMatch) {
            address = fullMatch[1].trim();
            city = fullMatch[2].trim();
            state = fullMatch[3].trim();
            zipCode = fullMatch[4] || '';
          } else {
            // Format: "Address, City State ZIP" or "Address, City State"
            const cityStateMatch = location.match(/^(.+?),\s*([^,]+?)\s+([A-Za-z]{2,})\s*(\d{5})?$/);
            if (cityStateMatch) {
              address = cityStateMatch[1].trim();
              city = cityStateMatch[2].trim();
              state = cityStateMatch[3].trim();
              zipCode = cityStateMatch[4] || '';
            } else {
              // Fallback: split by comma and try to extract
              const parts = location.split(',').map((part: string) => part.trim());
              if (parts.length >= 2) {
                address = parts[0];
                city = parts[1];
                
                // Try to extract state and zip from the last part
                if (parts.length >= 3) {
                  const lastPart = parts[2];
                  const stateZipMatch = lastPart.match(/([A-Za-z]{2,})\s*(\d{5})?/);
                  if (stateZipMatch) {
                    state = stateZipMatch[1];
                    zipCode = stateZipMatch[2] || '';
                  } else {
                    state = lastPart;
                  }
                }
              }
            }
          }
          
          logger.debug('Parsed location', { address, city, state, zipCode });
        }

        // Fetch services for this barber
        let services: Array<{ name: string; price: number; duration: number }> = [];
        if (barberData?.id) {
          const { data: existingServices, error: servicesError } = await supabase
            .from('services')
            .select('name, price, duration')
            .eq('barber_id', barberData.id);

          if (servicesError) {
            logger.error('Error fetching services', servicesError);
          } else if (Array.isArray(existingServices)) {
            services = existingServices.map(s => ({
              name: s.name || '',
              price: typeof s.price === 'number' ? s.price : 0,
              duration: typeof s.duration === 'number' ? s.duration : 30,
            }));
          }
        }

        // Create the full location string for the input field
        // Prioritize barber table location data over parsed profile location
        const finalCity = barberData?.city || city;
        const finalState = barberData?.state || state;
        const fullLocation = [address, finalCity, finalState, zipCode].filter(Boolean).join(', ');
        
        setFormData(prev => ({
          ...prev,
          phone: profile?.phone || '',
          address,
          city: finalCity, // Use barber table city if available
          state: finalState, // Use barber table state if available
          zipCode,
          services,
          stripeConnected: barberData?.stripe_account_status === 'active'
        }));

        // Set the location input to show the full address
        if (fullLocation) {
          setLocationInput(fullLocation);
          setIsLocationAutofilled(true); // Mark as autofilled
        }

        // Only set Stripe status if they have actually started the Stripe Connect process
        if (barberData?.stripe_account_id) {
          setStripeStatus(barberData?.stripe_account_status || null);
        } else {
          setStripeStatus(null);
        }
      } catch (error) {
        logger.error('Error fetching profile data', error);
      }
    };

    if (isRouterReady && user) {
      fetchProfileData();
    }
  }, [isRouterReady, user]);

  // Check if user is a barber and onboarding is incomplete
  useEffect(() => {
    if (isRouterReady && user) {
      logger.debug('Onboarding page: User loaded', { userId: user.id, role: user.role });
      
      if (user.role !== 'barber') {
        logger.debug('Onboarding page: User is not a barber, redirecting to home');
        safePush('/')
        return;
      }

      // Check if onboarding is already complete
      const checkOnboarding = async () => {
        try {
          logger.debug('Onboarding page: Checking onboarding status for user', { userId: user.id });
          
          const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id, business_name, bio, specialties, stripe_account_status, stripe_account_id')
            .eq('user_id', user.id)
            .single();

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('phone, location')
            .eq('id', user.id)
            .single();

          logger.debug('Onboarding page: Barber data', { hasBarber: !!barber });
          logger.debug('Onboarding page: Profile data', { hasProfile: !!profile });

          if (barberError && barberError.code !== 'PGRST116') {
            logger.error('Error fetching barber profile', barberError);
            return; // Stay on onboarding
          }

          if (profileError && profileError.code !== 'PGRST116') {
            logger.error('Error fetching user profile', profileError);
            return; // Stay on onboarding
          }

          // Check if all required fields are complete
          const hasBusinessInfo = barber?.business_name && barber?.bio && barber?.specialties && barber.specialties.length > 0;
          const hasContactInfo = profile?.phone && profile?.location;
          // Don't require Stripe to be fully active to show onboarding
          // const hasStripeAccount = barber?.stripe_account_status === 'active' && barber?.stripe_account_ready;

          logger.debug('Onboarding page: Completion check', { 
            hasBusinessInfo, 
            hasContactInfo, 
            businessName: barber?.business_name,
            bio: barber?.bio,
            specialties: barber?.specialties,
            specialtiesLength: barber?.specialties?.length,
            phone: profile?.phone,
            location: profile?.location
          });

          // Calculate completion percentage
          const totalFields = 6; // business_name, bio, specialties, phone, location, services
          let completedFields = 0;
          
          if (barber?.business_name) completedFields++;
          if (barber?.bio) completedFields++;
          if (barber?.specialties && barber.specialties.length > 0) completedFields++;
          if (profile?.phone) completedFields++;
          if (profile?.location) completedFields++;
          
          // Check for services
          if (barber?.id) {
            const { data: services } = await supabase
              .from('services')
              .select('id')
              .eq('barber_id', barber.id);
            if (services && services.length > 0) completedFields++;
          }
          
          const completionPercentage = (completedFields / totalFields) * 100;
          
          logger.debug('Onboarding page: Completion percentage', { 
            completedFields, 
            totalFields, 
            completionPercentage 
          });



          // Only redirect if they have basic business and contact info
          // Stripe setup can be done later
          if (hasBusinessInfo && hasContactInfo) {
            logger.debug('Onboarding page: Onboarding complete, but not auto-redirecting');
            setOnboardingComplete(true);
            // Don't auto-redirect - let user click button instead
          } else {
            logger.debug('Onboarding page: Onboarding incomplete, staying on page');
            setOnboardingComplete(false);
            logger.debug('Onboarding page: Missing fields', {
              missingBusinessName: !barber?.business_name,
              missingBio: !barber?.bio,
              missingSpecialties: !barber?.specialties || barber?.specialties?.length === 0,
              missingPhone: !profile?.phone,
              missingLocation: !profile?.location
            });
          }
        } catch (error) {
          logger.error('Error checking onboarding status', error);
        }
      };

      checkOnboarding();
    }
  }, [isRouterReady, user, router])

  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    bio: '',
    specialties: [],
    services: [],
    stripeConnected: false,
    socialMedia: {
      instagram: '',
      twitter: '',
      tiktok: '',
      facebook: '',
    }
  })

  const validateStep = async (stepIndex: number): Promise<boolean> => {
    const errors: ValidationErrors = {};
    const step = steps[stepIndex];

    if (stepIndex === 0) {
      // Business Information validation
      if (!formData.businessName.trim()) errors.businessName = 'Business name is required';
      if (!formData.phone.trim()) errors.phone = 'Phone number is required';
      if (!formData.address.trim()) errors.address = 'Address is required';
      if (!formData.city.trim()) errors.city = 'City is required';
      if (!formData.state.trim()) errors.state = 'State is required';
      if (!formData.zipCode.trim()) errors.zipCode = 'ZIP code is required';
      if (!formData.bio.trim()) errors.bio = 'Bio is required';

      // Phone validation (US default)
      if (formData.phone) {
        const phoneNumber = parsePhoneNumberFromString(formData.phone, 'US')
        if (!phoneNumber || !phoneNumber.isValid()) {
          errors.phone = 'Please enter a valid phone number';
        }
      }

      // ZIP code validation
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (formData.zipCode && !zipRegex.test(formData.zipCode)) {
        errors.zipCode = 'Please enter a valid ZIP code';
      }

      // Address validation - skip OSM validation if user has entered any location data
      // This allows users to enter any valid location without requiring exact OSM matches
      if (!errors.address && !errors.city && !errors.state && !errors.zipCode) {
        // Only validate if the user hasn't entered any location data at all
        const hasLocationData = formData.address || formData.city || formData.state || formData.zipCode;
        
        if (!hasLocationData) {
          errors.address = 'Please enter your location';
        }
        // Skip OSM validation entirely - trust that user knows their own address
      }
    }

    if (stepIndex === 1) {
      // Services validation
      if (formData.services.length === 0) {
        errors.services = 'At least one service is required';
      } else {
        formData.services.forEach((service, index) => {
          if (!service.name.trim()) {
            errors[`service-${index}-name`] = 'Service name is required';
          }
          if (!service.price || service.price <= 0) {
            errors[`service-${index}-price`] = 'Valid price is required';
          }
          if (!service.duration || service.duration < 1) {
            errors[`service-${index}-duration`] = 'Duration must be at least 1 minute';
          }
        });
      }
    }

    if (stepIndex === 2) {
      // Stripe validation - now optional (can be skipped)
      // Only validate if user tries to proceed without connecting
      // Skip validation is handled separately
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Handle nested social media fields
    if (name.startsWith('socialMedia.')) {
      const socialMediaField = name.split('.')[1] as keyof typeof formData.socialMedia
      setFormData(prev => ({
        ...prev,
        socialMedia: {
          ...prev.socialMedia,
          [socialMediaField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleSpecialtiesChange = (specialties: string[]) => {
    setFormData((prev) => ({ ...prev, specialties }))
  }

  const handleServiceChange = (index: number, field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((service, i) =>
        i === index ? { ...service, [field]: value } : service
      ),
    }))
    
    // Clear validation error when user starts typing
    const errorKey = `service-${index}-${field}`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  }

  const addService = () => {
    setFormData((prev) => ({
      ...prev,
      services: [...prev.services, { name: '', price: 0, duration: 30 }],
    }))
  }

  const removeService = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async () => {
    if (!isRouterReady) {
      logger.debug('Router not ready, waiting');
      return;
    }

    // Validate current step
    if (!(await validateStep(currentStep))) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true)
    try {
      logger.debug('Starting business profile update', { formData });

      // Single upsert operation for barber profile
      if (user?.role === 'barber') {
        const { data: sessionData } = await supabase.auth.getSession();
        logger.debug('Current session user id', { sessionUserId: sessionData?.session?.user?.id });
        logger.debug('user_id to upsert', { userId: user.id });
        
        // Check if barber row exists
        const { data: existingBarber, error: checkError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (existingBarber) {
          logger.debug('Barber row already exists for user_id, updating', { userId: user.id });
        } else {
          logger.debug('Creating new barber row for user_id', { userId: user.id });
        }

        const { error: upsertError } = await supabase
          .from('barbers')
          .upsert({
            user_id: user.id,
            business_name: formData.businessName,
            bio: formData.bio,
            specialties: formData.specialties,
            city: formData.city,
            state: formData.state,
            instagram: extractHandle(formData.socialMedia.instagram),
            twitter: extractHandle(formData.socialMedia.twitter),
            tiktok: extractHandle(formData.socialMedia.tiktok),
            facebook: extractHandle(formData.socialMedia.facebook),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (upsertError) {
          logger.error('Failed to upsert barber profile during onboarding', upsertError);
          throw upsertError;
        }
      }

      // Update phone and location in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: formData.phone,
          location: `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (profileError) {
        logger.error('Profile update error', profileError);
        throw profileError;
      }

      // Add services
      if (formData.services.length > 0 && user) {
        // Fetch the correct barber_id for this user
        const { data: barberRow, error: barberIdError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (barberIdError || !barberRow) {
          logger.error('Could not fetch barber id for service insert', barberIdError);
          throw barberIdError || new Error('No barber row found');
        }
        
        const barberId = barberRow.id;
        logger.debug('Adding services', { count: formData.services.length });
        
        // Delete all existing services for this barber before inserting new ones
        const { error: deleteError } = await supabase
          .from('services')
          .delete()
          .eq('barber_id', barberId);
        
        if (deleteError) {
          logger.error('Error deleting existing services', deleteError);
          throw deleteError;
        }
        
        // Now insert the new/updated services
        const { error: servicesError } = await supabase
          .from('services')
          .insert(
            formData.services.map(service => ({
              barber_id: barberId,
              name: service.name,
              price: service.price,
              duration: service.duration,
            }))
          );
        
        if (servicesError) {
          logger.error('Services creation error', servicesError);
          throw servicesError;
        }
        logger.debug('Services added successfully');
      }

      toast({
        title: 'Profile updated',
        description: 'Your business profile has been updated successfully.',
      })

      // Move to next step or complete
      if (currentStep < steps.length - 1) {
        logger.debug(`Moving to step ${currentStep + 1}`);
        setCurrentStep(currentStep + 1)
      } else {
        logger.debug('Onboarding completed, redirecting to settings');
        safePush('/settings');
      }
    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStripeConnect = async () => {
    try {
      setLoading(true);
      
      // Fetch the correct barber.id for this user
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single();
        
      if (barberError || !barber?.id) {
        toast({
          title: 'Error',
          description: 'Could not find your barber profile. Please complete your business info first.',
          variant: 'destructive',
        });
        return;
      }

      // First, check if there's already a Stripe account and refresh its status
      const refreshResponse = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.id }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        
        if (refreshData.success && refreshData.data.hasStripeAccount) {
          setFormData(prev => ({ ...prev, stripeConnected: true }));
          setStripeStatus(refreshData.data.currentStatus);
          
          if (refreshData.data.currentStatus === 'active') {
            toast({
              title: 'Stripe Account Active',
              description: 'Your Stripe account is already active and ready to accept payments!',
            });
            return;
          } else if (refreshData.data.currentStatus === 'pending') {
            toast({
              title: 'Account Pending',
              description: 'Your Stripe account is being reviewed. This usually takes 1-2 business days.',
            });
            return;
          }
        }
      }

      // Get barber's email and name
      if (!user?.email || !user?.name) {
        toast({
          title: 'Error',
          description: 'Could not fetch your profile information. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Create Stripe Connect account
      const response = await fetch('/api/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barberId: barber.id,
          email: user.email,
          name: user.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Stripe account');
      }

      const data = await response.json();
      const redirectUrl = data.url || data.accountLink;
      
      if (!redirectUrl) {
        throw new Error('No redirect URL received from Stripe');
      }

      // Redirect to Stripe
      window.location.href = redirectUrl;
    } catch (error) {
      logger.error('Error connecting Stripe', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to connect Stripe account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      toast({
        title: 'Payment Setup Skipped',
        description: 'You can set up payments later in your settings.',
      });
      
      // Move to next step or complete
      if (currentStep < steps.length - 1) {
        logger.debug(`Moving to step ${currentStep + 1}`);
        setCurrentStep(currentStep + 1);
      } else {
        logger.debug('Onboarding completed, redirecting to settings');
        safePush('/settings');
      }
    } catch (error) {
      logger.error('Error skipping step', error);
      toast({
        title: 'Error',
        description: 'Failed to skip step. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounced fetch suggestions
  const debouncedFetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const suggestions = await getAddressSuggestionsNominatim(query);
      setLocationSuggestions(suggestions);
    } catch (error) {
      setLocationSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (showSuggestions && locationInput.length >= 3) {
      const timer = setTimeout(() => {
        debouncedFetchSuggestions(locationInput);
      }, 300);
      debounceTimerRef.current = timer;
    } else if (locationInput.length < 3) {
      setLocationSuggestions([]);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [locationInput, showSuggestions, debouncedFetchSuggestions]);

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationInput(e.target.value ?? '');
    setShowSuggestions(true);
    setIsLocationAutofilled(false); // Reset autofilled flag when user types
    setFormData(prev => ({ ...prev, address: '', city: '', state: '', zipCode: '' }));
  };

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: any) => {
    const address = suggestion.address || {};
    const house = address.house_number ? address.house_number : '';
    const road = address.road ? address.road : '';
    const city = address.city || address.town || address.village || address.hamlet || '';
    const state = address.state || address.state_code || '';
    const zip = address.postcode || '';
    let line1 = [house, road].filter(Boolean).join(' ');
    let line2 = [city, state].filter(Boolean).join(', ');
    let formatted = [line1, line2].filter(Boolean).join(', ');
    setLocationInput(formatted);
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setIsLocationAutofilled(false); // Reset autofilled flag when user selects suggestion
    setFormData(prev => ({ ...prev, address: line1, city, state, zipCode: zip }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium text-white">Business Name *</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors.businessName ? 'border-red-500' : ''}`}
                placeholder="Enter your business name"
              />
              {validationErrors.businessName && (
                <p className="text-sm text-red-400">{validationErrors.businessName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-white">Phone Number *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors.phone ? 'border-red-500' : ''}`}
                placeholder="(555) 123-4567"
              />
              {validationErrors.phone && (
                <p className="text-sm text-red-400">{validationErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium text-white">Location *</Label>
              <Input
                id="location"
                name="location"
                value={locationInput}
                onChange={handleLocationChange}
                onFocus={() => setShowSuggestions(true)}
                className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                placeholder="Start typing your address..."
                autoComplete="off"
              />
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-black border border-white/20 rounded-xl shadow-lg max-h-60 overflow-auto">
                  {locationSuggestions.map((suggestion, idx) => {
                    const display = suggestion.display_name || suggestion.name;
                    return (
                      <div
                        key={idx}
                        className="px-4 py-2 cursor-pointer hover:bg-secondary/10 text-white"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        {display}
                      </div>
                    );
                  })}
                </div>
              )}
              {validationErrors.address && (
                <p className="text-sm text-red-400">{validationErrors.address}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-sm font-medium text-white">Bio *</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors.bio ? 'border-red-500' : ''}`}
                placeholder="Tell us about your business, experience, and what makes you unique..."
                rows={4}
              />
              {validationErrors.bio && (
                <p className="text-sm text-red-400">{validationErrors.bio}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialties" className="text-sm font-medium text-white">Specialties</Label>
              <SpecialtyAutocomplete
                value={formData.specialties}
                onChange={handleSpecialtiesChange}
                placeholder="Select your specialties..."
                maxSelections={15}
              />
              <p className="text-sm text-white/60">
                List your specialties to help clients find you
              </p>
            </div>

            {/* Social Media Section */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium text-white flex items-center gap-2">
                  <span>Social Media (Optional)</span>
                </Label>
                <p className="text-sm text-white/60">
                  Add your social media handles to help clients connect with you
                </p>
              </div>
              {/* Live preview of clickable icons */}
              <div className="flex items-center gap-2 mb-2">
                <SocialMediaLinks
                  instagram={formData.socialMedia.instagram}
                  twitter={formData.socialMedia.twitter}
                  tiktok={formData.socialMedia.tiktok}
                  facebook={formData.socialMedia.facebook}
                  size="md"
                  className="justify-center"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="socialMedia.instagram" className="text-white font-semibold flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-[#E1306C]" /> Instagram
                  </Label>
                  <Input
                    id="socialMedia.instagram"
                    name="socialMedia.instagram"
                    value={formData.socialMedia.instagram}
                    onChange={handleChange}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                    placeholder="@yourusername"
                  />
                  <p className="text-xs text-white/60">Only your handle (e.g., @yourusername)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialMedia.twitter" className="text-white font-semibold flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-[#1DA1F2]" /> Twitter/X
                  </Label>
                  <Input
                    id="socialMedia.twitter"
                    name="socialMedia.twitter"
                    value={formData.socialMedia.twitter}
                    onChange={handleChange}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                    placeholder="@yourusername"
                  />
                  <p className="text-xs text-white/60">Only your handle (e.g., @yourusername)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialMedia.tiktok" className="text-white font-semibold flex items-center gap-2">
                    <Music className="h-4 w-4 text-black" /> TikTok
                  </Label>
                  <Input
                    id="socialMedia.tiktok"
                    name="socialMedia.tiktok"
                    value={formData.socialMedia.tiktok}
                    onChange={handleChange}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                    placeholder="@yourusername"
                  />
                  <p className="text-xs text-white/60">Only your handle (e.g., @yourusername)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="socialMedia.facebook" className="text-white font-semibold flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-[#1877F3]" /> Facebook
                  </Label>
                  <Input
                    id="socialMedia.facebook"
                    name="socialMedia.facebook"
                    value={formData.socialMedia.facebook}
                    onChange={handleChange}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                    placeholder="yourpagename"
                  />
                  <p className="text-xs text-white/60">Only your page name (e.g., yourpagename)</p>
                </div>
              </div>
            </div>
          </div>
        )
      case 1:
        return (
          <div className="space-y-4">
            {validationErrors.services && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationErrors.services}</AlertDescription>
              </Alert>
            )}
            
            {formData.services.length === 0 && (
              <Alert className="bg-secondary/10 border-secondary/20 text-secondary">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Add at least one service to get started. You can always add more later.
                </AlertDescription>
              </Alert>
            )}
            
            {formData.services.map((service, index) => (
              <div key={index} className="space-y-4 p-4 border border-white/10 rounded-lg bg-white/5">
                <div className="space-y-2">
                  <Label htmlFor={`service-${index}-name`} className="text-sm font-medium text-white">Service Name *</Label>
                  <Input
                    id={`service-${index}-name`}
                    value={service.name}
                    onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                    className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors[`service-${index}-name`] ? 'border-red-500' : ''}`}
                    placeholder="e.g., Haircut"
                  />
                  {validationErrors[`service-${index}-name`] && (
                    <p className="text-sm text-red-400">{validationErrors[`service-${index}-name`]}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`service-${index}-price`} className="text-sm font-medium text-white">Price ($) *</Label>
                    <Input
                      id={`service-${index}-price`}
                      type="number"
                      value={service.price || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = val === '' ? 0 : parseFloat(val);
                        handleServiceChange(index, 'price', numVal);
                      }}
                      className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors[`service-${index}-price`] ? 'border-red-500' : ''}`}
                      min="0"
                      step="0.01"
                      placeholder="25.00"
                    />
                    {validationErrors[`service-${index}-price`] && (
                      <p className="text-sm text-red-400">{validationErrors[`service-${index}-price`]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`service-${index}-duration`} className="text-sm font-medium text-white">Duration (minutes) *</Label>
                    <Input
                      id={`service-${index}-duration`}
                      type="number"
                      value={service.duration || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const numVal = val === '' ? 0 : parseInt(val);
                        handleServiceChange(index, 'duration', numVal);
                      }}
                      className={`h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-secondary ${validationErrors[`service-${index}-duration`] ? 'border-red-500' : ''}`}
                      min="1"
                      step="1"
                      placeholder="30"
                    />
                    {validationErrors[`service-${index}-duration`] && (
                      <p className="text-sm text-red-400">{validationErrors[`service-${index}-duration`]}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeService(index)}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Remove Service
                </Button>
              </div>
            ))}
            <Button type="button" onClick={addService} variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Add Service
            </Button>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            {stripeStatus === 'active' && formData.stripeConnected ? (
              <Alert className="bg-green-500/10 border-green-500/20 text-green-400">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Stripe account is connected and ready to accept payments!
                </AlertDescription>
              </Alert>
            ) : stripeStatus === 'pending' ? (
              <Alert className="bg-secondary/10 border-secondary/20 text-secondary">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Stripe account is being reviewed. This usually takes 1-2 business days.
                </AlertDescription>
              </Alert>
            ) : stripeStatus === null ? (
              <>
                <p className="text-white/80">
                  To receive payments, you need to connect your Stripe account. This will allow you to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-white/80">
                  <li>Accept credit card payments securely</li>
                  <li>Receive payments directly to your bank account</li>
                  <li>Manage your earnings and payouts</li>
                  <li>Get detailed payment reports</li>
                </ul>
                
                {validationErrors.stripeConnected && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{validationErrors.stripeConnected}</AlertDescription>
                  </Alert>
                )}
                
                <Button
                  onClick={handleStripeConnect}
                  disabled={loading}
                  className="w-full bg-secondary hover:bg-secondary/90 text-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Stripe Account'
                  )}
                </Button>
                
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-white/60 text-center">
                    You'll be redirected to Stripe to complete the setup. This process is secure and takes about 5 minutes.
                  </p>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/20" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-darkpurple px-2 text-white/60">Or</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={loading}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Skip for Now
                  </Button>
                  
                  <p className="text-xs text-white/40 text-center">
                    You can set up payments later in your settings
                  </p>
                </div>
              </>
            ) : (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  There was an issue with your Stripe account. Please contact support.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const getProgressPercentage = () => {
    return ((currentStep + 1) / steps.length) * 100;
  };

  if (!isRouterReady) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>
      {/* Step Title Header */}
      <div className="w-full max-w-2xl mx-auto pt-8 pb-2 px-4">
        <h1 className="text-3xl sm:text-4xl font-bebas font-bold text-white text-center">
          {steps[currentStep].title}
        </h1>
      </div>

      {/* Progress Bar & Step Indicator */}
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex-1 flex flex-col items-center">
              <div className={`rounded-full border-2 ${currentStep === idx ? 'border-secondary bg-secondary/20' : 'border-white/20 bg-white/10'} w-12 h-12 flex items-center justify-center mb-2 transition-all`}>
                <step.icon className={`h-6 w-6 ${currentStep === idx ? 'text-secondary' : 'text-white/60'}`} />
              </div>
              <span className={`text-xs font-semibold ${currentStep === idx ? 'text-secondary' : 'text-white/60'}`}>{step.title}</span>
            </div>
          ))}
        </div>
        <Progress value={getProgressPercentage()} className="h-2 bg-white/10 rounded-full" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 pb-24 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -z-10" />
        <div className="w-full max-w-2xl">
          {/* Onboarding Complete Banner */}
          {onboardingComplete && showCompleteBanner && (
            <div className="flex justify-center mb-8">
              <Card className="bg-white/10 border border-white/20 shadow-2xl rounded-3xl max-w-lg w-full relative">
                <button
                  className="absolute top-4 right-4 text-green-200 hover:text-green-100 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-green-400"
                  aria-label="Dismiss"
                  onClick={() => setShowCompleteBanner(false)}
                >
                  <X className="h-5 w-5" />
                </button>
                <CardHeader className="bg-transparent rounded-t-3xl flex flex-col items-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="h-10 w-10 text-secondary drop-shadow-lg" />
                  </div>
                  <CardTitle className="text-2xl font-bebas font-bold text-white text-center">Onboarding Complete!</CardTitle>
                  <CardDescription className="text-white text-center mt-2 font-medium">
                    Your profile is ready. You can now receive bookings and payments.<br />
                    Welcome to the platform!
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center pb-8 pt-2">
                  <Button asChild className="bg-secondary text-black font-bebas font-bold rounded-xl px-8 py-3 mt-4 hover:bg-secondary/90 shadow-md text-lg transition-all duration-200 hover:scale-105 active:scale-100 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-black">
                    <Link href="/profile">Go to Profile</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step Card */}
          <Card className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-3xl">
            <CardHeader className="bg-white/5 border-b border-white/10 rounded-t-3xl">
              <CardTitle className="text-white flex flex-col items-center gap-2 text-center font-bebas font-bold text-3xl">
                <span className="flex items-center justify-center gap-2">
                  {React.createElement(steps[currentStep].icon, { className: 'h-6 w-6 text-secondary' })}
                  {steps[currentStep].title}
                </span>
              </CardTitle>
              <CardDescription className="text-white/70 font-medium text-center">
                {steps[currentStep].description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {renderStep()}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 mb-4 gap-4">
            <Button
              type="button"
              variant="outline"
              className="border-secondary text-secondary font-bebas font-bold hover:bg-secondary/10 rounded-xl px-6 py-3"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button
              type="button"
              className="bg-secondary text-black font-bebas font-bold rounded-xl px-8 py-3 hover:bg-secondary/90 shadow-md text-lg transition-all duration-200 hover:scale-105 active:scale-100 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-black"
              onClick={async () => {
                if (await validateStep(currentStep)) {
                  if (currentStep < steps.length - 1) {
                    setCurrentStep((prev) => prev + 1)
                  } else {
                    handleSubmit()
                  }
                } else {
                  toast({
                    title: 'Validation Error',
                    description: 'Please fix the errors before continuing.',
                    variant: 'destructive',
                  })
                }
              }}
              disabled={loading}
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 