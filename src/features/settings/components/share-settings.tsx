'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { useToast } from '@/shared/components/ui/use-toast'
import { Copy, Share2, Link, QrCode, ExternalLink, CheckCircle, AlertCircle, Loader2, Download, Sparkles, Globe } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Label } from '@/shared/components/ui/label'
import QRCode from 'react-qr-code'
import { Badge } from '@/shared/components/ui/badge'
import { logger } from '@/shared/lib/logger'

interface ProfileData {
  name?: string
  business_name?: string
  is_public?: boolean
  username?: string
}

export function ShareSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData>({})
  const [barberId, setBarberId] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    if (user) {
      loadProfileData()
    }
  }, [user])

  const loadProfileData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch profile data including username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, is_public, username')
        .eq('id', user?.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        logger.error('Error fetching profile', profileError)
      }

      // Fetch barber data if user is a barber
      let barberData = {}
      if (user?.role === 'barber') {
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('id, business_name')
          .eq('user_id', user.id)
          .single()

        if (barberError && barberError.code !== 'PGRST116') {
          logger.error('Error fetching barber data', barberError)
        }

        if (barber) {
          barberData = { business_name: barber.business_name }
          setBarberId(barber.id)
        }
      }

      setProfileData({ ...profile, ...barberData })
    } catch (error) {
      logger.error('Error loading profile data', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Use username for the booking link if available, otherwise use barber ID as fallback
  // Use production domain to ensure the link is publicly accessible
  const getBookingLink = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bocmstyle.com'
    
    // Use username if available, as it's more user-friendly
    if (profileData.username) {
      return `${baseUrl}/book/${profileData.username}`
    }
    
    // Fallback to barber ID if no username is available
    if (barberId) {
      return `${baseUrl}/book/${barberId}`
    }
    
    // If neither is available, return a placeholder
    return `${baseUrl}/book/placeholder`
  }

  const bookingLink = getBookingLink()

  // Validate that the booking link will work
  const isLinkValid = barberId || user?.id

  const copyToClipboard = async () => {
    if (!isLinkValid) {
      toast({
        title: "Cannot copy link",
        description: "Please complete your barber profile first.",
        variant: "destructive",
      })
      return
    }

    try {
      await navigator.clipboard.writeText(bookingLink)
      setCopied(true)
      toast({
        title: "Link copied!",
        description: "Your booking link has been copied to clipboard.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try copying the link manually.",
        variant: "destructive",
      })
    }
  }

  const shareLink = async () => {
    if (!isLinkValid) {
      toast({
        title: "Cannot share link",
        description: "Please complete your barber profile first.",
        variant: "destructive",
      })
      return
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book an appointment with ${profileData.business_name || profileData.name || 'me'}`,
          text: `Book your next haircut with ${profileData.business_name || profileData.name || 'me'}`,
          url: bookingLink,
        })
      } catch (err) {
        // User cancelled sharing
        if (err instanceof Error && err.name !== 'AbortError') {
          toast({
            title: "Failed to share",
            description: "Please try sharing the link manually.",
            variant: "destructive",
          })
        }
      }
    } else {
      copyToClipboard()
    }
  }

  const openBookingLink = () => {
    if (!isLinkValid) {
      toast({
        title: "Cannot open link",
        description: "Please complete your barber profile first.",
        variant: "destructive",
      })
      return
    }
    window.open(bookingLink, '_blank')
  }

  if (isLoading) {
    return (
      <Card className="mb-6 bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center space-y-4">
              <div className="relative">
                <Share2 className="h-8 w-8 animate-spin mx-auto text-secondary" />
                <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
              </div>
              <p className="text-white/60 font-medium">Loading booking link...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6 bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
      <CardHeader className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-secondary/20 rounded-full">
            <Share2 className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <CardTitle className="text-xl font-bebas text-white tracking-wide">
              Share Your Booking Link
            </CardTitle>
            <CardDescription className="text-white/80 mt-1">
              Share your professional booking link with clients
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Profile Status */}
        {!profileData.is_public && (
          <Alert className="border-yellow-500/20 bg-yellow-500/10 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-800">
              Your profile is currently private. 
              <button 
                onClick={() => window.location.href = '/settings'}
                className="text-yellow-700 hover:text-yellow-600 underline ml-1 font-medium"
              >
                Make it public
              </button>
              to allow clients to book appointments.
            </AlertDescription>
          </Alert>
        )}

        {/* Booking Link Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-white">Your Booking Link</Label>
            <Badge variant="secondary" className="text-xs bg-secondary/20 text-secondary border-secondary/30">
              {isLinkValid ? 'Active' : 'Incomplete Profile'}
            </Badge>
          </div>
          
          <div className="relative flex items-center">
            <Input
              value={bookingLink}
              readOnly
              className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-secondary pr-28 flex-1"
              placeholder="Complete your profile to get your booking link"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                disabled={!isLinkValid}
                className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={openBookingLink}
                disabled={!isLinkValid}
                className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={shareLink}
            disabled={!isLinkValid}
            className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold shadow-lg"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
          
          <Button
            onClick={() => setShowQR(!showQR)}
            disabled={!isLinkValid}
            variant="outline"
            className="border-secondary/30 text-secondary hover:bg-secondary/10"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
        </div>

        {/* QR Code Modal */}
        {showQR && isLinkValid && (
          <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <QrCode className="h-5 w-5 text-secondary" />
                <h3 className="text-lg font-semibold text-white">QR Code</h3>
              </div>
              <div className="flex justify-center">
                <div className="p-6 bg-white rounded-3xl shadow-lg">
                  <QRCode
                    value={bookingLink}
                    size={200}
                    level="H"
                    fgColor="#262b2e"
                    bgColor="#ffffff"
                    id="booking-qr-code"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white/60">
                  Clients can scan this QR code to access your booking page
                </p>
                <p className="text-xs text-white/40">
                  {profileData.business_name || profileData.name || 'Your'} Booking Link
                </p>
              </div>
              <Button
                onClick={() => {
                  try {
                    // Create a canvas element to download the QR code
                    const canvas = document.createElement('canvas')
                    const qrCode = document.querySelector('#booking-qr-code')
                    if (qrCode) {
                      const svgData = new XMLSerializer().serializeToString(qrCode)
                      const img = new Image()
                      img.onload = () => {
                        canvas.width = img.width
                        canvas.height = img.height
                        const ctx = canvas.getContext('2d')
                        ctx?.drawImage(img, 0, 0)
                        const link = document.createElement('a')
                        link.download = `booking-qr-${profileData.username || barberId || 'code'}.png`
                        link.href = canvas.toDataURL()
                        link.click()
                      }
                      img.onerror = () => {
                        toast({
                          title: "Download failed",
                          description: "Failed to generate QR code image. Please try again.",
                          variant: "destructive",
                        })
                      }
                      img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
                    } else {
                      toast({
                        title: "QR Code not found",
                        description: "Please try refreshing the page and generating the QR code again.",
                        variant: "destructive",
                      })
                    }
                  } catch (error) {
                    logger.error('Error downloading QR code', error)
                    toast({
                      title: "Download failed",
                      description: "An error occurred while downloading the QR code.",
                      variant: "destructive",
                    })
                  }
                }}
                variant="outline"
                size="sm"
                className="border-secondary/30 text-secondary hover:bg-secondary/10 rounded-2xl"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            </div>
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-3xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-secondary/20 rounded-full">
              <Sparkles className="h-4 w-4 text-secondary" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Pro Tips</h4>
              <ul className="text-xs text-white/70 space-y-1">
                <li>• Add this link to your social media profiles</li>
                <li>• Include it in your business cards and marketing materials</li>
                <li>• Share it directly with clients via text or email</li>
                <li>• Use the QR code for in-person sharing</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 