"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/router"
import { useAuth } from "@/shared/hooks/use-auth-zustand"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import { Calendar, MapPin, Scissors, Heart, Upload, Camera } from "lucide-react"
import { useToast } from "@/shared/components/ui/use-toast"
import Link from "next/link"
import type { User } from "@/features/auth/hooks/use-auth"
import { useData } from "@/shared/hooks/use-data"
import type { Booking, Barber, Service } from "@/shared/hooks/use-data"
import { supabase } from "@/shared/lib/supabase"
import { Textarea } from "@/shared/components/ui/textarea"
import { Progress } from "@/shared/components/ui/progress"
import { logger } from "@/shared/lib/logger"

interface ClientProfileProps {
  user: User
}

export function ClientProfile({ user }: ClientProfileProps) {
  const { toast } = useToast()
  const { bookings, loading, error } = useData()
  const userBookings = bookings.filter(b => b.clientId === user.id)
  const [avatarUrl, setAvatarUrl] = useState((user as any)?.avatar_url || "")
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
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
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id)
      if (updateError) throw updateError
      setAvatarUrl(publicUrl)
      toast({ title: 'Success', description: 'Avatar updated successfully!' })
    } catch (error) {
      logger.error('Error uploading avatar', error)
      toast({ title: 'Error', description: 'Failed to upload avatar. Please try again.', variant: 'destructive' })
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully",
    })
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
          Your <span className="text-saffron">Client Profile</span>
        </h1>
        <p className="text-xl text-white/80 max-w-2xl mx-auto">
          Manage your bookings, update your info, and track your activity.
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
                      <AvatarFallback className="bg-saffron text-primary font-bold text-xl">{user.name?.charAt(0) || "U"}</AvatarFallback>
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
                      className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-white font-semibold">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="Your location"
                      defaultValue={user.location || ''}
                      className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron"
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
                      className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-saffron"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={avatarLoading}
                    className="w-full bg-saffron text-primary font-semibold hover:bg-saffron/90"
                  >
                    Save Changes
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
                    <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Total Bookings</p>
                      <p className="text-2xl font-bold text-white">{userBookings.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
                      <Heart className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Favorite Barbers</p>
                      <p className="text-2xl font-bold text-white">{[...new Set(userBookings.map(b => b.barber.id))].length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-saffron/20 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Member Since</p>
                      <p className="text-2xl font-bold text-white">{user.joinDate || 'Recently'}</p>
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
