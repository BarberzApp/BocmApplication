'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { BookingForm } from '@/shared/components/booking/booking-form'
import { Service } from '@/shared/types/service'
import { useToast } from '@/shared/components/ui/use-toast'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import Link from 'next/link'
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Share2, 
  Star, 
  MapPin, 
  Phone, 
  Clock, 
  Calendar,
  ArrowLeft,
  Sparkles,
  Video,
  Eye,
  Grid3X3,
  BookOpen,
  Settings,
  MoreHorizontal,
  Instagram,
  Twitter,
  Facebook,
  Mail,
  Users,
  Award,
  CheckCircle
} from 'lucide-react'

type Barber = {
  id: string
  userId: string
  name: string
  username?: string
  location?: string
  phone?: string
  bio?: string
  avatar_url?: string
  coverphoto?: string
  specialties: string[]
  services: Service[]
  portfolio: string[]
  instagram?: string
  twitter?: string
  facebook?: string
  email?: string
  review_count?: number
  average_rating?: number
}

type Review = {
  id: string
  rating: number
  comment?: string
  created_at: string
  client: {
    name: string
    avatar_url?: string
  }
}

type FeaturedReel = {
  id: string
  title: string
  description?: string
  url: string
  thumbnail?: string
  views: number
  likes: number
  comments_count: number
  created_at: string
  tags: string[]
  is_featured: boolean
}

