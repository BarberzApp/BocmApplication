'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, Calendar, DollarSign, User, Clock, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { useToast } from '@/shared/components/ui/use-toast'
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner'
import { GlassyCard } from '@/shared/components/ui/glassy-card'
import { format } from 'date-fns'
import { logger } from '@/shared/lib/logger'

interface PaymentHistoryProps {
  barberId: string
}

interface PaymentRecord {
  id: string
  barber_id: string
  client_id: string | null
  service_id: string
  date: string
  status: string
  payment_status: string
  payment_intent_id: string
  price: number
  platform_fee: number
  barber_payout: number
  notes: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  created_at: string
  updated_at: string
  services: {
    id: string
    name: string
    description: string | null
    duration: number
    price: number
  } | null
  profiles: {
    id: string
    name: string
    email: string
  } | null
  payment_details: {
    id: string
    payment_intent_id: string
    amount: number
    currency: string
    status: string
    barber_stripe_account_id: string
    platform_fee: number
    barber_payout: number
    booking_id: string
    created_at: string
    updated_at: string
  } | null
}

interface PaymentHistoryResponse {
  payments: PaymentRecord[]
  totals: {
    totalRevenue: number
    totalPlatformFees: number
    totalBarberPayout: number
    totalBookings: number
  }
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

interface EarningsData {
  current: number
  previous: number
  trend: 'up' | 'down'
  percentage: number
}

export function PaymentHistory({ barberId }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [totals, setTotals] = useState<PaymentHistoryResponse['totals'] | null>(null)
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const { toast } = useToast()

  const loadPayments = async (pageNum: number = 0) => {
    try {
      setLoading(true)
      setError(null)

      const limit = 20
      const offset = pageNum * limit

      const response = await fetch(`/api/payments/barber-payments?barberId=${barberId}&limit=${limit}&offset=${offset}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch payments')
      }

      const data: PaymentHistoryResponse = await response.json()
      
      if (pageNum === 0) {
        setPayments(data.payments)
        setTotals(data.totals)
      } else {
        setPayments(prev => [...prev, ...data.payments])
      }

      setHasMore(data.payments.length === limit)
      setPage(pageNum)
    } catch (error) {
      logger.error('Error loading payments', error)
      setError(error instanceof Error ? error.message : 'Failed to load payments')
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load payment history',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadEarningsData = async () => {
    try {
      const response = await fetch(`/api/earnings/monthly?barberId=${barberId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch earnings')
      }
      
      const data = await response.json()
      setEarningsData(data)
    } catch (error) {
      logger.error('Error loading earnings data', error)
      // Don't show error toast for earnings data as it's secondary
    }
  }

  useEffect(() => {
    loadPayments()
    loadEarningsData()
  }, [barberId])

  const loadMore = () => {
    if (!loading && hasMore) {
      loadPayments(page + 1)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount) // Amount is already in dollars
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="glassy-secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Confirmed</Badge>
      case 'completed':
        return <Badge variant="glassy-secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Completed</Badge>
      case 'cancelled':
        return <Badge variant="glassy-secondary" className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading && payments.length === 0) {
    return (
      <GlassyCard className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl">
        <CardContent className="pt-6 flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size="md" text="Loading payment history..." />
        </CardContent>
      </GlassyCard>
    )
  }

  if (error && payments.length === 0) {
    return (
      <GlassyCard className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl">
        <CardContent className="pt-6">
          <div className="text-center text-red-400">
            <p>Error loading payment history: {error}</p>
            <Button 
              onClick={() => loadPayments()} 
              className="mt-4 bg-secondary hover:bg-secondary/90 text-primary font-semibold"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </GlassyCard>
    )
  }

  return (
    <GlassyCard className="bg-white/5 border border-white/10 shadow-xl backdrop-blur-xl rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary/20 rounded-full">
            <DollarSign className="h-5 w-5 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-bebas text-white tracking-wide">Payment History</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        {totals && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <GlassyCard variant="hover" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {earningsData?.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm text-white/60">Revenue Growth</span>
              </div>
              <div className={`text-2xl font-bold ${earningsData?.trend === "up" ? "text-green-400" : "text-red-400"}`}>
                {earningsData?.trend === "up" ? "+" : "-"}{earningsData?.percentage || 0}%
              </div>
              <div className="text-xs text-white/40">vs last month</div>
            </GlassyCard>
            <GlassyCard variant="secondary" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-secondary" />
                <span className="text-sm text-secondary font-medium">Total Payout</span>
              </div>
              <div className="text-2xl font-bold text-secondary">{formatCurrency(totals.totalBarberPayout)}</div>
            </GlassyCard>
            <GlassyCard variant="hover" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-white/60">Total Bookings</span>
              </div>
              <div className="text-2xl font-bold text-white">{totals.totalBookings}</div>
            </GlassyCard>
          </div>
        )}

        {/* Payment List */}
        <div className="space-y-4">
          {payments.map((payment) => (
            <GlassyCard key={payment.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-3 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white">
                      {payment.services?.name || 'Unknown Service'}
                    </h3>
                    {getStatusBadge(payment.status)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(payment.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTime(payment.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {payment.profiles?.name || payment.guest_name || 'Guest'}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{formatCurrency(payment.price)}</div>
                  <div className="text-sm text-secondary font-medium">
                    You earned: {formatCurrency(payment.barber_payout)}
                  </div>
                </div>
              </div>
              
              {payment.notes && (
                <div className="text-sm text-white/60 bg-white/5 rounded-lg p-3">
                  <strong className="text-white/80">Notes:</strong> {payment.notes}
                </div>
              )}
            </GlassyCard>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-6 text-center">
            <Button 
              onClick={loadMore} 
              disabled={loading}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}

        {!hasMore && payments.length > 0 && (
          <div className="mt-6 text-center text-white/60">
            No more payments to load
          </div>
        )}

        {payments.length === 0 && !loading && (
          <div className="text-center py-12 text-white/60">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-secondary/20 rounded-full">
                <DollarSign className="h-12 w-12 text-secondary/50" />
              </div>
            </div>
            <p className="text-lg font-semibold text-white mb-2">No payment history found</p>
            <p className="text-sm">Your completed bookings will appear here</p>
          </div>
        )}
      </CardContent>
    </GlassyCard>
  )
} 