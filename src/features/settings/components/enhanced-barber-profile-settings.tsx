"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useToast } from '@/shared/components/ui/use-toast'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { 
  MapPin, 
  Scissors, 
  DollarSign, 
  Building2, 
  Instagram,
  Twitter,
  Facebook,
  Music,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Save,
  Info,
  Phone,
  Check,
  X
} from 'lucide-react'
// import { BrowseIntegrationGuide } from './browse-integration-guide' // Removed
import { BARBER_SPECIALTIES } from '@/shared/constants/specialties'
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { geocodeAddress, getAddressSuggestionsNominatim } from '@/shared/lib/geocode'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { logger } from '@/shared/lib/logger'

const barberProfileSchema = z.object({
  // Basic Info
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters'),
  location: z.string().min(2, 'Location is required'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  carrier: z.string().min(2, 'Carrier is required'),
  sms_notifications: z.boolean().default(false),
  
  // Professional Info
  specialties: z.array(z.string()).min(1, 'Select at least one specialty'),
  priceRange: z.enum(['Budget ($15-$30)', 'Mid-range ($30-$60)', 'Premium ($60+)'], {
    required_error: 'Please select a price range'
  }),
  
  // Social Media
  instagram: z.string().optional().or(z.literal('')),
  twitter: z.string().optional().or(z.literal('')),
  tiktok: z.string().optional().or(z.literal('')),
  facebook: z.string().optional().or(z.literal('')),
  
  // Visibility
  isPublic: z.boolean(),
})

type BarberProfileFormData = z.infer<typeof barberProfileSchema>

const PRICE_RANGES = [
  { value: 'Budget ($15-$30)', label: 'Budget ($15-$30)', description: 'Budget ($15-$30) - Affordable services for everyone' },
  { value: 'Mid-range ($30-$60)', label: 'Mid-range ($30-$60)', description: 'Mid-range ($30-$60) - Quality services at fair prices' },
  { value: 'Premium ($60+)', label: 'Premium ($60+)', description: 'Premium ($60+) - High-end services and expertise' }
]

const CARRIER_OPTIONS = [
  { value: 'verizon', label: 'Verizon' },
  { value: 'att', label: 'AT&T' },
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'metro', label: 'MetroPCS' },
  { value: 'googlefi', label: 'Google Fi' },
];

interface EnhancedBarberProfileSettingsProps {
  onSave?: () => void;
  showPreview?: boolean;
  showIntegrationGuide?: boolean;
}

// Utility function to extract handle from URL or return as-is if already a handle
function extractHandle(input: string): string {
  if (!input) return '';
  // Remove leading/trailing whitespace
  input = input.trim();
  // If input is a URL, extract the handle
  try {
    const url = new URL(input);
    // Instagram/Twitter/TikTok: last path segment
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      // For TikTok, handle may be prefixed with '@'
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL, fall through
  }
  // If input starts with @, return as-is, else add @
  if (input.startsWith('@')) return input;
  return '@' + input;
}

