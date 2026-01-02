"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
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
  Scissors, 
  Building2, 
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Save
} from 'lucide-react'
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { getAddressSuggestionsNominatim } from '@/shared/lib/geocode'
import { logger } from '@/shared/lib/logger'
import { PRICE_RANGES, extractHandle } from '@/shared/constants/settings'
import { CarrierSelect } from '@/shared/components/forms/carrier-select'
import { SmsNotificationToggle } from '@/shared/components/forms/sms-notification-toggle'
import { LocationInput } from '@/shared/components/forms/location-input'
import { SocialMediaInputs } from '@/shared/components/forms/social-media-inputs'

const barberProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters'),
  location: z.string().min(2, 'Location is required'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  carrier: z.string().min(2, 'Carrier is required'),
  sms_notifications: z.boolean().default(false),
  specialties: z.array(z.string()).min(1, 'Select at least one specialty'),
  priceRange: z.enum(['Budget ($15-$30)', 'Mid-range ($30-$60)', 'Premium ($60+)'], {
    required_error: 'Please select a price range'
  }),
  instagram: z.string().optional().or(z.literal('')),
  twitter: z.string().optional().or(z.literal('')),
  tiktok: z.string().optional().or(z.literal('')),
  facebook: z.string().optional().or(z.literal('')),
  isPublic: z.boolean(),
})

type BarberProfileFormData = z.infer<typeof barberProfileSchema>

interface BarberProfileSettingsProps {
  onSave?: () => void
}

export function BarberProfileSettings({ onSave }: BarberProfileSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLon, setLocationLon] = useState<number | null>(null)

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

  const loadBarberProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      logger.debug('Loading barber profile for user', { userId: user.id })

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        logger.error('Profile fetch error', profileError)
        throw profileError
      }

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

      form.reset(formData)
      
      if (barber.latitude && barber.longitude) {
        setLocationLat(barber.latitude)
        setLocationLon(barber.longitude)
      }

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
    const geoSuggestions = await getAddressSuggestionsNominatim(data.location)
    const geo = geoSuggestions && geoSuggestions.length > 0 
      ? { lat: parseFloat(geoSuggestions[0].lat), lon: parseFloat(geoSuggestions[0].lon) } 
      : null
    
    if (!geo) {
      toast({
        title: 'Invalid location',
        description: 'Please enter a valid place from the suggestions.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // Format location from geocoding result
      let formattedLocation = data.location
      if (geoSuggestions && geoSuggestions.length > 0) {
        const address = geoSuggestions[0].address || {}
        const house = address.house_number || ''
        const road = address.road || ''
        const city = address.city || address.town || address.village || address.hamlet || ''
        const state = address.state || address.state_code || ''
        const line1 = [house, road].filter(Boolean).join(' ')
        const line2 = [city, state].filter(Boolean).join(', ')
        formattedLocation = [line1, line2].filter(Boolean).join(', ')
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
          latitude: geo.lat,
          longitude: geo.lon,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (barberError) throw barberError

      toast({
        title: 'Success',
        description: 'Profile updated successfully! Your changes will be visible in search results.',
      })

      // Send test SMS if enabled
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
          })
          if (res.ok) {
            toast({
              title: 'Test SMS sent',
              description: 'A test SMS was sent to your phone to confirm notifications are enabled.'
            })
          } else {
            const err = await res.json()
            toast({
              title: 'SMS failed',
              description: err.error || 'Failed to send test SMS. Please check your carrier and phone number.',
              variant: 'destructive',
            })
          }
        } catch (e) {
          toast({
            title: 'SMS failed',
            description: 'Could not send test SMS. Please check your connection.',
            variant: 'destructive',
          })
        }
      }

      if (onSave) onSave()

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

  const handleLocationGeocode = (lat: number, lon: number) => {
    setLocationLat(lat)
    setLocationLon(lon)
  }

  return (
    <div className="space-y-6">
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
                      <FormItem>
                        <LocationInput
                          value={field.value}
                          onChange={field.onChange}
                          onGeocode={handleLocationGeocode}
                          error={!!form.formState.errors.location}
                        />
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
                      <CarrierSelect
                        value={field.value}
                        onChange={field.onChange}
                        error={!!form.formState.errors.carrier}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sms_notifications"
                  render={({ field }) => (
                    <FormItem>
                      <SmsNotificationToggle
                        value={field.value}
                        onChange={field.onChange}
                      />
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
                
                <SocialMediaInputs control={form.control} />
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
    </div>
  )
}