type BarberFromDB = {
  id: string
  user_id: string
  bio: string | null
  specialties: string[]
  profiles: Array<{
    name: string
    username?: string
    location: string | null
    phone: string | null
    avatar_url?: string
    coverphoto?: string
    instagram?: string
    twitter?: string
    facebook?: string
    email?: string
  }>
  services: Array<{
    id: string
    name: string
    description: string | null
    duration: number
    price: number
    barber_id: string
  }>
  portfolio: string[]
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary', error, { errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-white">Something went wrong</h1>
              <p className="text-gray-400 mb-6">An unexpected error occurred. Please try again.</p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full rounded-full bg-secondary text-primary px-6 py-3"
              >
                Reload Page
              </Button>
              <Button asChild variant="outline" className="w-full rounded-full">
                <Link href="/browse">Browse Barbers</Link>
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function BookPageContent() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [barber, setBarber] = useState<Barber | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileFallback, setShowMobileFallback] = useState(false)
  const [featuredReels, setFeaturedReels] = useState<FeaturedReel[]>([])
  const [showVideoDialog, setShowVideoDialog] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<FeaturedReel | null>(null)
  const [loadingReels, setLoadingReels] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('cuts')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)

  // Share functionality
  const handleShare = async () => {
    if (!barber) return

    const shareUrl = `${window.location.origin}/book/${barber.username || barber.id}`
    const shareText = `Book your next haircut with ${barber.name} on BOCM Style!`

    try {
      if (navigator.share) {
        // Use native sharing on mobile devices
        await navigator.share({
          title: `Book with ${barber.name}`,
          text: shareText,
          url: shareUrl,
        })
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: 'Link copied!',
          description: 'Booking link copied to clipboard.',
        })
      }
    } catch (error) {
      logger.error('Error sharing', error)
      // Fallback to clipboard copy if native sharing fails
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: 'Link copied!',
          description: 'Booking link copied to clipboard.',
        })
      } catch (clipboardError) {
        toast({
          title: 'Error',
          description: 'Failed to share or copy link.',
          variant: 'destructive',
        })
      }
    }
  }

  // Safely extract identifier from params (could be username or barber ID)
  const identifier = params && params.username ? (Array.isArray(params.username) ? params.username[0] : params.username) : undefined;

  // Add guard for params in BookPageContent
  if (!identifier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-white">Invalid Profile Link</h1>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">This profile link appears to be invalid or has expired.</p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full rounded-full bg-secondary text-primary px-6 py-3 text-sm sm:text-base">
              <Link href="/browse">Browse Available Barbers</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            If you believe this is an error, please contact the barber directly.
          </p>
        </div>
      </div>
    )
  }

  // Detect mobile device - Universal detection
  useEffect(() => {
    const checkMobile = () => {
      // Universal mobile detection
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
        window.matchMedia('(max-width: 768px)').matches;
      
      setIsMobile(isMobileDevice);
    }
    
    checkMobile();
  }, [])

  // Check if we're in a mobile browser and handle PWA/service worker interference
  useEffect(() => {
    const checkMobileAndPWA = () => {
      // Check for PWA/service worker interference
      if (isMobile && typeof window !== 'undefined') {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone === true;
        
        if (isPWA) {
          // PWA detected, set a timeout for fallback
          setTimeout(() => {
            if (loading) {
              setShowMobileFallback(true);
            }
          }, 10000); // 10 second timeout
        }
      }
    }
    
    if (isMobile) {
      checkMobileAndPWA();
    }
  }, [isMobile, loading])

  useEffect(() => {
    if (identifier) {
      fetchBarberDetails()
    }
  }, [identifier])

  const fetchBarberDetails = async () => {
    if (!identifier) {
      setLoading(false)
      setError('Invalid identifier')
      return
    }

    try {
      let profileData: any = null;
      let barberData: any = null;

      // First, try to find the profile by username
      const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', identifier)
        .eq('role', 'barber')
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        logger.error('Error fetching profile by username', profileError)
        // Continue to try other methods
      }

      if (profileResult) {
        // If we found a profile by username, this is a username
        profileData = profileResult;
        
        // Then, get the barber's details using the user_id
        const { data: barberResult, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', profileData.id)
          .single()

        if (barberError) {
          logger.error('Error fetching barber', barberError)
          throw barberError
        }

        if (!barberResult) {
          throw new Error('Barber not found')
        }

        barberData = barberResult;
      } else {
        // If no profile found by username, try to find a profile with this ID
        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', identifier)
          .eq('role', 'barber')
          .single()

        if (profileError) {
          logger.error('Error fetching profile by ID', profileError)
          throw new Error('Profile not found')
        }

        if (!profileResult) {
          throw new Error('Profile not found')
        }

        // If we found a profile, this is a user ID
        profileData = profileResult;
        
        // Then, get the barber's details using the user_id
        const { data: barberResult, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', profileData.id)
          .single()

        if (barberError) {
          logger.error('Error fetching barber', barberError)
          throw barberError
        }

        if (!barberResult) {
          throw new Error('Barber not found')
        }

        barberData = barberResult;
      }

      // Fetch services for this barber
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberData.id)

      if (servicesError) {
        logger.error('Error fetching services', servicesError)
      }

      // Construct the barber object
      const barberObject: Barber = {
        id: barberData.id,
        userId: profileData.id,
        name: profileData.name || 'Unknown Barber',
        username: profileData.username,
        location: profileData.location,
        phone: profileData.phone,
        bio: barberData.bio,
        avatar_url: profileData.avatar_url,
        coverphoto: profileData.coverphoto,
        specialties: barberData.specialties || [],
        services: servicesData || [],
        portfolio: barberData.portfolio || [],
        instagram: barberData.instagram,
        twitter: barberData.twitter,
        facebook: barberData.facebook,
        email: profileData.email,
        review_count: barberData.review_count || 0,
        average_rating: barberData.average_rating || 0
      }

      setBarber(barberObject)

      // Fetch featured reels
      await fetchFeaturedReels(barberData.id)

      // Fetch reviews
      await fetchReviews(barberData.id)

    } catch (error) {
      logger.error('Error fetching barber details', error)
      setError(error instanceof Error ? error.message : 'Failed to load barber details')
    } finally {
      setLoading(false)
    }
  }

  const fetchFeaturedReels = async (barberId: string) => {
    try {
      setLoadingReels(true)
      
      const { data, error } = await supabase
        .from('cuts')
        .select('*')
        .eq('barber_id', barberId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(9)

      if (error) {
        logger.error('Error fetching featured cuts', error)
        return
      }

      setFeaturedReels(data || [])
    } catch (error) {
      logger.error('Error fetching featured cuts', error)
    } finally {
      setLoadingReels(false)
    }
  }

  const fetchReviews = async (barberId: string) => {
    try {
      setLoadingReviews(true)
      
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          client:client_id(
            name,
            avatar_url
          )
        `)
        .eq('barber_id', barberId)
        .eq('is_public', true)
        .eq('is_moderated', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        logger.error('Error fetching reviews', error)
        return
      }

      // Transform the data to match the Review type
      const transformedReviews: Review[] = (data || []).map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        client: {
          name: review.client?.name || 'Anonymous',
          avatar_url: review.client?.avatar_url
        }
      }))

      setReviews(transformedReviews)
    } catch (error) {
      logger.error('Error fetching reviews', error)
    } finally {
      setLoadingReviews(false)
    }
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
    return views.toString()
  }

  const formatLocation = (location: string) => {
    if (!location) return '';
    const parts = location.split(',').map(s => s.trim());
    
    if (parts.length >= 4) {
      // For format: "88 Doe Court, Wynwood Drive, South Brunswick, NJ"
      const city = parts[parts.length - 2];
      const state = parts[parts.length - 1];
      return `${city}, ${state}`;
    } else if (parts.length >= 3) {
      // For format: "88 Doe Court, South Brunswick, NJ"
      const city = parts[1];
      const state = parts[2];
      return `${city}, ${state}`;
    } else if (parts.length >= 2) {
      // Fallback for shorter formats
      const city = parts[0];
      const state = parts[1];
      return `${city}, ${state}`;
    } else {
      return location;
    }
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-white">Something went wrong</h1>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">{error}</p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full rounded-full bg-secondary text-primary px-6 py-3 text-sm sm:text-base"
            >
              Try Again
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/browse">Browse Barbers</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-white text-sm sm:text-base">Loading profile...</p>
          {isMobile && (
            <p className="text-sm text-gray-400 mt-2">If this takes too long, try refreshing the page</p>
          )}
        </div>
      </div>
    )
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-white">Profile Not Found</h1>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">The barber you're looking for doesn't exist or has been removed from the platform.</p>
          </div>
          
          <div className="space-y-3">
            <Button asChild className="w-full rounded-full bg-secondary text-primary px-6 py-3 text-sm sm:text-base">
              <Link href="/browse">Browse Available Barbers</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full text-sm sm:text-base">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            The barber may have deactivated their account or changed their profile link.
          </p>
        </div>
      </div>
    )
  }

  // Show mobile fallback if page doesn't load
  if (showMobileFallback) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Having trouble loading?</h1>
            <p className="text-gray-400">
              The profile page seems to be taking longer than expected. Try one of these options:
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full bg-secondary text-primary"
            >
              Try Again
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.open(window.location.href, '_blank')}
              className="w-full"
            >
              Open in New Tab
            </Button>
            
            <div className="text-sm text-gray-400">
              <p>If the problem persists, try:</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• Refreshing the page</li>
                <li>• Opening in a different browser</li>
                <li>• Checking your internet connection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background pb-[140px] md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-white">@{barber.username || barber.name?.toLowerCase().replace(/\s+/g, '')}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        {barber.coverphoto ? (
          <img
            src={barber.coverphoto}
            alt="Cover photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary/20 via-purple-500/20 to-secondary/20 relative">
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Profile Section */}
      <div className="relative px-4 pb-4">
        {/* Avatar positioned over cover photo */}
        <div className="relative -mt-16 mb-4">
          <Avatar className="h-32 w-32 mx-auto border-4 border-black shadow-xl">
            <AvatarImage src={barber.avatar_url} alt={barber.name} className="object-cover w-full h-full" />
            <AvatarFallback className="text-4xl bg-secondary text-primary font-bold w-full h-full flex items-center justify-center">
              {barber.name && barber.name.length > 0 ? barber.name.charAt(0) : '?'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Profile Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{barber.name}</h1>
          {barber.username && (
            <p className="text-secondary text-lg font-mono mb-2">@{barber.username}</p>
          )}
          {barber.location && (
            <div className="flex items-center justify-center gap-1 text-white/70 mb-3">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{formatLocation(barber.location)}</span>
            </div>
          )}
          
          {/* Rating Display */}
          {barber.average_rating && barber.average_rating > 0 ? (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(barber.average_rating!)
                        ? 'text-yellow-400 fill-current'
                        : 'text-white/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-white/90 text-base font-semibold">
                {barber.average_rating?.toFixed(1)}
              </span>
              <span className="text-white/60 text-sm">
                ({barber.review_count || 0} reviews)
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-white/30"
                  />
                ))}
              </div>
              <span className="text-white/60 text-sm">
                No reviews yet
              </span>
            </div>
          )}

          {/* Bio */}
          {barber.bio && (
            <p className="text-white/80 text-sm leading-relaxed mb-4 max-w-md mx-auto">
              {barber.bio}
            </p>
          )}

          {/* Specialties */}
          {barber.specialties && barber.specialties.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {barber.specialties.map((specialty, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-secondary/20 text-secondary border-secondary/30 px-3 py-1 text-xs"
                >
                  {specialty}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center mb-6">
            <Button
              onClick={() => setShowBookingForm(true)}
              className="flex-1 max-w-xs bg-secondary text-primary font-semibold rounded-full hover:bg-secondary/90"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book Now
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 rounded-full"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Social Links */}
          {(barber.instagram || barber.twitter || barber.facebook) && (
            <div className="flex justify-center gap-4 mb-6">
              {barber.instagram && (
                <a
                  href={`https://instagram.com/${barber.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {barber.twitter && (
                <a
                  href={`https://twitter.com/${barber.twitter.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {barber.facebook && (
                <a
                  href={`https://facebook.com/${barber.facebook.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none p-0">
            <TabsTrigger 
              value="cuts" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-white/60 hover:text-white"
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Cuts
            </TabsTrigger>
            <TabsTrigger 
              value="services" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-white/60 hover:text-white"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-white/60 hover:text-white"
            >
              <Award className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger 
              value="reviews" 
              className="flex-1 data-[state=active]:text-secondary data-[state=active]:border-b-2 data-[state=active]:border-secondary bg-transparent text-white/60 hover:text-white"
            >
              <Star className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
          </TabsList>

          {/* Cuts Tab */}
          <TabsContent value="cuts" className="mt-6">
            {loadingReels ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
              </div>
            ) : featuredReels.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {featuredReels.map((reel) => (
                  <div
                    key={reel.id}
                    className="group relative aspect-square bg-white/5 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/cuts?cutId=${reel.id}`
                    }}
                  >
                    <video
                      src={reel.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()}
                    />
                    
                    {/* Stats Overlay */}
                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-white text-xs bg-black/50 backdrop-blur-sm rounded px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{formatViews(reel.views)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{formatViews(reel.likes)}</span>
                      </div>
                    </div>
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Video className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/60">No cuts available yet</p>
              </div>
            )}
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            {barber.services && barber.services.length > 0 ? (
              <div className="space-y-3">
                {barber.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-start p-4 bg-white/5 rounded-2xl border border-white/10"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white text-base mb-1">{service.name}</h4>
                      {service.description && (
                        <p className="text-white/60 text-sm mb-2">{service.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration} minutes</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-secondary text-xl">${service.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/60">No services available</p>
              </div>
            )}
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="mt-6">
            {barber.portfolio && barber.portfolio.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {barber.portfolio.map((item, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square bg-white/5 cursor-pointer"
                    onClick={() => setSelectedImage(item)}
                  >
                    <img
                      src={item}
                      alt={`Portfolio item ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/60">No portfolio items available</p>
              </div>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="mt-6">
            {loadingReviews ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-white/5 rounded-2xl border border-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={review.client.avatar_url} alt={review.client.name} />
                        <AvatarFallback className="bg-secondary/20 text-secondary text-sm">
                          {review.client.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-white text-sm">{review.client.name}</h4>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-white/30'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-white/80 text-sm leading-relaxed">{review.comment}</p>
                        )}
                        <p className="text-white/50 text-xs mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/60">No reviews yet</p>
                <p className="text-white/40 text-sm mt-2">Be the first to leave a review!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom spacing */}
      <div className="h-20"></div>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-2xl w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-0 overflow-hidden">
          {selectedVideo ? (
            <>
              <div className="aspect-video">
                <video
                  src={selectedVideo.url}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                />
              </div>
              <div className="p-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-white">{selectedVideo.title}</DialogTitle>
                  <DialogDescription className="text-white/80">
                    {selectedVideo.description}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-4 mt-4 text-white/60 text-sm">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{formatViews(selectedVideo.views)} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    <span>{formatViews(selectedVideo.likes)} likes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    <span>{formatViews(selectedVideo.comments_count || 0)} comments</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      {selectedImage !== null && (
        <Dialog open={!!selectedImage} onOpenChange={open => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-2xl w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-0 flex flex-col items-center justify-center">
            <div className="w-full flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-secondary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25v-.75zm0 0l5.25-5.25a2.25 2.25 0 013.18 0l5.32 5.32M3 16.5l5.25-5.25a2.25 2.25 0 013.18 0l5.32 5.32" />
                  </svg>
                </span>
                <span className="text-white text-lg font-bold">Portfolio Image</span>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                aria-label="Close"
                className="text-white hover:text-secondary focus:outline-none focus:ring-2 focus:ring-secondary rounded-full p-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="w-full flex-1 flex items-center justify-center p-4">
              <img
                src={selectedImage || ''}
                alt="Portfolio item"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-lg"
                draggable={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showBookingForm && barber && (
        <ErrorBoundary>
          <BookingForm
            isOpen={showBookingForm}
            onClose={() => setShowBookingForm(false)}
            selectedDate={selectedDate || new Date()}
            barberId={barber!.id}
            onBookingCreated={(booking) => {
              setShowBookingForm(false)
              toast({
                title: 'Booking Created!',
                description: 'Your appointment has been scheduled successfully.',
              })
            }}
          />
        </ErrorBoundary>
      )}
    </div>
  )
}

export default function BookPage() {
  return (
    <ErrorBoundary>
      <BookPageContent />
    </ErrorBoundary>
  )
} 