export function EnhancedBarberProfileSettings({ onSave, showPreview = true, showIntegrationGuide = true }: EnhancedBarberProfileSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const form = useForm<BarberProfileFormData>({
    resolver: zodResolver(barberProfileSchema),
    defaultValues: {
      name: '',
      username: '',
      businessName: '',
      bio: '',
      location: '',
      phone: '',
      carrier: '',
      specialties: [],
      priceRange: 'Mid-range ($30-$60)',
      instagram: '',
      twitter: '',
      tiktok: '',
      facebook: '',
      isPublic: true,
      sms_notifications: false,
    },
  })

  useEffect(() => {
    if (user) {
      loadBarberProfile()
    }
  }, [user])

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
      logger.error('Error fetching suggestions', error)
      setLocationSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    if (showSuggestions && locationInput.length >= 3) {
      const timer = setTimeout(() => {
        debouncedFetchSuggestions(locationInput);
      }, 300); // 300ms debounce
      
      debounceTimerRef.current = timer;
    } else if (locationInput.length < 3) {
      setLocationSuggestions([]);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [locationInput, showSuggestions, debouncedFetchSuggestions]);

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationInput(e.target.value ?? '');
    setShowSuggestions(true);
    form.setValue('location', e.target.value ?? '');
  };

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: any) => {
    // Format: house_number road, city/town, state (e.g., '88 Doe Court, South Brunswick, NJ')
    const address = suggestion.address || {};
    const house = address.house_number || '';
    const road = address.road || '';
    const city = address.city || address.town || address.village || address.hamlet || '';
    const state = address.state || address.state_code || '';
    // Build the formatted string
    let line1 = [house, road].filter(Boolean).join(' ');
    let line2 = [city, state].filter(Boolean).join(', ');
    let formatted = [line1, line2].filter(Boolean).join(', ');
    setLocationInput(formatted);
    setShowSuggestions(false);
    setLocationSuggestions([]); // Clear suggestions immediately
    form.setValue('location', formatted);
  };

  // Validate location on blur
  const handleLocationBlur = async () => {
    // Add a small delay to allow clicking on suggestions
    setTimeout(async () => {
      if (!locationInput) return;
      // Use Nominatim proxy for geocoding
      const geoSuggestions = await getAddressSuggestionsNominatim(locationInput);
      const geo = geoSuggestions && geoSuggestions.length > 0 ? { lat: parseFloat(geoSuggestions[0].lat), lon: parseFloat(geoSuggestions[0].lon) } : null;
      if (!geo) {
        toast({
          title: 'Invalid location',
          description: 'Please enter a valid place from the suggestions.',
          variant: 'destructive',
        });
        setLocationInput('');
        form.setValue('location', '');
      }
    }, 200);
  };

  const loadBarberProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      logger.debug('Loading barber profile for user', { userId: user.id })

      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        logger.error('Profile fetch error', profileError)
        throw profileError
      }

      logger.debug('Profile data loaded', { userId: profile?.id })

      // Fetch barber data
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (barberError) {
        logger.error('Barber fetch error', barberError)
        throw barberError
      }

      logger.debug('Barber data loaded', { barberId: barber?.id })

      // Update form with fetched data
      const formData = {
        name: profile.name || '',
        username: profile.username || '',
        businessName: barber.business_name || '',
        bio: barber.bio || profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        carrier: profile.carrier || '',
        specialties: barber.specialties || [],
        priceRange: barber.price_range || 'Mid-range ($30-$60)',
        instagram: barber.instagram || '',
        twitter: barber.twitter || '',
        tiktok: barber.tiktok || '',
        facebook: barber.facebook || '',
        isPublic: profile.is_public ?? true,
        sms_notifications: profile.sms_notifications ?? false,
      }

      logger.debug('Setting form data', { hasData: !!formData.name })
      form.reset(formData)
      setLocationInput(profile.location || '');

    } catch (error) {
      logger.error('Error loading barber profile', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile data. Please refresh the page.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: BarberProfileFormData) => {
    if (!user) return

    // Validate location before submit
    // Use Nominatim proxy for geocoding
    const geoSuggestions = await getAddressSuggestionsNominatim(data.location);
    const geo = geoSuggestions && geoSuggestions.length > 0 ? { lat: parseFloat(geoSuggestions[0].lat), lon: parseFloat(geoSuggestions[0].lon) } : null;
    if (!geo) {
      toast({
        title: 'Invalid location',
        description: 'Please enter a valid place from the suggestions.',
        variant: 'destructive',
      })
      return;
    }
    let lat = geo.lat, lon = geo.lon

    try {
      setLoading(true)

      // If the location is not already formatted, reformat it from the geo suggestion
      let formattedLocation = data.location;
      if (geoSuggestions && geoSuggestions.length > 0) {
        const address = geoSuggestions[0].address || {};
        const house = address.house_number || '';
        const road = address.road || '';
        const city = address.city || address.town || address.village || address.hamlet || '';
        const state = address.state || address.state_code || '';
        const line1 = [house, road].filter(Boolean).join(' ');
        const line2 = [city, state].filter(Boolean).join(', ');
        formattedLocation = [line1, line2].filter(Boolean).join(', ');
      }
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          sms_notifications: data.sms_notifications,
          carrier: data.carrier,
          phone: data.phone,
          is_public: data.isPublic,
          location: formattedLocation,
          name: data.name,
          username: data.username,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update barber profile
      const { error: barberError } = await supabase
        .from('barbers')
        .update({
          business_name: data.businessName,
          bio: data.bio,
          specialties: data.specialties,
          price_range: data.priceRange,
          instagram: extractHandle(data.instagram || ''),
          twitter: extractHandle(data.twitter || ''),
          tiktok: extractHandle(data.tiktok || ''),
          facebook: extractHandle(data.facebook || ''),
          latitude: lat,
          longitude: lon,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (barberError) throw barberError

      toast({
        title: 'Success',
        description: 'Profile updated successfully! Your changes will be visible in search results.',
      })

      // After successful save, send test SMS if enabled
      if (data.sms_notifications && data.phone && data.carrier) {
        try {
          const res = await fetch('/api/bookings/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: data.phone,
              carrier: data.carrier,
              message: 'Thank you for enabling SMS notifications! You will now receive important updates by text.'
            })
          });
          if (res.ok) {
            toast({
              title: 'Test SMS sent',
              description: 'A test SMS was sent to your phone to confirm notifications are enabled.'
            });
          } else {
            const err = await res.json();
            toast({
              title: 'SMS failed',
              description: err.error || 'Failed to send test SMS. Please check your carrier and phone number.',
              variant: 'destructive',
            });
          }
        } catch (e) {
          toast({
            title: 'SMS failed',
            description: 'Could not send test SMS. Please check your connection.',
            variant: 'destructive',
          });
        }
      }

      if (onSave) onSave();

    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleSpecialty = (specialty: string) => {
    const currentValue = form.getValues('specialties')
    const newValue = currentValue.includes(specialty)
      ? currentValue.filter(s => s !== specialty)
      : [...currentValue, specialty]
    form.setValue('specialties', newValue)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-secondary/20 rounded-full">
            <User className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bebas text-white tracking-wide">
              Barber Profile Settings
            </h2>
            <p className="text-white/70 text-sm sm:text-base">
              Manage your profile information that appears in search results and booking pages
            </p>
          </div>
        </div>
      </div>

      <Card className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
        <CardHeader className="bg-white/5 rounded-t-2xl border-b border-white/10 p-6">
          <CardTitle className="flex items-center gap-2 text-white text-2xl font-bebas">
            <Building2 className="h-5 w-5 text-secondary" />
            Profile Information
          </CardTitle>
          <CardDescription className="text-white/80">
            Update your basic information and business details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Basic Information */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <User className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Basic Information</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="your_username" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-white/60">
                          Used in your booking link: bocmstyle.com/book/{field.value || 'your_username'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell clients about yourself, your experience, and what makes you unique..."
                          className="min-h-[100px] bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This appears in search results and your profile page. {field.value?.length || 0}/500 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel className="text-white font-semibold">Location *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary" />
                            <Input
                              placeholder="City, State or Zip Code"
                              className="pl-10 bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl"
                              value={locationInput ?? ''}
                              onChange={handleLocationChange}
                              onFocus={() => setShowSuggestions(true)}
                              onBlur={handleLocationBlur}
                              autoComplete="off"
                            />
                            {/* Suggestions dropdown */}
                            {showSuggestions && (locationSuggestions.length > 0 || suggestionsLoading) && (
                              <div className="absolute z-50 left-0 right-0 mt-1 bg-black border border-white/20 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                {suggestionsLoading && (
                                  <div className="px-4 py-2 text-white/60 text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                                      Searching...
                                    </div>
                                  </div>
                                )}
                                {locationSuggestions.map((s, i) => (
                                  <button
                                    key={`${s.place_id || i}-${s.display_name}`}
                                    type="button"
                                    className="w-full text-left px-4 py-2 text-white hover:bg-secondary/20"
                                    onMouseDown={() => handleSuggestionSelect(s)}
                                  >
                                    {s.display_name || s.name || 'Unknown location'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-semibold">Phone Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Carrier *
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span>We need your carrier to send you free SMS reminders. If you’re unsure, check your phone bill or carrier app.</span>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary rounded-xl flex items-center gap-2 ${form.formState.errors.carrier ? 'border-red-400' : ''}`}>
                          <Phone className="h-4 w-4 text-secondary mr-2" />
                          <SelectValue placeholder="Select your carrier…" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkpurple border-white/20 text-white">
                          {CARRIER_OPTIONS.map((carrier) => (
                            <SelectItem key={carrier.value} value={carrier.value} className="flex items-center justify-between">
                              <span>{carrier.label}</span>
                              {field.value === carrier.value && <Check className="h-4 w-4 text-secondary ml-2" />}
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
                  name="sms_notifications"
                  render={({ field }) => (
                    <FormItem className="mt-2">
                      <Button
                        size="sm"
                        className={
                          field.value
                            ? 'bg-green-600 text-white font-semibold rounded-lg px-4 py-2 shadow flex items-center gap-2 hover:bg-green-700 transition'
                            : 'bg-secondary text-primary font-semibold rounded-lg px-4 py-2 shadow hover:bg-secondary/90 transition'
                        }
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? <><Check className="h-4 w-4" /> SMS Notifications Enabled</> : <>Enable SMS Notifications</>}
                      </Button>
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="bg-white/20" />

              {/* Professional Information */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Scissors className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Professional Information</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <FormField
                  control={form.control}
                  name="specialties"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Specialties *</FormLabel>
                      <FormControl>
                        <SpecialtyAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Search and select your specialties..."
                          maxSelections={15}
                        />
                      </FormControl>
                      <FormDescription>
                        Select the services you specialize in. These appear in search results and help clients find you.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priceRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-semibold">Price Range *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white focus:border-secondary rounded-xl">
                            <SelectValue placeholder="Select your price range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-black/90 border border-white/10 backdrop-blur-xl rounded-2xl text-white">
                          {PRICE_RANGES.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{range.label}</span>
                                
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        This helps clients understand your pricing tier and appears in search filters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="bg-white/20" />

              {/* Social Media */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Social Media</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                <p className="text-sm text-white/80">
                  Add your social media handles (just your @ or username, not the full link).
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-white font-semibold">
                          <Instagram className="h-4 w-4 text-[#E1306C]" />
                          Instagram
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@yourusername" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-white/60">
                          Only your handle (e.g., @yourusername)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-white font-semibold">
                          <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                          Twitter/X
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@yourusername" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-white/60">
                          Only your handle (e.g., @yourusername)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tiktok"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-white font-semibold">
                          <Music className="h-4 w-4 text-[#000000]" />
                          TikTok
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="@yourusername" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-white/60">
                          Only your handle (e.g., @yourusername)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-white font-semibold">
                          <Facebook className="h-4 w-4 text-[#1877F3]" />
                          Facebook
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="yourpagename" {...field} className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl" />
                        </FormControl>
                        <FormDescription className="text-white/60">
                          Only your page name (e.g., yourpagename)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="bg-white/20" />

              {/* Visibility Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Visibility Settings</h3>
                </div>
                <Separator className="my-2 bg-secondary/40" />
                
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border p-6 bg-white/10 border-white/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base text-white font-semibold">Public Profile</FormLabel>
                        <FormDescription>
                          When enabled, your profile appears in search results and can be discovered by new clients.
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

                {!form.watch('isPublic') && (
                  <Alert className="bg-red-900/30 border-red-400/30 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your profile is currently private and won't appear in search results. Enable public profile to start receiving bookings from new clients.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-6">
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="min-w-[140px] bg-secondary text-primary font-semibold rounded-xl px-8 py-3 hover:bg-secondary/90 shadow-lg text-lg transition-all duration-200 hover:scale-105 active:scale-100 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-darkpurple"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Profile Preview */}
      {/* Removed profile preview as requested */}

      {/* Integration Guide */}
              {/* BrowseIntegrationGuide removed */}
    </div>
  )
} 