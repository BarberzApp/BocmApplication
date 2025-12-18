import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { calculateFeeBreakdown } from '@/shared/lib/fee-calculator'
import { logger } from '@/shared/lib/logger'

export const dynamic = 'force-dynamic'

// Type definitions
interface EarningsResponse {
  current: number
  previous: number
  trend: 'up' | 'down'
  percentage: number
  breakdown?: {
    serviceFees: number
    platformFees: number
    totalEarnings: number
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')

    if (!barberId) {
      return NextResponse.json({ error: 'Barber ID is required' }, { status: 400 })
    }

    // Validate barber ID format
    if (typeof barberId !== 'string' || barberId.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid Barber ID format' }, { status: 400 })
    }

    logger.debug('Fetching earnings for barber', { barberId })

    // Get current month's earnings
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    logger.debug('Date range for current month', {
      from: firstDayOfMonth.toISOString(),
      to: lastDayOfMonth.toISOString()
    })

    const { data: currentMonthData, error: currentError } = await supabase
      .from('bookings')
      .select('price, platform_fee, barber_payout')
      .eq('barber_id', barberId)
      .eq('payment_status', 'succeeded')
      .gte('created_at', firstDayOfMonth.toISOString())
      .lte('created_at', lastDayOfMonth.toISOString())

    if (currentError) {
      logger.error('Error fetching current month earnings', currentError)
      throw currentError
    }

    logger.debug('Current month bookings', { count: currentMonthData?.length || 0 })

    // Get previous month's earnings
    const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    logger.debug('Date range for previous month', {
      from: firstDayOfPrevMonth.toISOString(),
      to: lastDayOfPrevMonth.toISOString()
    })

    const { data: prevMonthData, error: prevError } = await supabase
      .from('bookings')
      .select('price, platform_fee, barber_payout')
      .eq('barber_id', barberId)
      .eq('payment_status', 'succeeded')
      .gte('created_at', firstDayOfPrevMonth.toISOString())
      .lte('created_at', lastDayOfPrevMonth.toISOString())

    if (prevError) {
      logger.error('Error fetching previous month earnings', prevError)
      throw prevError
    }

    logger.debug('Previous month bookings', { count: prevMonthData?.length || 0 })

    // Validate booking data
    if (!Array.isArray(currentMonthData) || !Array.isArray(prevMonthData)) {
      return NextResponse.json({ error: 'Invalid booking data format' }, { status: 500 })
    }

    // Validate prices in bookings
    const validatePrices = (bookings: any[]): boolean => {
      return bookings.every(booking => 
        booking && 
        typeof booking.price === 'number' && 
        booking.price >= 0
      )
    }

    if (!validatePrices(currentMonthData) || !validatePrices(prevMonthData)) {
      return NextResponse.json({ error: 'Invalid price data in bookings' }, { status: 500 })
    }

    // Calculate current month breakdown
    const currentBreakdown = currentMonthData?.reduce((acc, booking) => {
      const price = booking.price || 0
      const platformFee = booking.platform_fee || 0
      const barberPayout = booking.barber_payout || 0
      
      // If barber_payout is missing, calculate it based on price
      let calculatedBarberPayout = barberPayout
      if (!barberPayout && price > 0) {
        // Default calculation: barber gets 80% of service price (20% platform fee)
        calculatedBarberPayout = price * 0.8
      }
      
      logger.debug('Processing booking', { 
        price, 
        platformFee, 
        barberPayout, 
        calculatedBarberPayout 
      })
      
      return {
        serviceFees: acc.serviceFees + price,
        platformFees: acc.platformFees + platformFee,
        totalEarnings: acc.totalEarnings + calculatedBarberPayout
      }
    }, { serviceFees: 0, platformFees: 0, totalEarnings: 0 }) || { serviceFees: 0, platformFees: 0, totalEarnings: 0 }

    // Calculate previous month breakdown
    const prevBreakdown = prevMonthData?.reduce((acc, booking) => {
      const price = booking.price || 0
      const platformFee = booking.platform_fee || 0
      const barberPayout = booking.barber_payout || 0
      
      // If barber_payout is missing, calculate it based on price
      let calculatedBarberPayout = barberPayout
      if (!barberPayout && price > 0) {
        // Default calculation: barber gets 80% of service price (20% platform fee)
        calculatedBarberPayout = price * 0.8
      }
      
      return {
        serviceFees: acc.serviceFees + price,
        platformFees: acc.platformFees + platformFee,
        totalEarnings: acc.totalEarnings + calculatedBarberPayout
      }
    }, { serviceFees: 0, platformFees: 0, totalEarnings: 0 }) || { serviceFees: 0, platformFees: 0, totalEarnings: 0 }

    // Convert to cents for consistent API response
    const currentTotal = Math.round(currentBreakdown.totalEarnings * 100)
    const prevTotal = Math.round(prevBreakdown.totalEarnings * 100)

    logger.debug('Calculated totals', {
      currentTotal,
      prevTotal,
      currentBookings: currentMonthData?.length || 0,
      prevBookings: prevMonthData?.length || 0
    })

    const percentage = prevTotal === 0 ? 100 : ((currentTotal - prevTotal) / prevTotal) * 100

    const response: EarningsResponse = {
      current: currentTotal,
      previous: prevTotal,
      trend: currentTotal >= prevTotal ? "up" : "down",
      percentage: Math.abs(Math.round(percentage)),
      breakdown: {
        serviceFees: currentBreakdown.serviceFees * 100,
        platformFees: currentBreakdown.platformFees * 100,
        totalEarnings: currentBreakdown.totalEarnings * 100
      }
    }

    logger.debug('Sending response', { hasResponse: !!response })
    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error fetching earnings', error)
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
  }
}