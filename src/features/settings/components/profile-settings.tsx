'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/shared/lib/supabase'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useToast } from '@/shared/components/ui/use-toast'
import { Loader2, Upload, CheckCircle, AlertCircle, User, Mail, Phone, MapPin, Building2, Instagram, Twitter, Facebook, Globe, Save, Camera, Sparkles, Info, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Switch } from '@/shared/components/ui/switch'
import { SpecialtyAutocomplete } from '@/shared/components/ui/specialty-autocomplete'
import { Badge } from '@/shared/components/ui/badge'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/shared/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { logger } from '@/shared/lib/logger'

interface ProfileFormData {
  name: string
  username: string
  email: string
  phone: string
  bio: string
  location: string
  description: string
  specialties: string[]
  businessName: string
  isPublic: boolean
  socialMedia: {
    instagram: string
    twitter: string
    tiktok: string
    facebook: string
  }
  carrier: string
  sms_notifications: boolean
}

interface ProfileSettingsProps {
  onUpdate?: () => void
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

// Timeout helper
async function withTimeout(promise: Promise<any>, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

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

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isBarber, setIsBarber] = useState(false)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()
  const { user, status } = useAuth()
  const router = useRouter()
  const { push: safePush } = useSafeNavigation();
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProfileFormData>()
  const [isDeveloper, setIsDeveloper] = useState(false)

  // Add state for separate address fields (removed zipCode and state)
  const [addressFields, setAddressFields] = useState({
    address: '',
    city: ''
  })

