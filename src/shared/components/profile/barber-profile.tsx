"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useSafeNavigation } from "@/shared/hooks/use-safe-navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { Badge } from "@/shared/components/ui/badge"
import { Calendar, Star, Scissors, Camera, Search, Info, X, User } from "lucide-react"
import { useToast } from "@/shared/components/ui/use-toast"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { useData } from "../../hooks/use-data"
import { supabase } from '@/shared/lib/supabase'
import { BARBER_SPECIALTIES, getFilteredSpecialties } from '@/shared/constants/specialties'
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover"
import { Progress } from "@/shared/components/ui/progress"


export function BarberProfile() {
  const { push } = useSafeNavigation()
  const { user } = useAuth()
  const { updateBarber, loading: dataLoading } = useData()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [barberId, setBarberId] = useState<string>('')
  const [stats, setStats] = useState({
    totalAppointments: 0,
    bookedByYou: 0, // new stat
    servicesCount: 0
  })
  const [specialtiesOpen, setSpecialtiesOpen] = useState(false)
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(user?.specialties || [])
  const [avatarUrl, setAvatarUrl] = useState((user as any)?.avatar_url || "")
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      fetchBarberId()
      fetchStats()
    }
  }, [user])

  const fetchBarberId = async () => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      if (data) {
        setBarberId(data.id)
      }
    } catch (error) {
      logger.error('Error fetching barber ID', error)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch appointments count (as barber)
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('barber_id', barberId)

      // Fetch services count
      const { count: servicesCount } = await supabase
        .from('services')
        .select('*', { count: 'exact' })
        .eq('barber_id', barberId)

      // Fetch bookings made by this barber as a client
      const { count: bookedByYou } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('client_id', user?.id)

      setStats({
        totalAppointments: appointmentsCount || 0,
        bookedByYou: bookedByYou || 0,
        servicesCount: servicesCount || 0
      })
    } catch (error) {
      logger.error('Error fetching stats', error)
    }
  }

  // Timeout helper
  async function withTimeout(promise: Promise<any>, ms = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ])
  }

  if (!user) {
    push('/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      await withTimeout((async () => {
        const formData = new FormData(e.currentTarget)
        const barberData = {
          bio: formData.get('bio') as string,
          specialties: selectedSpecialties,
          location: formData.get('location') as string,
        }
        // Update barber profile
        await updateBarber(user.id, barberData)
        // Update phone in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone: formData.get('phone') as string,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
        if (profileError) throw profileError
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully",
        })
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Profile update took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error updating profile', error)
        toast({
          title: "Error",
          description: "Failed to update profile",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return
      const file = e.target.files[0]
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file type', description: 'Please select an image file.', variant: 'destructive' })
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' })
        return
      }
      setAvatarLoading(true)
      await withTimeout((async () => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage.from('avatars').upload(fileName, file)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id)
        // Optionally update the user object in zustand if needed
        if (updateError) throw updateError
        setAvatarUrl(publicUrl)
        toast({ title: 'Success', description: 'Avatar updated successfully!' })
      })(), 10000)
    } catch (error: any) {
      if (error.message === 'timeout') {
        toast({ title: 'Timeout', description: 'Avatar upload took too long. Please try again.', variant: 'destructive' })
      } else {
        logger.error('Error uploading avatar', error)
        toast({ title: 'Error', description: 'Failed to upload avatar. Please try again.', variant: 'destructive' })
      }
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Indeterminate Progress Bar for Avatar Upload */}
      {avatarLoading && (
        <div className="w-full mb-4">
          <Progress value={100} className="h-2 animate-pulse bg-white/10" />
          <div className="text-xs text-white/60 text-center mt-1">Uploading avatar...</div>
        </div>
      )}
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl lg:text-6xl font-bebas font-bold text-white mb-4">
          Your <span className="text-saffron">Barber Profile</span>
        </h1>
        <p className="text-xl text-white/80 max-w-2xl mx-auto">
          Showcase your skills, manage your services, and grow your business.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="space-y-6">
              <Card className="bg-darkpurple/90 backdrop-blur-sm border border-white/10 shadow-2xl">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-4 border-saffron/20">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name || 'Avatar'} />}
                        <AvatarFallback className="bg-saffron text-primary font-bold text-xl">{user.name?.charAt(0) || "B"}</AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="absolute right-[-18px] bottom-[-8px] bg-yellow-400 border-4 border-red-500 rounded-full p-3 shadow-xl focus:outline-none focus:ring-2 focus:ring-saffron z-50 transition-transform hover:scale-110"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Upload profile picture"
                        disabled={avatarLoading}
                        style={{ width: 48, height: 48 }}
                      >
                        {avatarLoading ? (
                          <span className="w-6 h-6 animate-spin border-2 border-white border-t-transparent rounded-full block" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={avatarLoading}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-white">{user.name}</CardTitle>
                      <p className="text-white/60">{user.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-white font-semibold">Bio</Label>
                      <Textarea
                        id="bio"
                        name="bio"
                        placeholder="Tell us about yourself..."
                        defaultValue={user.bio || ''}
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/50"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="specialties" className="text-white font-semibold flex items-center gap-2">
                        <Scissors className="h-4 w-4 text-white" />
                        Specialties
                      </Label>
                      <Popover open={specialtiesOpen} onOpenChange={setSpecialtiesOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={specialtiesOpen}
                            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/50 transition-all duration-30 rounded-xl h-12"
                          >
                            <div className="flex items-center gap-2">
                              {selectedSpecialties.length > 0 ? (
                                <>
                                  <div className="w-2 h-2 white rounded-full"></div>
                                  <span className="font-medium">
                                    {selectedSpecialties.length} specialty{selectedSpecialties.length !== 1 ? 'ies' : ''} selected
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Scissors className="h-4 w-4 text-white/60" />
                                  <span className="text-white/60">Search and select specialties...</span>
                                </>
                              )}
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0rkpurple/95 border border-white/10op-blur-xl rounded-xl shadow-2l" align="start">
                          <Command className="bg-transparent">
                            <div className="flex items-center border-b border-white/10 px-3 py-2">
                              <Search className="h-4 w-4 text-white/60 mr-2" />
                              <CommandInput 
                                placeholder="Search specialties..." 
                                className="text-white placeholder:text-white/60 border-none bg-transparent focus:ring-0 focus:border-white/50"
                              />
                            </div>
                            <CommandList className="max-h-64overflow-y-auto">
                              <CommandEmpty className="text-white/60y-4 text-center">
                                No specialty found.
                              </CommandEmpty>
                              <CommandGroup className="p-2">
                                {BARBER_SPECIALTIES.map((specialty) => (
                                  <CommandItem
                                    key={specialty}
                                    value={specialty}
                                    onSelect={() => {
                                      setSelectedSpecialties(prev => 
                                        prev.includes(specialty)
                                          ? prev.filter(s => s !== specialty)
                                          : [...prev, specialty]
                                      )
                                    }}
                                    className="text-white hover:bg-white/10 rounded-lg transition-all duration-200cursor-pointer group"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                                          selectedSpecialties.includes(specialty) 
                                            ? "bg-white/20 border border-white/30" 
                                            : "bg-white/10 border border-white/20 group-hover:bg-white/20"
                                        )}>
                                          <Scissors className={cn(
                                  "h-4 w-4 transition-all duration-200",
                                            selectedSpecialties.includes(specialty) ? "text-white": "text-white/60"
                                          )} />
                                        </div>
                                        <span className="font-medium">{specialty}</span>
                                      </div>
                                      <Check
                                        className={cn(
                                "h-4 w-4 transition-all duration-200",
                                          selectedSpecialties.includes(specialty) 
                                            ? "opacity-100" 
                                            : "opacity-0"
                                        )}
                                      />
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-white/60 flex items-center gap-2">
                        <Info className="h-3 w-3" />
                        Select the services you specialize in to help clients find you
                      </p>
                      {selectedSpecialties.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {selectedSpecialties.map((specialty) => (
                            <Badge 
                              key={specialty} 
                              className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30 transition-all duration-200 cursor-pointer group"
                              onClick={() => setSelectedSpecialties(prev => prev.filter(s => s !== specialty))}
                            >
                              <Scissors className="h-3 mr-1 group-hover:scale-110 transition-transform text-white" />
                              {specialty}
                              <X className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-white font-semibold">Location</Label>
                      <Input
                        id="location"
                        name="location"
                        placeholder="Your location"
                        defaultValue={user.location || ''}
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-white font-semibold">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="Your phone number"
                        defaultValue={user.phone || ''}
                        className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/50"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={loading || dataLoading}
                      className="w-full bg-white text-black font-bold hover:bg-white/90"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
        </div>

        <div>
          <Card className="bg-darkpurple/90 backdrop-blur-sm border border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Total Appointments</p>
                      <p className="text-2xl font-bold text-white">{stats.totalAppointments}</p>
                    </div>
                  </div>
                </div>
                {/* Booked by You stat replaces Average Rating */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Booked by You</p>
                      <p className="text-2xl font-bold text-white">{stats.bookedByYou}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Scissors className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Services Offered</p>
                      <p className="text-2xl font-bold text-white">{stats.servicesCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}