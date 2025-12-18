import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function GET(request: Request) {
  try {
    // Verify super admin access
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user || user.email !== 'primbocm@gmail.com') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      )
    }

    // Fetch comprehensive platform statistics
    const [
      { count: totalUsers },
      { count: totalBarbers },
      { count: totalClients },
      { count: disabledAccounts },
      { count: developers },
      { count: activeBookings },
      { data: revenueData }
    ] = await Promise.all([
      // Total users
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }),
      
      // Total barbers
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'barber'),
      
      // Total clients
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'client'),
      
      // Disabled accounts
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_disabled', true),
      
      // Developers
      supabase
        .from('barbers')
        .select('*', { count: 'exact', head: true })
        .eq('is_developer', true),
      
      // Active bookings
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'payment_pending']),
      
      // Revenue data
      supabase
        .from('bookings')
        .select('price, status')
        .in('status', ['confirmed', 'completed'])
    ])

    // Calculate total revenue
    const totalRevenue = revenueData?.reduce((sum, booking) => sum + (booking.price || 0), 0) || 0

    const stats = {
      totalUsers: totalUsers || 0,
      totalBarbers: totalBarbers || 0,
      totalClients: totalClients || 0,
      disabledAccounts: disabledAccounts || 0,
      developers: developers || 0,
      activeBookings: activeBookings || 0,
      totalRevenue: totalRevenue / 100 // Convert from cents to dollars
    }

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    logger.error('Super admin stats error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 