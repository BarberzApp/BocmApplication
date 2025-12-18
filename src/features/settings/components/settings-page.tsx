'use client'

import { useState, useEffect } from 'react'
import { ProfileSettings } from './profile-settings'
import { ServicesSettings } from './services-settings'
import { AddonsSettings } from './addons-settings'
import { ShareSettings } from './share-settings'
import { EnhancedBarberProfileSettings } from './enhanced-barber-profile-settings'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { User, Scissors, Share2, Calendar, DollarSign, Lock, Settings as SettingsIcon, AlertCircle, Sparkles, Package, RefreshCw } from 'lucide-react'
import { AvailabilityManager } from '@/shared/components/booking/availability-manager'
import { EarningsDashboard } from '@/shared/components/payment/earnings-dashboard'
import { PaymentHistory } from '@/shared/components/payment/payment-history'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Progress } from '@/shared/components/ui/progress'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { useRouter } from 'next/navigation'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { logger } from '@/shared/lib/logger'


type Tab = 'profile' | 'services' | 'addons' | 'availability' | 'earnings'

interface SettingsData {
  profileComplete: boolean
  servicesComplete: boolean
  availabilityComplete: boolean
  stripeConnected: boolean
  notificationsConfigured: boolean
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [isLoading, setIsLoading] = useState(true)
  const [settingsData, setSettingsData] = useState<SettingsData>({
    profileComplete: false,
    servicesComplete: false,
    availabilityComplete: false,
    stripeConnected: false,
    notificationsConfigured: false
  })
  const [barberId, setBarberId] = useState<string>('')
  const [showVerifyBanner, setShowVerifyBanner] = useState(true)
  const [latestUser, setLatestUser] = useState<any>(null)
  const { user, status, logout } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const { push: safePush } = useSafeNavigation();

