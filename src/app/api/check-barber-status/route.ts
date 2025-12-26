import { NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get barber status
    const { data: barber, error } = await supabase
      .from('barbers')
      .select('id, user_id, business_name, stripe_account_id, stripe_account_status, updated_at')
      .eq('user_id', userId)
      .single()

    if (error) {
      logger.error('Error fetching barber', error)
      return NextResponse.json(
        { error: 'Failed to fetch barber status' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      barber: barber 
    })
  } catch (error) {
    logger.error('Error checking barber status', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check barber status' },
      { status: 500 }
    )
  }
} 