'use client'

import { useState } from 'react'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import {
  Search,
  User,
  Image as ImageIcon,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  avatar_url?: string
  coverphoto?: string
  join_date?: string
  barber?: {
    id: string
    portfolio?: string[]
    cuts?: Array<{
      id: string
      url: string
      thumbnail?: string
      title: string
    }>
  }
}

export function UserProfileManager() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<{ type: string; url: string; id?: string } | null>(null)
  const { toast } = useToast()

  const searchUser = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Search Required',
        description: 'Please enter an email or user ID to search',
        variant: 'destructive',
      })
      return
    }

    setSearching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      // Search by email or ID
      const isEmail = searchTerm.includes('@')
      const searchQuery = isEmail 
        ? supabase.from('profiles').select('*').eq('email', searchTerm).single()
        : supabase.from('profiles').select('*').eq('id', searchTerm).single()

      const { data: profile, error: profileError } = await searchQuery

      if (profileError || !profile) {
        toast({
          title: 'User Not Found',
          description: 'No user found with that email or ID',
          variant: 'destructive',
        })
        setUserProfile(null)
        return
      }

      // Get barber data if user is a barber
      let barberData = null
      if (profile.role === 'barber') {
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('id, portfolio')
          .eq('user_id', profile.id)
          .single()

        if (!barberError && barber) {
          // Get cuts/reels for this barber
          const { data: cuts } = await supabase
            .from('cuts')
            .select('id, url, thumbnail, title')
            .eq('barber_id', barber.id)
            .order('created_at', { ascending: false })

          barberData = {
            id: barber.id,
            portfolio: barber.portfolio || [],
            cuts: cuts || [],
          }
        }
      }

      setUserProfile({
        id: profile.id,
        name: profile.name || 'Unknown',
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        avatar_url: profile.avatar_url,
        coverphoto: profile.coverphoto,
        join_date: profile.join_date,
        barber: barberData,
      })

      toast({
        title: 'User Found',
        description: `Found profile for ${profile.name || profile.email}`,
      })
    } catch (error) {
      logger.error('Error searching user', error)
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search user',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleDeletePhoto = (type: string, url: string, id?: string) => {
    setPhotoToDelete({ type, url, id })
    setDeleteConfirmOpen(true)
  }

  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !userProfile) return

    setDeletingPhoto(photoToDelete.url)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No session token available')
      }

      const response = await fetch('/api/super-admin/delete-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: userProfile.id,
          photoType: photoToDelete.type,
          photoUrl: photoToDelete.url,
          photoId: photoToDelete.id,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete photo')
      }

      // Update local state
      if (photoToDelete.type === 'avatar') {
        setUserProfile({ ...userProfile, avatar_url: null })
      } else if (photoToDelete.type === 'cover') {
        setUserProfile({ ...userProfile, coverphoto: null })
      } else if (photoToDelete.type === 'portfolio' && userProfile.barber) {
        setUserProfile({
          ...userProfile,
          barber: {
            ...userProfile.barber,
            portfolio: userProfile.barber.portfolio?.filter(p => p !== photoToDelete.url) || [],
          },
        })
      } else if (photoToDelete.type === 'cut' && userProfile.barber) {
        setUserProfile({
          ...userProfile,
          barber: {
            ...userProfile.barber,
            cuts: userProfile.barber.cuts?.filter(c => c.id !== photoToDelete.id) || [],
          },
        })
      }

      toast({
        title: 'Photo Deleted',
        description: 'Photo has been successfully deleted',
      })
    } catch (error) {
      logger.error('Error deleting photo', error)
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete photo',
        variant: 'destructive',
      })
    } finally {
      setDeletingPhoto(null)
      setDeleteConfirmOpen(false)
      setPhotoToDelete(null)
    }
  }

  const getPhotoTypeLabel = (type: string) => {
    switch (type) {
      case 'avatar':
        return 'Avatar'
      case 'cover':
        return 'Cover Photo'
      case 'portfolio':
        return 'Portfolio Image'
      case 'cut':
        return 'Cut/Reel'
      default:
        return 'Photo'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile & Photo Manager
          </CardTitle>
          <CardDescription className="text-white/80">
            Search for users by email or ID and manage their photos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                type="text"
                placeholder="Search by email or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <Button
              onClick={searchUser}
              disabled={searching}
              className="bg-secondary text-primary hover:bg-secondary/90"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* User Profile Display */}
          {userProfile && (
            <Card className="bg-white/5 border-white/10 mt-4">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-start gap-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={userProfile.avatar_url} />
                      <AvatarFallback className="bg-secondary text-primary text-xl">
                        {userProfile.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{userProfile.name}</h3>
                        <Badge className={userProfile.role === 'barber' ? 'bg-blue-500' : 'bg-gray-500'}>
                          {userProfile.role.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-white/80">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{userProfile.email}</span>
                        </div>
                        {userProfile.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{userProfile.phone}</span>
                          </div>
                        )}
                        {userProfile.join_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Joined: {new Date(userProfile.join_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Avatar */}
                  {userProfile.avatar_url && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Avatar
                      </h4>
                      <div className="relative inline-block">
                        <img
                          src={userProfile.avatar_url}
                          alt="Avatar"
                          className="w-24 h-24 object-cover rounded-lg border-2 border-white/20"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => handleDeletePhoto('avatar', userProfile.avatar_url!)}
                          disabled={deletingPhoto === userProfile.avatar_url}
                        >
                          {deletingPhoto === userProfile.avatar_url ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Cover Photo */}
                  {userProfile.coverphoto && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Cover Photo
                      </h4>
                      <div className="relative inline-block">
                        <img
                          src={userProfile.coverphoto}
                          alt="Cover"
                          className="w-48 h-32 object-cover rounded-lg border-2 border-white/20"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => handleDeletePhoto('cover', userProfile.coverphoto!)}
                          disabled={deletingPhoto === userProfile.coverphoto}
                        >
                          {deletingPhoto === userProfile.coverphoto ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Portfolio (Barbers only) */}
                  {userProfile.barber && userProfile.barber.portfolio && userProfile.barber.portfolio.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Portfolio Images ({userProfile.barber.portfolio.length})
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        {userProfile.barber.portfolio.map((url, index) => (
                          <div key={index} className="relative">
                            <img
                              src={url}
                              alt={`Portfolio ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border-2 border-white/20"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0"
                              onClick={() => handleDeletePhoto('portfolio', url)}
                              disabled={deletingPhoto === url}
                            >
                              {deletingPhoto === url ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuts/Reels (Barbers only) */}
                  {userProfile.barber && userProfile.barber.cuts && userProfile.barber.cuts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Cuts/Reels ({userProfile.barber.cuts.length})
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        {userProfile.barber.cuts.map((cut) => (
                          <div key={cut.id} className="relative">
                            <img
                              src={cut.thumbnail || cut.url}
                              alt={cut.title}
                              className="w-full h-32 object-cover rounded-lg border-2 border-white/20"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-xs text-white truncate">
                              {cut.title}
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0"
                              onClick={() => handleDeletePhoto('cut', cut.url, cut.id)}
                              disabled={deletingPhoto === cut.url}
                            >
                              {deletingPhoto === cut.url ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!userProfile.avatar_url && !userProfile.coverphoto && 
                   (!userProfile.barber || (userProfile.barber.portfolio?.length === 0 && userProfile.barber.cuts?.length === 0)) && (
                    <div className="text-center py-8 text-white/60">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No photos found for this user</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-darkpurple border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Photo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to delete this {photoToDelete ? getPhotoTypeLabel(photoToDelete.type) : 'photo'}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePhoto}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

