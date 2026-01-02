'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/shared/lib/supabase'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useToast } from '@/shared/components/ui/use-toast'
import { Loader2, User, Mail, Phone, Save, Camera, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { CarrierSelect } from '@/shared/components/forms/carrier-select'
import { SmsNotificationToggle } from '@/shared/components/forms/sms-notification-toggle'
import { SimpleLocationInput } from '@/shared/components/forms/simple-location-input'
import { logger } from '@/shared/lib/logger'

const clientProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().optional(),
  carrier: z.string().min(1, 'Carrier is required'),
  sms_notifications: z.boolean().default(false),
})

type ClientProfileFormData = z.infer<typeof clientProfileSchema>

interface ClientProfileSettingsProps {
  onUpdate?: () => void
}

export function ClientProfileSettings({ onUpdate }: ClientProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { user, status } = useAuth()
  const { push: safePush } = useSafeNavigation()

  const form = useForm<ClientProfileFormData>({
    resolver: zodResolver(clientProfileSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      phone: '',
      bio: '',
      location: '',
      carrier: '',
      sms_notifications: false,
    },
  })

  const fetchProfile = useCallback(async () => {
    if (!user) return

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // Get carrier and phone from localStorage for autofill
      const storedCarrier = typeof window !== 'undefined' ? localStorage.getItem('sms_carrier') : null
      const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('sms_phone') : null

      form.reset({
        name: profile.name || '',
        username: profile.username || '',
        email: profile.email || '',
        phone: profile.phone || storedPhone || '',
        bio: profile.bio || '',
        location: profile.location || '',
        carrier: profile.carrier || storedCarrier || '',
        sms_notifications: profile.sms_notifications || false,
      })

      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url)
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
  }, [user, form, toast])

  useEffect(() => {
    if (status === 'unauthenticated') {
      safePush('/login')
      return
    }

    if (user && isInitialLoad) {
      fetchProfile()
    }
  }, [status, user, isInitialLoad, safePush, fetchProfile])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return
      const file = e.target.files[0]
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        })
        return
      }

      setIsLoading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
      
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
    } catch (error: any) {
      logger.error('Error uploading avatar', error)
      toast({
        title: 'Error',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: ClientProfileFormData) => {
    if (!user) return

    try {
      setIsLoading(true)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          username: data.username,
          email: data.email,
          phone: data.phone,
          bio: data.bio,
          location: data.location,
          carrier: data.carrier,
          sms_notifications: data.sms_notifications,
        })
        .eq('id', user.id)
      
      if (profileError) throw profileError
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully!',
      })
      onUpdate?.()
    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

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
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
        <p className="text-white/60">Manage your personal information and preferences</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">Basic Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-secondary" />
                            Full Name *
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your full name"
                              className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                              {...field}
                            />
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
                          <FormLabel className="text-white font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-secondary" />
                            Username *
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your_username"
                              className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-white/60 text-xs">
                            Used in your booking link: bocmstyle.com/book/{field.value || 'your_username'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">Contact Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-secondary" />
                            Email Address *
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email address"
                              className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                              {...field}
                            />
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
                          <FormLabel className="text-white font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-secondary" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="(555) 123-4567"
                              className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">SMS Notifications</h4>
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <SimpleLocationInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          error={!!form.formState.errors.location}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-medium">Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary resize-none"
                          placeholder="Tell us about yourself..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-white/60">
                        {field.value?.length || 0}/500 characters
                      </FormDescription>
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
      </Form>
    </div>
  )
}

