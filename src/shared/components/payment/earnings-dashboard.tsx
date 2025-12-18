"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { useToast } from "@/shared/components/ui/use-toast"
import { Loader2, DollarSign, TrendingUp, TrendingDown, CreditCard, Sparkles } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { LoadingSpinner } from "@/shared/components/ui/loading-spinner"
import { GlassyCard } from "@/shared/components/ui/glassy-card"
import { supabase } from "@/shared/lib/supabase"
import { logger } from "@/shared/lib/logger"

interface MonthlyEarnings {
  current: number
  previous: number
  trend: "up" | "down"
  percentage: number
  breakdown: {
    serviceFees: number
    platformFees: number
    totalEarnings: number
  }
}

interface BarberProfile {
  id: string
  profiles: {
    email: string
    name: string
  }
}

interface EarningsDashboardProps {
  barberId: string
}

export function EarningsDashboard({ barberId }: EarningsDashboardProps) {
  const { toast } = useToast()
  const [earnings, setEarnings] = useState<MonthlyEarnings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [hasStripeAccount, setHasStripeAccount] = useState(false)

  useEffect(() => {
    logger.debug('EarningsDashboard mounted', { barberId })
    loadEarnings()
    checkStripeAccount()
  }, [barberId])

  const checkStripeAccount = async () => {
    logger.debug('Checking Stripe account for barber', { barberId })
    try {
      // First, try to refresh the account status from Stripe
      const refreshResponse = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: barberId }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        logger.debug('Stripe account refresh result', { hasAccount: refreshData.success && refreshData.data.hasStripeAccount });
        
        if (refreshData.success && refreshData.data.hasStripeAccount) {
          setHasStripeAccount(true);
          return;
        }
      }

      // Fallback to checking the database directly
      const { data, error } = await supabase
        .from('barbers')
        .select('stripe_account_id')
        .eq('id', barberId)
        .single()

      if (error) {
        logger.error('Error fetching Stripe account', error)
        throw error
      }

      logger.debug('Stripe account check result', {
        hasAccount: !!data?.stripe_account_id,
        accountId: data?.stripe_account_id
      })
      setHasStripeAccount(!!data?.stripe_account_id)
    } catch (error) {
      logger.error('Error checking Stripe account', error)
    }
  }

  const loadEarnings = async () => {
    logger.debug('Loading earnings for barber', { barberId })
    setIsLoading(true)
    try {
      const response = await fetch(`/api/earnings/monthly?barberId=${barberId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch earnings')
      }
      
      const data = await response.json()
      logger.debug('Earnings data loaded', { hasData: !!data })
      
      // Validate the data structure
      if (!data || typeof data.current !== 'number') {
        throw new Error('Invalid earnings data received')
      }
      
      setEarnings(data)
    } catch (error) {
      logger.error("Error loading earnings", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load earnings data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupPayments = async () => {
    logger.debug('Starting payment setup for barber', { barberId })
    setIsSettingUp(true)
    try {
      // First, check if there's already a Stripe account and refresh its status
      const refreshResponse = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: barberId }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        
        if (refreshData.success && refreshData.data.hasStripeAccount) {
          // Update the local state to reflect the refreshed status
          setHasStripeAccount(true);
          
          if (refreshData.data.currentStatus === 'active') {
            toast({
              title: 'Stripe Account Active',
              description: 'Your Stripe account is already active and ready to accept payments!',
            });
            return;
          } else if (refreshData.data.currentStatus === 'pending') {
            toast({
              title: 'Account Pending',
              description: 'Your Stripe account is being reviewed. This usually takes 1-2 business days.',
            });
            return;
          }
        }
      }

      // Get barber's email and name
      logger.debug('Fetching barber details')
      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select(`
          id,
          profiles (
            email,
            name
          )
        `)
        .eq('id', barberId)
        .single() as { data: BarberProfile | null, error: any }

      if (barberError) {
        logger.error('Error fetching barber details', barberError)
        throw new Error(`Failed to fetch barber details: ${barberError.message}`)
      }

      if (!barber?.profiles?.email || !barber?.profiles?.name) {
        throw new Error('Barber email or name is missing')
      }

      logger.debug('Barber details fetched', {
        email: barber.profiles.email,
        name: barber.profiles.name
      })

      // Create Stripe Connect account
      logger.debug('Creating Stripe Connect account')
      const response = await fetch('/api/connect/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barberId,
          email: barber.profiles.email,
          name: barber.profiles.name,
        }),
      }).catch(error => {
        logger.error('Network error during fetch', error)
        throw new Error(`Network error: ${error.message}`)
      })

      if (!response) {
        throw new Error('No response received from server')
      }

      let responseData
      try {
        responseData = await response.json()
      } catch (error) {
        logger.error('Error parsing response', error)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        logger.error('Failed to create Stripe account', { error: responseData.error })
        throw new Error(responseData.error || 'Failed to create Stripe account')
      }

      const redirectUrl = responseData.url || responseData.accountLink
      if (!redirectUrl) {
        throw new Error('No redirect URL received from Stripe')
      }

      logger.debug('Stripe account created, redirecting', { redirectUrl })
      window.location.href = redirectUrl
    } catch (error) {
      logger.error('Error setting up payments', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set up payments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleAccessDashboard = async () => {
    logger.debug('Accessing Stripe dashboard for barber', { barberId })
    try {
      const response = await fetch('/api/connect/create-dashboard-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barberId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to access Stripe dashboard')
      }

      if (!data.url) {
        throw new Error('No dashboard URL received')
      }

      window.location.href = data.url
    } catch (error) {
      logger.error('Error accessing Stripe dashboard', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to access Stripe dashboard. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    logger.debug('Loading state active')
    return (
      <GlassyCard className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl">
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size="md" text="Loading earnings..." />
        </CardContent>
      </GlassyCard>
    )
  }

  logger.debug('Rendering dashboard with state', {
    hasStripeAccount,
    isSettingUp,
    hasEarnings: !!earnings
  })

  return (
    <GlassyCard className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl min-h-[400px]">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-secondary/20 rounded-full">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-bebas text-white tracking-wide">Monthly Earnings</CardTitle>
        </div>
        <CardDescription className="text-white/80">Your earnings breakdown for this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-8">
          {/* Main Earnings Display */}
          <div className="text-center space-y-4">
            <div className="relative">
              {/* Glowy background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 via-secondary/10 to-transparent rounded-2xl blur-xl" />
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
                <div className="text-5xl font-bebas font-bold text-secondary mb-2">
                  ${earnings?.current ? (earnings.current / 100).toFixed(2) : "0.00"}
                </div>
                <div className="flex items-center justify-center space-x-2">
                  {earnings?.trend === "up" ? (
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  )}
                  <Badge variant="secondary" className="text-xs bg-secondary/20 text-secondary border-secondary/30">
                    {earnings?.trend === "up" ? "+" : "-"}{earnings?.percentage}% from last month
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              <h3 className="text-lg font-semibold text-white">Earnings Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassyCard variant="hover" className="p-4 space-y-2">
                <div className="text-sm text-white/60">Service Fees</div>
                <div className="text-2xl font-bold text-white">
                  ${earnings?.breakdown?.serviceFees ? (earnings.breakdown.serviceFees / 100).toFixed(2) : "0.00"}
                </div>
                <div className="text-xs text-white/40">From haircut services</div>
              </GlassyCard>
              <GlassyCard variant="hover" className="p-4 space-y-2">
                <div className="text-sm text-white/60">Platform Fees</div>
                <div className="text-2xl font-bold text-white">
                  ${earnings?.breakdown?.platformFees ? (earnings.breakdown.platformFees / 100).toFixed(2) : "0.00"}
                </div>
                <div className="text-xs text-white/40">Processing fees</div>
              </GlassyCard>
            </div>
          </div>

          {/* Payment Setup Section */}
          {!hasStripeAccount && (
            <div className="text-center space-y-4 border-t border-white/10 pt-8">
              <GlassyCard className="p-6">
                <p className="text-white/80 mb-4">
                  Set up your payment account to start receiving payments
                </p>
                <Button
                  onClick={handleSetupPayments}
                  disabled={isSettingUp}
                  className="bg-secondary hover:bg-secondary/90 text-primary font-semibold shadow-lg"
                >
                  {isSettingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {isSettingUp ? "Setting up..." : "Set up payments"}
                </Button>
              </GlassyCard>
            </div>
          )}

          {/* Stripe Dashboard Access */}
          {hasStripeAccount && (
            <div className="text-center space-y-4 border-t border-white/10 pt-8">
              <GlassyCard className="p-6">
                <Button
                  onClick={handleAccessDashboard}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 font-semibold"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Access Stripe Dashboard
                </Button>
              </GlassyCard>
            </div>
          )}
        </div>
      </CardContent>
    </GlassyCard>
  )
}