  // Function to parse location string into separate fields (simplified)
  const parseLocation = (location: string) => {
    if (!location) return { address: '', city: '' }
    
    // Try different location formats
    const locationStr = location.trim()
    
    // Format: "Address, City, State ZIP" or "Address, City, State"
    const fullMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:,\s*[A-Za-z]{2,}\s*\d{5}?)?$/);
    if (fullMatch) {
      return {
        address: fullMatch[1].trim(),
        city: fullMatch[2].trim()
      }
    }
    
    // Format: "Address, City State ZIP" or "Address, City State"
    const cityStateMatch = locationStr.match(/^(.+?),\s*([^,]+?)(?:\s+[A-Za-z]{2,}\s*\d{5}?)?$/);
    if (cityStateMatch) {
      return {
        address: cityStateMatch[1].trim(),
        city: cityStateMatch[2].trim()
      }
    }
    
    // Fallback: split by comma and try to extract
    const parts = locationStr.split(',').map((part: string) => part.trim());
    if (parts.length >= 2) {
      const address = parts[0];
      const city = parts[1];
      
      return { address, city }
    }
    
    return { address: locationStr, city: '' }
  }

  // Function to combine address fields into location string (simplified)
  const combineAddressFields = (fields: typeof addressFields) => {
    const parts = [fields.address, fields.city].filter(Boolean);
    return parts.join(', ');
  }

  const validateForm = (data: ProfileFormData): boolean => {
    const errors: {[key: string]: string} = {}
    
    if (!data.name?.trim()) errors.name = 'Full name is required'
    if (!data.username?.trim()) errors.username = 'Username is required'
    if (data.username && !/^[a-zA-Z0-9_]{3,30}$/.test(data.username)) {
      errors.username = 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    }
    if (!data.email?.trim()) errors.email = 'Email is required'
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address'
    }
    if (data.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(data.phone.replace(/\s/g, ''))) {
      errors.phone = 'Please enter a valid phone number'
    }
    if (!data.carrier?.trim()) errors.carrier = 'Carrier is required';
    if (isBarber && !data.businessName?.trim()) {
      errors.businessName = 'Business name is required for barbers'
    }
    if (isBarber && !data.bio?.trim()) {
      errors.bio = 'Bio is required for barbers'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const fetchProfile = useCallback(async () => {
    if (!user) return

    try {
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // Check if user is a barber
      if (profile?.role === 'barber') {
        setIsBarber(true)
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (barberError) {
          logger.error('Error fetching barber profile', barberError)
          safePush('/barber/onboarding');
          return;
        }
        if (barber) {
          setBarberId(barber.id)
          // Use barber's bio if available, otherwise use profile's bio
          // Parse location into separate fields
          const parsedLocation = parseLocation(profile.location || '');
          setAddressFields(parsedLocation);
          
          // Get carrier and phone from localStorage for autofill
          const storedCarrier = typeof window !== 'undefined' ? localStorage.getItem('sms_carrier') : null;
          const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('sms_phone') : null;
          
          reset({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || storedPhone || '',
            bio: barber.bio || profile.bio || '',
            location: profile.location || '',
            description: profile.description || '',
            specialties: barber.specialties || [],
            businessName: barber.business_name || '',
            isPublic: profile.is_public || false,
            socialMedia: {
              instagram: barber.instagram || '',
              twitter: barber.twitter || '',
              tiktok: barber.tiktok || '',
              facebook: barber.facebook || ''
            },
            carrier: profile.carrier || storedCarrier || '',
            sms_notifications: profile.sms_notifications || false,
          })
        }
      } else {
        // For non-barbers, just use profile data
        // Parse location into separate fields
        const parsedLocation = parseLocation(profile.location || '');
        setAddressFields(parsedLocation);
        
                  // Get carrier and phone from localStorage for autofill
          const storedCarrier = typeof window !== 'undefined' ? localStorage.getItem('sms_carrier') : null;
          const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('sms_phone') : null;
          
          reset({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || storedPhone || '',
          bio: profile.bio || '',
          location: profile.location || '',
          description: profile.description || '',
          specialties: [],
          businessName: '',
          isPublic: profile.is_public || false,
          socialMedia: {
            instagram: '',
            twitter: '',
            tiktok: '',
            facebook: ''
          },
          carrier: profile.carrier || storedCarrier || '',
          sms_notifications: profile.sms_notifications || false,
        })
      }

      // Set avatar URL if exists
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      }

      // Fetch is_developer from barbers table
      if (user?.role === 'barber') {
        const { data } = await supabase
          .from('barbers')
          .select('is_developer')
          .eq('user_id', user.id)
          .single()

        if (data && typeof data.is_developer === 'boolean') {
          setIsDeveloper(data.is_developer)
        }
      }
    } catch (error) {
      logger.error('Error fetching profile', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile data. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsInitialLoad(false)
    }
  }, [user, reset, toast, safePush])

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      safePush('/login')
      return
    }

    if (user && isInitialLoad) {
      fetchProfile()
    }
  }, [status, user, isInitialLoad, safePush])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return
      const file = e.target.files[0]
      
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        })
        return
      }

      setIsLoading(true)
      // Upload to Supabase Storage with timeout
      await withTimeout((async () => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, file)
        if (error) throw error
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user?.id)
        if (updateError) throw updateError
        setAvatarUrl(publicUrl)
        toast({
          title: 'Success',
          description: 'Avatar updated successfully!',
        })
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Avatar upload took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error uploading avatar', error)
        toast({
          title: 'Error',
          description: 'Failed to upload avatar. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    if (!validateForm(data)) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      await withTimeout((async () => {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: data.name,
            username: data.username,
            email: data.email,
            phone: data.phone,
            bio: data.bio,
            location: combineAddressFields(addressFields), // Combine address fields
            description: data.description,
            is_public: data.isPublic,
            carrier: data.carrier,
            sms_notifications: data.sms_notifications,
          })
          .eq('id', user?.id)
        if (profileError) throw profileError
        // Update barber data if user is a barber
        if (isBarber && barberId) {
          const { error: barberError } = await supabase
            .from('barbers')
            .update({
              business_name: data.businessName,
              bio: data.bio,
              specialties: data.specialties,
              instagram: extractHandle(data.socialMedia.instagram),
              twitter: extractHandle(data.socialMedia.twitter),
              tiktok: extractHandle(data.socialMedia.tiktok),
              facebook: extractHandle(data.socialMedia.facebook),
            })
            .eq('id', barberId)
          if (barberError) throw barberError
        }
        toast({
          title: 'Success',
          description: 'Profile updated successfully!',
        })
        onUpdate?.()
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Profile update took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error updating profile', error)
        toast({
          title: 'Error',
          description: 'Failed to update profile. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeveloperToggle = async (checked: boolean) => {
    setIsDeveloper(checked)
    if (user?.role === 'barber') {
      await supabase
        .from('barbers')
        .update({ is_developer: checked })
        .eq('user_id', user.id)
    }
  }

  // Only show quick stats for clients
  const isClient = user?.role !== 'barber';
  // Example stats (replace with real data if available)
  const quickStats = [
    { label: 'Total Bookings', value: 0, icon: <CheckCircle className="h-6 w-6 text-secondary" /> },
    { label: 'Favorite Barbers', value: 0, icon: <Sparkles className="h-6 w-6 text-secondary" /> },
    { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently', icon: <User className="h-6 w-6 text-secondary" /> },
  ];

  if (isInitialLoad) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-secondary/20 rounded-full">
              <User className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bebas text-white tracking-wide">
                Profile Settings
              </h3>
              <p className="text-white/80 mt-1">Manage your personal information</p>
            </div>
          </div>
        </div>
        
        <Card className="bg-darkpurple/90 border border-white/10 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-secondary" />
                  <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
                </div>
                <p className="text-white/60 font-medium">Loading profile...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
        <p className="text-white/60">Manage your personal information and preferences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl">
          <CardHeader className="bg-white/5 border-b border-white/10">
            <CardTitle className="text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-secondary" />
              Personal Information
            </CardTitle>
            <CardDescription className="text-white/70">
              Update your profile details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Form Fields (avatar upload removed) */}
            <div className="flex-1 w-full space-y-6">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">Basic Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-secondary" />
                        Full Name *
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${validationErrors.name ? 'border-red-400' : ''}`}
                        {...register('name', { required: 'Name is required' })}
                        placeholder="Enter your full name"
                      />
                      {validationErrors.name && (
                        <p className="text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-white font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-secondary" />
                        Username *
                      </Label>
                      <Input
                        id="username"
                        type="text"
                        className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${validationErrors.username ? 'border-red-400' : ''}`}
                        {...register('username', { required: 'Username is required' })}
                        placeholder="your_username"
                      />
                      {validationErrors.username && (
                        <p className="text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.username}
                        </p>
                      )}
                      <p className="text-xs text-white/60">
                        Used in your booking link: bocmstyle.com/book/{watch('username') || 'your_username'}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Contact Information Section */}
                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">Contact Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-secondary" />
                        Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${validationErrors.email ? 'border-red-400' : ''}`}
                        {...register('email', { required: 'Email is required' })}
                        placeholder="Enter your email address"
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-white font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-secondary" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary ${validationErrors.phone ? 'border-red-400' : ''}`}
                        {...register('phone')}
                        placeholder="(555) 123-4567"
                      />
                      {validationErrors.phone && (
                        <p className="text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {/* SMS Notifications Section */}
                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">SMS Notifications</h4>
                  <div className="space-y-2">
                    <Label htmlFor="carrier" className="text-white font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-secondary" />
                      Carrier *
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-secondary cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>We need your carrier to send you free SMS reminders. If you’re unsure, check your phone bill or carrier app.</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select
                      value={watch('carrier')}
                      onValueChange={(value) => setValue('carrier', value)}
                    >
                      <SelectTrigger className={`h-12 px-4 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary focus:ring-2 focus:ring-secondary/40 rounded-xl shadow-sm flex items-center gap-2 ${errors.carrier ? 'border-red-400' : ''}`}>
                        <SelectValue placeholder="Select your carrier…" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/10 border border-white/20 shadow-xl rounded-xl text-white">
                        {CARRIER_OPTIONS.map((carrier) => (
                          <SelectItem key={carrier.value} value={carrier.value} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/10 rounded-lg transition-colors">
                            <span>{carrier.label}</span>
                            {watch('carrier') === carrier.value && <Check className="h-4 w-4 text-secondary ml-2" />}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.carrier && (
                      <p className="text-red-400 text-sm">Carrier is required</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-white font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-secondary" />
                      Address
                    </Label>
                    <Input
                      id="address"
                      type="text"
                      className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                      value={addressFields.address}
                      onChange={(e) => setAddressFields(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="123 Main St"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-white font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-secondary" />
                      City
                    </Label>
                    <Input
                      id="city"
                      type="text"
                      className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                      value={addressFields.city}
                      onChange={(e) => setAddressFields(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="New York"
                    />
                  </div>

                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-white font-medium">
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    className={`bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary resize-none ${validationErrors.bio ? 'border-red-400' : ''}`}
                    {...register('bio')}
                    placeholder="Tell us about yourself..."
                  />
                  {validationErrors.bio && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validationErrors.bio}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {!watch('sms_notifications') ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 bg-secondary text-primary font-semibold rounded-lg px-4 py-2 shadow hover:bg-secondary/90 transition"
                      onClick={() => setValue('sms_notifications', true)}
                    >
                      Enable SMS Notifications
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 bg-green-600 text-white font-semibold rounded-lg px-4 py-2 shadow flex items-center gap-2 cursor-default"
                      disabled
                    >
                      <Check className="h-4 w-4" /> SMS Notifications Enabled
                    </Button>
                  )}
                </div>
              </div>
            {/* Save Button */}
            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-secondary hover:bg-secondary/90 text-primary font-semibold shadow-lg px-8 py-3"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>


    </div>
  )
} 