  // Fetch latest user on mount and after resend
  const fetchLatestUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) setLatestUser(data.user)
  }

  useEffect(() => {
    fetchLatestUser()
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to access settings.',
        variant: 'destructive',
      })
      safePush('/login')
      return
    }

    if (user) {
      loadSettingsData()
    }
  }, [user, status])

  const loadSettingsData = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, phone, location, bio, is_public, email_notifications, sms_notifications')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        logger.error('Error fetching profile', profileError)
      }

      logger.debug('Profile data loaded', { userId: profile?.id })

      // Check if user is a barber
      if (user.role === 'barber') {
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('id, business_name, bio, specialties, stripe_account_status')
          .eq('user_id', user.id)
          .single()

        if (barberError && barberError.code !== 'PGRST116') {
          logger.error('Error fetching barber data', barberError)
        }

        logger.debug('Barber data loaded', { barberId: barber?.id })

        if (barber) {
          setBarberId(barber.id)
          logger.debug('Settings: Barber ID set', { barberId: barber.id })
          
          // Check services
          const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('id')
            .eq('barber_id', barber.id)

          if (servicesError) {
            logger.error('Error fetching services', servicesError)
          }

          logger.debug('Services data loaded', { count: services?.length })

          // Check availability
          const { data: availability, error: availabilityError } = await supabase
            .from('availability')
            .select('id')
            .eq('barber_id', barber.id)

          if (availabilityError && availabilityError.code !== 'PGRST116') {
            logger.error('Error fetching availability', availabilityError)
          }

          logger.debug('Availability data loaded', { hasData: !!availability })

          // More realistic completion logic
          const profileComplete = !!(profile?.name && profile?.email)
          const servicesComplete = !!(services && services.length > 0)
          const availabilityComplete = !!(availability && availability.length > 0)
          const stripeConnected = barber?.stripe_account_status === 'active'
          const notificationsConfigured = true // Default to true since these are optional

          logger.debug('Completion status', {
            profileComplete,
            servicesComplete,
            availabilityComplete,
            stripeConnected,
            notificationsConfigured
          })

          setSettingsData({
            profileComplete,
            servicesComplete,
            availabilityComplete,
            stripeConnected,
            notificationsConfigured
          })
        } else {
          // Barber row doesn't exist yet
          setSettingsData({
            profileComplete: !!(profile?.name && profile?.email),
            servicesComplete: false,
            availabilityComplete: false,
            stripeConnected: false,
            notificationsConfigured: true
          })
        }
      } else {
        // For non-barbers - simpler requirements
        const profileComplete = !!(profile?.name && profile?.email)
        const notificationsConfigured = true // Default to true for non-barbers

        logger.debug('Non-barber completion status', {
          profileComplete,
          notificationsConfigured
        })

        setSettingsData({
          profileComplete,
          servicesComplete: false,
          availabilityComplete: false,
          stripeConnected: false,
          notificationsConfigured
        })
      }
    } catch (error) {
      logger.error('Error loading settings data', error)
      toast({
        title: 'Error',
        description: 'Failed to load settings data. Please refresh the page.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getCompletionPercentage = () => {
    const totalSections = user?.role === 'barber' ? 5 : 3
    const completedSections = Object.values(settingsData).filter(Boolean).length
    return Math.round((completedSections / totalSections) * 100)
  }

  const getTabStatus = (tab: Tab) => {
    switch (tab) {
      case 'profile':
        return settingsData.profileComplete ? 'complete' : 'incomplete'
      case 'services':
        return settingsData.servicesComplete ? 'complete' : 'incomplete'
      case 'availability':
        return settingsData.availabilityComplete ? 'complete' : 'incomplete'
      case 'earnings':
        return settingsData.stripeConnected ? 'complete' : 'incomplete'

      default:
        return 'neutral'
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as Tab)
  }

  // Helper to check if email is verified (Supabase v2+ uses user_metadata.email_verified, v1 uses confirmed_at)
  const isEmailVerified = !!(latestUser && (latestUser.user_metadata?.email_verified || latestUser.confirmed_at))

  const handleResendVerification = async () => {
    if (!user || !user.email) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
      if (error) throw error
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox (and spam folder).',
      })
      // Refetch latest user after resend
      fetchLatestUser()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to resend verification email.',
        variant: 'destructive',
      })
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-8">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="text-center space-y-4 relative z-10">
          <div className="relative">
            <SettingsIcon className="h-12 w-12 animate-spin mx-auto text-secondary" />
            <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
          </div>
          <p className="text-white/60 font-medium">Loading your settings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-8">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        </div>
        
        <Card className="max-w-md bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl relative z-10">
          <CardContent className="p-6">
            <Alert className="border-secondary/20 bg-secondary/10">
              <AlertCircle className="h-4 w-4 text-secondary" />
              <AlertDescription className="text-white">
                Please log in to access your settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8 relative z-10">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center py-8">
            <div className="p-5 bg-secondary/20 rounded-full shadow-lg mb-4 flex items-center justify-center">
              <SettingsIcon className="h-10 w-10 text-secondary" />
            </div>
            <h1 className="text-4xl font-bebas font-bold text-white mb-2">Settings</h1>
            <p className="text-white/70 text-base max-w-xs font-pacifico">
              Manage your profile, services, and preferences
            </p>
          </div>

          {/* Show prominent booking link banner for barbers */}
          {user?.role === 'barber' && <ShareSettings />}
          
          {/* Email Verification Banner */}
          {latestUser && !isEmailVerified && showVerifyBanner && (
            <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 shadow-lg backdrop-blur-xl rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-full">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Please verify your email address
                    </p>
                    <p className="text-xs text-yellow-700">
                      Check your inbox for a verification link
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleResendVerification} className="border-yellow-500/30 text-yellow-700 hover:bg-yellow-500/10">
                    Resend
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowVerifyBanner(false)} className="text-yellow-600 hover:bg-yellow-500/10">
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Section - Only show if there are incomplete sections */}
          {getCompletionPercentage() < 100 && (
            <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-secondary" />
                      <span className="text-sm font-medium text-white">Profile Completion</span>
                    </div>
                    <Badge variant="secondary" className="bg-secondary/20 text-secondary border-secondary/30">
                      {getCompletionPercentage()}% Complete
                    </Badge>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={getCompletionPercentage()} 
                      className="h-3 bg-white/10 border border-white/20" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-secondary/40 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                  </div>
                  <p className="text-sm text-white/60 text-center">
                    Complete all sections to optimize your profile for clients
                  </p>
                  {user?.role === 'barber' && (
                    <div className="flex justify-center">
                      <Button 
                        onClick={() => safePush('/barber/onboarding')}
                        className="bg-secondary hover:bg-secondary/90 text-primary font-semibold rounded-xl px-6 py-3"
                        size="sm"
                      >
                        Complete Onboarding
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Settings Card */}
          <Card className="bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              {/* Modern Tab Navigation */}
              <div className="p-6 border-b border-white/10">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl p-2">
                  <TabsList className="flex w-full gap-2 bg-transparent">
                    <TabsTrigger 
                      value="profile" 
                      className={`relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium snap-start ${
                        activeTab === 'profile' 
                          ? 'bg-secondary text-primary shadow-lg' 
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    
                    {user?.role === 'barber' && (
                      <>
                        <TabsTrigger 
                          value="services" 
                          className={`relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium snap-start ${
                            activeTab === 'services' 
                              ? 'bg-secondary text-primary shadow-lg' 
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Scissors className="h-4 w-4" />
                          <span className="hidden sm:inline">Services</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                          value="earnings" 
                          className={`relative flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-4 rounded-xl transition-all duration-200 text-sm sm:text-base font-semibold snap-start ${
                            activeTab === 'earnings' 
                              ? 'bg-secondary text-primary shadow-lg scale-105' 
                              : 'text-white/80 hover:text-white hover:bg-white/10 bg-secondary/10 border border-secondary/20'
                          }`}
                        >
                          <DollarSign className="h-5 w-5" />
                          <span className="hidden sm:inline">Earnings</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                          value="addons" 
                          className={`relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium snap-start ${
                            activeTab === 'addons' 
                              ? 'bg-secondary text-primary shadow-lg' 
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Package className="h-4 w-4" />
                          <span className="hidden sm:inline">Add-ons</span>
                        </TabsTrigger>
                        
                        <TabsTrigger 
                          value="availability" 
                          className={`relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium snap-start ${
                            activeTab === 'availability' 
                              ? 'bg-secondary text-primary shadow-lg' 
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Calendar className="h-4 w-4" />
                          <span className="hidden sm:inline">Schedule</span>
                        </TabsTrigger>
                      </>
                    )}
                    

                    

                  </TabsList>
                </div>
              </div>

              <div className="p-6">
                <TabsContent value="profile" className="mt-0">
                  {user?.role === 'barber' ? (
                    <EnhancedBarberProfileSettings onSave={loadSettingsData} />
                  ) : (
                    <ProfileSettings onUpdate={loadSettingsData} />
                  )}
                </TabsContent>

                {user?.role === 'barber' && (
                  <>
                    <TabsContent value="services" className="mt-0">
                      <ServicesSettings onUpdate={loadSettingsData} />
                    </TabsContent>
                    
                    <TabsContent value="addons" className="mt-0">
                      <AddonsSettings onUpdate={loadSettingsData} />
                    </TabsContent>
                    
                    <TabsContent value="availability" className="mt-0">
                      <div className="space-y-6">
                        <AvailabilityManager barberId={barberId} onUpdate={loadSettingsData} />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="earnings" className="mt-0">
                      <div className="space-y-6">
                        <div className="text-center space-y-2">
                          <h2 className="text-2xl font-bebas font-bold text-white">Earnings & Payments</h2>
                          <p className="text-white/60 font-pacifico">Track your earnings and manage payments</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <EarningsDashboard barberId={barberId} />
                          <PaymentHistory barberId={barberId} />
                        </div>
                      </div>
                    </TabsContent>
                  </>
                )}
                

                

              </div>
            </Tabs>
          </Card>
        </div>
      </div>
      {/* Logout Button at the bottom */}
      <div className="container max-w-6xl mx-auto px-4 mt-8 mb-8 flex justify-center relative z-10">
        <Button
          onClick={async () => {
            try {
              await logout();
              toast({
                title: 'Logged out',
                description: 'You have been logged out successfully.',
                variant: 'success',
              });
              safePush('/login');
            } catch (error) {
              toast({
                title: 'Logout failed',
                description: 'There was a problem logging out. Please try again.',
                variant: 'destructive',
              });
            }
          }}
          className="w-full max-w-md bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl shadow-lg py-3 text-lg"
        >
          Log Out
        </Button>
      </div>
    </div>
  )
} 